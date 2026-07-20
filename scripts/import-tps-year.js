/**
 * Upload one curated CACD TPS exam year into Supabase.
 *
 * This script intentionally does not call any external AI. The questions must
 * already be curated by the agent/human from the original exam PDF and saved as
 * JSON before upload.
 *
 * Usage:
 *   node scripts/import-tps-year.js --year=2003 --dry-run
 *   node scripts/import-tps-year.js --year=2003 --input=data/processed/tps-2003.json
 *
 * Expected JSON shape:
 * {
 *   "year": 2003,
 *   "questions": [
 *     {
 *       "question_number": 1,
 *       "item_number": 1,
 *       "subject": "Português",
 *       "topic": "Interpretação de texto",
 *       "context_text": "texto introdutório completo",
 *       "command_text": "comando da questão",
 *       "item_text": "item a julgar",
 *       "gabarito_ce": "C",
 *       "image_note": null,
 *       "image_urls": []
 *     }
 *   ]
 * }
 *
 * Required env vars for non-dry-run uploads:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUBJECTS = [
  'Português',
  'Inglês',
  'História do Brasil',
  'História Mundial',
  'Política Internacional',
  'Economia',
  'Direito Interno',
  'Direito Internacional',
  'Geografia',
];

const ARGS = process.argv.slice(2);
const YEAR = Number((ARGS.find(arg => arg.startsWith('--year=')) || '--year=2003').replace('--year=', ''));
const INPUT_ARG = (ARGS.find(arg => arg.startsWith('--input=')) || '').replace('--input=', '');
const INPUT_FILE = path.resolve(process.cwd(), INPUT_ARG || path.join('data', 'processed', 'tps-' + YEAR + '.json'));
const DRY_RUN = ARGS.includes('--dry-run');
const BATCH_SIZE = 100;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + ' não configurada.');
  return value;
}

function failValidation(message, index) {
  const prefix = Number.isInteger(index) ? 'Questão índice ' + index + ': ' : '';
  throw new Error(prefix + message);
}

function normalizeText(value) {
  return String(value || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function loadCuratedFile() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error('Arquivo curado não encontrado: ' + path.relative(process.cwd(), INPUT_FILE));
  }
  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  if (Number(data.year) !== YEAR) throw new Error('Ano do arquivo (' + data.year + ') não confere com --year=' + YEAR);
  if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error('Arquivo não possui questions[].');
  return data.questions;
}

function validateQuestion(question, index) {
  if (!Number.isInteger(Number(question.question_number))) failValidation('question_number obrigatório.', index);
  if (!Number.isInteger(Number(question.item_number))) failValidation('item_number obrigatório.', index);
  if (!SUBJECTS.includes(question.subject)) failValidation('subject inválido: ' + question.subject, index);
  if (!normalizeText(question.topic)) failValidation('topic obrigatório.', index);
  if (!normalizeText(question.item_text)) failValidation('item_text obrigatório.', index);
  if (!['C', 'E'].includes(String(question.gabarito_ce || '').toUpperCase())) failValidation('gabarito_ce deve ser C ou E.', index);
  if (!normalizeText(question.context_text) && !normalizeText(question.command_text)) {
    failValidation('context_text ou command_text obrigatório.', index);
  }
}

function validateQuestions(questions) {
  const seen = new Set();
  questions.forEach(function(question, index) {
    validateQuestion(question, index);
    const key = Number(question.question_number) + '.' + Number(question.item_number);
    if (seen.has(key)) failValidation('item duplicado ' + key, index);
    seen.add(key);
  });
}

function toDbRows(year, questions) {
  return questions.map(function(question) {
    const context = normalizeText(question.context_text);
    const command = normalizeText(question.command_text);
    const item = normalizeText(question.item_text);
    const enunciado = [context, command].filter(Boolean).join('\n\n') + ' | ' + item;
    const metadata = {
      question_number: Number(question.question_number),
      item_number: Number(question.item_number),
      context_text: context,
      command_text: command,
      item_text: item,
      image_note: question.image_note || null,
      image_urls: Array.isArray(question.image_urls) ? question.image_urls : [],
      curated_by: 'Codex agent',
      imported_by: 'scripts/import-tps-year.js',
    };
    return {
      source: 'exam',
      year,
      subject: question.subject,
      topic: normalizeText(question.topic),
      enunciado,
      opcoes: { a: 'Certo', b: 'Errado' },
      gabarito: String(question.gabarito_ce || '').toUpperCase() === 'C' ? 'a' : 'b',
      explicacao: JSON.stringify(metadata),
    };
  });
}

async function upsertYear(year, rows) {
  const supabase = createClient(
    requiredEnv('SUPABASE_URL'),
    process.env.SUPABASE_SERVICE_ROLE_KEY || requiredEnv('SUPABASE_SERVICE_KEY')
  );
  const del = await supabase.from('questions').delete().eq('source', 'exam').eq('year', year);
  if (del.error) throw del.error;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const ins = await supabase.from('questions').insert(rows.slice(i, i + BATCH_SIZE));
    if (ins.error) throw ins.error;
  }
}

async function main() {
  const questions = loadCuratedFile();
  validateQuestions(questions);
  const rows = toDbRows(YEAR, questions);
  console.log('TPS ' + YEAR + ': arquivo curado validado com ' + rows.length + ' itens.');
  console.log('Entrada: ' + path.relative(process.cwd(), INPUT_FILE));

  if (DRY_RUN) {
    console.log('DRY RUN: validação concluída; nada foi inserido no Supabase.');
    console.log('Primeiro item:', JSON.stringify(rows[0], null, 2));
    return;
  }

  console.log('TPS ' + YEAR + ': atualizando Supabase...');
  await upsertYear(YEAR, rows);
  console.log('TPS ' + YEAR + ': concluído. Pare aqui e valide no site antes de seguir para o próximo ano.');
}

main().catch(function(error) {
  console.error('Falha no upload TPS:', error.message || error);
  process.exit(1);
});
