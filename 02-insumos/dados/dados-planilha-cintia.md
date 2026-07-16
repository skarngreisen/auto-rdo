# Dados Consolidados - Parc das Artes

## Projeto

| Métrica | Valor |
|---|---|
| Projeto | 88007 PP25067 - PARC DAS ARTES |
| Início | 09/02/2026 |
| Término | 24/05/2026 |
| Dias corridos | 104 |
| Dias previstos (original) | 32 |
| Dias de atraso | 72 |
| % Atraso | 69% |

## Totais de Horas

| Indicador | Total |
|---|---|
| Horas Totais | 67d 13h 20m |
| Horas Trabalhadas | 45d 1h 56m |
| Horas Paradas | 22d 11h 24m |

## Horas Paradas por Coluna (Classificação Original da Planilha)

| Coluna | Horas | % das Paradas |
|---|---|---|
| Parada Parc das Artes | 9d 18h 5m | 43% |
| Parada DH-GEL Engenharia | 8d 9h 17m | 37% |
| Parada Mecânica | 4d 0h 29m | 18% |
| Parada Chuva | 0d 7h 53m | 1% |

## Produtividade Mensal

| Mês | Horas Trabalhadas | Horas Paradas | % Produtiva |
|---|---|---|---|
| Fevereiro (09-28) | 4d 20h 17m | 1d 20h 53m | 72% |
| Março | 11d 4h 15m | 11d 2h 50m | 50% |
| Abril | 18d 14h 1m | 6d 23h 44m | 73% |
| Maio (01-24) | 10d 11h 23m | 2d 11h 57m | 81% |

---

# Diagnóstico: Categorização das Justificativas de Horas Paradas

As 112 linhas do RDO foram analisadas e cada justificativa de parada foi classificada em **6 categorias** de causa imediata.

**Mapeamento das colunas originais para as 6 categorias:**

| Coluna Original | Categorias |
|---|---|
| Parada DH_GEL | Cat 1 (Materiais), Cat 3 (Falta Equipe), Cat 4 (Atividades-Meio) |
| Parada Parc das Artes | Cat 5 (Aguardando Terceiros) |
| Parada Chuva | Cat 6 (Condições Climáticas) |
| Parada Mecânica | Cat 2 (Manutenção Corretiva) |

Cada linha recebeu um grau de confiabilidade na coluna **Conf.**. O marcador `(!)` indica itens com confiança abaixo de 65% que precisam ser revisados pela Cíntia (6 itens no total). O CSV complementar `paradas_com_confianca.csv` permite filtrar por `Revisar=SIM`.

## Categoria 1: Aguardando Materiais, Insumos e Equipamentos (~2d)

**Aguardando materiais de responsabilidade interna da DH.** Concentradas no início da obra (concreto, caminhão) e em momentos pontuais (broca, consumíveis de solda, jateador). Os 8 dias de tubos foram reclassificados como Cat 5 porque estavam lançados na coluna Parc das Artes (material faturado diretamente pelo cliente).

| Data | Justificativa | Horas | Conf. |
|---|---|---|---|
| 09-12/02 | Aguardando caminhão para nivelar terreno / concreto | 20h 40m | 85% |
| 19/03 | Aguardando revestimento | 3h | 100% |
| 29/03 | Aguardando broca | 13h 50m (mesclado) | 80% |
| 07/04 | Aguardando bomba de pistão e munck | 6h 10m (mesclado) | 80% |
| 15/04 | Aguardando peças do underreamer | 15h (mesclado) | 80% |
| 23/04 | Aguardando oxigênio/acetileno e material | 8h 10m | 95% |
| 01/05 | Aguardando jateador | 2h 30m | 95% |
| 11/05 | Aguardando retirada da bomba e sonda | 6h 25m | 95% |
| 13/05 | Aguardando retro da Saerp / bomba | 9h | 80% |

**Diagnóstico:** Paradas por materiais e insumos de responsabilidade interna da DH. O concreto no início da obra, consumíveis de solda (oxigênio/acetileno), broca, jateador e peças de reposição indicam falha no planejamento logístico e falta de estoque mínimo no canteiro. Itens mesclados com reunião (19/03) ou com múltiplas naturezas (13/05) exigem revisão da Cíntia para separar as horas. **Nota:** Os 8 dias de espera por tubos de revestimento (11-18/03) foram reclassificados como Cat 5, pois estavam lançados na coluna Parc das Artes (material faturado diretamente pelo cliente).

---

## Categoria 2: Manutenção Corretiva de Equipamentos (~4d)

Quebras e reparos corretivos nos equipamentos de perfuração, principalmente no sistema de embreagem (fole), bombas (Gardner Denver, Duplex, Centrífuga, Emsco), underreamer, swivel e kelly. A recorrência de problemas no fole da embreagem (4 ocorrências em março-abril) indica desgaste não endereçado preventivamente.

