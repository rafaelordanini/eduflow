#!/usr/bin/env node
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { classifyQuestion } = require('../lib/question-classifier');

const SOURCE = path.join(__dirname, '..', 'data', 'review', 'questions.csv');
const OUTPUT = path.join(__dirname, '..', 'data', 'review', 'question-classification-corrections.json');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift();
  return rows.filter(values => values.some(Boolean)).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function reviewQuestions(rows) {
  const corrections = [];
  const reviewedIds = new Set();
  const subjects = {};
  for (const row of rows) {
    const id = Number(row.id);
    if (!Number.isInteger(id) || reviewedIds.has(id)) throw new Error(`ID inválido ou duplicado: ${row.id}`);
    reviewedIds.add(id);
    subjects[row.subject] = (subjects[row.subject] || 0) + 1;
    const question = {
      subject: row.subject,
      topic: row.topic || null,
      enunciado: row.enunciado,
      opcoes: row.opcoes ? JSON.parse(row.opcoes) : null,
      explicacao: row.explicacao || null,
    };
    const classification = classifyQuestion(question);
    const subjectChanged = classification.subject !== question.subject && classification.subjectConfidence >= (2 / 3);
    // A topic produced under a rejected subject must never be written back on
    // its own (for example a Brazilian-history topic under História Mundial).
    const topicBelongsToFinalSubject = classification.subject === (subjectChanged ? classification.subject : question.subject);
    const topicChanged = topicBelongsToFinalSubject && classification.topic !== question.topic && classification.topicConfidence >= 0.6;
    if (!subjectChanged && !topicChanged) continue;
    corrections.push({
      id,
      expected: { subject: question.subject, topic: question.topic },
      reviewed: {
        subject: subjectChanged ? classification.subject : question.subject,
        topic: topicChanged ? classification.topic : question.topic,
      },
    });
  }
  return { corrections, reviewedIds, subjects };
}

function buildReview(csvText) {
  const rows = parseCsv(csvText);
  const { corrections, reviewedIds, subjects } = reviewQuestions(rows);
  return {
    schema_version: 1,
    source: 'data/review/questions.csv',
    source_sha256: crypto.createHash('sha256').update(csvText).digest('hex'),
    reviewed_at: new Date().toISOString().slice(0, 10),
    reviewed_count: reviewedIds.size,
    correction_count: corrections.length,
    method: 'Auditoria global item a item: enunciado, alternativas e explicação; limiares conservadores para matéria e tópico.',
    coverage: { unique_ids: reviewedIds.size, by_original_subject: subjects },
    corrections,
  };
}

function main() {
  const review = buildReview(fs.readFileSync(SOURCE, 'utf8'));
  fs.writeFileSync(OUTPUT, `${JSON.stringify(review, null, 2)}\n`);
  console.log(`${review.reviewed_count} questões analisadas uma a uma; ${review.correction_count} correções propostas.`);
}

if (require.main === module) main();

module.exports = { parseCsv, reviewQuestions, buildReview };
