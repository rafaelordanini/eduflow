#!/usr/bin/env node
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

async function fetchAllQuestions(supabase) {
  const questions = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from('questions')
      .select('id,source,year,subject,topic,enunciado,opcoes,gabarito,explicacao')
      .order('id', { ascending: true })
      .range(offset, offset + 499);
    if (error) throw error;
    if (!data?.length) break;
    questions.push(...data);
    if (data.length < 500) break;
  }
  return questions;
}

async function main() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!process.env.SUPABASE_URL || !serviceKey) {
    throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  }

  const supabase = createClient(process.env.SUPABASE_URL, serviceKey);
  const questions = await fetchAllQuestions(supabase);
  const outputDirectory = path.join(process.cwd(), 'artifacts');
  fs.mkdirSync(outputDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(outputDirectory, 'questions-for-review.json'),
    `${JSON.stringify({ exportedAt: new Date().toISOString(), count: questions.length, questions }, null, 2)}\n`
  );
  console.log(`${questions.length} questões exportadas para análise.`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { fetchAllQuestions };
