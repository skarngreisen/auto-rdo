# Lacunas do BDO Atual vs. BDO Ideal

> Baseado na analise do `RDOs Artesano.xlsx` (12 abas, 21/03 a 01/04/2026).

---

## Cobertura atual: ~70%

O BDO atual cobre bem o nucleo operacional de perfuracao (brocas, revestimentos, BHA, parametros,
fluido, consumiveis, horas), mas tem ausencias relevantes para um relatorio diario completo.

---

## Lacunas Detectadas

### 1. Fluido de Perfuracao: densidade (mud weight)

- **Situacao atual:** So tem Areia (%), API Cake e Solidos (%). Falta o parametro mais basico de controle de fluido.
- **O que falta:** Densidade (lb/gal ou ppg), Viscosidade Marsh (s/qt), Filtrado API (mL), pH.
- **Impacto:** Sem densidade, nao da para monitorar kick, perda de circulacao, ou estabilidade do poco.
- **Prioridade:** Alta

### 2. HSE / Seguranca

- **Situacao atual:** Zero campos de seguranca.
- **O que falta:**
  - DDS (Dialogo Diario de Seguranca) realizado? (Sim/Nao)
  - Incidentes no dia (checkbox ou texto)
  - Quase-acidentes relatados (texto livre)
  - Horas-homem expostas (numero)
  - EPIs vistoriados? (Sim/Nao)
- **Impacto:** Exigencia legal (NR-22, NR-31). Primeira coisa que fiscal pede em auditoria. Sem isso, o relatorio nao tem validade documental para orgaos reguladores.
- **Prioridade:** Alta

### 3. Campo narrativo aberto (Ocorrencias / Observacoes)

- **Situacao atual:** Nao existe. O que nao cabe nas celulas... se perde.
- **O que falta:** Um campo de texto livre para registro de anomalias, decisoes de campo,
  visitas de cliente/fiscal, conversas relevantes, imprevistos.
- **Impacto:** Essencial para rastreabilidade de decisoes e licoes aprendidas.
  Hoje a Cintia provavelmente preenche isso por fora (WhatsApp, e-mail, cabeca).
- **Prioridade:** Alta

### 4. Planejamento das proximas 24h

- **Situacao atual:** Nao existe.
- **O que falta:** Campo com a previsao do proximo turno (ex.: "Continuar perfuracao fase 8 1/2
  ate 350 m, revestir, cimentar").
- **Impacto:** Sem continuidade entre turnos, a troca de equipe depende de conversa informal.
- **Prioridade:** Media

### 5. Profundidade inicial do dia

- **Situacao atual:** So tem "Prof. final do dia (m)".
- **O que falta:** "Prof. inicial do dia (m)".
- **Impacto:** Sem a profundidade inicial, o campo "Perfurado (m)" (em Dados de Brocas)
  fica sem referencia cruzada para conferencia. Erro de digitacao passa batido.
- **Prioridade:** Media

### 6. Condicoes climaticas

- **Situacao atual:** Nao existe.
- **O que falta:** Chuva (Sim/Nao ou mm), Condicao geral (Bom/Ruim/Parado por clima).
- **Impacto:** Chuva ja e uma das 6 categorias de hora parada que a Cintia cataloga.
  Sem registro no BDO, a causa raiz da parada fica sem evidencia documental.
- **Prioridade:** Baixa

### 7. Equipe (estrutura formal)

- **Situacao atual:** Nomes soltos em celulas sem estrutura clara (Cassio, Laron).
- **O que falta:** Campo por funcao com nome: Sondador, Torrista, Plataformista/Auxiliar 1,
  Auxiliar 2, Coordenador/Consultor.
- **Impacto:** Rastreabilidade de quem estava em qual funcao no dia.
- **Prioridade:** Baixa

---

## Resumo

| # | Lacuna | Prioridade |
|---|--------|-----------|
| 1 | Densidade e viscosidade do fluido | Alta |
| 2 | HSE (DDS, incidentes, HH expostas) | Alta |
| 3 | Campo de observacoes (texto livre) | Alta |
| 4 | Planejamento proximas 24h | Media |
| 5 | Profundidade inicial do dia | Media |
| 6 | Condicoes climaticas | Baixa |
| 7 | Equipe estruturada por funcao | Baixa |

As 3 lacunas de prioridade alta sao indispensaveis para um BDO com validade operacional e legal.
