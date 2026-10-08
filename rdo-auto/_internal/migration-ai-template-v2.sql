-- Adds the scope line to the default summary template.
--
-- Why: the summary used to count every non-deleted row, so a shift with an old
-- version left behind (`latest = false`) read as two shifts. The generator now
-- sends only the valid version of each shift, and the document must state its
-- own scope so the reader knows rows were filtered.

UPDATE public.ai_config
SET template_resumo = $tpl$# Resumo da obra {cliente} · Sonda {sonda}
> Projeto: {localidade} · Período coberto: {periodo}
> RDOs considerados: {total_rdos} (última atualização: {data_geracao})
> Fora do escopo: {rdos_excluidos} linha(s) em rascunho ou versão substituída

## Avanço físico
- Profundidade atual, fase do poço e metros avançados no período.

## O que aconteceu, por fase
- Blocos cronológicos por fase ou marco da obra, com datas.

## Equipe e logística
- Supervisores por turno, mobilizações, serviços de terceiros.

## Fluido, químicos e insumos
- Parâmetros do fluido, consumo, reabastecimento, intercorrências.

## HSE e intercorrências
- Incidentes, quase-acidentes, paradas por chuva ou por equipamento.

## Planejamento e pendências
- O que está previsto para os próximos turnos e o que ficou em aberto.

## Alertas de dados
- Campos nulos, datas sem RDO e divergências que dificultam a leitura.

## Resumo em uma frase
- O estado atual da obra em uma frase.
$tpl$,
    updated_at = now()
WHERE id = 1;

SELECT length(template_resumo) AS template_len FROM public.ai_config WHERE id = 1;
