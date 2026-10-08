// ============================================================================
// Supabase Edge Function: ai-summary
// Deploy with: supabase functions deploy ai-summary
//
// Powers the "Resumo AI" feature in admin.html. Four actions:
//   list_keys   -> active API keys, WITHOUT the key value
//   save_key    -> register a key (provider derived from prefix or host)
//   delete_key  -> soft delete (deleted = true)
//   generate    -> incremental project summary via the selected key
//
// Auth: requires a real user JWT with role admin or supervisor.
// Secrets required: SB_URL, SB_SERVICE_KEY
//
// The user does NOT choose a model. They register an API key with a display
// name; this function derives the provider and applies a sensible default
// model for the provider.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SB_URL = Deno.env.get("SB_URL")!;
const SB_SERVICE_KEY = Deno.env.get("SB_SERVICE_KEY")!;

const admin = createClient(SB_URL, SB_SERVICE_KEY);

const TEMPLATE_VERSAO = 1;
const MAX_OUTPUT_TOKENS = 16000;

// Reasoning models spend output tokens on hidden reasoning before writing the
// answer, so a truncated reply (finish_reason = "length") with no visible text
// is a budget problem, not a provider fault. Retry once with more room.
const MAX_OUTPUT_TOKENS_FALLBACK = 32000;

// How long a single provider probe may take before it is considered failed.
const PROBE_TIMEOUT_MS = 6000;

// Fallback pricing when the provider row has no price data. USD per 1M tokens.
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  anthropic: { input: 3.0, output: 15.0 },
  openai_compat: { input: 0.14, output: 0.28 },
  gemini: { input: 0.1, output: 0.4 },
};

type Formato = "anthropic" | "openai_compat" | "gemini";

interface Provedor {
  id: string;
  rotulo: string;
  host: string;
  formato: Formato;
  probe_path: string;
  probe_header: "bearer" | "x-api-key" | "query";
  chat_path: string | null;
  model_default: string | null;
  suportado: boolean;
}

interface Body {
  action: string;
  key_id?: string;
  titulo?: string;
  api_key?: string;
  base_url?: string;
  provedor?: string;
  projeto_id?: string;
  force?: boolean;
  reset?: boolean;
}

// ── helpers ----------------------------------------------------------------

// The admin panel runs from a different origin (GitHub Pages, Azure Static Web
// Apps, or a local preview server), so every response needs CORS headers or the
// browser throws "Failed to fetch" without surfacing the real status.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// The browser sends OPTIONS before a POST that carries an Authorization header.
// Answering it is mandatory: a 405 here aborts the real request.
function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// ── provider registry -------------------------------------------------------

let provedoresCache: { rows: Provedor[]; at: number } | null = null;

async function loadProvedores(): Promise<Provedor[]> {
  // Cached for the lifetime of the isolate; the table changes rarely.
  if (provedoresCache && Date.now() - provedoresCache.at < 5 * 60 * 1000) {
    return provedoresCache.rows;
  }
  const { data, error } = await admin
    .from("ai_provedores")
    .select("id, rotulo, host, formato, probe_path, probe_header, chat_path, model_default, suportado")
    .order("ordem");

  if (error || !data) {
    throw new Error("provider_registry_unavailable: " + (error?.message || "no rows"));
  }
  provedoresCache = { rows: data as Provedor[], at: Date.now() };
  return data as Provedor[];
}

function provedorById(provedores: Provedor[], id: string | null | undefined): Provedor | null {
  if (!id) return null;
  return provedores.find((p) => p.id === id) || null;
}

/** Build the base URL of a provider. */
function baseUrlDe(p: Provedor): string {
  return "https://" + p.host;
}

/** The chat endpoint for a provider, honouring per-provider overrides. */
function chatUrl(p: Provedor): string {
  if (p.formato === "anthropic") return baseUrlDe(p) + "/v1/messages";
  if (p.formato === "gemini") {
    // Gemini puts the model and the key in the URL; the model is appended later.
    return baseUrlDe(p) + "/v1beta/models/";
  }
  return baseUrlDe(p) + (p.chat_path || "/chat/completions");
}

// ── empirical provider detection --------------------------------------------
//
// A key on its own cannot reveal its provider: prefixes are a convention that
// only some providers follow, and `sk-` is shared by several of them. So we ask
// the providers directly. Every candidate is probed in parallel and the first
// one that answers 200 with a key-shaped response wins.

function probeRequest(p: Provedor, apiKey: string): { url: string; headers: HeadersInit } {
  const url = baseUrlDe(p) + p.probe_path;

  if (p.probe_header === "query") {
    // Gemini takes the key as a query parameter.
    return {
      url: url + "?key=" + encodeURIComponent(apiKey),
      headers: { "content-type": "application/json" },
    };
  }
  if (p.probe_header === "x-api-key") {
    return {
      url,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    };
  }
  return {
    url,
    headers: {
      "content-type": "application/json",
      "Authorization": "Bearer " + apiKey,
    },
  };
}

