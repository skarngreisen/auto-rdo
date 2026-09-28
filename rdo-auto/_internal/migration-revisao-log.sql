-- B-02: Log de revisão (roadmap 2.4)
-- Adds a JSONB array to each RDO storing the review trail:
--   [ { acao, quem, user_id, quando, comentario }, ... ]
-- acao in: enviado | aprovado | reaberto | solicitou_reabertura
ALTER TABLE public.rdos ADD COLUMN IF NOT EXISTS revisao_log JSONB NOT NULL DEFAULT '[]'::jsonb;
