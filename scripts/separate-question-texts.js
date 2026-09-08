#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const BATCH_SIZE = 500;
const TRUNCATION_LENGTH = 995;
const HEADER = /^Q(?:UEST[AÃ]O\s*)?(\d+)\s+(?:Item\s+)?(\d+)(?:\s*\(?(?:TPS\s*)?\d{4}\)?)?\s*:\s*/i;
const COMMAND = /(?:^|\n|(?<=[.!?])\s+)((?:(?:Com base|Com rela[cç][aã]o|A respeito|Acerca|Considerando|Tendo|Segundo|Based on|According to|Concerning|With reference to)\b|(?:Julgue|Analise|Avalie|Assinale|Examine|Judge)\b)[\s\S]*)$/i;

function normalize(value) {
  return String(value || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function metadataParts(question) {
  if (!question.explicacao) return null;
  try {
    const metadata = typeof question.explicacao === 'string' ? JSON.parse(question.explicacao) : question.explicacao;
    if (!metadata || (!metadata.item_text && !metadata.context_text && !metadata.command_text)) return null;
    return {
      texto_apoio: normalize(metadata.context_text),
      comando: normalize(metadata.command_text),
      enunciado: normalize(metadata.item_text),
    };
  } catch (_) {
    return null;
  }
}

function separateQuestion(question) {
  if (question.texto_apoio != null || question.comando != null) return { status: 'already-separated' };
  const fromMetadata = metadataParts(question);
  if (fromMetadata && fromMetadata.enunciado) return { status: 'separated', patch: fromMetadata };

  const original = normalize(question.enunciado);
  const withoutHeader = original.replace(HEADER, '');
  const separator = withoutHeader.lastIndexOf(' | ');
  if (separator < 0) {
    // Importadores antigos cortavam exatamente em 1.000 caracteres antes de
    // acrescentar o item. Esses registros não podem ser reconstruídos com
    // segurança e não devem continuar aparecendo como questões válidas.
    if (original.length >= TRUNCATION_LENGTH && /^exam/.test(question.source || '')) {
      return { status: 'quarantine', patch: { source: 'exam_quarantined' } };
    }
    return { status: 'unchanged' };
  }

  const item = normalize(withoutHeader.slice(separator + 3));
  let support = normalize(withoutHeader.slice(0, separator));
  let command = '';
  const commandMatch = support.match(COMMAND);
  if (commandMatch) {
    command = normalize(commandMatch[1]);
    support = normalize(support.slice(0, commandMatch.index));
  }
  if (!item) return { status: 'quarantine', patch: { source: 'exam_quarantined' } };
  return { status: 'separated', patch: { texto_apoio: support, comando: command, enunciado: item } };
}

async function fetchAll(supabase) {
  const rows = [];
  for (let offset = 0; ; offset += BATCH_SIZE) {
    const { data, error } = await supabase.from('questions').select('id,source,enunciado,explicacao,texto_apoio,comando').order('id').range(offset, offset + BATCH_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < BATCH_SIZE) return rows;
  }
}

async function main() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!process.env.SUPABASE_URL || !key) throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  const supabase = createClient(process.env.SUPABASE_URL, key);
  const questions = await fetchAll(supabase);
  const summary = {};
  for (const question of questions) {
    const result = separateQuestion(question);
    summary[result.status] = (summary[result.status] || 0) + 1;
    if (!DRY_RUN && result.patch) {
      const { error } = await supabase.from('questions').update(result.patch).eq('id', question.id);
      if (error) throw new Error(`Questão ${question.id}: ${error.message}`);
    }
  }
  console.log(JSON.stringify({ scanned: questions.length, dryRun: DRY_RUN, ...summary }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { normalize, separateQuestion };
