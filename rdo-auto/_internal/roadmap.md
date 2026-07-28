# RDO Auto — Roadmap de Desenvolvimento

> Prioridades e fases planejadas. Ordem dentro de cada fase = sugestao, nao compromisso.

---

## Fase 1: Agora (experiencia de preenchimento)

Foco: reduzir o atrito de preencher RDOs diarios.

### 1.1 Pre-preencher com RDO de ontem

- Ao clicar "+ Novo RDO", buscar o RDO do dia anterior (`data = hoje - 1, status = enviado`) no mesmo projeto.
- Se encontrado, oferecer um banner no topo do formulario:
  > "Deseja pre-preencher com os dados de ontem (21/03)?"
  > [Pre-preencher tudo] [Comecar em branco]
- Se o usuario aceitar, popular:
  - `profundidade_inicial` ← `profundidade_final` de ontem
  - `brocas` (atual de ontem → anterior de hoje; atual fica em branco para preencher)
  - `coluna` ← copia integral de ontem
  - `equipe` ← copia integral
  - `aprovacao_*` ← copia integral
  - `fluido`, `quimicos`, `insumos`, `combustivel` ← copia (estoques mantidos)
  - `condicoes_climaticas` ← resetar para "Bom"
  - `operacoes` ← NAO copiar (cada dia tem as suas)
  - `hse_*` ← resetar (DDS e incidentes sao diarios)
  - `observacoes`, `planejamento` ← limpar
  - `fotos` ← NAO copiar
  - `data` ← hoje

### 1.2 Pre-preencher por secao individual

- Cada card do formulario ganha um mini-botao (icone ou texto pequeno):
  > "Copiar de ontem"
- Visivel apenas quando ha RDO do dia anterior disponivel.
- Ao clicar, preenche apenas aquela secao especifica com os dados de ontem.
- Secoes que suportam isso: Brocas, Coluna (BHA), Equipe, Fluido/Quimicos, Aprovacao.

### 1.2b Dropdown de pecas na Coluna (BHA)

- O campo "Item" da tabela de coluna hoje é texto livre. Isso causa inconsistência entre
  projetos (ex.: "DP 3 1/2" vs "DP 3.5" vs "DP 3,5 pol") e dificulta qualquer análise futura.
- Substituir por **dropdown** com opções pré-definidas de peças comuns:
  - DP (Drill Pipe) — 3 1/2, 4 1/2, 5
  - DC (Drill Collar) — 6 1/4, 8, 9 1/2
  - Estabilizador — 8 1/2, 12 1/4, 17 1/2
  - Sub, Cross-over, etc.
- Bloqueado por: falta de inventário formal das peças usadas nos projetos DH. Precisamos
  levantar com o Fernando quais peças compõem o parque de sondas atual.
- Quando implementado, o dropdown pode preencher automaticamente ID/OD padrão da peça,
  reduzindo ainda mais o preenchimento manual.

### 1.3 Botao "Limpar formulario"

- Ao lado de "Salvar Rascunho" / "Enviar RDO".
- Confirma via modal simples: "Tem certeza? Os dados nao salvos serao perdidos."
- Reseta o form para o estado inicial (com time de hoje, equipe padrao).

### 1.4 Template de RDO por tipo de projeto

- Ao criar um projeto, o usuario seleciona o tipo:
  - **Perfuracao de poco** — template completo atual (brocas, coluna, fluido, quimicos, parametros, etc.).
  - **Manutencao** — template reduzido (sem brocas, coluna, fluido, parametros; foco em operacoes, equipe, HSE, materiais).
- O tipo fica salvo na tabela `projetos` (coluna `tipo`).
- Ao abrir um RDO novo, as secoes exibidas dependem do `tipo` do projeto.
- Manutencao tipicamente envolve: troca de bomba, reparo de equipamento, limpeza de poco, teste de vazao.
- Campos especificos de manutencao (futuro): equipamento intervencionado, pecas trocadas, motivo da intervencao.

### 1.5 Operacoes: classificacao + timeline visual (✅ implementado)

### 1.6 Striplog — planilha de penetração a cada 2 metros

- Descoberto: os sondadores preenchem uma planilha paralela chamada "striplog"
  (`Boletim Diário de Perfuração.xlsx`) onde anotam a cada 2 metros:
  - **Penetração (min/2min)** — tempo para perfurar o intervalo
  - **Peso sobre Broca** (diam. pol)
  - **Parâmetros do fluido** — viscosidade, peso específico, pH
