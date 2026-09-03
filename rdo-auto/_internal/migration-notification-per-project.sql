-- ============================================================================
-- RDO Auto — Per-project notification preferences
-- Replaces the global notificacao_preferencias model.
--
-- Model: notificacao_preferencias(projeto_id, user_id, evento, ativo).
--   For each project, the admin adds people and marks which events they get.
--   The trigger now filters recipients by the RDO's project.
--
-- Prerequisites:
--   1. public.is_admin() exists (migration-notification-preferences.sql).
--   2. notify_users() exists (migration-event-notifications.sql).
--   3. tr_notify_rdo_status_trigger is attached to rdos (it is; we only
--      replace the function body and re-attach idempotently).
--
-- NOTE: this drops the old global table and re-seeds the current admins into
-- every existing project for the 'rdo_enviado' event, preserving beta behavior.
-- ============================================================================

-- 1. Recreate the preferences table with project scope -----------------------
DROP TABLE IF EXISTS notificacao_preferencias;

CREATE TABLE notificacao_preferencias (
    projeto_id UUID NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    evento     TEXT NOT NULL CHECK (evento IN ('rdo_enviado','rdo_aprovado','rdo_alterado','resumo_diario')),
    ativo      BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (projeto_id, user_id, evento)
);

ALTER TABLE notificacao_preferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "NotifPrefs: authenticated read"
    ON notificacao_preferencias FOR SELECT TO authenticated USING (true);

CREATE POLICY "NotifPrefs: admin write"
    ON notificacao_preferencias FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON notificacao_preferencias TO authenticated;

-- 2. Seed: current admins get 'rdo_enviado' for every existing project -------
INSERT INTO notificacao_preferencias (projeto_id, user_id, evento, ativo)
SELECT pr.id, a.user_id, 'rdo_enviado', true
FROM projetos pr
CROSS JOIN (SELECT user_id FROM profiles WHERE role = 'admin') a
ON CONFLICT (projeto_id, user_id, evento) DO NOTHING;

-- 3. Helper: recipients for an event within a project ------------------------
DROP FUNCTION IF EXISTS notif_recipients(TEXT);

CREATE OR REPLACE FUNCTION notif_recipients(p_evento TEXT, p_projeto_id UUID)
RETURNS UUID[] LANGUAGE sql STABLE AS $$
  SELECT COALESCE(array_agg(user_id), ARRAY[]::UUID[])
  FROM notificacao_preferencias
  WHERE evento = p_evento AND ativo = true
    AND projeto_id = p_projeto_id;
$$;

-- 4. Rewrite the trigger to pass the project ---------------------------------
CREATE OR REPLACE FUNCTION tr_notify_rdo_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_projeto_name TEXT;
    v_author_name TEXT;
    v_message TEXT;
    v_targets UUID[];
BEGIN
    -- Event 1: new RDO submitted for review (clique em "Enviar RDO")
    IF NEW.status = 'em_revisao' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        SELECT cliente INTO v_projeto_name FROM projetos WHERE id = NEW.projeto_id;
        SELECT name INTO v_author_name FROM profiles WHERE user_id = NEW.user_id;
        v_message := format(
            'Novo RDO: projeto %s, data %s, autor %s.',
            COALESCE(v_projeto_name, 'desconhecido'),
            NEW.data,
            COALESCE(v_author_name, 'desconhecido')
        );
        v_targets := notif_recipients('rdo_enviado', NEW.projeto_id);
        IF v_targets IS NOT NULL AND array_length(v_targets, 1) > 0 THEN
            PERFORM notify_users(v_targets, v_message);
        END IF;
    END IF;

    -- Event 2: RDO approved
    IF NEW.status = 'aprovado' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
        SELECT cliente INTO v_projeto_name FROM projetos WHERE id = NEW.projeto_id;
        v_message := format(
            'RDO aprovado: projeto %s, data %s.',
            COALESCE(v_projeto_name, 'desconhecido'),
            NEW.data
        );
        v_targets := notif_recipients('rdo_aprovado', NEW.projeto_id);
        IF v_targets IS NOT NULL AND array_length(v_targets, 1) > 0 THEN
            PERFORM notify_users(v_targets, v_message);
        END IF;
    END IF;

    -- Event 3: RDO edited by someone else and approved (author changed)
    IF TG_OP = 'UPDATE' AND NEW.status = 'aprovado'
       AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        SELECT cliente INTO v_projeto_name FROM projetos WHERE id = NEW.projeto_id;
        v_message := format(
            'RDO alterado por outro usuario e aprovado: projeto %s, data %s.',
            COALESCE(v_projeto_name, 'desconhecido'),
            NEW.data
        );
        v_targets := notif_recipients('rdo_alterado', NEW.projeto_id);
        IF v_targets IS NOT NULL AND array_length(v_targets, 1) > 0 THEN
            PERFORM notify_users(v_targets, v_message);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 5. (Re)attach the trigger (idempotent) -------------------------------------
DROP TRIGGER IF EXISTS tr_notify_rdo_status_trigger ON rdos;
CREATE TRIGGER tr_notify_rdo_status_trigger
    AFTER INSERT OR UPDATE ON rdos
    FOR EACH ROW
    EXECUTE FUNCTION tr_notify_rdo_status();

-- ============================================================================
-- Verify
-- ============================================================================
SELECT 'Per-project notification migration applied' AS status;

SELECT pr.cliente, np.user_id, p.name, np.evento, np.ativo
FROM notificacao_preferencias np
JOIN projetos pr ON pr.id = np.projeto_id
JOIN profiles p ON p.user_id = np.user_id
ORDER BY pr.cliente, p.name, np.evento;
