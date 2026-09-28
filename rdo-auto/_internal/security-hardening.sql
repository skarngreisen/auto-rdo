-- ============================================================================
-- security-hardening.sql
-- Fecha o acesso indevido de DELETE/TRUNCATE e liga RLS com policies.
-- Produção: fecskilrtsaeavoznwgi. Rodar como postgres (dono das tabelas).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Revogar privilégios perigosos
--    - anon não escreve nada (era DELETE/INSERT/UPDATE/TRUNCATE).
--    - authenticated perde DELETE e TRUNCATE nas tabelas de dados.
--    - Ninguém trunca nenhuma tabela de aplicação.
-- ---------------------------------------------------------------------------
REVOKE DELETE, TRUNCATE, INSERT, UPDATE ON public.projetos FROM anon;
REVOKE DELETE, TRUNCATE, INSERT, UPDATE ON public.rdos     FROM anon;

REVOKE DELETE, TRUNCATE ON public.projetos FROM authenticated;
REVOKE DELETE, TRUNCATE ON public.rdos     FROM authenticated;

REVOKE TRUNCATE ON public.projeto_geologos         FROM anon, authenticated;
REVOKE TRUNCATE ON public.projeto_supervisores     FROM anon, authenticated;
REVOKE TRUNCATE ON public.notificacao_preferencias FROM anon, authenticated;
REVOKE TRUNCATE ON public.profiles                 FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Ligar RLS nas tabelas de dados (estava desligado = ninguém barrava nada)
-- ---------------------------------------------------------------------------
ALTER TABLE public.projetos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_geologos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projeto_supervisores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_teste            ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. Policies — decisões
--    SELECT  : authenticated lê (app depende).
--    INSERT  : authenticated cria (colaborador cria projeto/RDO).
--    UPDATE  : authenticated atualiza (rascunho, aprovação, soft delete).
--    DELETE  : NEGADO a todos — exclusão só via soft delete (UPDATE deleted).
-- ---------------------------------------------------------------------------

-- projetos
DROP POLICY IF EXISTS "projetos_select_auth" ON public.projetos;
CREATE POLICY "projetos_select_auth" ON public.projetos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "projetos_insert_auth" ON public.projetos;
CREATE POLICY "projetos_insert_auth" ON public.projetos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "projetos_update_auth" ON public.projetos;
CREATE POLICY "projetos_update_auth" ON public.projetos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "projetos_no_delete" ON public.projetos;
CREATE POLICY "projetos_no_delete" ON public.projetos
  FOR DELETE TO authenticated USING (false);

-- rdos
DROP POLICY IF EXISTS "rdos_select_auth" ON public.rdos;
CREATE POLICY "rdos_select_auth" ON public.rdos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rdos_insert_auth" ON public.rdos;
CREATE POLICY "rdos_insert_auth" ON public.rdos
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rdos_update_auth" ON public.rdos;
CREATE POLICY "rdos_update_auth" ON public.rdos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rdos_no_delete" ON public.rdos;
CREATE POLICY "rdos_no_delete" ON public.rdos
  FOR DELETE TO authenticated USING (false);

-- projeto_geologos / projeto_supervisores (histórico de atribuição; admin escreve)
DROP POLICY IF EXISTS "geologos_select_auth" ON public.projeto_geologos;
CREATE POLICY "geologos_select_auth" ON public.projeto_geologos
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "geologos_write_admin" ON public.projeto_geologos;
CREATE POLICY "geologos_write_admin" ON public.projeto_geologos
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "supervisores_select_auth" ON public.projeto_supervisores;
CREATE POLICY "supervisores_select_auth" ON public.projeto_supervisores
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "supervisores_write_admin" ON public.projeto_supervisores;
CREATE POLICY "supervisores_write_admin" ON public.projeto_supervisores
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Default privileges: tabelas FUTURAS nascem fechadas para anon
-- ---------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE DELETE, TRUNCATE, INSERT, UPDATE ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE ON TABLES FROM authenticated;

COMMIT;

-- ---------------------------------------------------------------------------
-- Verificação
-- ---------------------------------------------------------------------------
SELECT c.relname AS tabela, c.relrowsecurity AS rls_on
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname;

SELECT table_name, grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name IN ('projetos','rdos') AND grantee IN ('anon','authenticated')
GROUP BY table_name, grantee ORDER BY table_name, grantee;
