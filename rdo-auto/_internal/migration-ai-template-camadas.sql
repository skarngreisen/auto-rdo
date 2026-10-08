-- Reorganiza o template em duas camadas de leitura.
--
-- Camada 1, leitura essencial: o paragrafo de abertura (substitui o antigo
-- "Resumo em uma frase"), a etapa atual, a situacao atual, as pendencias e os
-- alertas. Quem le so isso entende onde a obra esta.
--
-- Camada 2, detalhamento de apoio: o que aconteceu por fase, equipe, fluido e
-- HSE. Sustenta as afirmacoes do topo com data e turno, e e a secao citada
-- quando alguem precisa defender o resumo numa reuniao.
--
-- O paragrafo de abertura tem teto de 900 caracteres, o que da 5 a 6 linhas em
-- tela de celular e cerca de 20 segundos de leitura.

UPDATE public.ai_config
SET template_resumo = $tpl$# Resumo da obra {cliente} · Sonda {sonda}
> Projeto: {localidade} · Período coberto: {periodo}
> RDOs considerados: {total_rdos} · Fora do escopo: {rdos_excluidos} (rascunho ou versão substituída)

## Resumo
- Um único parágrafo, entre 600 e 900 caracteres, com o retrato completo da
  obra: onde está, o que a trava ou a impulsiona, e o que vem pela frente.
- É a única parte que muita gente vai ler. Escreva para ser entendido sozinho.
- Sem listas, sem títulos internos, sem repetir o que está nas seções de baixo.

## Etapa atual da obra
- Dois a três parágrafos sobre onde a obra está, o que já ficou para trás e o
  que vem pela frente. Sem justificar a classificação e sem listar RDO.

## Situação atual
- Dois a três parágrafos com o retrato de agora: o que está andando, o que está
  parado e o que está pronto no canteiro.

## Pendências e próximos passos
- O que está pendente de decisão e o que está previsto para os próximos turnos.

## Alertas de dados
- Dias sem RDO durante etapa ativa, com as datas e a contagem.
- Divergência de turnos em relação ao esperado para a etapa, se houver.
- Campos vazios que atrapalham a leitura, no máximo em uma frase.
- No máximo três tópicos curtos. Nada de repetir o que já está nas outras seções.

## O que aconteceu, por fase
- Detalhamento do que foi feito, em blocos por fase da obra, com datas.
- Esta seção é o detalhamento de apoio: pode ser detalhada, e é daqui que sai a
  evidência que sustenta o que está no topo do documento.

## Equipe e logística
- Supervisores por turno, mobilizações, serviços de terceiros. Nomes, funções e
  datas de entrada e saída.

## Fluido, químicos e insumos
- Parâmetros do fluido, consumo, reabastecimento, intercorrências.

## HSE e intercorrências
- Incidentes, quase-acidentes, paradas por chuva ou por equipamento.
$tpl$,
    updated_at = now()
WHERE id = 1;

SELECT length(template_resumo) AS template_len FROM public.ai_config WHERE id = 1;
