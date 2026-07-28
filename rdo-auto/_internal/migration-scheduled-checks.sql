-- ============================================================================
-- RDO Auto — Scheduled Notification Checks (pg_cron)
-- Run after migration-notifications.sql and after deploying the Edge Function.
--
-- Prerequisites:
--   1. pg_cron extension enabled (via Supabase Dashboard → Extensions)
--   2. pg_net extension enabled (CREATE EXTENSION IF NOT EXISTS pg_net)
--   3. notify_users() function from migration-event-notifications.sql deployed
--   4. Edge Function "notify-telegram" deployed
-- ============================================================================

-- 0. Enable extensions -------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Sent-notifications table (dedup: avoid spamming same alert) -------------
CREATE TABLE IF NOT EXISTS notificacoes_enviadas (
    id              BIGSERIAL PRIMARY KEY,
    projeto_id      UUID NOT NULL,
    tipo            TEXT NOT NULL,  -- 'rdo_faltando', 'rdo_atrasado_revisao'
    nivel           INTEGER NOT NULL,  -- escalation level (1, 2, 3)
    data_rdo        DATE NOT NULL,     -- the RDO date this notification is about
    enviado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_dedup
    ON notificacoes_enviadas (projeto_id, tipo, nivel, data_rdo);

-- 2. Helper: get project's current shift supervisors -------------------------
CREATE OR REPLACE FUNCTION get_shift_supervisors(p_projeto_id UUID)
RETURNS TABLE(user_id UUID, turno INTEGER) LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT ps.user_id, ps.turno
    FROM projeto_supervisores ps
    WHERE ps.projeto_id = p_projeto_id AND ps.fim IS NULL
    ORDER BY ps.turno;
END;
$$;

-- 3. Helper: get Fernando's user_id (hardcoded lookup) -----------------------
CREATE OR REPLACE FUNCTION get_fernando_id()
RETURNS UUID LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_id UUID;
BEGIN
    SELECT user_id INTO v_id FROM profiles
    WHERE name ILIKE '%fernando%' AND role = 'admin'
    LIMIT 1;
    RETURN v_id;
END;
$$;

-- 4. Helper: check and notify if not already sent ----------------------------
CREATE OR REPLACE FUNCTION notify_if_not_sent(
    p_projeto_id UUID,
    p_tipo TEXT,
    p_nivel INTEGER,
    p_data_rdo DATE,
    p_targets UUID[],
    p_message TEXT
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM notificacoes_enviadas
        WHERE projeto_id = p_projeto_id
          AND tipo = p_tipo
          AND nivel = p_nivel
          AND data_rdo = p_data_rdo
    ) INTO v_exists;

    IF NOT v_exists AND array_length(p_targets, 1) > 0 THEN
        PERFORM notify_users(p_targets, p_message);
        INSERT INTO notificacoes_enviadas (projeto_id, tipo, nivel, data_rdo)
        VALUES (p_projeto_id, p_tipo, p_nivel, p_data_rdo);
    END IF;
END;
$$;

-- 5. Main scheduled check function -------------------------------------------
-- Called by pg_cron every few hours. Checks all active projects.
CREATE OR REPLACE FUNCTION scheduled_rdo_check()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_proj RECORD;
    v_geologo_id UUID;
    v_geologo_name TEXT;
    v_fernando_id UUID;
    v_last_rdo_date DATE;
    v_last_rdo_ts TIMESTAMPTZ;
    v_hours_since_last NUMERIC;
    v_hours_since_submission NUMERIC;
    v_rdos_hoje INTEGER;
    v_expected_rdos INTEGER;
    v_sups RECORD;
    v_targets UUID[];
    v_message TEXT;
    v_projeto_name TEXT;
    v_today DATE := CURRENT_DATE;
    v_now TIMESTAMPTZ := now();
BEGIN
    v_fernando_id := get_fernando_id();

    -- Active projects: have an RDO within the last 60 days
    FOR v_proj IN
        SELECT p.id, p.cliente, p.turnos_por_dia
        FROM projetos p
        WHERE EXISTS (
            SELECT 1 FROM rdos r
            WHERE r.projeto_id = p.id
              AND r.deleted = false
              AND r.data >= v_today - INTERVAL '60 days'
        )
    LOOP
        v_projeto_name := v_proj.cliente;
        v_expected_rdos := COALESCE(v_proj.turnos_por_dia, 1);

        -- Get current geologist
        SELECT pg.user_id, pr.name INTO v_geologo_id, v_geologo_name
        FROM projeto_geologos pg
        JOIN profiles pr ON pr.user_id = pg.user_id
        WHERE pg.projeto_id = v_proj.id AND pg.fim IS NULL
        LIMIT 1;

        -- ============================================================
        -- CHECK A: Missing RDOs (not submitted today)
        -- ============================================================
        SELECT count(*) INTO v_rdos_hoje
        FROM rdos
        WHERE projeto_id = v_proj.id
          AND deleted = false
          AND data = v_today;

        IF v_rdos_hoje < v_expected_rdos THEN
            -- Find last RDO date and time
            SELECT data, created_at INTO v_last_rdo_date, v_last_rdo_ts
            FROM rdos
            WHERE projeto_id = v_proj.id
              AND deleted = false
            ORDER BY data DESC, created_at DESC
            LIMIT 1;

            v_hours_since_last := extract(epoch FROM (v_now - COALESCE(v_last_rdo_ts, v_now - INTERVAL '999 days'))) / 3600;

            -- Escalation level 1: first warning (> 2 hours after expected start)
            IF v_hours_since_last > 2 AND v_hours_since_last <= 8 THEN
                FOR v_sups IN SELECT * FROM get_shift_supervisors(v_proj.id) LOOP
                    v_targets := ARRAY[v_sups.user_id];
                    v_message := format(
                        'Lembrete: RDO do projeto %s — %s ainda nao foi enviado. Turno %s.',
                        v_projeto_name, v_today, v_sups.turno
                    );
                    PERFORM notify_if_not_sent(v_proj.id, 'rdo_faltando', 1, v_today, v_targets, v_message);
                END LOOP;
            END IF;

            -- Escalation level 2: second warning (> 8 hours)
            IF v_hours_since_last > 8 AND v_hours_since_last <= 48 THEN
                v_targets := ARRAY[]::UUID[];
                FOR v_sups IN SELECT * FROM get_shift_supervisors(v_proj.id) LOOP
                    v_targets := v_targets || v_sups.user_id;
                END LOOP;
                IF v_geologo_id IS NOT NULL THEN
                    v_targets := v_targets || v_geologo_id;
                END IF;
                v_message := format(
                    'ALERTA: RDO do projeto %s — %s ainda nao enviado (%s h desde o ultimo).',
                    v_projeto_name, v_today, round(v_hours_since_last)
                );
                PERFORM notify_if_not_sent(v_proj.id, 'rdo_faltando', 2, v_today, v_targets, v_message);
            END IF;

            -- Escalation level 3: Fernando (> 48 hours without RDO)
            IF v_hours_since_last > 48 THEN
                v_targets := ARRAY[]::UUID[];
                FOR v_sups IN SELECT * FROM get_shift_supervisors(v_proj.id) LOOP
                    v_targets := v_targets || v_sups.user_id;
                END LOOP;
                IF v_geologo_id IS NOT NULL THEN
                    v_targets := v_targets || v_geologo_id;
                END IF;
                IF v_fernando_id IS NOT NULL THEN
                    v_targets := v_targets || v_fernando_id;
                END IF;
                v_message := format(
                    'CRITICO: Projeto %s esta ha %s h sem RDO. Ultimo registro: %s.',
                    v_projeto_name, round(v_hours_since_last), COALESCE(v_last_rdo_date::text, 'nunca')
                );
                PERFORM notify_if_not_sent(v_proj.id, 'rdo_faltando', 3, v_today, v_targets, v_message);
            END IF;
        END IF;

        -- ============================================================
        -- CHECK B: RDOs stuck in review (awaiting geologist approval)
        -- ============================================================
        FOR v_sups IN
            SELECT r.id, r.data, r.created_at
            FROM rdos r
            WHERE r.projeto_id = v_proj.id
              AND r.deleted = false
              AND r.status = 'em_revisao'
        LOOP
            v_hours_since_submission := extract(epoch FROM (v_now - v_sups.created_at)) / 3600;

            -- Level 1: +12 hours, ping geologist
            IF v_hours_since_submission > 12 AND v_hours_since_submission <= 24 THEN
                IF v_geologo_id IS NOT NULL THEN
                    v_targets := ARRAY[v_geologo_id];
                    v_message := format(
                        'Lembrete: RDO do projeto %s — %s aguardando revisao ha %s h.',
                        v_projeto_name, v_sups.data, round(v_hours_since_submission)
                    );
                    PERFORM notify_if_not_sent(v_proj.id, 'rdo_atrasado_revisao', 1, v_sups.data, v_targets, v_message);
                END IF;
            END IF;

            -- Level 2: +24 hours
            IF v_hours_since_submission > 24 AND v_hours_since_submission <= 48 THEN
                IF v_geologo_id IS NOT NULL THEN
                    v_targets := ARRAY[v_geologo_id];
                    v_message := format(
                        'URGENTE: RDO do projeto %s — %s aguardando revisao ha %s h.',
                        v_projeto_name, v_sups.data, round(v_hours_since_submission)
                    );
                    PERFORM notify_if_not_sent(v_proj.id, 'rdo_atrasado_revisao', 2, v_sups.data, v_targets, v_message);
                END IF;
            END IF;

            -- Level 3: +48 hours → Fernando
            IF v_hours_since_submission > 48 THEN
                v_targets := ARRAY[]::UUID[];
                IF v_geologo_id IS NOT NULL THEN
                    v_targets := v_targets || v_geologo_id;
                END IF;
                IF v_fernando_id IS NOT NULL THEN
                    v_targets := v_targets || v_fernando_id;
                END IF;
                v_message := format(
                    'CRITICO: RDO do projeto %s — %s esta ha %s h sem aprovacao. Geologo: %s.',
                    v_projeto_name, v_sups.data, round(v_hours_since_submission),
                    COALESCE(v_geologo_name, 'nao definido')
                );
                PERFORM notify_if_not_sent(v_proj.id, 'rdo_atrasado_revisao', 3, v_sups.data, v_targets, v_message);
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

-- 6. Schedule: run every 2 hours ---------------------------------------------
SELECT cron.schedule(
    'rdo-scheduled-check',
    '0 */2 * * *',   -- every 2 hours
    'SELECT scheduled_rdo_check();'
);

-- ============================================================================
-- Verify
-- ============================================================================
SELECT 'Scheduled notification check installed' AS status;
SELECT cron.jobname, cron.schedule, cron.command FROM cron.job WHERE jobname = 'rdo-scheduled-check';
