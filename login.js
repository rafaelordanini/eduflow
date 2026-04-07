# EduFlow — Plataforma E-Learning

Plataforma de e-learning com autenticação, gerenciamento de matérias/aulas (vídeos do Google Drive), e tracking de progresso por aluno.

**Stack:** Vercel (Serverless) + Supabase (PostgreSQL) + HTML/CSS/JS

---

## Estrutura do Projeto

```
eduflow/
├── api/                        ← Funções serverless (backend)
│   ├── auth/
│   │   ├── login.js            Login
│   │   └── me.js               Dados do usuário logado
│   ├── users/
│   │   ├── index.js            Listar / Criar usuários
│   │   └── [id].js             Editar / Excluir usuário
│   ├── subjects/
│   │   ├── index.js            Listar / Criar matérias
│   │   └── [id].js             Editar / Excluir matéria
│   ├── lessons/
│   │   ├── index.js            Listar / Criar aulas
│   │   ├── [id].js             Editar / Excluir aula
│   │   └── reorder.js          Reordenar aulas
│   └── progress/
│       └── index.js            Ler / Salvar progresso do aluno
├── lib/
│   ├── supabase.js             Conexão com o banco
│   └── middleware.js            Autenticação e segurança
├── public/
│   └── index.html              ← Frontend (interface visual)
├── sql/
│   ├── schema.sql              ← Tabelas do banco de dados
│   └── seed.sql                ← Dados iniciais (usuários, matérias)
├── scripts/
│   └── seed.js                 ← (Opcional, para quem tem Node.js)
├── .env.example                Modelo das variáveis secretas
├── package.json                Dependências do projeto
├── vercel.json                 Configuração da Vercel
└── README.md                   Este arquivo
```

---

## GUIA COMPLETO — 100% Pelo Navegador (Sem Instalar Nada)

> **Você NÃO precisa instalar nada no computador.**
> Tudo será feito diretamente pelo navegador, em 3 sites: Supabase, GitHub e Vercel.
> Tempo estimado: ~25 minutos.

---

### ETAPA 1 — Criar uma conta no Supabase (banco de dados)

O Supabase é o serviço gratuito que vai guardar os dados (usuários, matérias, aulas, progresso dos alunos).

1. Abra o navegador e acesse: **https://supabase.com**
2. Clique no botão verde **"Start your project"** (canto superior direito)
3. Você verá opções de login. Clique em **"Continue with GitHub"**
   - **Se você ainda não tem conta no GitHub:**
     - Vai abrir a página do GitHub. Clique em **"Create an account"**
     - Preencha: username (nome de usuário), email, senha
     - Clique **"Create account"**
     - Confirme o email (abra sua caixa de entrada, clique no link de verificação)
     - Volte para **https://supabase.com** e refaça o passo 2
   - **Se já tem conta no GitHub:** digite seu usuário e senha e clique **"Sign in"**
4. O GitHub vai pedir permissão. Clique **"Authorize supabase"**
5. Pronto! Você está no **Dashboard do Supabase** (uma tela com fundo escuro)

---

### ETAPA 2 — Criar um projeto no Supabase

1. No Dashboard, clique no botão verde **"New Project"**
2. Um formulário vai aparecer. Preencha assim:
   - **Organization:** Já vem selecionada a sua (não precisa mudar)
   - **Name:** Apague o que estiver escrito e digite: `eduflow`
   - **Database Password:** Clique no botão **"Generate a password"** (gera uma senha automaticamente)
     - Você NÃO precisa anotar essa senha — ela não será usada no projeto
   - **Region:** Clique e escolha **"South America (São Paulo)"** (se estiver no Brasil)
     - Se não estiver no Brasil, escolha a região mais próxima de você
   - **Pricing Plan:** Deixe em **"Free"** (já vem selecionado)
3. Clique no botão verde **"Create new project"**
4. Vai aparecer uma tela com barras de carregamento. **Aguarde 1-2 minutos**
5. Quando tudo carregar, você verá o painel do projeto com informações como "Project API", "Database" etc.

---

### ETAPA 3 — Criar as tabelas no banco de dados

