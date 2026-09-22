# Backlog: RDO Auto

> Lista priorizada de features **ainda não implementadas**, extraída do `roadmap.md`.
> Gerado em 03/09/2026. Revisado com o Igor em 03/09/2026 (itens removidos e lista renumerada).
>
> Importante: o roadmap estava desatualizado. Vários itens que ele marca como pendentes já
> foram implementados no código (ver seção "Já implementado" abaixo). Este backlog contém
> apenas o que realmente falta.

---

## Como ler

- **Prioridade**: Must / Should / Could / Later (MoSCoW), ou **Em avaliação** (ainda decidindo viabilidade).
- **Tamanho**: S (horas) / M (1 a 2 dias) / L (semanas). Estimativa grossa, revisar antes de começar.
- **Bloqueado por**: dependência externa (alguém precisa fornecer algo antes de começar).

---

## Já implementado (fora deste backlog)

Confirmado no código (`main.js`, `index.html`, `admin.html`, `README.md`):

- 1.1 Pré-preencher com RDO anterior (mesmo dia, turno oposto, ou dia anterior).
- 1.2 Pré-preencher por seção individual (Perfuração, Fluido, Equipe, Aprovação).
- 1.2b Seletor de itens da Coluna/BHA (dropdown com itens comuns + opção "Outro").
- 1.5 / 1.7 Operações: classificação (Normal / Não produtiva / Parada). *(A timeline colorida de 24h foi removida — decisão de 03/09/2026, ver "Decisões desta revisão".)*
- 1.6 Striplog com ROP automático (tabela metro a metro, cálculo de ROP, desvio colorido, virada de meia-noite).
- 2.3 Interface de revisão (aprovar / reabrir no admin), com fluxo simplificado rascunho → em_revisao → aprovado.
- 2.4 Log de revisão (quem/quando/ação/comentário) — campo JSONB `revisao_log` no RDO.
- 3.4 Notificações Telegram configuráveis (status de ativação + matriz de preferências por usuário/projeto).
- 4.2 Exportação CSV + PDF (cliente-side via jsPDF) + envio de PDF por e-mail (Resend, edge function `send-rdo-email`).
- Completação (aba): revestimento + pré-filtro + limpeza/desenvolvimento (compressor/bomba) + jateamento.
- Estoque auto-calculado (Químicos/Materiais com tipo Consumo/Reabastecimento).

---

## Backlog

### Resumo

