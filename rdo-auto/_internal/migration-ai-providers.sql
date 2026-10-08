-- ============================================================================
-- RDO Auto: provider registry for the AI summary
--
-- The registration flow detects the provider EMPIRICALLY: it probes every
-- known provider with the supplied key and the first one that answers 200 wins.
-- Prefix matching alone is unreliable (sk- is used by several providers), so the
-- probe is the source of truth.
--
-- This table is the single place to add a provider. Adding a new one means one
-- INSERT, not a new code path, because almost every provider speaks the same
-- OpenAI-compatible format. Only `anthropic` and `gemini` have their own shape.
--
-- Run this in the Supabase SQL Editor (or via node _internal/run-sql.js).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_provedores (
    id             TEXT PRIMARY KEY,
    rotulo         TEXT NOT NULL,
    host           TEXT NOT NULL,
    formato        TEXT NOT NULL CHECK (formato IN ('anthropic', 'openai_compat', 'gemini')),
    probe_path     TEXT NOT NULL,
    probe_header   TEXT NOT NULL DEFAULT 'bearer'
                   CHECK (probe_header IN ('bearer', 'x-api-key', 'query')),
    chat_path      TEXT,
    model_default  TEXT,
    suportado      BOOLEAN NOT NULL DEFAULT true,
    ordem          INTEGER NOT NULL DEFAULT 100,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_provedores ENABLE ROW LEVEL SECURITY;

-- Read-only reference data. The Edge Function reads it with the service role;
-- the client roles may read it too (it contains no secrets), which keeps the
-- UI able to render provider labels.
DROP POLICY IF EXISTS "ai_provedores: anyone authenticated reads" ON public.ai_provedores;
CREATE POLICY "ai_provedores: anyone authenticated reads" ON public.ai_provedores
    FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.ai_provedores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_provedores TO service_role;

-- Seed: the ten supported providers.
-- `chat_path` is only filled where it differs from the OpenAI-compatible default
-- of `/chat/completions` appended after the base URL.

INSERT INTO public.ai_provedores
    (id, rotulo, host, formato, probe_path, probe_header, chat_path, model_default, ordem)
VALUES
    ('anthropic',  'Anthropic (Claude)',  'api.anthropic.com',                  'anthropic',     '/v1/models',                        'x-api-key', NULL,                                              'claude-sonnet-4-5',   10),
    ('openai',     'OpenAI',              'api.openai.com',                     'openai_compat', '/v1/models',                        'bearer',    NULL,                                              'gpt-4o',              20),
    ('deepseek',   'DeepSeek',            'api.deepseek.com',                   'openai_compat', '/models',                           'bearer',    NULL,                                              'deepseek-v4-flash',   30),
    ('qwen',       'Qwen (Alibaba)',      'dashscope.aliyuncs.com',             'openai_compat', '/compatible-mode/v1/models',        'bearer',    NULL,                                              'qwen-max',            40),
    ('moonshot',   'Moonshot (Kimi)',     'api.moonshot.cn',                    'openai_compat', '/v1/models',                        'bearer',    '/v1/chat/completions',                            'moonshot-v1-8k',      50),
    ('zhipu',      'Zhipu (GLM)',         'open.bigmodel.cn',                   'openai_compat', '/api/paas/v4/models',               'bearer',    '/api/paas/v4/chat/completions',                   'glm-4-plus',          60),
    ('groq',       'Groq',                'api.groq.com',                       'openai_compat', '/openai/v1/models',                 'bearer',    '/openai/v1/chat/completions',                     'llama-3.3-70b-versatile', 70),
    ('openrouter', 'OpenRouter',          'openrouter.ai',                      'openai_compat', '/api/v1/key',                       'bearer',    '/api/v1/chat/completions',                        'anthropic/claude-sonnet-4.5', 80),
    ('mistral',    'Mistral',             'api.mistral.ai',                     'openai_compat', '/v1/models',                        'bearer',    NULL,                                              'mistral-large-latest', 90),
    ('gemini',     'Google Gemini',       'generativelanguage.googleapis.com',  'gemini',        '/v1beta/models',                    'query',     NULL,                                              'gemini-2.0-flash',   100)
ON CONFLICT (id) DO UPDATE SET
    rotulo        = EXCLUDED.rotulo,
    host          = EXCLUDED.host,
    formato       = EXCLUDED.formato,
    probe_path    = EXCLUDED.probe_path,
    probe_header  = EXCLUDED.probe_header,
    chat_path     = EXCLUDED.chat_path,
    model_default = EXCLUDED.model_default,
    ordem         = EXCLUDED.ordem;

-- Providers we know about but do NOT support yet. Kept here so the "not
-- supported" message can list what is missing, and so adding one later is a
-- single UPDATE of `suportado` plus its probe config.
INSERT INTO public.ai_provedores
    (id, rotulo, host, formato, probe_path, probe_header, suportado, ordem)
VALUES
    ('cohere',   'Cohere',   'api.cohere.com', 'openai_compat', '/v1/models', 'bearer', false, 200),
    ('together', 'Together', 'api.together.xyz', 'openai_compat', '/v1/models', 'bearer', false, 210),
    ('xai',      'xAI (Grok)', 'api.x.ai', 'openai_compat', '/v1/models', 'bearer', false, 220)
ON CONFLICT (id) DO NOTHING;

-- Verify.
SELECT id, rotulo, formato, suportado FROM public.ai_provedores ORDER BY ordem;