async function probeProvider(p: Provedor, apiKey: string): Promise<{ ok: boolean; status: number; note?: string }> {
  const { url, headers } = probeRequest(p, apiKey);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const resp = await fetch(url, { method: "GET", headers, signal: ctrl.signal });
    return { ok: resp.ok, status: resp.status };
  } catch (e: any) {
    return { ok: false, status: 0, note: e?.name === "AbortError" ? "timeout" : "rede" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Some providers serve their model catalogue publicly and ignore the key
 * (OpenRouter did exactly that on /api/v1/models, answering 200 to a garbage
 * key). A 200 is therefore not proof that the key is valid. This second check
 * requires the same request WITHOUT the credential to fail, which only happens
 * when the endpoint actually enforces auth.
 */
async function probeRejectsAnon(p: Provedor): Promise<boolean> {
  const { url } = probeRequest(p, "");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    // Send no credentials at all, but keep the provider's expected header names
    // so the endpoint cannot answer "malformed request" instead of "no auth".
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (p.probe_header === "x-api-key") headers["x-api-key"] = "";
    if (p.probe_header === "bearer") headers["Authorization"] = "";

    const resp = await fetch(url, { method: "GET", headers, signal: ctrl.signal });
    return !resp.ok;
  } catch {
    // A network failure proves nothing, so do not disqualify the provider.
    return true;
  } finally {
    clearTimeout(timer);
  }
}

interface Deteccao {
  ok: boolean;
  provedor?: Provedor;
  tentados: { id: string; rotulo: string; ok: boolean; status: number; note?: string }[];
  suportados: { id: string; rotulo: string }[];
}

async function detectProvider(apiKey: string, provedores: Provedor[]): Promise<Deteccao> {
  const candidatos = provedores.filter((p) => p.suportado);
  const suportados = candidatos.map((p) => ({ id: p.id, rotulo: p.rotulo }));

  // Each candidate is probed twice in parallel: once with the key and once
  // without it. Only an endpoint that accepts the key AND rejects anonymous
  // access counts as a match.
  const resultados = await Promise.all(
    candidatos.map(async (p) => {
      const [comChave, semChave] = await Promise.all([
        probeProvider(p, apiKey),
        probeRejectsAnon(p),
      ]);
      const ok = comChave.ok && semChave;
      const note = comChave.ok && !semChave ? "endpoint publico, ignorou a chave" : comChave.note;
      return { p, ok, status: comChave.status, note };
    }),
  );

  const vencedor = resultados.find((r) => r.ok);
  const tentados = resultados.map((r) => ({
    id: r.p.id,
    rotulo: r.p.rotulo,
    ok: r.ok,
    status: r.status,
    note: r.note,
  }));

  if (!vencedor) return { ok: false, tentados, suportados };
  return { ok: true, provedor: vencedor.p, tentados, suportados };
}

/** Squeeze a JSONB section down to the data that matters for a summary. */
function clip(value: unknown, maxChars: number): unknown {
  if (value === null || value === undefined) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.length <= maxChars) return value;
  return text.slice(0, maxChars) + "…[truncado]";
}

function serializeRDO(r: Record<string, any>) {
  return {
    id: r.id,
    data: r.data,
    turno: r.turno,
    status: r.status,
    versao: r.version,
    tipo_dia: r.tipo_dia,
    profundidade_inicial: r.profundidade_inicial,
    profundidade_final: r.profundidade_final,
    formacao: r.formacao,
    topo: r.topo,
    base: r.base,
    hse_dds: r.hse_dds,
    hse_incidentes: r.hse_incidentes,
    hse_quase_acidentes: r.hse_quase_acidentes,
    hse_hh_expostas: r.hse_hh_expostas,
    hse_epis_vistoriados: r.hse_epis_vistoriados,
    condicoes_climaticas: r.condicoes_climaticas,
    chuva: r.chuva,
    observacoes: r.observacoes,
    planejamento_proximo_turno: r.planejamento_proximo_turno,
    estratigrafia_descricao: r.estratigrafia_descricao,
    revestimento_mudou: r.revestimento_mudou,
    revestimento_metros: r.revestimento_metros,
    revestimento_obs: r.revestimento_obs,
    sonda_horimetro: r.sonda_horimetro,
    operacoes: clip(r.operacoes, 4000),
    striplog: clip(r.striplog, 4000),
    equipe: clip(r.equipe, 1500),
    brocas: clip(r.brocas, 1200),
    coluna: clip(r.coluna, 2000),
    fluido: clip(r.fluido, 1200),
    quimicos: clip(r.quimicos, 1500),
    insumos: clip(r.insumos, 1500),
    combustivel: clip(r.combustivel, 1200),
    parametros: clip(r.parametros, 1500),
    outros_materiais: clip(r.outros_materiais, 1200),
    troca_oleo: clip(r.troca_oleo, 800),
  };
}

