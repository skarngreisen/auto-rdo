-- ============================================================================
-- RDO Auto — Notification System Migration
-- Run this in the Supabase SQL Editor
-- ============================================================================

-- 1. Add telegram_chat_id to profiles ----------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- 2. Add turnos_por_dia to projetos ------------------------------------------
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS turnos_por_dia INTEGER NOT NULL DEFAULT 1;

-- 3. Geologist assignment history --------------------------------------------
CREATE TABLE IF NOT EXISTS projeto_geologos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id  UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES profiles(user_id),
    inicio      DATE NOT NULL,
    fim         DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT one_current_geologist UNIQUE (projeto_id, fim)
    -- allows at most one row with fim IS NULL per projeto
);
-- Partial unique index: only one current geologist per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_current_geologist
    ON projeto_geologos (projeto_id) WHERE fim IS NULL;

-- 4. Supervisor assignment history -------------------------------------------
CREATE TABLE IF NOT EXISTS projeto_supervisores (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projeto_id  UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES profiles(user_id),
    turno       INTEGER NOT NULL CHECK (turno IN (1, 2)),
    inicio      DATE NOT NULL,
    fim         DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Partial unique index: only one current supervisor per project per turno
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_current_supervisor
    ON projeto_supervisores (projeto_id, turno) WHERE fim IS NULL;

-- ============================================================================
-- 5. RLS policies ------------------------------------------------------------
-- ============================================================================

-- projeto_geologos: authenticated users can read
ALTER TABLE projeto_geologos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Geologos: all authenticated can read"
    ON projeto_geologos FOR SELECT TO authenticated USING (true);

-- projeto_supervisores: authenticated users can read
ALTER TABLE projeto_supervisores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Supervisores: all authenticated can read"
    ON projeto_supervisores FOR SELECT TO authenticated USING (true);

-- ============================================================================
-- 6. Function: get current project crew --------------------------------------
-- Returns current geologist and supervisors for a project at a given date
-- ============================================================================
CREATE OR REPLACE FUNCTION get_project_crew(
    p_projeto_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    geologist_id UUID,
    geologist_name TEXT,
    supervisor1_id UUID,
    supervisor1_name TEXT,
    supervisor2_id UUID,
    supervisor2_name TEXT,
    has_two_shifts BOOLEAN
) LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_geologo RECORD;
    v_sup1 RECORD;
    v_sup2 RECORD;
    v_turnos INTEGER;
BEGIN
    -- Geologist at p_date
    SELECT pg.user_id, pr.name INTO v_geologo
    FROM projeto_geologos pg
    JOIN profiles pr ON pr.user_id = pg.user_id
    WHERE pg.projeto_id = p_projeto_id
      AND pg.inicio <= p_date
      AND (pg.fim IS NULL OR pg.fim >= p_date)
    ORDER BY pg.inicio DESC
    LIMIT 1;

    -- Supervisor turno 1 at p_date
    SELECT ps.user_id, pr.name INTO v_sup1
    FROM projeto_supervisores ps
    JOIN profiles pr ON pr.user_id = ps.user_id
    WHERE ps.projeto_id = p_projeto_id
      AND ps.turno = 1
      AND ps.inicio <= p_date
      AND (ps.fim IS NULL OR ps.fim >= p_date)
    ORDER BY ps.inicio DESC
    LIMIT 1;

    -- Supervisor turno 2 at p_date
    SELECT ps.user_id, pr.name INTO v_sup2
    FROM projeto_supervisores ps
    JOIN profiles pr ON pr.user_id = ps.user_id
    WHERE ps.projeto_id = p_projeto_id
      AND ps.turno = 2
      AND ps.inicio <= p_date
      AND (ps.fim IS NULL OR ps.fim >= p_date)
    ORDER BY ps.inicio DESC
    LIMIT 1;

    SELECT turnos_por_dia INTO v_turnos FROM projetos WHERE id = p_projeto_id;

    RETURN QUERY SELECT
        v_geologo.user_id,
        v_geologo.name,
        v_sup1.user_id,
        v_sup1.name,
        v_sup2.user_id,
        v_sup2.name,
        (v_turnos = 2);
END;
$$;

-- ============================================================================
-- 7. Verify migration --------------------------------------------------------
-- ============================================================================
SELECT 'Migration applied' AS status;
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('projeto_geologos', 'projeto_supervisores')
ORDER BY table_name;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name = 'telegram_chat_id'
UNION ALL
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projetos'
  AND column_name = 'turnos_por_dia';
