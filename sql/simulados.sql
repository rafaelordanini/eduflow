CREATE TABLE IF NOT EXISTS simulados (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL, -- 'custom' or 'cacd'
  config JSONB NOT NULL,
  questoes JSONB NOT NULL, -- array of question objects with user answers
  score INTEGER,
  total INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_simulados_user ON simulados(user_id, started_at DESC);
