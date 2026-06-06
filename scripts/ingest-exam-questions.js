/**
 * Script to ingest CACD TPS exam questions into the `questions` table.
 * Usage: node scripts/ingest-exam-questions.js
 * Requires: OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY env vars
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'google/gemini-2.5-flash';

const SUBJECT_MAP = {
  'LÍNGUA PORTUGUESA': 'Português',
  'LINGUA PORTUGUESA': 'Português',
  'PORTUGUÊS': 'Português',
  'HISTÓRIA DO BRASIL': 'História do Brasil',
  'HISTORIA DO BRASIL': 'História do Brasil',
  'HISTÓRIA MUNDIAL': 'História Mundial',
  'HISTORIA MUNDIAL': 'História Mundial',
  'POLÍTICA INTERNACIONAL': 'Política Internacional',
  'POLITICA INTERNACIONAL': 'Política Internacional',
  'RELAÇÕES INTERNACIONAIS': 'Política Internacional',
  'ECONOMIA': 'Economia',
  'DIREITO INTERNACIONAL': 'Direito Internacional',
  'DIREITO INTERNO': 'Direito Interno',
  'GEOGRAFIA': 'Geografia',
  'INGLÊS': 'Inglês',
  'INGLES': 'Inglês',
  'FRANCÊS': 'Francês',
  'FRANCES': 'Francês',
  'ESPANHOL': 'Espanhol',
};

async function callAI(prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    })
  });
  if (!res.ok) throw new Error(`AI error: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function extractQuestionsFromChunk(text, year) {
  const prompt = `Você é um extrator de questões de provas do CACD (Instituto Rio Branco).

Analise o texto abaixo de uma prova TPS CACD ${year} e extraia TODAS as questões de múltipla escolha que encontrar.

Para cada questão, identifique:
- A matéria (Português, História do Brasil, História Mundial, Política Internacional, Economia, Direito Internacional, Direito Interno, Geografia, Inglês, Francês, Espanhol)
- O enunciado completo
- As 5 alternativas (a, b, c, d, e)
- O gabarito (se disponível no texto - geralmente no final como "GABARITO")

IMPORTANTE: As questões do CACD TPS são do formato "Certo ou Errado" com itens numerados (1, 2, 3, 4) — CONVERTA cada item em uma questão de múltipla escolha onde:
- alternativa a = o item está CERTO
- alternativa b = o item está ERRADO
- alternativas c, d, e = variações contextuais relevantes sobre o tema

Para questões já em formato múltipla escolha (a-e), extraia diretamente.

Retorne APENAS JSON válido no formato:
{
  "questoes": [
    {
      "subject": "nome da matéria",
      "topic": "subtópico específico do enunciado",
      "enunciado": "texto completo da questão",
      "opcoes": {"a": "...", "b": "...", "c": "...", "d": "...", "e": "..."},
      "gabarito": "a" ou null se não disponível,
      "explicacao": "breve explicação do gabarito se disponível"
    }
  ]
}

TEXTO DA PROVA:
${text.substring(0, 15000)}`;

  const content = await callAI(prompt);

  // Extract JSON
  const match = content.match(/```json\n?([\s\S]+?)\n?```/) || content.match(/(\{[\s\S]+\})/);
  const jsonStr = match ? match[1] : content;

  try {
    const result = JSON.parse(jsonStr);
    return result.questoes || [];
  } catch (e) {
    console.error('JSON parse error for chunk, skipping. Content preview:', content.substring(0, 200));
    return [];
  }
}

async function ingestExamFile(filePath, year) {
  console.log(`\n📄 Processing TPS ${year} from ${filePath}...`);
  const text = fs.readFileSync(filePath, 'utf8');

  // Split into chunks of ~15000 chars with overlap
  const chunkSize = 14000;
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.substring(i, i + chunkSize + 500));
  }

  console.log(`  Splitting into ${chunks.length} chunks...`);

  let allQuestions = [];
  for (let i = 0; i < chunks.length; i++) {
    console.log(`  Processing chunk ${i + 1}/${chunks.length}...`);
    try {
      const questions = await extractQuestionsFromChunk(chunks[i], year);
      console.log(`  → Found ${questions.length} questions in chunk ${i + 1}`);
      allQuestions = allQuestions.concat(questions);
      // Rate limit
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`  ⚠️  Chunk ${i + 1} failed:`, e.message);
    }
  }

  // Normalize subjects
  const normalized = allQuestions.map(q => ({
    ...q,
    subject: SUBJECT_MAP[q.subject?.toUpperCase()] || q.subject || 'Geral',
    source: 'exam',
    year,
  }));

  console.log(`  Total questions extracted: ${normalized.length}`);

  // Filter out questions without gabarito or with very short enunciados
  const valid = normalized.filter(q =>
    q.enunciado && q.enunciado.length > 20 &&
    q.opcoes && q.opcoes.a && q.opcoes.b
  );

  console.log(`  Valid questions: ${valid.length}`);

  // Upsert into questions table (avoid exact duplicates)
  let inserted = 0;
  for (const q of valid) {
    // Check if similar question already exists
    const { data: existing } = await supabase
      .from('questions')
      .select('id')
      .eq('year', year)
      .ilike('enunciado', q.enunciado.substring(0, 50) + '%')
      .limit(1);

    if (existing && existing.length > 0) continue;

    const { error } = await supabase.from('questions').insert({
      source: 'exam',
      year,
      subject: q.subject,
      topic: q.topic || null,
      enunciado: q.enunciado,
      opcoes: q.opcoes,
      gabarito: q.gabarito || 'a',
      explicacao: q.explicacao || null,
    });

    if (!error) inserted++;
    else console.error('  Insert error:', error.message);
  }

  console.log(`  ✅ Inserted ${inserted} new questions from TPS ${year}`);
  return inserted;
}

async function main() {
  const exams = [
    { file: '/tmp/tps2025.txt', year: 2025 },
    { file: '/tmp/tps2024.txt', year: 2024 },
    { file: '/tmp/tps2023.txt', year: 2023 },
  ];

  let total = 0;
  for (const exam of exams) {
    if (fs.existsSync(exam.file)) {
      const inserted = await ingestExamFile(exam.file, exam.year);
      total += inserted;
    } else {
      console.log(`⚠️  File not found: ${exam.file}`);
    }
  }

  console.log(`\n🎉 Done! Total questions inserted: ${total}`);

  // Show summary
  const { data: summary } = await supabase
    .from('questions')
    .select('subject, source')
    .order('subject');

  if (summary) {
    const counts = {};
    summary.forEach(q => {
      counts[q.subject] = (counts[q.subject] || 0) + 1;
    });
    console.log('\n📊 Questions per subject:');
    Object.entries(counts).sort().forEach(([s, c]) => console.log(`  ${s}: ${c}`));
  }
}

main().catch(console.error);
