-- RDO Auto - track when the RDO PDF was emailed (dedup for the beta auto-send)
ALTER TABLE rdos ADD COLUMN IF NOT EXISTS pdf_enviado_em TIMESTAMPTZ;
