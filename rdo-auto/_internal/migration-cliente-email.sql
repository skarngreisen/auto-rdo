-- RDO Auto - add client email to projects (for emailing the RDO PDF to the client)
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS cliente_email TEXT;