- Se preenchido corretamente, esse dado permite derivar automaticamente:
  - Profundidade inicial/final do dia
  - Metros perfurados e ROP por intervalo
  - Horas de operação da broca
  - Anomalias (quedas de ROP detectadas automaticamente)
  - Curva de performance da broca ao longo do projeto
- Impacto: **elimina ~30% dos campos do formulário atual** (profundidade,
  ROP, horas de operação, anomalias) e os substitui por dados derivados do striplog.
- Próximo passo: receber um striplog preenchido como exemplo e avaliar o esforço
  de digitalização. Possível implementação como uma nova aba "Striplog" no app,
  que alimenta automaticamente a seção de Perfuração do RDO.
- ✅ Exemplo preenchido recebido e analisado. Confirma: marcação metro a metro,
  tempo de perfuração é min/m (não min/2m). Paradas registradas como obs.
- **UX definida (aprovada, pendente de implementação):**
  - Header ganha tabs `[RDO] [Striplog]` quando formulário está ativo
  - Tab Striplog: tabela full-width com Prof. (m), Horário, Obs
  - Botão "+ Marcar metro" com auto-fill: profundidade = último valor + 1m, horário = agora
  - Primeira linha: checkbox "Início do turno" (marca quando começou a perfurar)
  - ROP ao vivo abaixo da tabela
  - RDO auto-populado no submit: depthInitial/DepthFinal do striplog, anomalias automáticas

### 1.7 Operacoes: classificacao + timeline visual (✅ implementado)

- Remover campo "Codigo" da tabela de operacoes (nao agrega valor no fluxo atual).
- Adicionar campo "Tipo" com 3 opcoes:
  - **Normal** (verde) — atividade produtiva (perfuracao, cimentacao, etc.)
  - **Nao produtiva** (amarelo) — atividade-meio necessaria (DDS, manutencao preventiva, deslocamento)
  - **Parada** (vermelho) — tempo ocioso por falha, clima, aguardando terceiros
- Conforme os intervalos sao preenchidos, renderizar abaixo da tabela uma **linha do tempo** horizontal:
  - Barra de 24h (00:00 a 24:00) com cada intervalo representado como um segmento colorido.
  - Visual estilo `O------------O` onde os `O` sao os marcadores de inicio/fim e o traco tem a cor do tipo.
  - Permite ao supervisor visualizar rapidamente a proporcao de horas produtivas vs paradas no dia.

---

## Fase 2: Workflow de Aprovacao

Foco: separar preenchimento (supervisor) de revisao (geologo).

### 2.1 Novos status

Substituir o enum atual `rascunho | enviado` por:

| Status | Significado | Quem pode transicionar |
|---|---|---|
| `rascunho` | Preenchimento em andamento | Supervisor |
| `em_revisao` | Enviado para revisao do geologo | Supervisor |
| `revisado` | Revisado e aprovado pelo geologo | Geologo |
| `reaberto` | Devolvido para ajustes pelo geologo | Geologo |
| `enviado` | (legado, migrar para em_revisao) | — |

### 2.2 Permissoes por papel

- **Supervisor**: cria RDO, edita rascunho, edita RDO reaberto, envia para revisao.
- **Geologo**: ve RDOs em revisao, aprova (→ revisado), reabre com comentarios (→ reaberto).
- **RDOs revisados**: somente leitura para ambos.

### 2.3 Interface de revisao

- Geologo ve uma lista separada: "Pendentes de revisao" (filtro `status = em_revisao`).
- Ao abrir um RDO em revisao, ve o formulario em modo leitura + um painel de acao:
  > [Aprovar] [Reabrir para ajustes]
- Ao reabrir, campo de texto obrigatorio: "Motivo do ajuste".
- O motivo fica visivel para o supervisor no RDO reaberto.

### 2.4 Comentarios de revisao

- Nova tabela `revisoes` ou campo JSONB `revisao_log` no RDO.
- Cada acao de revisao registra: quem, quando, acao (revisado/reaberto), comentario.

---

## Fase 3: Notificacoes

Foco: ninguem precisa avisar ninguem manualmente.

### 3.1 Notificacoes in-app

- Badge no header: "3 pendentes" para o geologo, "1 reaberto" para o supervisor.
- Lista de notificacoes acessivel por icone de sino no header.
- Cada notificacao linka direto para o RDO relevante.

### 3.2 Push notifications (browser)