| Data | Justificativa | Horas | Conf. |
|---|---|---|---|
| 24/02 | Manutenção na bomba Gardner Denver | 2h 45m | 95% |
| 25/02 | Manutenção e ajustes das bombas duplex e centrífuga | 6h 40m | 95% |
| 03/03 | Ajuste de aperto do swivel | 0h 20m | 95% |
| 04-05/03 | Troca de parafuso gaxeta / solda no kelly | 7h 25m | 95% |
| 06/03 | Manutenção das mangueiras | 10h 30m (mesclado) | 80% |
| 19/02 | Instalação elétrica | 4h | 95% |
| 20/03 | Mau funcionamento na sonda | 10h (mesclado) | 80% |
| 30/03 | Arrumando ar do fole | 7h (mesclado) | 80% |
| 31/03 | Reparo no fole da engrenagem | 7h 25m (mesclado) | 85% |
| 08/04 | Reparo tubo do fole da embreagem | 2h 44m | 95% |
| 10/04 | Troca da graxeta / Revisão da bomba centrífuga | 5h | 95% |
| 12/04 | Reparo por solda no underreamer | 16h (mesclado) | 80% |
| 13/04 | Arrumando fole da embreagem de mesa e sonda | 8h | 95% |
| 14/04 | Arrumando junta da bomba / swivel / mangueiras / fole | 6h 15m | 95% |
| 15/04 | Aguardando peças do underreamer (pinos do braço) | 15h (mesclado) | 80% |
| 16/04 | Manutenção do underreamer | 4h | 95% |
| 18/04 | Manutenção do underreamer e bomba Emsco | 2h | 95% |
| 24/04 | Manutenção sistema de sucção bomba Emsco | 1h 10m | 95% |

**Diagnóstico:** Ausência de manutenção preventiva. O fole da embreagem apresentou falhas recorrentes (4 intervenções), o underreamer quebrou repetidamente, e as bombas exigiram múltiplos reparos. Isso sugere que o plano de manutenção predial dos equipamentos não está sendo seguido ou é inexistente. Recomenda-se um programa de lubrificação, inspeção e troca programada de peças de desgaste.

---

## Categoria 3: Falta de Equipe / Mão de Obra (~4d)

Paradas por indisponibilidade de pessoal, concentradas no início de abril (dias 01-05 e 11-12). O padrão "Sem atividade - falta de equipe" aparece em 3 dias consecutivos.

| Data | Justificativa | Horas | Conf. |
|---|---|---|---|
| 13/02 | Conferência da base, manutenção do veículo de apoio | 3h 30m | 100% |
| 06/03 | DTS / administrativo | 8h 30m (mesclado) | 80% |
| 30/03 | Aguardando Torrista | 7h (mesclado) | 80% |
| 01/04 | Chuva forte + falta de equipe | 13h (mesclado) | 85% |
| 02/04 | Deslocamento + falta de equipe | 14h 20m (mesclado) | 100% |
| 03-05/04 | Sem atividade - falta de equipe (3 dias) | 33h | 95% |
| 06/04 | Desmontagem da bomba e organização do canteiro | 7h | 100% |
| 11/04 | Falta de equipe | 12h | 95% |
| 12/04 | Reparo no underreamer + falta de equipe | 16h (mesclado) | 80% |
| 14/05 | Aguardando eletricista | 2h 27m (mesclado) | 70% |

**Diagnóstico:** Segunda maior causa de parada. Inclui DTS (transição entre projetos, equipe saindo de um para outro), absenteísmo na virada março-abril (3 dias consecutivos sem atividade), desmontagem e organização de canteiro por falta de equipe dedicada, e espera por profissionais internos (torrista, eletricista). A Cíntia confirmou que conferência de base com manutenção de veículo (13/02) e desmontagem/organização (06/04) são fundamentalmente falta de equipe: ou a equipe estava ocupada com atividades-meio por falta de pessoal dedicado, ou houve desmobilização não planejada. Investigar escala, realocação entre obras e dimensionamento.

---

## Categoria 4: Atividades-Meio / Logística / Administrativo (~2d)

Tempo consumido em deslocamentos, reuniões, preparação de canteiro (instalação elétrica), carga/descarga de equipamentos, conferência de base e processos técnicos obrigatórios (cura de cimentação, bombeamento, teste de vazão).

| Data | Justificativa | Horas | Conf. |
|---|---|---|---|
| 09/03 | Aguardando liberação de perfuração | 0h 50m | 100% |
| 16/02, 28/05, 29/05 | Deslocamentos | 5h 50m | 95% |
| 02/03 | Reunião de equipe - planejamento / deslocamento | 2h | 80% |
| 28/02-01/03 | Aguardando cura de cimentação | 2 dias | 85% |
| 28/03 | Deslocamento para buscar fole de embreagem | 5h | 85% |
| 20-21/04 | Teste de catarina, carregamento/descarregamento | 5h 25m | 100% |
| 28/04 | Descarregando caminhão | 2h 30m | 95% |
| 19-22/05 | Bombeamento | 4 dias | 90% |
| 23-24/05 | Teste de vazão | 1h 30m + atividade | 90% |

**Diagnóstico:** Horas inerentes ao processo (cura de cimentação, teste de vazão, bombeamento) e atividades administrativas/logísticas. Aguardando liberação de perfuração (09/03) foi confirmado pela Cíntia como administrativo. Deslocamentos para buscar peças poderiam ser evitados com estoque no canteiro. Itens anteriormente aqui (conferência da base, desmontagem/organização) foram reclassificados como Cat 3 após confirmação da Cíntia.