Agora vamos criar as 4 tabelas que guardam os dados da plataforma. Faremos isso colando um código SQL.

1. Olhe o **menu lateral esquerdo** do Supabase (coluna escura com ícones)
2. Procure e clique no ícone **"SQL Editor"**
   - É um ícone que parece um documento com os símbolos `<>` ou `{ }`
   - Fica mais ou menos no meio do menu
3. Vai abrir um editor de texto grande (área branca ou escura onde você pode digitar)
4. Se houver qualquer texto escrito no editor, **selecione tudo** (Ctrl+A) e **apague** (Delete)
5. Agora você precisa colar o conteúdo do arquivo `schema.sql`. **Copie TUDO abaixo** (desde o `CREATE TABLE` até o último `;`):

```sql
-- ============================================================
--  EduFlow — Schema do Banco de Dados
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(50)  UNIQUE NOT NULL,
    password_hash TEXT       NOT NULL,
    name        VARCHAR(120) NOT NULL,
    role        VARCHAR(10)  NOT NULL DEFAULT 'student'
                CHECK (role IN ('admin','student')),
    created_at  TIMESTAMPTZ  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subjects (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    description TEXT         DEFAULT '',
    created_at  TIMESTAMPTZ  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lessons (
    id                BIGSERIAL PRIMARY KEY,
    subject_id        BIGINT       NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title             VARCHAR(200) NOT NULL,
    drive_url         TEXT         DEFAULT '',
    embed_url         TEXT         DEFAULT '',
    duration_minutes  INT          DEFAULT 0,
    order_index       INT          DEFAULT 1,
    created_at        TIMESTAMPTZ  DEFAULT now()
);

CREATE TABLE IF NOT EXISTS progress (
    id                   BIGSERIAL PRIMARY KEY,
    user_id              BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id            BIGINT      NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    current_time_seconds INT         DEFAULT 0,
    completed            BOOLEAN     DEFAULT false,
    last_accessed        TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lessons_subject ON lessons(subject_id);
CREATE INDEX IF NOT EXISTS idx_progress_user   ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_lesson ON progress(lesson_id);
```

6. **Cole** o SQL copiado acima no editor do Supabase (Ctrl+V)
7. Clique no botão verde **"Run"** (fica no canto inferior direito do editor)
   - Ou pressione **Ctrl+Enter** no teclado
8. Vai aparecer uma mensagem verde: **"Success. No rows returned"**
   - Isso significa que **funcionou** — as tabelas foram criadas

**Para confirmar que deu certo:**
1. No menu lateral esquerdo, clique no ícone **"Table Editor"** (ícone de tabela/grade)
2. Na lista à esquerda, você deve ver **4 tabelas**: `users`, `subjects`, `lessons`, `progress`
3. Se aparecem as 4 tabelas, perfeito! Vá para a próxima etapa

---

### ETAPA 4 — Popular o banco com dados iniciais

Agora vamos criar os primeiros usuários e matérias de exemplo. Isso é feito com outro SQL.

1. Volte ao **"SQL Editor"** (clique no ícone no menu lateral esquerdo)
2. Clique em **"New query"** (botão no topo, ou no `+`) para abrir uma nova aba limpa
3. Se a aba não estiver vazia, selecione tudo (Ctrl+A) e apague (Delete)
4. **Copie TUDO abaixo** e cole no editor:

