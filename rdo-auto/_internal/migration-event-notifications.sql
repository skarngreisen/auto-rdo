-- ============================================================================
-- RDO Auto — Event-Driven Notification Triggers
-- Run after migration-notifications.sql and after deploying the Edge Function.
--
-- Prerequisites:
--   1. pg_net extension enabled (CREATE EXTENSION IF NOT EXISTS pg_net)
--   2. Edge Function "notify-telegram" deployed
--   3. TELEGRAM_BOT_TOKEN set as Supabase secret
--   4. Replace EDGE_FUNCTION_URL below with the actual deployed URL
-- ============================================================================

-- 0. Enable pg_net extension (required for http_post) ------------------------
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Helper: send Telegram notification to one or more users -----------------
CREATE OR REPLACE FUNCTION notify_users(p_user_ids UUID[], p_message TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
    v_edge_url TEXT := 'https://fecskilrtsaeavoznwgi.supabase.co/functions/v1/notify-telegram';
BEGIN
    PERFORM net.http_post(
        url := v_edge_url,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
            'user_ids', p_user_ids,
            'message', p_message
        )
    );
END;
$$;

-- 2. Trigger: RDO status change → notify relevant people --------------------
CREATE OR REPLACE FUNCTION tr_notify_rdo_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_author_id UUID;
    v_geologo_id UUID;
    v_geologo_name TEXT;
    v_projeto_name TEXT;
    v_message TEXT;
    v_targets UUID[];
BEGIN
    -- Only fire on status transitions
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
        -- Get project name
        SELECT cliente INTO v_projeto_name FROM projetos WHERE id = NEW.projeto_id;

        -- Get current geologist
        SELECT pg.user_id, pr.name INTO v_geologo_id, v_geologo_name
        FROM projeto_geologos pg
        JOIN profiles pr ON pr.user_id = pg.user_id
        WHERE pg.projeto_id = NEW.projeto_id AND pg.fim IS NULL
        LIMIT 1;

        -- Scenario 1: RDO submitted for review
        IF NEW.status = 'em_revisao' AND (TG_OP = 'INSERT' OR OLD.status = 'rascunho') THEN
            v_author_id := NEW.user_id;
            IF v_geologo_id IS NOT NULL THEN
                v_message := format(
                    'RDO do projeto %s — %s enviado para revisao.',
                    v_projeto_name, NEW.data
                );
                v_targets := ARRAY[v_geologo_id];
                PERFORM notify_users(v_targets, v_message);
            END IF;
        END IF;

        -- Scenario 2: RDO approved
        IF NEW.status = 'aprovado' AND OLD.status = 'em_revisao' THEN
            v_author_id := NEW.user_id;
            IF v_author_id IS NOT NULL THEN
                v_message := format(
                    'RDO do projeto %s — %s aprovado por %s.',
                    v_projeto_name, NEW.data,
                    COALESCE(v_geologo_name, 'geologo')
                );
                v_targets := ARRAY[v_author_id];
                PERFORM notify_users(v_targets, v_message);
            END IF;
        END IF;

        -- Scenario 3: RDO edited directly by geologist (status stays em_revisao
        -- or goes to aprovado, but NEW.user_id != original author implies edit)
        -- Detect: the row was updated and user_id changed, meaning geologist
        -- took over and edited it
        IF TG_OP = 'UPDATE' AND NEW.status = 'aprovado' AND OLD.status = 'em_revisao'
           AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            v_message := format(
                'Atencao: seu RDO do projeto %s — %s foi alterado por %s e aprovado. Consulte a versao final.',
                v_projeto_name, NEW.data,
                COALESCE(v_geologo_name, 'geologo')
            );
            v_targets := ARRAY[OLD.user_id];
            PERFORM notify_users(v_targets, v_message);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Attach trigger to rdos table --------------------------------------------
DROP TRIGGER IF EXISTS tr_notify_rdo_status_trigger ON rdos;
CREATE TRIGGER tr_notify_rdo_status_trigger
    AFTER INSERT OR UPDATE ON rdos
    FOR EACH ROW
    EXECUTE FUNCTION tr_notify_rdo_status();

-- ============================================================================
-- Verify
-- ============================================================================
SELECT 'Event-driven notification trigger installed' AS status;
