-- ============================================================================
-- RDO Auto — Notification Preferences (admin-controlled recipients)
-- Run this in the Supabase SQL Editor.
--
-- Prerequisites:
--   1. notify_users() function exists (migration-event-notifications.sql).
--   2. pg_net extension enabled (CREATE EXTENSION IF NOT EXISTS pg_net).
--   3. tr_notify_rdo_status_trigger is attached to rdos (it is, from the
--      event-notifications migration; this file only replaces the function).
--
-- What this does:
--   1. Creates notificacao_preferencias (per-user, per-event opt-in).
--   2. Adds public.is_admin() helper for RLS.
--   3. Rewrites tr_notify_rdo_status() to route events through preferences
--      instead of hardcoded targets (previously: all admins on new RDO).
--   4. Seeds current admins with the 'rdo_enviado' event, preserving the
--      current beta behavior (admins notified on every new RDO).
--
-- NOTE: this is a pure preference-driven model. There is no hardcoded
-- recipient fallback anymore. If a user has no row (or ativo=false) for an
-- event, they do NOT get notified for it.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Admin helper (used by RLS) ----------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- 2. Preferences table -------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificacao_preferencias (
    user_id    UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    evento     TEXT NOT NULL CHECK (evento IN ('rdo_enviado','rdo_aprovado','rdo_alterado','resumo_diario')),
    ativo      BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, evento)
);

ALTER TABLE notificacao_preferencias ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read (the admin panel and the trigger both need it).
CREATE POLICY "NotifPrefs: authenticated read"
    ON notificacao_preferencias FOR SELECT TO authenticated USING (true);

-- Only admins can write.
CREATE POLICY "NotifPrefs: admin write"
    ON notificacao_preferencias FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON notificacao_preferencias TO authenticated;

-- 3. Seed current admins with 'rdo_enviado' (preserve beta behavior) ---------
--    Se algum admin (ex.: Cintia) estiver com role errada em profiles, ele nao
--    entra aqui: corrija a role primeiro (ou insira a linha manualmente abaixo).
INSERT INTO notificacao_preferencias (user_id, evento, ativo)
SELECT user_id, 'rdo_enviado', true
FROM profiles
WHERE role = 'admin'
ON CONFLICT (user_id, evento) DO NOTHING;

-- 4. Helper: collect recipients for an event ---------------------------------
CREATE OR REPLACE FUNCTION notif_recipients(p_evento TEXT)
RETURNS UUID[] LANGUAGE sql STABLE AS $$
  SELECT COALESCE(array_agg(user_id), ARRAY[]::UUID[])
  FROM notificacao_preferencias
  WHERE evento = p_evento AND ativo = true;
$$;

-- 5. Rewrite the RDO status trigger ------------------------------------------
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
        v_targets := notif_recipients('rdo_enviado');
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
        v_targets := notif_recipients('rdo_aprovado');
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
        v_targets := notif_recipients('rdo_alterado');
        IF v_targets IS NOT NULL AND array_length(v_targets, 1) > 0 THEN
            PERFORM notify_users(v_targets, v_message);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 6. (Re)attach the trigger (idempotent) --------------------------------------
DROP TRIGGER IF EXISTS tr_notify_rdo_status_trigger ON rdos;
CREATE TRIGGER tr_notify_rdo_status_trigger
    AFTER INSERT OR UPDATE ON rdos
    FOR EACH ROW
    EXECUTE FUNCTION tr_notify_rdo_status();

-- ============================================================================
-- Verify
-- ============================================================================
SELECT 'Notification preferences migration applied' AS status;

-- List seeded recipients for 'rdo_enviado':
SELECT np.user_id, pr.name, pr.role, np.ativo
FROM notificacao_preferencias np
JOIN profiles pr ON pr.user_id = np.user_id
WHERE np.evento = 'rdo_enviado'
ORDER BY pr.name;