```sql
-- Habilitar extensão pgcrypto (necessária para senhas)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Usuários iniciais
INSERT INTO users (username, password_hash, name, role) VALUES
  ('admin',  crypt('admin123',  gen_salt('bf', 10)), 'Administrador',    'admin'),
  ('prof',   crypt('prof123',   gen_salt('bf', 10)), 'Professor Carlos', 'admin'),
  ('maria',  crypt('maria123',  gen_salt('bf', 10)), 'Maria Silva',      'student'),
  ('joao',   crypt('joao123',   gen_salt('bf', 10)), 'João Santos',      'student'),
  ('ana',    crypt('ana123',    gen_salt('bf', 10)), 'Ana Oliveira',     'student');

-- Matérias de exemplo
INSERT INTO subjects (name, description) VALUES
  ('Matemática Básica', 'Fundamentos de matemática para iniciantes'),
  ('Português',         'Gramática e interpretação de texto'),
  ('Ciências',          'Introdução às ciências naturais');

-- Aulas de exemplo (links do Drive estão vazios — adicione os seus pelo painel admin depois)
INSERT INTO lessons (subject_id, title, drive_url, embed_url, duration_minutes, order_index) VALUES
  ((SELECT id FROM subjects WHERE name = 'Matemática Básica'), 'Introdução aos Números', '', '', 15, 1),
  ((SELECT id FROM subjects WHERE name = 'Matemática Básica'), 'Soma e Subtração',       '', '', 20, 2),
  ((SELECT id FROM subjects WHERE name = 'Matemática Básica'), 'Multiplicação',           '', '', 25, 3),
  ((SELECT id FROM subjects WHERE name = 'Português'),         'Alfabeto e Vogais',       '', '', 10, 1),
  ((SELECT id FROM subjects WHERE name = 'Português'),         'Formação de Palavras',    '', '', 18, 2),
  ((SELECT id FROM subjects WHERE name = 'Português'),         'Frases Simples',          '', '', 22, 3),
  ((SELECT id FROM subjects WHERE name = 'Ciências'),          'O Planeta Terra',         '', '', 20, 1),
  ((SELECT id FROM subjects WHERE name = 'Ciências'),          'A Água',                  '', '', 15, 2);
```

5. Clique no botão verde **"Run"** (ou Ctrl+Enter)
6. Deve aparecer: **"Success. No rows returned"** — funcionou!

**Para confirmar:**
1. Clique em **"Table Editor"** no menu lateral
2. Clique na tabela **"users"** na lista à esquerda
3. Você deve ver 5 linhas: admin, prof, maria, joao, ana
4. Clique na tabela **"subjects"** — deve ter 3 linhas
5. Clique na tabela **"lessons"** — deve ter 8 linhas

**Logins criados (anote!):**

| Usuário  | Senha       | Perfil          |
|----------|-------------|-----------------|
| `admin`  | `admin123`  | Administrador   |
| `prof`   | `prof123`   | Administrador   |
| `maria`  | `maria123`  | Aluno           |
| `joao`   | `joao123`   | Aluno           |
| `ana`    | `ana123`    | Aluno           |

> ⚠️ **Troque as senhas** pelo painel admin depois do primeiro acesso!

---

### ETAPA 5 — Copiar as credenciais do Supabase

Precisamos de 2 informações para conectar o projeto ao banco. Vamos copiá-las e guardá-las temporariamente.

1. No menu lateral esquerdo do Supabase, clique em **"Project Settings"**
   - É o ícone de **engrenagem ⚙️** (geralmente o último ícone no menu, bem embaixo)
2. Na página que abrir, olhe o **submenu à esquerda** (lista de seções)
3. Clique em **"API"** (ou **"Data API"**, dependendo da versão do Supabase)
4. Agora você verá 2 informações importantes:

   **Primeira — Project URL:**
   - Procure a seção **"Project URL"** (ou **"API URL"**)
   - Há um campo com uma URL tipo: `https://abcdefgh.supabase.co`
   - Clique no botão de **copiar** (ícone 📋) ao lado dessa URL
   - **Abra o Bloco de Notas** (ou qualquer editor de texto) e cole. Escreva ao lado:
     ```
     SUPABASE_URL=https://abcdefgh.supabase.co
     ```

   **Segunda — Service Role Key:**
   - Mais abaixo, procure a seção **"Project API keys"**
   - Você verá DUAS chaves. **NÃO use a primeira** (a `anon public`)
   - Use a SEGUNDA chave, chamada **`service_role`** (tem um rótulo dizendo "secret")
   - Clique no botão de **copiar** (ícone 📋) ao lado dessa chave
   - Cole no Bloco de Notas e escreva ao lado:
     ```
     SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
     ```

