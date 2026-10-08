-- Adds the EAP stage reference to the summary template.
--
-- Why: the RDOs rarely fill the structured stage signals (revestimento_mudou,
-- pre_filtro_mudou, jateamento_mudou are empty in most projects) and the
-- operation `codigo` field is unused in practice. The stage therefore has to be
-- inferred from the free-text descriptions. This text gives the model the stage
-- vocabulary and the signs that identify each one, so the summary can say where
-- the well stands and what is expected next.
--
-- It lives in ai_config because the stages are the same for every drilling
-- project; only the schedule dates differ, and those are not part of the
-- summary's job.

UPDATE public.ai_config
SET template_resumo = $tpl$# Resumo da obra {cliente} · Sonda {sonda}
> Projeto: {localidade} · Período coberto: {periodo}
> RDOs considerados: {total_rdos} (última atualização: {data_geracao})
> Fora do escopo: {rdos_excluidos} linha(s) em rascunho ou versão substituída

## Etapa atual da obra
- Em que etapa da EAP a obra está, com a evidência que sustenta a conclusão.
- O que já foi concluído e o que caracteriza a etapa em curso.
- O que se espera da próxima etapa.

## Situação atual
- Dois a três parágrafos curtos com o retrato de agora: onde o poço está,
  o que está andando e o que está parado.

## O que aconteceu, por fase
- Blocos cronológicos por etapa da obra, com datas.

## Equipe e logística
- Supervisores por turno, mobilizações, serviços de terceiros.

## Fluido, químicos e insumos
- Parâmetros do fluido, consumo, reabastecimento, intercorrências.

## HSE e intercorrências
- Incidentes, quase-acidentes, paradas por chuva ou por equipamento.

## Pendências e próximos passos
- O que está pendente de decisão e o que está previsto para os próximos turnos.

## Alertas de dados
- Campos nulos, datas sem RDO e divergências que dificultam a leitura.

## Resumo em uma frase
- O estado atual da obra em uma frase.
$tpl$,
    updated_at = now()
WHERE id = 1;

SELECT length(template_resumo) AS template_len FROM public.ai_config WHERE id = 1;
