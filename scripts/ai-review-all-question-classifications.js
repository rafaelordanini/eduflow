#!/usr/bin/env node
require('dotenv').config();

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { QUESTION_TAXONOMY } = require('../lib/question-taxonomy');
const { parseCsv } = require('./review-all-question-classifications');

const API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const BATCH_SIZE = Number(process.env.DEEPSEEK_AUDIT_BATCH_SIZE || 8);
const CONCURRENCY = Number(process.env.DEEPSEEK_AUDIT_CONCURRENCY || 3);
const MAX_ATTEMPTS = 5;
const SOURCE = path.join(__dirname, '..', 'data', 'review', 'questions.csv');
const OUTPUT_DIR = path.join(__dirname, '..', 'artifacts');
const CHECKPOINT = path.join(OUTPUT_DIR, 'deepseek-question-audit.checkpoint.json');
const AUDIT_OUTPUT = path.join(OUTPUT_DIR, 'deepseek-question-audit.json');
const CORRECTIONS_OUTPUT = path.join(OUTPUT_DIR, 'deepseek-question-classification-corrections.json');

const SYSTEM_PROMPT = `Você é o auditor acadêmico do banco de questões do CACD.
Analise semanticamente CADA questão, sem usar a classificação atual como evidência.
Identifique a habilidade efetivamente avaliada. Em questões de idioma, classifique pelo idioma e pela habilidade linguística, mesmo quando o texto-base tratar de história, direito ou economia.
Escolha subject e topic EXATAMENTE da taxonomia fornecida. Não invente rótulos.
Retorne uma decisão para cada ID, sem omitir, duplicar ou reordenar IDs.
confidence deve estar entre 0 e 1. reason deve ser uma justificativa objetiva em até 240 caracteres.
Retorne somente um objeto JSON válido no formato solicitado, sem markdown ou qualquer texto antes ou depois do JSON.`;

function questionPayload(row) {
  let options = null;
  try { options = row.opcoes ? JSON.parse(row.opcoes) : null; } catch { options = row.opcoes || null; }
  return {
    id: Number(row.id),
    current_subject: row.subject,
    current_topic: row.topic || null,
    statement: row.enunciado,
    options,
    explanation: row.explicacao || null,
  };
}

function buildPrompt(rows) {
  return JSON.stringify({
    taxonomy: QUESTION_TAXONOMY,
    questions: rows.map(questionPayload),
    response_schema: {
      decisions: [{ id: 'integer', subject: 'taxonomy key', topic: 'topic from selected subject', confidence: 'number 0..1', reason: 'string <= 240 chars' }],
    },
  });
}

function extractJson(content) {
  if (!content || !String(content).trim()) throw new Error('DeepSeek retornou conteúdo vazio em vez de JSON.');
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : content;
  const match = candidate.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? match[0] : candidate);
  } catch (error) {
    throw new Error(`DeepSeek retornou JSON incompleto ou inválido: ${error.message}`);
  }
}

function validateDecisions(rows, value) {
  if (!Array.isArray(value?.decisions) || value.decisions.length !== rows.length) throw new Error('Quantidade de decisões diferente da quantidade enviada.');
  const expectedIds = rows.map(row => Number(row.id));
  const seen = new Set();
  return value.decisions.map((decision, index) => {
    if (decision.id !== expectedIds[index] || seen.has(decision.id)) throw new Error(`ID ausente, duplicado ou fora de ordem: ${decision.id}.`);
    seen.add(decision.id);
    if (!Object.hasOwn(QUESTION_TAXONOMY, decision.subject)) throw new Error(`Matéria fora da taxonomia no ID ${decision.id}: ${decision.subject}.`);
    if (!QUESTION_TAXONOMY[decision.subject].includes(decision.topic)) throw new Error(`Tópico fora da taxonomia no ID ${decision.id}: ${decision.topic}.`);
    const confidence = Number(decision.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new Error(`Confiança inválida no ID ${decision.id}.`);
    return { id: decision.id, subject: decision.subject, topic: decision.topic, confidence, reason: String(decision.reason || '').slice(0, 240) };
  });
}

async function requestBatch(rows, apiKey, fetchImpl = fetch) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: buildPrompt(rows) }],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 6000,
        }),
      });
      if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
      const body = await response.json();
      return validateDecisions(rows, extractJson(body.choices?.[0]?.message?.content || ''));
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, 1000 * (2 ** (attempt - 1))));
    }
  }
  throw lastError;
}