5. Por fim, invente uma chave secreta qualquer (texto longo e aleatório). Exemplo:
   ```
   JWT_SECRET=minha-chave-secreta-eduflow-2025-xK9mB3nQ7vR2pL5s
   ```
   Pode ser qualquer texto com 20+ caracteres. Quanto mais longo e aleatório, melhor.

6. Seu Bloco de Notas agora deve ter algo assim (com seus valores reais):
   ```
   SUPABASE_URL=https://abcdefgh.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...chave-longa...
   JWT_SECRET=minha-chave-secreta-eduflow-2025-xK9mB3nQ7vR2pL5s
   ```
   **Mantenha o Bloco de Notas aberto** — vamos usar essas 3 informações na Etapa 8.

> ⚠️ **IMPORTANTE:** A chave `service_role` dá acesso total ao banco. Nunca publique ela em lugar público.

---

### ETAPA 6 — Criar uma conta no GitHub (repositório de código)

O GitHub vai guardar os arquivos do projeto. A Vercel precisa dele para publicar o site.

**Se você já tem conta no GitHub** (criou na Etapa 1), pule para o item 3.

1. Acesse: **https://github.com**
2. Se não tem conta, clique em **"Sign up"** e crie uma (é grátis)
3. Após fazer login, clique no **"+"** (ícone de mais, canto superior direito da tela) → **"New repository"**
4. Preencha o formulário:
   - **Repository name:** Digite `eduflow`
   - **Description:** Digite `Plataforma de E-Learning` (opcional)
   - **Visibilidade:** Selecione **"Private"** (privado — recomendado)
   - **Initialize this repository with:** Marque a caixa ✅ **"Add a README file"**
5. Clique no botão verde **"Create repository"**
6. Você verá a página do repositório com um arquivo README.md — perfeito!

---

### ETAPA 7 — Enviar os arquivos do projeto para o GitHub (pela web)

Agora vamos subir os arquivos do EduFlow para o repositório. Faremos isso diretamente pelo navegador.

**Primeiro, baixe o arquivo ZIP do projeto:**

1. Eu preparei um arquivo `.zip` com todos os arquivos do projeto. Faça o download dele.
2. Após baixar, **extraia o ZIP** no seu computador:
   - **Windows:** Clique com botão direito no arquivo → **"Extrair tudo..."** → **"Extrair"**
   - **Mac:** Dê dois cliques no arquivo .zip
   - Isso vai criar uma pasta chamada `eduflow` no seu computador

**Agora, envie os arquivos para o GitHub:**

3. No navegador, acesse seu repositório: **https://github.com/SEU_USUARIO/eduflow**
   (Troque `SEU_USUARIO` pelo seu nome de usuário do GitHub)
4. Clique no botão **"Add file"** (botão azul/cinza, acima da lista de arquivos) → **"Upload files"**
5. Vai abrir uma página com uma área de arraste grande
6. **Abra a pasta `eduflow` que você extraiu** no Explorador de Arquivos
7. **Selecione TODOS os arquivos e pastas dentro de `eduflow`** (Ctrl+A):
   - Pastas: `api`, `lib`, `public`, `sql`, `scripts`
   - Arquivos: `package.json`, `vercel.json`, `.env.example`, `.gitignore`
   - **NÃO envie** a pasta `node_modules` (se existir) nem o arquivo `.env`
8. **Arraste** tudo para a área de upload do GitHub (onde diz "Drag files here")
9. Aguarde o upload terminar — você verá os nomes dos arquivos aparecendo na lista
10. Embaixo, na seção **"Commit changes"**:
    - No campo de mensagem, digite: `Adicionar projeto EduFlow`
    - Deixe selecionado **"Commit directly to the `main` branch"**
11. Clique no botão verde **"Commit changes"**
12. Aguarde processar. Quando terminar, você verá os arquivos na página do repositório:
    - Pastas: `api/`, `lib/`, `public/`, `scripts/`, `sql/`
    - Arquivos: `package.json`, `vercel.json`, `.env.example`, `.gitignore`

> **Nota:** Se aparecer algum arquivo `README.md` duplicado, não tem problema — o GitHub vai usar o que está na raiz.