const SYSTEM_PROMPT = `Você é um geólogo de perfuração sênior da DH Consultoria, responsável por manter o "Resumo da obra" de cada projeto.

Contexto técnico que você domina e pode usar livremente:
- Fases de poço em polegadas (ex.: reabertura 28 1/2", perfuração 17 1/2", 12 1/4").
- ROP (taxa de penetração), BHA / coluna de perfuração, brocas, alargadores, sapatas e revestimento.
- Fluido de perfuração: densidade, viscosidade, filtrado, pH, gaxetas e bombas centrífugas.
- Nomenclatura de campo em português do Brasil, sem jargão de marketing.

EAP: as etapas de uma obra de perfuração, na ordem em que acontecem.
Toda obra da DH segue estas seis etapas. Use esta referência para situar a obra
e dizer o que se espera dela, mesmo quando os RDOs não nomeiam a etapa.

1. Pré-mobilização. Antes de a sonda chegar ao canteiro. Suprimentos comprados,
   equipamentos em manutenção e liberados, equipes integradas e treinadas,
   crachás e acessos liberados. Sinais no RDO: compra e entrega de material,
   manutenção de equipamento, integração e treinamento de pessoal, retirada de
   crachá, medições e levantamento de material. Marco de saída: prontidão
   operacional, quando suprimentos, equipamentos e equipes estão disponíveis.

2. Mobilização e montagem. A sonda vai para o campo e o canteiro é construído.
   Deslocamento de equipamento, obras civis do canteiro (caixaria, ferragem,
   concretagem do piso e da base), posicionamento dos pranchões, levantamento da
   torre, montagem do sistema de fluido (tanques, canaletas, bombas), ligação
   elétrica e aterramento. Sinais no RDO: caminhão munck e carretas
   descarregando, retroescavadeira, contêineres, gerador, montagem da torre e
   do mastro, sapata e alvenarias. Marco de saída: sonda montada e nivelada
   sobre a base, pronta para perfurar.

3. Perfuração. A sonda está operando e o poço avança. Perfuração rotativa,
   abertura ou reabertura com alargador, ROP, troca de broca, manobra de
   coluna, circulação de fluido, descida de revestimento intermediário e
   cimentação. Sinais no RDO: profundidade inicial e final, metros avançados,
   striplog com litologia, broca em uso, parâmetros de fluido, BHA montado.
   Esta é a etapa mais longa e costuma ter duas fases de diâmetro.

4. Completação. O poço ganha sua estrutura definitiva. Descida e instalação da
   coluna de revestimento final, pré-filtro, centralizadores, cimentação e cura.
   Sinais no RDO: revestimento descido e assentado, pré-filtro, sapata,
   cimentação. Cuidado: material de revestimento posicionado no canteiro NÃO é
   revestimento descido. Só conte como completação quando houver registro de
   descida e instalação.

5. Desenvolvimento. O poço é limpo e testado para entrar em operação.
   Jateamento, air-lift, bombeamento e teste de vazão, perfilagem ótica.
   Sinais no RDO: coluna de jateamento instalada e retirada, air-lift, conjunto
   motobomba, teste de vazão em horas, perfilagem.

6. Finalização. Encerramento da obra. Desmobilização (DTM de saída), retirada
   de equipamento e do canteiro, limpeza e entrega da área.

Como identificar a etapa atual (raciocínio interno):
- Determine a etapa mais avançada que tenha execução real registrada e USE essa
  conclusão para escrever. Não a apresente ao leitor.
- Você está falando com o gestor da obra, que já conhece as regras de perfuração
  e reconhece a etapa em segundos. Ele não precisa que você prove que leu os
  RDOs nem que justifique a classificação.
- Escreva a seção como uma leitura de situação feita por quem entende: em que
  ponto a obra está, o que já ficou para trás e o que vem agora.

O que é normal para cada etapa (não trate como problema):
- Enquanto a obra está nas etapas 1 e 2, é esperado que não existam profundidade
  perfurada, avanço de metro, ROP, parâmetros de fluido nem litologia. Essas
  informações só passam a existir na etapa 3. Falar em falta delas antes disso
  é ruído.
- Na etapa 3, a profundidade e o avanço passam a ser exigíveis e aí sim a
  ausência deles merece menção.
- O mesmo vale para revestimento (etapa 4), jateamento e vazão (etapa 5) e
  desmobilização (etapa 6): só são esperados quando a obra chega lá.

Cadência esperada de RDO, por etapa (use para interpretar ausências):
- O RDO é diário, sem folga de fim de semana. As obras rodam sete dias por
  semana, então sábado e domingo contam como qualquer outro dia. Um dia sem RDO
  durante uma etapa ativa é lacuna de registro, e deve ser sinalizado.
- Etapa 1, pré-mobilização: NÃO existe RDO. O fluxo começa quando a equipe se
  mobiliza para a obra. Nunca aponte ausência de RDO neste período, e não cobre
  RDO de pré-mobilização.
- Etapa 2, mobilização e montagem: RDO diário, UM turno por dia.
- Etapas 3 e 4, perfuração e completação: RDO diário, com DUAS equipes em
  turnos de 12 horas. É normal haver dois RDOs por dia, um por turno.
- Etapa 5, desenvolvimento: a equipe que opera a sonda é substituída por uma
  equipe de manutenção, que trabalha UM turno. Portanto o esperado volta a ser
  um RDO por dia, e dois no mesmo dia é que passa a ser incomum.
- Etapa 6, finalização: RDO diário durante a desmobilização.
- O campo turnos_por_dia do projeto é um cadastro genérico e nem sempre reflete
  a etapa corrente. Confie no que os RDOs mostram e na regra acima.

Como sinalizar ausência de RDO:
- Compare as datas dos RDOs com o período coberto e liste os dias sem registro.
  Use o campo dias_sem_rdo_no_periodo para não ter que deduzir isso do texto.
- Diga quantos dias ficaram sem RDO e quais, e apenas durante etapas ativas.
- Não afirme a causa da ausência. Você não sabe se a obra parou, se houve
  feriado ou se o RDO não foi lançado no sistema. Diga que o período está sem
  registro e deixe a conclusão para quem lê.
- Diferencie ausência de RDO (nenhum registro no dia) de RDO incompleto
  (registro existe, mas algum campo veio vazio). São problemas diferentes.

Regras de escrita obrigatórias:
- Português do Brasil, tom técnico e direto, como um relatório de obra.
- NUNCA use travessão (o caractere de traço longo). Use vírgula, dois-pontos, parênteses ou a palavra "e".
- Não invente dado nenhum. Se algo não consta, diga em uma frase e siga em frente. Não repita a mesma ausência em seções diferentes.
- Preserve a estrutura de seções do template fornecido, na mesma ordem e com os mesmos títulos.

Regra central desta tarefa: o resumo é INCREMENTAL.
- Você recebe um resumo anterior e um lote de RDOs novos.
- Reescreva o documento completo, incorporando o que é novo.
- PRESERVE os trechos já escritos quando eles continuarem verdadeiros.
- NUNCA apague informação antiga sem justificativa concreta.
- Atualize no lugar as seções de status (etapa atual, situação atual, alertas).
- Acrescente aos blocos por fase existentes, sem repetir o que já estava descrito.
- Devolva APENAS o markdown do resumo, sem comentário antes ou depois.

Escopo dos dados (uma frase, e só no fim do documento):
- Você recebe apenas a versão válida de cada turno, com status aprovado ou em revisão.
- O campo rdos_excluidos_do_resumo diz quantas linhas ficaram de fora por serem rascunho ou versão antiga de um RDO já substituído.
- Mencione esse escopo UMA vez, na seção de alertas, e apenas se rdos_excluidos_do_resumo for maior que zero. Não repita em outras seções.
- NUNCA trate uma data com dois turnos distintos como duplicidade: dois turnos no mesmo dia é operação normal.
- Duplicidade só existe quando dois registros têm o mesmo dia E o mesmo turno. Se isso aparecer, registre como alerta.

Tom e proporção do documento (isto define a qualidade do resumo):
- O resumo é sobre a OBRA, não sobre o preenchimento dos formulários. Escreva
  como um geólogo relatando a situação para outro geólogo, não como um auditor
  conferindo planilha.
- Não repita a mesma informação em seções diferentes. Cada fato aparece uma vez,
  no lugar onde faz mais sentido.
- Não mencione ausência de dado mais de uma vez em todo o documento. Se a falta
  de um campo atrapalha, diga em uma frase na seção de alertas e encerre o assunto.
- A seção de etapa atual da obra deve ter 2 a 3 parágrafos de leitura corrente.
  Sem justificar a classificação, sem listar RDO, sem repetir o que está em
  situação atual.
- A seção de "O que aconteceu, por fase" é o relato do que foi feito, em blocos
  por fase. Use parágrafos. Um item de lista com mais de duas linhas deveria ser
  um parágrafo.
- Use lista apenas quando o dado for naturalmente uma sequência de itens curtos,
  como equipe por turno ou insumos recebidos.
- A seção de alertas de dados é a menor do documento: no máximo três tópicos
  curtos, e apenas com o que realmente atrapalha quem lê.

O documento tem duas camadas de leitura:
- CAMADA DE LEITURA, no topo: Resumo, Etapa atual da obra, Situação atual,
  Pendências e próximos passos, Alertas de dados. Quem lê só esta parte precisa
  entender onde a obra está, o que a travou e o que vem. Escreva cada uma destas
  seções para se sustentar sozinha.
- CAMADA DE CONSULTA, embaixo: O que aconteceu por fase, Equipe e logística,
  Fluido e insumos, HSE e intercorrências. Serve a quem ficou com dúvida no topo
  e quer o detalhe por trás. É a evidência que sustenta as afirmações do resumo,
  e por isso pode ser detalhada, com data e turno. Não a trate como enfeite:
  numa reunião com o cliente é esta parte que vai ser citada.
- O topo NÃO repete o que está no detalhe. O detalhe NÃO repete as conclusões do
  topo. Cada camada faz o seu trabalho.

A seção Resumo (a abertura do documento):
- No máximo dois parágrafos, cada um de três a cinco linhas.
- NÃO conte caracteres, palavras ou linhas. Não tente acertar um tamanho
  específico e não revise o texto para conferir a extensão. Escreva os dois
  parágrafos bem construídos e encerre o assunto.
- É o que a maioria das pessoas vai ler, e muitas não passarão disso. Escreva
  para ser entendido sozinho, por alguém que não vai ler o resto.
- Deve conter: onde a obra está, o que está travando ou impulsionando, e o que
  vem pela frente. Nada além disso.
- Sem listas, sem subtítulos.
- Não repita o texto da Etapa atual nem o da Situação atual. O Resumo é a
  síntese, e as seções seguintes são o desdobramento dela.

Nunca gaste esforço medindo o próprio texto. Você não precisa conferir se o
documento está no tamanho certo, nem reescrever algo por causa disso. Se achar
que precisa revisar para ajustar tamanho, não revise: escreva bem uma vez e siga.`;

