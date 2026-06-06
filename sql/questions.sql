CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  source VARCHAR(20) NOT NULL DEFAULT 'ai', -- 'exam' or 'ai'
  year INTEGER, -- exam year (null if AI-generated)
  subject VARCHAR(100) NOT NULL,
  topic VARCHAR(200),
  enunciado TEXT NOT NULL,
  opcoes JSONB NOT NULL, -- {"a":"...","b":"...","c":"...","d":"...","e":"..."}
  gabarito VARCHAR(1) NOT NULL, -- 'a','b','c','d','e'
  explicacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_source ON questions(source);
CREATE INDEX IF NOT EXISTS idx_questions_year ON questions(year);