---

### ETAPA 8 — Criar conta na Vercel e publicar o site

A Vercel é o serviço gratuito que vai colocar sua plataforma no ar (acessível por qualquer pessoa com o link).

1. Abra o navegador e acesse: **https://vercel.com**
2. Clique em **"Sign Up"** (canto superior direito)
3. Clique em **"Continue with GitHub"** (use a mesma conta do GitHub)
4. Autorize o acesso clicando **"Authorize Vercel"**
5. Você está agora no **Dashboard da Vercel**

**Importar o projeto:**

6. Clique no botão **"Add New..."** (botão azul no topo) → **"Project"**
7. Na lista de repositórios do GitHub, encontre **"eduflow"** e clique em **"Import"**
   - Se a lista estiver vazia, clique em **"Adjust GitHub App Permissions"**
   - Vai abrir a configuração do GitHub. Clique em **"All repositories"** (ou selecione "eduflow")
   - Clique **"Save"** e volte à Vercel — agora "eduflow" deve aparecer
8. Na tela de configuração do projeto:
   - **Framework Preset:** Clique no dropdown e selecione **"Other"**
   - **Root Directory:** Deixe **vazio** (não mexa)
   - **Build Command:** Deixe **vazio** (apague se tiver algo)
   - **Output Directory:** Digite `public`

**Adicionar as variáveis de ambiente (as 3 chaves do Bloco de Notas):**

9. Clique em **"Environment Variables"** para expandir essa seção
10. Agora adicione as 3 variáveis, uma por vez:

    **Primeira variável:**
    - No campo **"Key"** (campo da esquerda), digite exatamente: `SUPABASE_URL`
    - No campo **"Value"** (campo da direita), cole a URL do Supabase:
      `https://abcdefgh.supabase.co` (a que está no seu Bloco de Notas)
    - Clique no botão **"Add"**

    **Segunda variável:**
    - **Key:** `SUPABASE_SERVICE_KEY`
    - **Value:** cole a chave `service_role` inteira (texto longo começando com `eyJ...`)
    - Clique **"Add"**

    **Terceira variável:**
    - **Key:** `JWT_SECRET`
    - **Value:** cole a chave secreta que você inventou
    - Clique **"Add"**

11. Confira que as **3 variáveis** aparecem listadas abaixo do formulário
12. Clique no botão azul **"Deploy"**
13. **Aguarde 1-2 minutos** — vai aparecer um log de progresso
14. Quando aparecer a tela de **"Congratulations!"** com confetes 🎉, o site está no ar!

---

### ETAPA 9 — Acessar sua plataforma pela primeira vez

1. Na tela de congratulações da Vercel, você verá a **URL do seu site**. Será algo como:
   ```
   https://eduflow-xxxxxx.vercel.app
   ```
   (O `xxxxxx` é gerado automaticamente pela Vercel)
2. **Clique nessa URL** para abrir o site
3. Você verá a **tela de login do EduFlow** (fundo com tons de verde/terracota)
4. Para entrar como **administrador**:
   - No campo **"Usuário"**, digite: `admin`
   - No campo **"Senha"**, digite: `admin123`
   - Clique no botão **"Entrar"**
5. Você verá o **painel do administrador** com as matérias criadas

**Para testar como aluno:**
6. Clique no botão de **logout** (ícone 🚪 no canto superior direito)
7. Na tela de login, entre com:
   - **Usuário:** `maria`
   - **Senha:** `maria123`
8. Você verá a **tela do aluno** com as matérias disponíveis

**🎉 Pronto! Sua plataforma está funcionando!**

Compartilhe a URL com seus alunos. Cada aluno entra com o usuário/senha que o admin cadastrou.

---

## Após o Deploy — Tarefas do Dia a Dia

### Como trocar a senha do admin

1. Faça login como `admin` no site
2. Clique em **"Usuários"** na barra superior
3. Na linha do admin, clique no ícone de **lápis ✏️** (editar)
4. No campo **"Nova Senha"**, digite a nova senha (mínimo 4 caracteres)
5. Clique em **"Salvar"**

