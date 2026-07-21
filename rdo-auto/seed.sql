-- ============================================================================
-- RDO Auto — Database Setup & Seed Data
-- Run this in the Supabase SQL Editor (https://fecskilrtsaeavoznwgi.supabase.co)
-- ============================================================================

-- 1. Create tables -----------------------------------------------------------

CREATE TABLE IF NOT EXISTS projetos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente     TEXT NOT NULL,
    localidade  TEXT NOT NULL,
    sonda       TEXT NOT NULL,
    data_inicio DATE NOT NULL,
    turno       TEXT NOT NULL DEFAULT '07h x 17h',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rdos (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id                UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    data                      DATE NOT NULL DEFAULT CURRENT_DATE,
    tipo_dia                  TEXT,                          -- e.g. 'perfuracao', 'montagem', 'teste', 'parado'

    -- Drilling
    profundidade_inicial      NUMERIC(10,2),
    profundidade_final        NUMERIC(10,2),

    -- Estratigrafia (event-based, not daily)
    estratigrafia_mudou       BOOLEAN DEFAULT false,        -- was there a stratigraphic change today?
    estratigrafia_profundidade NUMERIC(10,2),               -- depth at which the change occurred
    estratigrafia_descricao   TEXT,                          -- description of new stratigraphy

    -- Revestimento (event-based)
    revestimento_mudou        BOOLEAN DEFAULT false,
    revestimento_metros       NUMERIC(10,2),
    revestimento_obs          TEXT,

    -- Legacy columns (kept for backward compatibility)
    formacao                  TEXT,
    topo                      NUMERIC(10,2),
    base                      NUMERIC(10,2),

    -- HSE
    hse_dds                   BOOLEAN DEFAULT false,        -- DDS done?
    hse_incidentes            TEXT,                          -- incident description
    hse_quase_acidentes       TEXT,                          -- near-miss description
    hse_hh_expostas           NUMERIC(10,1),                 -- man-hours exposed
    hse_epis_vistoriados      BOOLEAN DEFAULT false,

    -- General
    observacoes               TEXT,                          -- free-text notes
    planejamento_proximo_turno TEXT,                         -- next shift plan
    condicoes_climaticas      TEXT,                          -- 'Bom', 'Chuva', 'Tempestade', etc.
    chuva                     BOOLEAN DEFAULT false,

    -- Approvals
    aprovacao_geologo         TEXT,
    aprovacao_ger_oper        TEXT,
    aprovacao_preposto1       TEXT,
    aprovacao_preposto2       TEXT,

    -- JSONB complex sections (only include keys that are filled)
    brocas          JSONB,    -- { atual: { fabricante, serie, diametro, modelo, jatos, perfurado, oper_hs, rop }, anterior: {...} }
    parametros_anomalias JSONB, -- [ { parametro, descricao } ] — event-based anomalies
    parametros      JSONB,    -- { med1: { peso, rpm, torque, rop, bba_ident, spm, pressao, vazao }, med2, med3 } (legacy)
    coluna          JSONB,    -- [ { item, qty, id_pol, od_pol, length_m, total_m } ]
    operacoes       JSONB,    -- [ { inicio, termino, codigo, descritivo } ]
    equipe          JSONB,    -- [ { funcao, nome } ]
    insumos         JSONB,    -- { agua, limpa_fossa, limpeza_banheiro, pta, munck, guindaste, remocao_cacamba }
    quimicos        JSONB,    -- { bentonita: {consumo,estoque}, cmc: {...}, soda_caustica: {...}, ... }
    combustivel     JSONB,    -- { diesel: {consumo, estoque} }
    outros_materiais JSONB,   -- { camisa_bomba, valvula, gaxeta_swivel, oleo_40, hexa_t }
    fluido          JSONB,    -- { densidade, viscosidade, filtrado, ph, agua_livre, areia, api_cake, solidos }

    -- Photos
    fotos           JSONB,    -- [ "url1", "url2", "url3" ]

    version         INT NOT NULL DEFAULT 1,
    latest          BOOLEAN NOT NULL DEFAULT true,
    status          TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('rascunho','enviado')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rdos_projeto_id ON rdos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_rdos_data ON rdos(data DESC);
CREATE INDEX IF NOT EXISTS idx_rdos_latest ON rdos(projeto_id, latest);

-- 2. Disable RLS for testing (REMOVE IN PRODUCTION) -------------------------

ALTER TABLE projetos DISABLE ROW LEVEL SECURITY;
ALTER TABLE rdos DISABLE ROW LEVEL SECURITY;

-- 3. Seed data ---------------------------------------------------------------

-- Project
INSERT INTO projetos (id, cliente, localidade, sonda, data_inicio, turno)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Artesano',
    'Ribeirao Preto - SP',
    'A10',
    '2026-03-20',
    '07h x 17h'
);

-- RDO 1: Normal drilling day (2026-03-21)
INSERT INTO rdos (
    id, projeto_id, data, tipo_dia,
    profundidade_inicial, profundidade_final, formacao, topo, base,
    hse_dds, hse_incidentes, hse_quase_acidentes, hse_hh_expostas, hse_epis_vistoriados,
    observacoes, planejamento_proximo_turno, condicoes_climaticas, chuva,
    aprovacao_geologo, aprovacao_ger_oper, aprovacao_preposto1, aprovacao_preposto2,
    brocas, parametros, coluna, operacoes, fluido, quimicos, insumos
) VALUES (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001',
    '2026-03-21', 'perfuracao',
    0.00, 45.50, 'Serra Geral', 0.00, 45.50,
    true, '', '', 72.0, true,
    'Dia produtivo, sem intercorrencias.', 'Continuar perfuracao ate 120 m; prever revestimento 8".',
    'Bom', false,
    'Murilo Pedro', 'Fernando', 'Carlos Garcia', 'Vivian Perissin',
    '{
        "atual": {"fabricante":"Baker","serie":"BKR-8821","diametro":"8.5","modelo":"IADC 517","jatos":"16-16-16","perfurado":45.5,"oper_hs":8,"rop":5.7},
        "anterior": {"fabricante":"","serie":"","diametro":"","modelo":"","jatos":"","perfurado":"","oper_hs":""}
    }'::jsonb,
    '{
        "med1": {"prof":"15.2","bba":"BBA-01","peso":4.5,"rpm":85,"torque":2.1,"spm":110,"pressao":2500,"vazao":3200},
        "med2": {"prof":"30.8","bba":"BBA-01","peso":5.0,"rpm":90,"torque":2.3,"spm":112,"pressao":2600,"vazao":3200},
        "med3": {"prof":"45.5","bba":"BBA-01","peso":5.2,"rpm":88,"torque":2.0,"spm":110,"pressao":2550,"vazao":3150}
    }'::jsonb,
    '[
        {"item":"DP 3 1/2","qty":4,"id_pol":"3.5","od_pol":"5.0","length_m":9.15,"total_m":36.6},
        {"item":"DC 6 1/4","qty":2,"id_pol":"6.25","od_pol":"8.0","length_m":9.15,"total_m":18.3},
        {"item":"Estabilizador 8 1/2","qty":1,"id_pol":"6.25","od_pol":"8.5","length_m":1.83,"total_m":1.83}
    ]'::jsonb,
    '[
        {"inicio":"07:00","termino":"09:30","codigo":"PERF-01","descritivo":"Perfuracao fase 8 1/2 de 0 a 25 m"},
        {"inicio":"09:30","termino":"10:00","codigo":"PAR-01","descritivo":"Parada para manutencao: troca de jato da broca"},
        {"inicio":"10:00","termino":"17:00","codigo":"PERF-02","descritivo":"Perfuracao fase 8 1/2 de 25 a 45.5 m"}
    ]'::jsonb,
    '{
        "densidade":9.2,"viscosidade":45,"filtrado":12.0,"ph":9.5,
        "agua_livre":0,"areia":1.5,"api_cake":2.0,"solidos":8.0
    }'::jsonb,
    '{
        "bentonita":{"consumo":150,"estoque":850},
        "cmc":{"consumo":25,"estoque":475},
        "soda_caustica":{"consumo":10,"estoque":190},
        "goma_xantana":{"consumo":0,"estoque":200},
        "sal":{"consumo":0,"estoque":500},
        "barrilha":{"consumo":5,"estoque":145}
    }'::jsonb,
    '{
        "agua":"-",
        "limpa_fossa":"-",
        "limpeza_banheiro":"-",
        "pta":"-",
        "munck":"-",
        "guindaste":"-",
        "remocao_cacamba":"-"
    }'::jsonb
);

