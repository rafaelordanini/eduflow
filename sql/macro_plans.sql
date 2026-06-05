-- Macro Plans table: stores the AI-generated macro study plans (Plano Mestre)
CREATE TABLE IF NOT EXISTS macro_plans (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_json   JSONB NOT NULL,
  data_prova  DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS macro_plans_user_id_idx ON macro_plans(user_id);
CREATE INDEX IF NOT EXISTS macro_plans_created_at_idx ON macro_plans(created_at DESC);