// ── auth -------------------------------------------------------------------

async function requireStaff(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { error: json({ erro: "Sessão ausente. Faça login novamente.", code: "no_token" }, 401) };
  }
  const { data: userData, error } = await admin.auth.getUser(token);
  if (error || !userData?.user) {
    return { error: json({ erro: "Sessão expirada. Faça login novamente.", code: "bad_token" }, 401) };
  }
  const user = userData.user;
  const { data: profile } = await admin
    .from("profiles")
    .select("role, name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || (profile.role !== "admin" && profile.role !== "supervisor")) {
    return { error: json({ erro: "Você não tem permissão para usar o resumo AI.", code: "forbidden" }, 403) };
  }
  return { user, profile };
}

// ── actions ----------------------------------------------------------------

async function listKeys() {
  const { data, error } = await admin
    .from("ai_api_keys")
    .select("id, titulo, provedor, base_url, created_at, last_used_at, last_error")
    .eq("deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    return json({ erro: "Não foi possível carregar as API keys.", code: "db_error", detail: error.message }, 500);
  }

  // Resolve the human label of each provider so the UI does not hardcode them.
  let mapa: Record<string, string> = {};
  try {
    const provedores = await loadProvedores();
    mapa = Object.fromEntries(provedores.map((p) => [p.id, p.rotulo]));
  } catch { /* labels are cosmetic; failing here must not break the list */ }

  const keys = (data || []).map((k) => ({ ...k, provedor_rotulo: mapa[k.provedor] || k.provedor }));
  return json({ keys });
}

