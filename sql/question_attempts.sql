CREATE TABLE IF NOT EXISTS question_attempts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE SET NULL,
  subject VARCHAR(100) NOT NULL,
  topic VARCHAR(200),
  correct BOOLEAN NOT NULL,
  simulado_id INTEGER REFERENCES simulados(id) ON DELETE SET NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON question_attempts(user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_subject ON question_attempts(user_id, subject);