| ID | Feature | Prioridade | Tamanho | Bloqueado por |
|----|---------|-----------|---------|---------------|
| B-01 | ~~Turno do RDO: dropdown Turno 1/2/3 dinâmico~~ ✅ Implementado | - | - | - |
| B-02 | ~~Log de revisão (quem/quando/ação/comentário)~~ ✅ Implementado | - | - | - |
| B-03 | Notificações in-app (badge + sino) | Could | M | PWA (B-05) |
| B-04 | Painel admin: visão agregada simplificada | Should | M | - |
| B-05 | PWA: service worker + cache do app shell | Em avaliação | L | Decisão de viabilidade |
| B-06 | Instalação nativa (manifest + splash) | Em avaliação | M | PWA (B-05) |
| B-07 | Resumo diário por IA (DeepSeek) | Later | L | - |
| B-08 | Aba Inventário + Equipamentos (estoque read-only) | Should | M | - |
| B-09 | Dropdown de diâmetros de broca (fração, ex.: 17 1/2") | Should | S | Lista completa de diâmetros da DH |
| B-10 | Sondas gerenciáveis (tabela `sondas` + CRUD no admin) | Could | M | - |

---

### Detalhes

#### B-01: Turno do RDO: dropdown dinâmico (roadmap 1.8) — ✅ Implementado

**Implementação**: coluna `rdos.turno` (INTEGER 1–3, opcional no beta) + dropdown "Turno" no formulário
(aba Equipe & Geral) com opções dinâmicas por `projetos.turnos_por_dia`. Admin ganha "3 turnos (8h cada)"
e campo "Turno 3 (nome)" (`projetos.supervisor_turno3`). Turno exibido na lista, nas views read-only e no PDF.

**Necessidade**: distinguir dois RDOs do mesmo projeto na mesma data (turnos diferentes).

**Critérios de aceite**:
- Dropdown "Turno" na aba "Equipe & Geral", abaixo de "Data do RDO".
- Opções dinâmicas baseadas em `projetos.turnos_por_dia` (1, 2 ou 3).
- Admin ganha opção "3 turnos (8h cada)" + campo de supervisor do Turno 3.
- Persistir turno no RDO (coluna `turno` inteiro, 1 a 3).
- Opcional durante o beta (sem `required`), obrigatório depois.
- Obs: hoje existe `projetos.turno` como texto livre ("07h x 17h") e `turnos_por_dia` só com 1/2 turnos. O design do roadmap ainda não foi aplicado.

---

#### B-02: Log de revisão (roadmap 2.4) — ✅ Implementado

**Implementação**: campo JSONB `revisao_log` no RDO (array de `{ acao, quem, user_id, quando, comentario }`).
Ações registradas: `enviado`, `aprovado`, `reaberto` (com comentário via prompt), `solicitou_reabertura` (com comentário).
Trilha exibida como tabela nas views read-only (`main.js` e `admin.html`), e o comentário de reabertura
aparece num banner no formulário de edição do colaborador.

**Necessidade**: saber quem revisou, quando, o que fez e o comentário.

**Critérios de aceite**:
- Tabela `revisoes` ou campo JSONB `revisao_log` no RDO.
- Cada ação registra: quem, quando, ação (revisado/reaberto), comentário.
- Comentário visível para o supervisor no RDO reaberto.

---

#### B-03: Notificações in-app (roadmap 3.1)

**Necessidade**: o geólogo vê pendências sem depender só do Telegram.

**Critérios de aceite**:
- Badge no header ("3 pendentes" para geólogo, "1 reaberto" para supervisor).
- Ícone de sino abre lista de notificações.
- Cada notificação linka direto para o RDO relevante.
- **Decisão do Igor**: só depois que virar PWA (ver B-05).

---

#### B-04: Painel admin: visão agregada simplificada (roadmap 4.1)

**Necessidade**: o gerente vê o acumulado por projeto sem abrir RDO a RDO.

**Critérios de aceite (versão simplificada)**:
- Por projeto: total perfurado, horas produtivas vs paradas, consumo acumulado de químicos.
- Filtros: projeto, data início/fim.
- **Decisão do Igor**: fazer uma versão simplificada primeiro; sem gráficos (ver item removido "Dashboard").

---

#### B-05: PWA: service worker + cache (roadmap 5.1)

**Necessidade**: abrir o app e o shell carregar rápido/offline.

**Critérios de aceite**:
- Cache do app shell (HTML, CSS, JS, logo).
- Dados cacheados via IndexedDB.
- **Status**: Igor avaliando o nível de dificuldade de implementar. Não começar antes dessa decisão.

---

#### B-06: Instalação nativa (roadmap 5.3)

**Necessidade**: instalar como app no Android/iOS.

**Critérios de aceite**:
- manifest.json completo com ícones.
- Splash screen nativa.
- Instalável como PWA.
- **Status**: mesma avaliação de viabilidade do B-05.

---

#### B-07: Resumo diário por IA (Fase 6)

**Necessidade**: resumo gerencial automático no fim do dia.

**Critérios de aceite**:
- System prompt com contexto de perfuração (ROP, BHA, fluido, nomenclatura).
- Output de 300 a 500 palavras, foco gerencial, anomalias em destaque.
- Edge Function + `pg_cron` diário às 20:00 lendo RDOs do dia.
- Envio para DeepSeek API (V4 Flash) e resumo via Telegram.

---

#### B-08: Aba Inventário + Equipamentos (Notas)

**Necessidade**: consultar o estoque atual na obra (read-only) sem abrir o RDO.

**Critérios de aceite**:
- Aba de consulta do estoque calculado (reabastecimento − consumo).
- Não controla entradas/saídas diretamente; o controle diário fica na aba Insumos.
- No fim do projeto, inventário digital confrontado com o físico, discrepâncias anotadas no RDO final.

---

#### B-09: Dropdown de diâmetros de broca (Notas)

**Necessidade**: substituir siglas (BR, NB, DC) por diâmetros nominais padronizados.

**Critérios de aceite**:
- **Campo fechado (dropdown), não texto livre**: o usuário escolhe de uma lista fixa, nunca digita.
  Isso elimina variações como 17 1/2", 17 1/2 ou 17 ½.
- Opções: 9 7/8", 12 1/4", 17 1/2", 18", 22", 17 3/4", Outro.
- **Formato em fração** (ex.: 17 1/2"), nunca decimal (17,5). Broca não é medida em valor contínuo.
- "Outro" só para diâmetro fora da lista; diâmetros novos entram no catálogo (mesmo padrão de B-10).
- **Bloqueado por**: lista completa de diâmetros usados pela DH.
- Obs: ponto de atrito conhecido para o Igor; resolver a representação em fração é parte do trabalho.

---

#### B-10: Sondas gerenciáveis (Notas)

**Necessidade**: adicionar equipamentos sem alterar código.

**Critérios de aceite**:
- Tabela `sondas` com CRUD no admin.
- Substituir o dropdown fixo (Cardwell, R4, A10, Tornep).
- Obs: hoje `newRig` é texto livre; sem catálogo.

---

## Removidos nesta revisão (com motivo)

| Item | Motivo da remoção |
|------|-------------------|
| Botão "Limpar formulário" (1.3) | Risco de clique acidental maior que a conveniência. |
| Template por tipo de projeto (1.4) | Só haverá RDO de perfuração; sem manutenção. |
| Status completos de aprovação (2.1) | Preciosismo; o fluxo atual (rascunho → em_revisao → aprovado) basta. |
| Papel de Geólogo distinto (2.2) | O geólogo responsável pela obra é o próprio supervisor; sem papel separado. |
| Push notifications (3.2) | Não precisamos. |
| Notificações por e-mail (3.3) | Difícil de implementar para ganho pequeno (por enquanto). |
| Dashboard com gráficos (4.3) | Outro produto futuro; intenção de conectar Power BI ao banco depois. |
| Offline-first / sincronização (5.2) | Simplificação: o programa só roda com internet. |
| Checklist de inspeção da Sonda (Notas) | Não foi pedido pelo cliente. |

---

## Decisões desta revisão que afetam outros arquivos

- **Timeline do "Registro de Atividades" removida**: a barra de segmentos coloridos (timeline de 24h)
  foi removida por ficar visualmente "zuada"; decidido simplesmente tirar em vez de consertar. A
  classificação das operações (Normal / Não produtiva / Parada / Parada Climática) foi mantida.
- **App online-only**: o programa só roda com internet. O `README.md` ainda diz "funciona offline para
  preenchimento", e o `roadmap.md` (Fase 5) ainda lista offline/PWA. Vale alinhar os dois depois.

---

## Fora do escopo deste backlog

- **Governança do banco** (roadmap, Notas): switch de superuser para publishable-key quando o primeiro
  cliente real entrar. É processo/operação, não feature de produto.
- **Custos de IA** (Fase 6.3): informação, não feature.

## Pendências conhecidas fora do roadmap

Itens decididos em `prioridades-tecnicas.md` que não estão no roadmap, para não perder de vista:

- **Input validation campo a campo** (prioritária, revisar campo a campo com o Igor).
- **Audit log** (`rdos_audit`): trigger aprovado, UI (filtros/paginação/diff) pendente.
- **Loading states / skeleton loaders** (aguardando explicação do conceito).
