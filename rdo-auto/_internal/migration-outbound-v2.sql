-- ============================================================================
-- RDO Auto - Outbound rules v2 (beta)
-- 1. Remove the scheduled/hourly checks (pg_cron job, helpers, dedup table).
-- 2. Rewrite tr_notify_rdo_status(): notify ALL admins when a new RDO is
--    submitted for review (em_revisao). Removed the geologist-on-submit,
--    author-on-approve, and author-on-edit notifications.
-- ============================================================================

-- 1. Remove scheduled checks ------------------------------------------------
SELECT cron.unschedule('rdo-scheduled-check');

DROP FUNCTION IF EXISTS scheduled_rdo_check();
DROP FUNCTION IF EXISTS notify_if_not_sent(UUID, TEXT, INTEGER, DATE, UUID[], TEXT);
DROP FUNCTION IF EXISTS get_shift_supervisors(UUID);
DROP FUNCTION IF EXISTS get_fernando_id();

DROP TABLE IF EXISTS notificacoes_enviadas;

-- 2. Rewrite the RDO status trigger ------------------------------------------
CREATE OR REPLACE FUNCTION tr_notify_rdo_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_projeto_name TEXT;
    v_author_name TEXT;
    v_message TEXT;
    v_admins UUID[];
BEGIN
    -- Only fire when an RDO is newly submitted for review.
    IF NEW.status = 'em_revisao' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        SELECT cliente INTO v_projeto_name FROM projetos WHERE id = NEW.projeto_id;
        SELECT name INTO v_author_name FROM profiles WHERE user_id = NEW.user_id;

        v_message := format(
            'Novo RDO: projeto %s, data %s, autor %s.',
            COALESCE(v_projeto_name, 'desconhecido'),
            NEW.data,
            COALESCE(v_author_name, 'desconhecido')
        );

        SELECT array_agg(user_id) INTO v_admins FROM profiles WHERE role = 'admin';

        IF v_admins IS NOT NULL AND array_length(v_admins, 1) > 0 THEN
            PERFORM notify_users(v_admins, v_message);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

SELECT 'Outbound v2 applied' AS status;
