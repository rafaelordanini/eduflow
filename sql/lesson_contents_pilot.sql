-- Piloto de análise de conteúdo: Aula 1 de Geografia.
-- A estrutura já pode ser reutilizada para as demais aulas após a validação do piloto.
CREATE TABLE IF NOT EXISTS lesson_contents (
    id SERIAL PRIMARY KEY,
    lesson_id INTEGER NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
    transcript TEXT NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    suggested_title VARCHAR(255) NOT NULL DEFAULT '',
    topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
    references JSONB NOT NULL DEFAULT '[]'::jsonb,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'analyzing', 'ready', 'failed')),
    model VARCHAR(100),
    prompt_version INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_contents_status
    ON lesson_contents(processing_status);

DROP TRIGGER IF EXISTS trigger_lesson_contents_updated_at ON lesson_contents;
CREATE TRIGGER trigger_lesson_contents_updated_at
    BEFORE UPDATE ON lesson_contents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