async function reviewBatchAdaptive(rows, reviewer) {
  try {
    return await reviewer(rows);
  } catch (error) {
    if (rows.length === 1) {
      throw new Error(`Falha ao revisar a questão ${rows[0].id} após todas as tentativas: ${error.message}`);
    }
    // A long or unusually complex item can make the model truncate a whole
    // batch. Isolate it instead of discarding the progress of the global run.
    const middle = Math.ceil(rows.length / 2);
    console.warn(`Lote com IDs ${rows[0].id}–${rows[rows.length - 1].id} inválido; tentando dois lotes menores.`);
    const left = await reviewBatchAdaptive(rows.slice(0, middle), reviewer);
    const right = await reviewBatchAdaptive(rows.slice(middle), reviewer);
    return left.concat(right);
  }
}

function loadCheckpoint(sourceSha256) {
  if (!fs.existsSync(CHECKPOINT)) return new Map();
  const checkpoint = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
  if (checkpoint.source_sha256 !== sourceSha256 || checkpoint.model !== MODEL) return new Map();
  return new Map((checkpoint.decisions || []).map(item => [item.id, item]));
}

function saveCheckpoint(sourceSha256, decisions) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const ordered = [...decisions.values()].sort((a, b) => a.id - b.id);
  fs.writeFileSync(CHECKPOINT, `${JSON.stringify({ source_sha256: sourceSha256, model: MODEL, decisions: ordered }, null, 2)}\n`);
}

function buildOutputs(csvText, rows, decisions) {
  const ordered = rows.map(row => decisions.get(Number(row.id)));
  if (ordered.some(item => !item)) throw new Error('Auditoria incompleta: existem questões sem decisão da IA.');
  const sourceSha256 = crypto.createHash('sha256').update(csvText).digest('hex');
  const corrections = ordered.flatMap((decision, index) => {
    const row = rows[index];
    const expected = { subject: row.subject, topic: row.topic || null };
    const reviewed = { subject: decision.subject, topic: decision.topic };
    return expected.subject === reviewed.subject && expected.topic === reviewed.topic ? [] : [{ id: decision.id, expected, reviewed }];
  });
  const metadata = { schema_version: 2, source: 'data/review/questions.csv', source_sha256: sourceSha256, reviewed_at: new Date().toISOString(), reviewed_count: ordered.length, model: MODEL, method: 'Revisão semântica individual por DeepSeek V4' };
  return {
    audit: { ...metadata, decisions: ordered },
    corrections: { ...metadata, schema_version: 1, correction_count: corrections.length, corrections },
  };
}

async function runAudit({ csvText, apiKey, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY não configurada.');
  if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1 || !Number.isInteger(CONCURRENCY) || CONCURRENCY < 1) throw new Error('Batch size e concorrência devem ser inteiros positivos.');
  const rows = parseCsv(csvText);
  const sourceSha256 = crypto.createHash('sha256').update(csvText).digest('hex');
  const decisions = loadCheckpoint(sourceSha256);
  const pending = rows.filter(row => !decisions.has(Number(row.id)));
  const batches = [];
  for (let index = 0; index < pending.length; index += BATCH_SIZE) batches.push(pending.slice(index, index + BATCH_SIZE));
  let cursor = 0;
  async function worker() {
    while (cursor < batches.length) {
      const batch = batches[cursor++];
      const reviewed = await reviewBatchAdaptive(batch, rowsToReview => requestBatch(rowsToReview, apiKey, fetchImpl));
      reviewed.forEach(item => decisions.set(item.id, item));
      saveCheckpoint(sourceSha256, decisions);
      console.log(`${decisions.size}/${rows.length} questões revisadas pelo ${MODEL}.`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
  return buildOutputs(csvText, rows, decisions);
}

async function main() {
  const csvText = fs.readFileSync(SOURCE, 'utf8');
  const outputs = await runAudit({ csvText, apiKey: process.env.DEEPSEEK_API_KEY });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(AUDIT_OUTPUT, `${JSON.stringify(outputs.audit, null, 2)}\n`);
  fs.writeFileSync(CORRECTIONS_OUTPUT, `${JSON.stringify(outputs.corrections, null, 2)}\n`);
  fs.rmSync(CHECKPOINT, { force: true });
  console.log(`Auditoria concluída: ${outputs.audit.reviewed_count} decisões individuais; ${outputs.corrections.correction_count} correções.`);
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

module.exports = { buildPrompt, extractJson, validateDecisions, requestBatch, reviewBatchAdaptive, buildOutputs, runAudit };
