-- Lesson Questions table: caches AI-generated CACD-style questions per lesson
CREATE TABLE IF NOT EXISTS lesson_questions (
  id          SERIAL PRIMARY KEY,
  lesson_id   INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  questoes    JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lesson_id)
);

CREATE INDEX IF NOT EXISTS lesson_questions_lesson_id_idx ON lesson_questions(lesson_id);
