-- Separa os componentes das questões sem limitar o tamanho do texto de apoio.
-- A aplicação desta migração é não destrutiva: enunciado continua obrigatório e
-- o front-end mantém compatibilidade com registros antigos durante a varredura.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS texto_apoio TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS comando TEXT;

COMMENT ON COLUMN questions.texto_apoio IS 'Texto longo/contexto compartilhado pelos itens da questão';
COMMENT ON COLUMN questions.comando IS 'Comando curto que orienta o candidato';
