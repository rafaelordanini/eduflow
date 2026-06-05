-- Tabela para armazenar planos de estudo diários gerados pelo Barão
CREATE TABLE IF NOT EXISTS daily_plans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_date DATE NOT NULL DEFAULT CURRENT_DATE,
    hours_available NUMERIC(4,1) NOT NULL,
    focus_subjects TEXT,
    plan_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_plans_user_date ON daily_plans(user_id, plan_date DESC);
