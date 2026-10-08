-- A secao de alertas passa a cobrar cadencia de RDO por etapa, alem dos campos
-- vazios. A regra de expectativa (etapa, turnos, dias) vive no system prompt da
-- Edge Function; aqui fica apenas o que a secao deve conter.

UPDATE public.ai_config
SET template_resumo = $tpl$# Resumo da obra {cliente} · Sonda {sonda}
> Projeto: {localidade} · Período coberto: {periodo}
> RDOs considerados: {total_rdos} · Fora do escopo: {rdos_excluidos} (rascunho ou versão substituída)

## Etapa atual da obra
- Dois a três parágrafos sobre onde a obra está, o que já ficou para trás e o
  que vem pela frente. Sem justificar a classificação e sem listar RDO.

## Situação atual
- Dois a três parágrafos com o retrato de agora: o que está andando, o que está
  parado e o que está pronto no canteiro.

## O que aconteceu, por fase
- Relato do que foi feito, em blocos por fase da obra, com datas. Parágrafos,
  não lista de campos.

## Equipe e logística
- Supervisores por turno, mobilizações, serviços de terceiros.

## Fluido, químicos e insumos
- Parâmetros do fluido, consumo, reabastecimento, intercorrências.

## HSE e intercorrências
- Incidentes, quase-acidentes, paradas por chuva ou por equipamento.

## Pendências e próximos passos
- O que está pendente de decisão e o que está previsto para os próximos turnos.

## Alertas de dados
- Dias sem RDO durante etapa ativa, com as datas e a contagem.
- Divergência de turnos em relação ao esperado para a etapa, se houver.
- Campos vazios que atrapalham a leitura, no máximo em uma frase.
- No máximo três tópicos curtos. Nada de repetir o que já está nas outras seções.

## Resumo em uma frase
- O estado atual da obra em uma frase.
$tpl$,
    updated_at = now()
WHERE id = 1;

SELECT length(template_resumo) AS template_len FROM public.ai_config WHERE id = 1;