### Como cadastrar um novo aluno

1. Faça login como admin
2. Clique em **"Usuários"** na barra superior
3. Clique no botão **"Novo Usuário"**
4. Preencha os campos:
   - **Nome Completo:** Ex: `Pedro Costa`
   - **Usuário (login):** Ex: `pedro.costa`
   - **Senha:** Ex: `pedro123` (mínimo 4 caracteres)
   - **Perfil:** Selecione **"Aluno"**
5. Clique em **"Criar Usuário"**
6. Informe ao aluno: o endereço do site, o usuário e a senha

### Como adicionar uma aula com vídeo do Google Drive

1. Acesse **https://drive.google.com** e faça login
2. Faça upload do vídeo: clique em **"+ Novo"** → **"Upload de arquivo"** → selecione o vídeo
3. Após o upload, clique com o **botão direito** no vídeo → **"Compartilhar"** → **"Compartilhar"**
4. Em **"Acesso geral"**, clique no dropdown e mude de "Restrito" para **"Qualquer pessoa com o link"**
5. Clique em **"Copiar link"** (botão azul) e depois **"Concluído"**
6. No EduFlow (logado como admin):
   - Clique em **"Matérias"** na barra superior
   - Clique na matéria desejada para abrir
   - Clique no botão **"Nova Aula"**
   - **Título:** Escreva o nome da aula
   - **Link Google Drive:** Cole o link que copiou (Ctrl+V)
   - **Duração (min):** Escreva a duração em minutos
   - Clique em **"Adicionar Aula"**
7. O sistema converte automaticamente o link para o formato de player embutido

### Como reordenar aulas

1. Na tela de gerenciamento de aulas, use as setas **↑ ↓** ao lado de cada aula
2. A ordem é salva automaticamente

---

## Funcionalidades

| Recurso | Descrição |
|---------|-----------|
| **Login com usuário/senha** | Autenticação segura via JWT com bcrypt |
| **Perfis: Admin e Aluno** | Controle de acesso por perfil |
| **CRUD de Matérias** | Criar, editar, excluir matérias |
| **CRUD de Aulas** | Vídeos via Google Drive (conversão automática) |
| **Ordenação de Aulas** | Reordenar com setas ↑↓ |
| **CRUD de Usuários** | Admin gerencia todos os acessos |
| **Tracking de Progresso** | Salva minuto/segundo exato por aluno |
| **Retomada Automática** | Ao reabrir, vídeo continua de onde parou |
| **Marcar como Concluída** | Toggle por aula |
| **Progresso por Matéria** | Barra de % baseada nas aulas concluídas |
| **Dark Mode** | Detecta preferência do sistema automaticamente |
| **Responsivo** | Funciona em desktop, tablet e celular |

---

## Resolução de Problemas

| Problema | O que fazer |
|----------|-------------|
| Tela de login aparece mas dá erro ao entrar | Vá na Vercel → Settings → Environment Variables → confira se as 3 variáveis estão corretas (SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET) |
| Tela completamente branca após deploy | Na Vercel → Settings → General → "Output Directory" deve ser `public` |
| "Success" no SQL mas tabelas não aparecem | Clique em "Table Editor" no menu lateral do Supabase e atualize a página (F5) |
| Vídeo não carrega / tela preta | O vídeo no Google Drive precisa estar compartilhado como "Qualquer pessoa com o link" |
| "Invalid JWT" ou "Unauthorized" | O JWT_SECRET deve ser o MESMO na Vercel e o que foi usado antes. Se mudou, refaça o deploy |
| Quero mudar alguma variável de ambiente | Na Vercel: Settings → Environment Variables → edite o valor → depois clique em "Deployments" → nos 3 pontinhos "..." do último deploy → "Redeploy" |
| Upload de arquivos no GitHub falhou | Tente arrastar menos arquivos por vez (primeiro as pastas api, lib, public, sql, scripts; depois os arquivos soltos) |
| Repositório no GitHub ficou vazio | Certifique-se de que marcou "Add a README file" ao criar. Se não marcou, delete o repo e crie novamente marcando essa opção |