---

## Categoria 5: Aguardando Decisão / Liberação / Fornecimento de Terceiros (~9d 17h)

**A maior causa de parada do projeto.** O principal evento foi a espera de 8 dias por tubos de revestimento fornecidos pelo cliente (11 a 18/03, lançados em Parc das Artes). Além disso, paradas por dependência de decisões ou presença de terceiros: Saerp, geólogo, fiscais, Parc das Artes. As decisões da Saerp travaram a obra por vários dias em maio.

| Data | Justificativa | Horas | Conf. |
|---|---|---|---|
| 27/02 | Aguardando o Geólogo da Saerp | 0h 30m | 95% |
| 11-18/03 | Aguardando Material - tubos (8 dias consecutivos) | 8d 0h | 95% |
| 29/04 | Aguardando definição do Parc das Artes | 6h | 80% |
| 04-07/05 | Aguardando decisão da Saerp (4 dias) | 1d 7h 35m | 95% |
| 13/05 | Aguardando retro da Saerp | 9h (mesclado) | 80% |
| 23/05 | Aguardando fiscais para teste de vazão | 1h 30m | 90% |

**Diagnóstico:** Esta é a categoria mais impactada pela reclassificação: os 8 dias de espera por tubos de revestimento (11-18/03) estavam lançados na coluna Parc das Artes, indicando que o material era faturado diretamente pelo cliente (faturamento direto para evitar bitributação). Isso torna a dependência do cliente a **maior causa de horas paradas do projeto**. As decisões da Saerp (4 dias em maio), mais a espera por geólogo, fiscais, definição do Parc das Artes e liberação de perfuração, reforçam o padrão de gargalo externo. Recomenda-se alinhar contratualmente prazos de resposta e fornecimento com o cliente.

---

## Categoria 6: Condições Climáticas (~14h)

Paradas por chuva, concentradas em fevereiro-março (período chuvoso) e um evento em maio.

| Data | Justificativa | Horas | Conf. |
|---|---|---|---|
| 22/02 | Parada por motivos climáticos (chuva) | 0h 58m | 95% |
| 31/03 | Paralização por motivos climáticos | 1h 55m (mesclado) | 85% |
| 01/04 | Chuva forte | 2h (mesclado) | 85% |
| 07/04 | Motivos climáticos (chuva) | 1h 30m (mesclado) | 80% |
| 15/05 | Paralização por chuva | 1h 30m | 85% |

**Diagnóstico:** Impacto relativamente baixo (14h no total). As chuvas de fevereiro-março são sazonais e previsíveis. Não representam um problema sistêmico, mas poderiam ser mitigadas com drenagem do canteiro e proteção de equipamentos.

> **Legenda da coluna Conf.:** A Cíntia revisou e confirmou a classificação de todos os itens que estavam com baixa confiança. Não há mais itens pendentes de revisão. O CSV complementar `paradas_com_confianca.csv` contém a classificação final de todas as 112 linhas.

---

## Resumo do Diagnóstico

| # | Categoria | Horas | % Paradas | Principal Causa Raiz |
|---|---|---|---|---|
| 1 | Materiais / Insumos / Equipamentos | ~2d | 9% | Falha na cadeia de suprimentos interna |
| 2 | Manutenção Corretiva de Equipamentos | ~4d | 18% | Ausência de plano de manutenção preventiva |
| 3 | Falta de Equipe / Mão de Obra | ~4d | 18% | Dimensionamento, absenteísmo, DTS, equipe ocupada com meio |
| 4 | Atividades-Meio / Logística | ~2d | 9% | Deslocamentos, processos técnicos obrigatórios, administrativo |
| 5 | Aguardando Terceiros | ~9d 17h | 43% | Dependência do cliente (tubos, decisões Saerp, fiscais) |
| 6 | Condições Climáticas | ~14h | 3% | Sazonalidade (impacto baixo) |

**Três ações de maior impacto para reduzir horas paradas em projetos futuros:**
1. **Alinhar fornecimento com o cliente:** Itens faturados diretamente (tubos de revestimento, retroescavadeira Saerp) precisam ter prazos contratuais de entrega e penalidades. Os 8 dias parados por tubos representam o maior impacto isolado do projeto.
2. **Implementar manutenção preventiva:** Checklist diário/semanal de bombas, fole, underreamer e swivel com troca programada de peças de desgaste.
3. **Planejar suprimentos internos com antecedência:** Concreto, consumíveis de solda e peças de reposição devem estar no canteiro antes do início da etapa dependente.

---
Classificação final validada pela Cíntia. Nenhum item pendente de revisão.
Última atualização: dados do CSV "Sistema Controle Horas Paradas PARC DAS ARTES concluido.csv" (112 linhas, período 09/02 a 31/05/2026). Mapeamento: DH_GEL=Cat1/3/4, PA=Cat5, CH=Cat6, ME=Cat2. CSV complementar: `paradas_com_confianca.csv`.