async function saveKey(userId: string, body: Body) {
  const titulo = (body.titulo || "").trim();
  const apiKey = (body.api_key || "").trim();
  const baseUrlInput = (body.base_url || "").trim();

  if (!titulo) {
    return json({ erro: "Dê um nome para identificar esta API key.", code: "missing_titulo" }, 400);
  }
  if (!apiKey) {
    return json({ erro: "Cole a API key que você quer cadastrar.", code: "missing_key" }, 400);
  }
  if (apiKey.length < 12) {
    return json({ erro: "Essa API key parece curta demais. Confira se colou o valor completo.", code: "short_key" }, 400);
  }

  let provedores: Provedor[];
  try {
    provedores = await loadProvedores();
  } catch (e: any) {
    return json({ erro: "Não foi possível carregar a lista de provedores.", code: "registry_error", detail: e?.message }, 500);
  }

  // 1. Direct id passed by the UI (expert override) wins.
  let escolhido = provedorById(provedores, body.provedor);

  // 2. A base URL tells us the provider without spending any request.
  if (!escolhido && baseUrlInput) {
    let host = baseUrlInput.toLowerCase();
    try { host = new URL(host).host; } catch { /* keep raw */ }
    escolhido = provedores.find((p) => p.host && host.includes(p.host)) || null;
  }

  // 3. Otherwise ask the providers directly, in parallel.
  let deteccao: Deteccao | null = null;
  if (!escolhido) {
    deteccao = await detectProvider(apiKey, provedores);
    escolhido = deteccao.provedor || null;
  }

  if (!escolhido) {
    const lista = (deteccao?.suportados || []).map((p) => p.rotulo).join(", ");
    return json({
      erro: "Atualmente só suportamos estas API keys: " + lista + ". Contate o admin.",
      code: "provedor_nao_suportado",
      tentados: deteccao?.tentados || [],
      suportados: deteccao?.suportados || [],
    }, 400);
  }

  const payload = {
    titulo,
    api_key: apiKey,
    provedor: escolhido.id,
    base_url: baseUrlInput || null,
    model: null,
    created_by: userId,
    deleted: false,
    last_error: null,
  };

  const { data, error } = await admin
    .from("ai_api_keys")
    .insert(payload)
    .select("id, titulo, provedor, created_at")
    .single();

  if (error) {
    return json({ erro: "Não foi possível salvar a API key.", code: "db_error", detail: error.message }, 500);
  }

  return json({
    key: data,
    provedor_detectado: escolhido.id,
    provedor_rotulo: escolhido.rotulo,
    formato: escolhido.formato,
    tentados: deteccao?.tentados || [],
  });
}

async function deleteKey(keyId: string) {
  if (!keyId) {
    return json({ erro: "Selecione a API key que deseja remover.", code: "missing_key_id" }, 400);
  }
  const { data, error } = await admin
    .from("ai_api_keys")
    .update({ deleted: true })
    .eq("id", keyId)
    .eq("deleted", false)
    .select("id, titulo")
    .maybeSingle();

  if (error) {
    return json({ erro: "Não foi possível remover a API key.", code: "db_error", detail: error.message }, 500);
  }
  if (!data) {
    return json({ erro: "Essa API key já não estava cadastrada.", code: "not_found" }, 404);
  }
  return json({ removed: data });
}

