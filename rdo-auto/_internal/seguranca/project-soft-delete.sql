-- ============================================================================
-- project-soft-delete.sql
-- Fase 3: soft delete de projeto + auditoria de exclusões.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Colunas de soft delete em projetos (paridade com rdos.deleted)
-- ---------------------------------------------------------------------------
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS deleted     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by  UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_projetos_deleted ON public.projetos(deleted);

-- ---------------------------------------------------------------------------
-- 2. Tabela de auditoria de exclusões
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exclusao_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela       TEXT NOT NULL,               -- 'projetos' | 'rdos'
  registro_id  UUID NOT NULL,
  acao         TEXT NOT NULL,               -- 'soft_delete' | 'restore'
  quem         TEXT,                        -- nome do usuário
  user_id      UUID REFERENCES auth.users(id),
  quando       TIMESTAMPTZ NOT NULL DEFAULT now(),
  comentario   TEXT,
  snapshot     JSONB                        -- cópia do registro no momento
);

ALTER TABLE public.exclusao_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.exclusao_log FROM anon;
GRANT SELECT, INSERT ON public.exclusao_log TO authenticated;

-- Leitura: qualquer autenticado (trilha de auditoria visível).
DROP POLICY IF EXISTS "exclusao_log_select_auth" ON public.exclusao_log;
CREATE POLICY "exclusao_log_select_auth" ON public.exclusao_log
  FOR SELECT TO authenticated USING (true);

-- Escrita: qualquer autenticado registra (a ação de exclusão é restrita por role no app).
DROP POLICY IF EXISTS "exclusao_log_insert_auth" ON public.exclusao_log;
CREATE POLICY "exclusao_log_insert_auth" ON public.exclusao_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Ninguém apaga ou altera a trilha de auditoria.
DROP POLICY IF EXISTS "exclusao_log_no_modify" ON public.exclusao_log;
CREATE POLICY "exclusao_log_no_modify" ON public.exclusao_log
  FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS "exclusao_log_no_delete" ON public.exclusao_log;
CREATE POLICY "exclusao_log_no_delete" ON public.exclusao_log
  FOR DELETE TO authenticated USING (false);

-- ---------------------------------------------------------------------------
-- 3. Trigger: auditar automaticamente quando um projeto/rdo é soft-deletado
--    (mantém a trilha mesmo se o app esquecer de inserir manualmente)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tr_log_soft_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nome TEXT;
BEGIN
  -- Só registra quando passa de não-apagado para apagado.
  IF NEW.deleted = true AND (OLD.deleted IS DISTINCT FROM true) THEN
    SELECT name INTO v_nome FROM profiles WHERE user_id = auth.uid();
    INSERT INTO exclusao_log (tabela, registro_id, acao, quem, user_id, snapshot)
    VALUES (
      TG_TABLE_NAME,
      NEW.id,
      'soft_delete',
      COALESCE(v_nome, 'desconhecido'),
      auth.uid(),
      to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_log_soft_delete_projetos ON public.projetos;
CREATE TRIGGER tr_log_soft_delete_projetos
  AFTER UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.tr_log_soft_delete();

DROP TRIGGER IF EXISTS tr_log_soft_delete_rdos ON public.rdos;
CREATE TRIGGER tr_log_soft_delete_rdos
  AFTER UPDATE ON public.rdos
  FOR EACH ROW EXECUTE FUNCTION public.tr_log_soft_delete();

COMMIT;

-- Verificação
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='projetos'
  AND column_name IN ('deleted','deleted_at','deleted_by') ORDER BY column_name;

SELECT relname AS tabela, relrowsecurity AS rls_on
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND relname='exclusao_log';