-- RDO 2: Site setup day (2026-03-20) — no drilling, only operations + crew
INSERT INTO rdos (
    id, projeto_id, data, tipo_dia,
    hse_dds, hse_incidentes, hse_quase_acidentes, hse_hh_expostas, hse_epis_vistoriados,
    observacoes, planejamento_proximo_turno, condicoes_climaticas, chuva,
    aprovacao_geologo, aprovacao_ger_oper,
    operacoes
) VALUES (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000001',
    '2026-03-20', 'montagem',
    true, '', '', 48.0, true,
    'Montagem do canteiro concluida. Sonda posicionada, aguardando concreto para base.',
    'Iniciar perfuracao assim que o concreto curar (previsao 07h).',
    'Bom', false,
    'Murilo Pedro', 'Fernando',
    '[
        {"inicio":"07:00","termino":"09:00","codigo":"MONT-01","descritivo":"Descarga e posicionamento da sonda"},
        {"inicio":"09:00","termino":"12:00","codigo":"MONT-02","descritivo":"Montagem do BOP e linha de fluxo"},
        {"inicio":"13:00","termino":"17:00","codigo":"MONT-03","descritivo":"Concretagem da base e nivelamento"}
    ]'::jsonb
);

-- RDO 3: Stopped due to rain (2026-03-22)
INSERT INTO rdos (
    id, projeto_id, data, tipo_dia,
    hse_dds, hse_incidentes, hse_hh_expostas, hse_epis_vistoriados,
    observacoes, planejamento_proximo_turno, condicoes_climaticas, chuva,
    aprovacao_geologo, aprovacao_ger_oper, aprovacao_preposto1,
    operacoes
) VALUES (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000001',
    '2026-03-22', 'parado',
    true, 'Nenhum incidente registrado.', 16.0, true,
    'Chuva intensa durante toda a manha. Equipe realizou DDS e organizacao do almoxarifado. Tarde: chuva persistente, sem condicoes de operacao.',
    'Retomar perfuracao. Verificar acesso a estrada de terra (pode estar comprometido).',
    'Tempestade', true,
    'Murilo Pedro', 'Fernando', 'Carlos Garcia',
    '[
        {"inicio":"07:00","termino":"08:00","codigo":"PAR-02","descritivo":"DDS e inspecao de equipamentos"},
        {"inicio":"08:00","termino":"12:00","codigo":"PAR-03","descritivo":"Parado por chuva — organizacao do almoxarifado coberto"},
        {"inicio":"13:00","termino":"17:00","codigo":"PAR-04","descritivo":"Parado por chuva — sem condicoes de operacao"}
    ]'::jsonb
);

-- ============================================================================
-- 4. Storage bucket (must be created via Dashboard or API, not SQL)
--    Go to: Supabase Dashboard → Storage → New Bucket
--    Name: fotos
--    Public bucket: YES (so photos are accessible via URL)
--    Allowed MIME types: image/jpeg, image/png, image/webp
--    File size limit: 5 MB
-- ============================================================================

-- Verify seed
SELECT 'projetos' AS tabela, count(*) AS registros FROM projetos
UNION ALL
SELECT 'rdos', count(*) FROM rdos;
