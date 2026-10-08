-- The provider column used to hold a format ('anthropic' | 'openai_compat').
-- It now holds a provider id from ai_provedores ('deepseek', 'openai', ...),
-- so the old CHECK constraint rejects every valid row.
--
-- Drop the constraint and replace it with a foreign key into the registry.
-- That is stricter than a CHECK list and self-maintaining: adding a provider to
-- ai_provedores is enough, no schema change needed.

ALTER TABLE public.ai_api_keys DROP CONSTRAINT IF EXISTS ai_api_keys_provedor_check;

-- Normalise legacy rows to real provider ids before adding the FK.
UPDATE public.ai_api_keys SET provedor = 'anthropic' WHERE provedor = 'anthropic';
UPDATE public.ai_api_keys SET provedor = 'deepseek'  WHERE provedor = 'openai_compat';

-- Orphaned rows (provider not in the registry) would block the FK; clear them
-- so detection can re-identify the key at first use.
UPDATE public.ai_api_keys k
SET provedor = 'deepseek'
WHERE NOT EXISTS (SELECT 1 FROM public.ai_provedores p WHERE p.id = k.provedor);

ALTER TABLE public.ai_api_keys
    ADD CONSTRAINT ai_api_keys_provedor_fkey
    FOREIGN KEY (provedor) REFERENCES public.ai_provedores(id);

-- Verify.
SELECT provedor, count(*) FROM public.ai_api_keys GROUP BY provedor;