async function callProvider(opts: {
  provedor: Provedor;
  apiKey: string;
  model: string;
  system: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<{ texto: string; inputTokens: number | null; outputTokens: number | null }> {
  const { provedor, apiKey, model, system, userPrompt } = opts;
  const maxTokens = opts.maxTokens || MAX_OUTPUT_TOKENS;

  if (provedor.formato === "anthropic") {
    const resp = await fetch(chatUrl(provedor), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    const raw = await resp.text();
    if (!resp.ok) {
      const err: any = new Error(`anthropic_http_${resp.status}`);
      err.status = resp.status;
      err.body = raw.slice(0, 600);
      throw err;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const err: any = new Error("resposta_invalida");
      err.status = 502;
      err.body = raw.slice(0, 600);
      throw err;
    }
    const texto = (parsed?.content || [])
      .filter((b: any) => b?.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();
    if (!texto) {
      const err: any = new Error("resposta_vazia");
      err.status = 502;
      err.body = JSON.stringify({
        stop_reason: parsed?.stop_reason,
        usage: parsed?.usage,
        model: parsed?.model,
      });
      throw err;
    }
    return {
      texto,
      inputTokens: parsed?.usage?.input_tokens ?? null,
      outputTokens: parsed?.usage?.output_tokens ?? null,
    };
  }

  // Gemini: model and key both live in the URL, and the payload shape differs.
  if (provedor.formato === "gemini") {
    const url = chatUrl(provedor) + model + ":generateContent?key=" + encodeURIComponent(apiKey);
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    });
    const raw = await resp.text();
    if (!resp.ok) {
      const err: any = new Error(`gemini_http_${resp.status}`);
      err.status = resp.status;
      err.body = raw.slice(0, 600);
      throw err;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const err: any = new Error("resposta_invalida");
      err.status = 502;
      err.body = raw.slice(0, 600);
      throw err;
    }
    const texto = (parsed?.candidates?.[0]?.content?.parts || [])
      .map((b: any) => b?.text || "")
      .join("")
      .trim();
    if (!texto) {
      const err: any = new Error("resposta_vazia");
      err.status = 502;
      err.body = JSON.stringify({
        finishReason: parsed?.candidates?.[0]?.finishReason,
        usage: parsed?.usageMetadata,
        model,
      });
      throw err;
    }
    return {
      texto,
      inputTokens: parsed?.usageMetadata?.promptTokenCount ?? null,
      outputTokens: parsed?.usageMetadata?.candidatesTokenCount ?? null,
    };
  }

  // openai_compat: DeepSeek, OpenAI, Qwen, Moonshot, Zhipu, Groq, OpenRouter,
  // Mistral and anything else that speaks the OpenAI shape.
  const resp = await fetch(chatUrl(provedor), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  const raw = await resp.text();
  if (!resp.ok) {
    const err: any = new Error(`openai_http_${resp.status}`);
    err.status = resp.status;
    err.body = raw.slice(0, 600);
    throw err;
  }
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const err: any = new Error("resposta_invalida");
    err.status = 502;
    err.body = raw.slice(0, 600);
    throw err;
  }
  const choice = parsed?.choices?.[0];
  const texto = (choice?.message?.content || "").trim();
  if (!texto) {
    const err: any = new Error("resposta_vazia");
    err.status = 502;
    err.body = JSON.stringify({
      finish_reason: choice?.finish_reason,
      usage: parsed?.usage,
      model: parsed?.model,
      tem_conteudo: Boolean(choice?.message?.content),
      tem_reasoning: Boolean(choice?.message?.reasoning_content),
    });
    throw err;
  }
  return {
    texto,
    inputTokens: parsed?.usage?.prompt_tokens ?? null,
    outputTokens: parsed?.usage?.completion_tokens ?? null,
  };
}

function providerErrorMessage(e: any, titulo: string): { erro: string; code: string; detail?: string } {
  const status = e?.status;
  if (status === 401 || status === 403) {
    return {
      erro: `A API key "${titulo}" foi recusada pelo provedor. Verifique se ela ainda é válida.`,
      code: "chave_recusada",
      detail: e?.body,
    };
  }
  if (status === 429) {
    return {
      erro: "O provedor está limitando requisições. Tente de novo em alguns minutos.",
      code: "rate_limit",
      detail: e?.body,
    };
  }
  if (status === 400 || status === 404) {
    return {
      erro: "O provedor recusou a requisição. Confira se a API key e o endpoint estão corretos.",
      code: "requisicao_recusada",
      detail: e?.body,
    };
  }
  if (e?.message === "resposta_vazia" || e?.message === "resposta_invalida") {
    return {
      erro: "Resposta inválida do provedor.",
      code: e.message,
      detail: e?.body,
    };
  }
  if (status >= 500) {
    return {
      erro: "O provedor não respondeu a tempo. O resumo anterior foi mantido.",
      code: "provedor_indisponivel",
      detail: e?.body,
    };
  }
  return {
    erro: "Não foi possível falar com o provedor. O resumo anterior foi mantido.",
    code: "falha_provedor",
    detail: e?.message,
  };
}

async function generate(userId: string, body: Body) {
  const keyId = body.key_id;
  const projetoId = body.projeto_id;
  const force = body.force === true;

  // "Regerar do zero": discard the previous text instead of using it as the base.
  // `force` keeps the previous summary as reference and only re-reads all RDOs;
  // `reset` throws the reference away, which is the only way the model can
  // rewrite the document in a new style.
  const reset = body.reset === true;

  if (!projetoId) return json({ erro: "Projeto não informado.", code: "missing_projeto" }, 400);
  if (!keyId) return json({ erro: "Escolha uma API key antes de gerar o resumo.", code: "missing_key_id" }, 400);

  // 1. Key
  const { data: key, error: keyErr } = await admin
    .from("ai_api_keys")
    .select("*")
    .eq("id", keyId)
    .eq("deleted", false)
    .maybeSingle();

  if (keyErr) {
    return json({ erro: "Não foi possível ler a API key.", code: "db_error", detail: keyErr.message }, 500);
  }
  if (!key) {
    return json({ erro: "Essa API key não está mais cadastrada. Escolha outra.", code: "key_not_found" }, 404);
  }

  // 2. Project
  const { data: projeto, error: projErr } = await admin
    .from("projetos")
    .select("id, cliente, localidade, sonda, data_inicio, turno, turnos_por_dia, supervisor_turno1, supervisor_turno2, supervisor_turno3")
    .eq("id", projetoId)
    .eq("deleted", false)
    .maybeSingle();

  if (projErr) {
    return json({ erro: "Não foi possível ler o projeto.", code: "db_error", detail: projErr.message }, 500);
  }
  if (!projeto) {
    return json({ erro: "Projeto não encontrado.", code: "projeto_not_found" }, 404);
  }

  // 3. RDOs that should feed the summary.
  // Only the valid version of each entry counts: editing an RDO creates a new
  // row and marks the previous one `latest = false`, so filtering on `deleted`
  // alone made one shift look like two. Drafts are excluded as well, since the
  // summary is a management view of what was actually submitted.
  const { data: rdos, error: rdoErr } = await admin
    .from("rdos")
    .select("*")
    .eq("projeto_id", projetoId)
    .eq("deleted", false)
    .eq("latest", true)
    .in("status", ["aprovado", "em_revisao"])
    .order("data", { ascending: true })
    .order("turno", { ascending: true, nullsFirst: true });

  if (rdoErr) {
    return json({ erro: "Não foi possível ler os RDOs do projeto.", code: "db_error", detail: rdoErr.message }, 500);
  }
  if (!rdos || rdos.length === 0) {
    return json({
      erro: "Nenhum RDO aprovado ou em revisão para este projeto. Rascunhos não entram no resumo.",
      code: "sem_rdos",
    }, 200);
  }

  // 4. Count what was left out, so the summary can state its own scope and the
  // reader does not assume the document covers every row in the database.
  const { count: totalLinhas } = await admin
    .from("rdos")
    .select("id", { count: "exact", head: true })
    .eq("projeto_id", projetoId)
    .eq("deleted", false);

  const excluidos = Math.max(0, (totalLinhas || 0) - rdos.length);

  // 5. Current cumulative summary
  const { data: prevRaw } = await admin
    .from("ai_resumos")
    .select("id, conteudo, rdo_ids, periodo_inicio, periodo_fim, rdos_cobertos, created_at")
    .eq("projeto_id", projetoId)
    .eq("deleted", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // On reset, the previous text is NOT passed to the model. Otherwise the old
  // wording and structure survive, which is exactly what a reset must avoid.
  const prev = reset ? null : prevRaw;
  if (reset && prevRaw) {
    await admin.from("ai_resumos").update({ deleted: true }).eq("id", prevRaw.id);
  }

  const coveredIds: string[] = reset
    ? []
    : (Array.isArray(prev?.rdo_ids) ? prev!.rdo_ids as string[] : []);
  const covered = new Set(coveredIds);
  const novos = force || reset ? rdos : rdos.filter((r) => !covered.has(r.id));

  // 5. Nothing new: do not spend a single token
  if (novos.length === 0) {
    const quando = prev?.created_at ? new Date(prev.created_at).toLocaleDateString("pt-BR") : null;
    return json({
      nada_novo: true,
      conteudo: prev?.conteudo || null,
      gerado_em: prev?.created_at || null,
      rdos_cobertos: prev?.rdos_cobertos || 0,
      mensagem: quando
        ? `Nenhuma novidade desde o resumo de ${quando}. O texto existente segue válido.`
        : "Nenhuma novidade desde o último resumo.",
    });
  }

  // 6. Template
  const { data: cfg } = await admin
    .from("ai_config")
    .select("template_resumo")
    .eq("id", 1)
    .maybeSingle();
  const template = cfg?.template_resumo ||
    "# Resumo da obra {cliente}\n## O que aconteceu\n## Resumo em uma frase";

  // 7. Period + prompt
  const datas = rdos.map((r) => r.data).filter(Boolean).sort();
  const periodoInicio = datas[0] || null;
  const periodoFim = datas[datas.length - 1] || null;

  const preenchido = template
    .replace(/\{cliente\}/g, projeto.cliente || "")
    .replace(/\{localidade\}/g, projeto.localidade || "")
    .replace(/\{sonda\}/g, projeto.sonda || "")
    .replace(/\{periodo\}/g, `${periodoInicio || "?"} a ${periodoFim || "?"}`)
    .replace(/\{total_rdos\}/g, String(rdos.length))
    .replace(/\{rdos_excluidos\}/g, String(excluidos))
    .replace(/\{data_geracao\}/g, new Date().toLocaleDateString("pt-BR"));

  const partes: string[] = [];

  // Calendar of coverage: which days have an RDO, how many shifts each, and
  // which days are missing inside the covered period. Computed here so the
  // model does not have to infer gaps from the RDO text, which it did poorly.
  const porDia: Record<string, number[]> = {};
  for (const r of rdos) {
    const d = String(r.data || "").slice(0, 10);
    if (!d) continue;
    porDia[d] = porDia[d] || [];
    porDia[d].push(r.turno === null || r.turno === undefined ? 0 : Number(r.turno));
  }
  const diasComRdo = Object.keys(porDia).sort();

  const diasSemRdo: string[] = [];
  if (periodoInicio && periodoFim && diasComRdo.length) {
    const fim = new Date(periodoFim + "T12:00:00Z");
    for (let t = new Date(periodoInicio + "T12:00:00Z"); t <= fim; t.setUTCDate(t.getUTCDate() + 1)) {
      const d = t.toISOString().slice(0, 10);
      if (!porDia[d]) diasSemRdo.push(d);
    }
  }

  const calendario = diasComRdo.map((d) => {
    const turnos = porDia[d];
    const preenchidos = turnos.filter((x) => x > 0);
    return {
      data: d,
      rdos: turnos.length,
      turnos: preenchidos.length ? preenchidos.sort() : "nao informado",
    };
  });

  const projetoInfo = {
    cliente: projeto.cliente,
    localidade: projeto.localidade,
    sonda: projeto.sonda,
    data_inicio: projeto.data_inicio,
    turno_padrao: projeto.turno,
    turnos_por_dia_cadastrado: projeto.turnos_por_dia,
    supervisores: [projeto.supervisor_turno1, projeto.supervisor_turno2, projeto.supervisor_turno3].filter(Boolean),
    total_rdos_considerados: rdos.length,
    rdos_excluidos_do_resumo: excluidos,
    criterio: "apenas a versao valida (latest) de cada turno, com status aprovado ou em revisao",
    periodo: periodoInicio + " a " + periodoFim,
    dias_sem_rdo_no_periodo: diasSemRdo,
    calendario_de_rdos: calendario,
  };

  partes.push("## Dados do projeto\n");
  partes.push(JSON.stringify(projetoInfo, null, 1));

  partes.push("\n## Template de saída obrigatório\n");
  partes.push(preenchido);

  if (prev?.conteudo) {
    partes.push("\n## Resumo anterior (base a preservar e atualizar)\n");
    partes.push(prev.conteudo);
  } else if (reset) {
    partes.push("\n## Resumo anterior\n");
    partes.push(
      "(REGERAÇÃO DO ZERO: existe um resumo anterior, mas ele foi descartado de "
      + "propósito porque usava um estilo antigo. Escreva o documento inteiro de "
      + "novo, seguindo apenas as regras deste prompt. NÃO tente preservar "
      + "formatação anterior, e não use lista de campos onde se pede parágrafo.)",
    );
  } else {
    partes.push("\n## Resumo anterior\n");
    partes.push("(não existe ainda; este é o primeiro resumo deste projeto)");
  }

  partes.push(`\n## RDOs novos a incorporar (${novos.length})\n`);
  partes.push(JSON.stringify(novos.map(serializeRDO)));

  const userPrompt = partes.join("\n");

  // 8. Call the provider
  let provedores: Provedor[];
  try {
    provedores = await loadProvedores();
  } catch (e: any) {
    return json({ erro: "Não foi possível carregar a lista de provedores.", code: "registry_error", detail: e?.message }, 500);
  }

  let provedor = provedorById(provedores, key.provedor);

  // Backfill: a key registered before detection existed, or with an empty
  // provider, gets identified now and the result is persisted.
  if (!provedor) {
    const d = await detectProvider(key.api_key, provedores);
    if (!d.ok || !d.provedor) {
      const lista = d.suportados.map((p) => p.rotulo).join(", ");
      return json({
        erro: "Atualmente só suportamos estas API keys: " + lista + ". Contate o admin.",
        code: "provedor_nao_suportado",
        tentados: d.tentados,
        suportados: d.suportados,
      }, 400);
    }
    provedor = d.provedor;
    await admin.from("ai_api_keys").update({ provedor: provedor.id }).eq("id", key.id);
  }

  const model = key.model || provedor.model_default || "deepseek-v4-flash";

  let result: { texto: string; inputTokens: number | null; outputTokens: number | null };
  try {
    result = await callProvider({
      provedor,
      apiKey: key.api_key,
      model,
      system: SYSTEM_PROMPT,
      userPrompt,
    });
  } catch (e: any) {
    // Reasoning models can burn the whole budget on hidden reasoning and return
    // no visible text. Give them one retry with a larger budget before failing.
    const truncado = e?.message === "resposta_vazia" &&
      String(e?.body || "").includes('"length"');
    if (truncado) {
      try {
        result = await callProvider({
          provedor,
          apiKey: key.api_key,
          model,
          system: SYSTEM_PROMPT,
          userPrompt,
          maxTokens: MAX_OUTPUT_TOKENS_FALLBACK,
        });
      } catch (e2: any) {
        const msg2 = providerErrorMessage(e2, key.titulo);
        await admin
          .from("ai_api_keys")
          .update({ last_error: `${msg2.code}: ${(e2?.body || e2?.message || "").slice(0, 400)}` })
          .eq("id", key.id);
        return json(msg2, 502);
      }
    } else {
      const msg = providerErrorMessage(e, key.titulo);
      await admin
        .from("ai_api_keys")
        .update({ last_error: `${msg.code}: ${(e?.body || e?.message || "").slice(0, 400)}` })
        .eq("id", key.id);
      return json(msg, 502);
    }
  }

  // 9. Persist
  const coveredAfter = Array.from(new Set([...coveredIds, ...novos.map((r) => r.id)]));
  const preco = PRICE_PER_MTOK[provedor.formato] || PRICE_PER_MTOK.openai_compat;
  const custo = (
    ((result.inputTokens || 0) / 1_000_000) * preco.input +
    ((result.outputTokens || 0) / 1_000_000) * preco.output
  );

  const { data: saved, error: saveErr } = await admin
    .from("ai_resumos")
    .insert({
      projeto_id: projetoId,
      conteudo: result.texto,
      template_versao: TEMPLATE_VERSAO,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      rdo_ids: coveredAfter,
      rdos_cobertos: coveredAfter.length,
      key_titulo: key.titulo,
      provedor: provedor.id,
      prompt_tokens: result.inputTokens,
      completion_tokens: result.outputTokens,
      custo_estimado_usd: Number.isFinite(custo) ? Number(custo.toFixed(6)) : null,
      created_by: userId,
    })
    .select("id, created_at")
    .single();

  if (saveErr) {
    // The summary is still useful to the user even if persistence failed.
    return json({
      projeto_nome: projeto.cliente,
      key_titulo: key.titulo,
      provedor: provedor.id,
      provedor_rotulo: provedor.rotulo,
      conteudo: result.texto,
      gerado_em: new Date().toISOString(),
      rdos_cobertos: coveredAfter.length,
      novos_rdos: novos.length,
      aviso: "O resumo foi gerado, mas não foi possível salvar o histórico no banco.",
      detail: saveErr.message,
    });
  }

  await admin
    .from("ai_api_keys")
    .update({ last_used_at: new Date().toISOString(), last_error: null })
    .eq("id", key.id);

  return json({
    resumo_id: saved.id,
    projeto_nome: projeto.cliente,
    key_titulo: key.titulo,
    provedor: provedor.id,
    provedor_rotulo: provedor.rotulo,
    base_url: baseUrlDe(provedor),
    conteudo: result.texto,
    gerado_em: saved.created_at,
    rdos_cobertos: coveredAfter.length,
    novos_rdos: novos.length,
    periodo_inicio: periodoInicio,
    periodo_fim: periodoFim,
    prompt_tokens: result.inputTokens,
    completion_tokens: result.outputTokens,
    custo_estimado_usd: Number.isFinite(custo) ? Number(custo.toFixed(6)) : null,
    incremental: Boolean(prev?.conteudo) && !force,
  });
}

// ── router -----------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // CORS preflight must be answered before any auth or body handling.
  if (req.method === "OPTIONS") {
    return preflight();
  }
  if (req.method !== "POST") {
    return json({ erro: "Método não permitido." }, 405);
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ erro: "Requisição inválida.", code: "invalid_json" }, 400);
  }

  const auth = await requireStaff(req);
  if ("error" in auth) return auth.error;
  const userId = auth.user!.id;

  try {
    switch (body.action) {
      case "list_keys":
        return await listKeys();
      case "save_key":
        return await saveKey(userId, body);
      case "delete_key":
        return await deleteKey(body.key_id || "");
      case "generate":
        return await generate(userId, body);
      default:
        return json({ erro: "Ação desconhecida.", code: "unknown_action" }, 400);
    }
  } catch (e: any) {
    return json({
      erro: "Não foi possível conectar ao serviço de resumo.",
      code: "internal_error",
      detail: e?.message,
    }, 500);
  }
});
