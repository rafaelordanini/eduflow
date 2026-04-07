-- ============================================================
-- EduFlow — Dados Iniciais (rode DEPOIS do schema.sql)
-- Cole este SQL no "SQL Editor" do Supabase e clique em "Run"
-- ============================================================

-- Habilitar extensão pgcrypto (necessária para senhas)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Usuários iniciais ─────────────────────────────────────────
-- Senhas entre parênteses — anote-as ou mude depois pelo painel admin
INSERT INTO users (username, password_hash, name, role) VALUES
  ('admin',  crypt('admin123',  gen_salt('bf', 10)), 'Administrador',   'admin'),
  ('prof',   crypt('prof123',   gen_salt('bf', 10)), 'Professor Carlos','admin'),
  ('maria',  crypt('maria123',  gen_salt('bf', 10)), 'Maria Silva',     'student'),
  ('joao',   crypt('joao123',   gen_salt('bf', 10)), 'João Santos',     'student'),
  ('ana',    crypt('ana123',    gen_salt('bf', 10)), 'Ana Oliveira',    'student');

-- ── Matérias de exemplo ───────────────────────────────────────
INSERT INTO subjects (name, description) VALUES
  ('Matemática Básica', 'Fundamentos de matemática para iniciantes'),
  ('Português',         'Gramática e interpretação de texto'),
  ('Ciências',          'Introdução às ciências naturais');

-- ── Aulas de exemplo ──────────────────────────────────────────
-- Os links do Google Drive estão vazios — adicione os seus pelo painel admin
INSERT INTO lessons (subject_id, title, drive_url, embed_url, duration_minutes, order_index) VALUES
  ((SELECT id FROM subjects WHERE name = 'Matemática Básica'), 'Introdução aos Números', '', '', 15, 1),
  ((SELECT id FROM subjects WHERE name = 'Matemática Básica'), 'Soma e Subtração',       '', '', 20, 2),
  ((SELECT id FROM subjects WHERE name = 'Matemática Básica'), 'Multiplicação',           '', '', 25, 3),
  ((SELECT id FROM subjects WHERE name = 'Português'),         'Alfabeto e Vogais',       '', '', 10, 1),
  ((SELECT id FROM subjects WHERE name = 'Português'),         'Formação de Palavras',    '', '', 18, 2),
  ((SELECT id FROM subjects WHERE name = 'Português'),         'Frases Simples',          '', '', 22, 3),
  ((SELECT id FROM subjects WHERE name = 'Ciências'),          'O Planeta Terra',         '', '', 20, 1),
  ((SELECT id FROM subjects WHERE name = 'Ciências'),          'A Água',                  '', '', 15, 2);

-- ============================================================
-- TABELA DE LOGINS INICIAIS (anote!)
-- ============================================================
-- | Usuário | Senha      | Perfil        |
-- |---------|------------|---------------|
-- | admin   | admin123   | Administrador |
-- | prof    | prof123    | Administrador |
-- | maria   | maria123   | Aluno         |
-- | joao    | joao123    | Aluno         |
-- | ana     | ana123     | Aluno         |
-- ============================================================
-- IMPORTANTE: Troque as senhas pelo painel admin após o primeiro acesso!
