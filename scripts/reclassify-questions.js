#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { classifyQuestion } = require('../lib/question-classifier');

const apply = process.argv.includes('--apply');

async function main() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!process.env.SUPABASE_URL || !serviceKey) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY).');
  }
  const supabase = createClient(process.env.SUPABASE_URL, serviceKey);

  let offset = 0;
  let reviewed = 0;
  let changed = 0;
  const changes = [];

  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('id,subject,topic,enunciado,opcoes,explicacao')
      .order('id', { ascending: true })
      .range(offset, offset + 499);
    if (error) throw error;
    if (!data?.length) break;

    for (const question of data) {
      reviewed += 1;
      const classification = classifyQuestion(question);
      const subjectChanged = classification.subject !== question.subject && classification.subjectConfidence >= 0.67;
      const topicChanged = classification.topic !== question.topic && classification.topicConfidence >= 0.6;
      if (!subjectChanged && !topicChanged) continue;

      const patch = {
        ...(subjectChanged && { subject: classification.subject }),
        ...(topicChanged && { topic: classification.topic }),
      };
      changes.push({ id: question.id, from: `${question.subject} / ${question.topic || '—'}`, to: `${patch.subject || question.subject} / ${patch.topic || question.topic || '—'}` });
      if (apply) {
        const { error: updateError } = await supabase.from('questions').update(patch).eq('id', question.id);
        if (updateError) throw updateError;
      }
      changed += 1;
    }
    offset += data.length;
  }

  console.table(changes);
  console.log(`${reviewed} questões revisadas; ${changed} ${apply ? 'realocadas' : 'realocações propostas (dry-run)'}.`);
  if (!apply) console.log('Execute novamente com --apply para persistir as alterações.');
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
