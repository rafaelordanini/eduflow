#!/usr/bin/env node
require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const DEFAULT_REVIEW = path.join(__dirname, '..', 'data', 'review', 'question-classification-corrections.json');
const DEFAULT_SOURCE = path.join(__dirname, '..', 'data', 'review', 'questions.csv');

function normalizeTopic(value) {
  return value === '' || value === undefined ? null : value;
}

function validateReview(review) {
  if (review?.schema_version !== 1 || !Array.isArray(review.corrections)) {
    throw new Error('Arquivo de revisão inválido: schema_version 1 e corrections são obrigatórios.');
  }
  if (!Number.isInteger(review.reviewed_count) || review.reviewed_count < review.corrections.length) {
    throw new Error('Arquivo de revisão inválido: reviewed_count inconsistente.');
  }
  if (review.correction_count !== review.corrections.length) {
    throw new Error('Arquivo de revisão inválido: correction_count inconsistente.');
  }

  const ids = new Set();
  for (const correction of review.corrections) {
    if (!Number.isInteger(correction.id) || ids.has(correction.id)) {
      throw new Error(`ID inválido ou duplicado na revisão: ${correction.id}.`);
    }
    ids.add(correction.id);
    for (const state of ['expected', 'reviewed']) {
      if (!correction[state] || typeof correction[state].subject !== 'string' || !correction[state].subject.trim()) {
        throw new Error(`Correção ${correction.id} não possui ${state}.subject válido.`);
      }
      correction[state].topic = normalizeTopic(correction[state].topic);
      if (correction[state].topic !== null && typeof correction[state].topic !== 'string') {
        throw new Error(`Correção ${correction.id} não possui ${state}.topic válido.`);
      }
    }
  }
  return review;
}

function assertSourceIntegrity(review, sourceText) {
  if (!review.source_sha256) return;
  const actual = require('node:crypto').createHash('sha256').update(sourceText).digest('hex');
  if (actual !== review.source_sha256) {
    throw new Error('Revisão abortada: o CSV de origem mudou depois da auditoria global. Exporte e revise novamente.');
  }
}

async function fetchCurrent(supabase, corrections) {
  const rows = [];
  for (let offset = 0; offset < corrections.length; offset += 100) {
    const ids = corrections.slice(offset, offset + 100).map(item => item.id);
    const { data, error } = await supabase.from('questions').select('id,subject,topic').in('id', ids);
    if (error) throw error;
    rows.push(...data);
  }
  return new Map(rows.map(row => [Number(row.id), row]));
}

function assertPreconditions(corrections, currentById) {
  const stale = corrections.filter(correction => {
    const current = currentById.get(correction.id);
    if (!current) return true;
    const matches = state => current.subject === state.subject && normalizeTopic(current.topic) === state.topic;
    // A previous partial/global run is safe to resume when a row has already
    // reached the reviewed state.
    return !matches(correction.expected) && !matches(correction.reviewed);
  });
  if (stale.length) {
    const ids = stale.slice(0, 20).map(item => item.id).join(', ');
    throw new Error(`Revisão abortada: ${stale.length} registros ausentes ou alterados desde a exportação (${ids}${stale.length > 20 ? ', …' : ''}).`);
  }
}

async function applyCorrections(supabase, corrections) {
  const applied = [];
  try {
    for (const correction of corrections) {
      const { data: current, error: readError } = await supabase.from('questions').select('subject,topic').eq('id', correction.id).single();
      if (readError) throw readError;
      if (current.subject === correction.reviewed.subject && normalizeTopic(current.topic) === correction.reviewed.topic) continue;
      let query = supabase.from('questions')
        .update(correction.reviewed)
        .eq('id', correction.id)
        .eq('subject', correction.expected.subject);
      query = correction.expected.topic === null ? query.is('topic', null) : query.eq('topic', correction.expected.topic);
      const { data, error } = await query.select('id');
      if (error) throw error;
      if (data.length !== 1) throw new Error(`A pré-condição deixou de ser válida para a questão ${correction.id}.`);
      applied.push(correction);
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const correction of applied.reverse()) {
      const { error: rollbackError } = await supabase.from('questions').update(correction.expected).eq('id', correction.id);
      if (rollbackError) rollbackErrors.push(`${correction.id}: ${rollbackError.message}`);
    }
    if (rollbackErrors.length) error.message += ` Falhas no rollback: ${rollbackErrors.join('; ')}`;
    throw error;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const fileArgument = process.argv.find(argument => argument.startsWith('--file='));
  const reviewPath = fileArgument ? path.resolve(fileArgument.slice('--file='.length)) : DEFAULT_REVIEW;
  const review = validateReview(JSON.parse(fs.readFileSync(reviewPath, 'utf8')));
  if (review.source === 'data/review/questions.csv') assertSourceIntegrity(review, fs.readFileSync(DEFAULT_SOURCE, 'utf8'));
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!process.env.SUPABASE_URL || !serviceKey) throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  if (apply && process.env.CONFIRM_QUESTION_REVIEW !== 'APPLY') {
    throw new Error('Para aplicar, defina CONFIRM_QUESTION_REVIEW=APPLY.');
  }

  const supabase = createClient(process.env.SUPABASE_URL, serviceKey);
  const current = await fetchCurrent(supabase, review.corrections);
  assertPreconditions(review.corrections, current);
  console.log(`${review.reviewed_count} questões revisadas; ${review.correction_count} correções validadas.`);
  if (!apply) return console.log('Dry-run concluído; nenhum registro foi alterado.');
  await applyCorrections(supabase, review.corrections);
  console.log(`${review.corrections.length} correções aplicadas com sucesso.`);
}

if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });

module.exports = { normalizeTopic, validateReview, assertSourceIntegrity, assertPreconditions };