- Service worker + Web Push API.
- Disparado quando: RDO enviado para revisao, RDO reaberto, RDO revisado.
- Permissao solicitada no primeiro uso.

### 3.3 Email (opcional, Supabase Edge Functions)

- Template simples: "RDO #123 do projeto Artesano foi enviado para revisao."
- Via `pg_net` ou Supabase Edge Function com `pg_cron`.
- Apenas se o usuario tiver email cadastrado no perfil.

---

## Fase 4: Admin & Analytics

Foco: visao gerencial dos dados acumulados.

### 4.1 Painel de admin

- Pagina separada (`admin.html`) com autenticacao.
- Visao agregada por projeto: total perfurado, horas produtivas vs paradas, consumo acumulado de quimicos.
- Filtros: projeto, data inicio/fim.

### 4.2 Exportacao

- CSV de RDOs filtrados (implementado no admin.html).
- PDF de RDO individual (para cliente ou fiscal):
  - Implementado com **ReportLab** (Python) — evita os problemas de HTML→PDF.
  - Layout replicando o BDO em papel: cabecalho com logo DH, dados do cliente,
    secoes com bordas (perfuracao, operacoes, HSE, etc.), fotos embutidas.
  - Gerado sob demanda no admin.html (botao "Exportar PDF" ao visualizar um RDO)
    ou em lote (todos os RDOs de um projeto em um unico PDF paginado).
  - Script: `rdo-auto/export_pdf.py` — recebe RDO ID via CLI e gera o PDF.

### 4.3 Dashboard

- Graficos (Chart.js): profundidade vs tempo (curva S), distribuicao de horas paradas (Pareto), consumo de quimicos acumulado.
- Metricas em tempo real: "Profundidade atual: 142.3 m", "Dias de atraso: 3".

---

## Fase 5: Offline-First & PWA Completo

Foco: funcionar sem internet na sonda.

### 5.1 Service Worker

- Cache do app shell (HTML, CSS, JS, logo).
- Dados cacheados via IndexedDB.

### 5.2 Sincronizacao offline

- RDOs criados offline ficam em fila local.
- Ao reconectar, sincroniza automaticamente com Supabase.
- Resolve conflitos: "ultimo a escrever vence" com aviso.

### 5.3 Instalacao nativa

- Manifest.json completo com icones.
- Tela de splash nativa.
- Instalavel como app no Android e iOS.

---

## Resumo visual

```
Fase 1 (MVP+)               Fase 2 (Workflow)      Fase 3 (Notif)      Fase 4 (Admin)       Fase 5 (Offline)
[pre-fill ontem]        →   [em_revisao]       →   [badge]         →   [dashboard]      →   [service worker]
[pre-fill secao]            [revisado]             [push]              [CSV/PDF (ReportLab)]  [sync offline]
[limpar form]               [reaberto]            [email]             [graficos]            [PWA install]
[template perf/manut]       [permissoes]
[timeline ops colorida]     [log revisao]
[BHA dropdown]
[striplog → auto ROP/depth]
```

---

## Notas

- **Supabase Auth** sera introduzido na Fase 2 (necessario para distinguir supervisor de geologo).
- **RLS** sera reabilitado na Fase 2 com politicas por papel.
- **Bucket de fotos** permanece publico ate que auth esteja implementado.
- A transicao de `enviado` para `em_revisao` requer migracao dos dados existentes (script SQL simples).
- **Sondas gerenciáveis**: atualmente as sondas sao um dropdown fixo (Cardwell, R4, A10, Tornep). Futuramente, criar tabela `sondas` com CRUD no admin para que novos equipamentos possam ser adicionados sem alterar o codigo.
- **Unificar insumos e outros_materiais**: atualmente sao duas secoes separadas no formulario (Insumos: agua, limpa fossa, etc.; Outros Materiais: itens diversos). Avaliar se devem ser unificados em uma unica tabela de consumo. O view do RDO ja mostra ambos separadamente com mensagens explicitas de vazio. Revisar apos feedback de campo.
- **Governanca do banco**: durante o desenvolvimento, o CodeWhale tem acesso superuser (via senha do Postgres) por conveniencia. Quando dados reais de cliente entrarem, faremos o switch: CodeWhale passa a usar apenas a publishable key (INSERT/SELECT), e operacoes de admin (DDL, DELETE, UPDATE) passam a ser feitas via scripts SQL que o Igor revisa e executa manualmente. Gatilho: primeiro cliente real no sistema ou solicitacao explicita do Igor.
