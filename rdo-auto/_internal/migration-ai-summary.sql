-- ============================================================================
-- RDO Auto: AI Project Summary (backlog B-07, fase 6.4)
--
-- Creates the storage for AI-generated incremental project summaries and for
-- the user-supplied API keys that power them.
--
-- Design notes:
--   * ai_api_keys is LOCKED: RLS is enabled with NO policies and all privileges
--     are revoked from `authenticated` and `anon`. Only the `ai-summary` Edge
--     Function (service_role) can read it. The API key value never reaches the
--     browser, not even to an admin.
--   * The user does NOT pick a "model". They register an API key with a display
--     name; the provider is derived from the key prefix or the base URL host.
--   * ai_resumos keeps one cumulative summary per project. The "current" summary
--     is the most recent non-deleted row.
--
-- Run this in the Supabase SQL Editor (or via node _internal/run-sql.js).
--
-- Verified against the live schema on this migration's date:
--   rdos.turno            = INTEGER  (1 / 2 / 3, nullable)
--   rdos.parametros       = JSONB    (anomalies live here; there is no
--                                     `parametros_anomalias` column)
--   rdos.deleted          = BOOLEAN  (soft delete, plus deleted_at/deleted_by)
--   rdos.latest / version = BOOLEAN / INTEGER
--   projetos.deleted      = BOOLEAN
-- ============================================================================

-- 1. API keys ---------------------------------------------------------------
-- Locked table: no RLS policies at all, so every client-role read returns 403.

CREATE TABLE IF NOT EXISTS public.ai_api_keys (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo        TEXT NOT NULL,
    provedor      TEXT NOT NULL DEFAULT 'openai_compat'
                  CHECK (provedor IN ('anthropic', 'openai_compat')),
    api_key       TEXT NOT NULL,
    base_url      TEXT,
    model         TEXT,
    created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ,
    last_error    TEXT,
    deleted       BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.ai_api_keys ENABLE ROW LEVEL SECURITY;

-- No policies on purpose. Belt and suspenders: revoke everything explicitly.
REVOKE ALL ON public.ai_api_keys FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_api_keys TO service_role;

CREATE INDEX IF NOT EXISTS idx_ai_api_keys_active
    ON public.ai_api_keys (deleted, created_at DESC);

-- The `provedor` column holds an id from `ai_provedores` (created in
-- migration-ai-providers.sql). The earlier CHECK list of
-- ('anthropic','openai_compat') rejected every real provider id, so it is
-- replaced by a foreign key into the registry. See
-- migration-ai-provedores-fk.sql for the fix applied to existing databases.
ALTER TABLE public.ai_api_keys DROP CONSTRAINT IF EXISTS ai_api_keys_provedor_check;

-- 2. Summaries --------------------------------------------------------------
-- One cumulative summary per project. Readable by admin/supervisor so the UI
-- can show the timeline; written only by the Edge Function (service_role).

CREATE TABLE IF NOT EXISTS public.ai_resumos (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id           UUID NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
    conteudo             TEXT NOT NULL,
    template_versao      INTEGER NOT NULL DEFAULT 1,
    periodo_inicio       DATE,
    periodo_fim          DATE,
    rdo_ids              JSONB NOT NULL DEFAULT '[]'::jsonb,
    rdos_cobertos        INTEGER NOT NULL DEFAULT 0,
    key_titulo           TEXT,
    provedor             TEXT,
    prompt_tokens        INTEGER,
    completion_tokens    INTEGER,
    custo_estimado_usd   NUMERIC(10, 6),
    created_by           UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted              BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.ai_resumos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_resumos: admin/supervisor read" ON public.ai_resumos;
CREATE POLICY "ai_resumos: admin/supervisor read" ON public.ai_resumos
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'supervisor')
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_resumos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_resumos TO service_role;

CREATE INDEX IF NOT EXISTS idx_ai_resumos_projeto
    ON public.ai_resumos (projeto_id, created_at DESC)
    WHERE deleted = false;

-- 3. Config singleton -------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_config (
    id              INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    template_resumo TEXT NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_config FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_config TO service_role;

-- 4. Seed the default summary template -------------------------------------
-- Contract between the UI, the prompt and the model. Sections map 1:1 to the
-- manual "Resumo da obra" documents the team already writes.

INSERT INTO public.ai_config (id, template_resumo)
VALUES (1, $tpl$# Resumo da obra {cliente} · Sonda {sonda}
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
$tpl$)
ON CONFLICT (id) DO NOTHING;

-- 5. Grants the Edge Function needs on tables it only READS -----------------
-- The `ai-summary` function runs as service_role. Supabase does not
-- automatically grant service_role access to tables created by hand, so the
-- existing app tables it reads must be granted explicitly.

GRANT SELECT ON public.projetos TO service_role;
GRANT SELECT ON public.rdos TO service_role;
GRANT SELECT ON public.profiles TO service_role;

-- 6. Verify ------------------------------------------------------------------

SELECT 'ai_api_keys' AS tabela, count(*) AS registros FROM public.ai_api_keys
UNION ALL
SELECT 'ai_resumos', count(*) FROM public.ai_resumos
UNION ALL
SELECT 'ai_config', count(*) FROM public.ai_config;

-- Expect ai_api_keys and ai_config to show ZERO privileges for `authenticated`:
--   SELECT privilege_type FROM information_schema.table_privileges
--   WHERE table_name = 'ai_api_keys' AND grantee IN ('authenticated','anon');
