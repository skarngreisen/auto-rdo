-- Ajusta o template para o novo tom: a etapa e deducao interna do modelo, nao
-- um argumento que ele apresenta ao leitor.
--
-- O texto anterior pedia "a evidencia que sustenta a conclusao", e o resultado
-- foi um resumo que tentava provar que tinha lido os RDOs, listando registros e
-- cobrando campos vazios que a fase da obra ainda nao produz. Um gestor
-- identifica a etapa em segundos; o resumo nao precisa demonstra-la.

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
- No máximo três tópicos curtos, só com o que atrapalha quem lê.

## Resumo em uma frase
- O estado atual da obra em uma frase.
$tpl$,
    updated_at = now()
WHERE id = 1;

SELECT length(template_resumo) AS template_len FROM public.ai_config WHERE id = 1;
