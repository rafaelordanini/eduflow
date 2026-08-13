const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { buildReview, parseCsv } = require('../scripts/review-all-question-classifications');

test('CSV parser preserves multiline statements and JSON alternatives', () => {
  const rows = parseCsv('id,subject,topic,enunciado,opcoes,explicacao\n1,Economia,,"linha 1\nlinha 2","{""a"":""Certo""}",\n');
  assert.equal(rows[0].enunciado, 'linha 1\nlinha 2');
  assert.deepEqual(JSON.parse(rows[0].opcoes), { a: 'Certo' });
});

test('global artifact covers every exported question and fixes the reported block', () => {
  const csv = fs.readFileSync('data/review/questions.csv', 'utf8');
  const generated = buildReview(csv);
  const checkedIn = JSON.parse(fs.readFileSync('data/review/question-classification-corrections.json', 'utf8'));
  assert.equal(generated.reviewed_count, 5620);
  assert.equal(generated.coverage.unique_ids, generated.reviewed_count);
  assert.equal(checkedIn.source_sha256, generated.source_sha256);
  for (const id of [14515, 14516, 14517, 14518]) {
    const correction = generated.corrections.find(item => item.id === id);
    assert.equal(correction.reviewed.subject, 'História do Brasil');
    assert.equal(correction.reviewed.topic, 'República de 1946 e regime militar');
  }
  for (const id of [14434, 14435, 14436]) {
    const correction = checkedIn.corrections.find(item => item.id === id);
    assert.equal(correction.reviewed.subject, 'Geografia');
    assert.equal(correction.reviewed.topic, 'Geopolítica');
  }
});
