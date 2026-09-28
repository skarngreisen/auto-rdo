-- B-01: Turno do RDO (roadmap 1.8)
-- 1. Add integer turno (1..3) to each RDO. Nullable during beta (optional field).
ALTER TABLE public.rdos ADD COLUMN IF NOT EXISTS turno INTEGER CHECK (turno BETWEEN 1 AND 3);

-- 2. Supervisor name for shift 3 (free-text, same pattern as supervisor_turno1/2).
ALTER TABLE public.projetos ADD COLUMN IF NOT EXISTS supervisor_turno3 TEXT;

-- 3. Allow turno 3 in the supervisor assignment table (currently only 1 and 2).
ALTER TABLE public.projeto_supervisores DROP CONSTRAINT IF EXISTS projeto_supervisores_turno_check;
ALTER TABLE public.projeto_supervisores ADD CONSTRAINT projeto_supervisores_turno_check CHECK (turno IN (1, 2, 3));
