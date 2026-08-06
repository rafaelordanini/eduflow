const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const appSource = fs.readFileSync('public/js/app.js', 'utf8');

test('review generation uses a response-sized batch and falls back to the exam bank', () => {
  const start = appSource.indexOf('function abrirRevisaoPlano(');
  const end = appSource.indexOf('\nfunction conferirRevisao(', start);
  const reviewSource = appSource.slice(start, end);

  assert.ok(start >= 0 && end > start, 'review function should exist');
  assert.match(reviewSource, /lessonTitle: preciseTopic, count: 5/);
  assert.match(reviewSource, /\.catch\(function\(\) \{[\s\S]*source=exam&limit=5/);
  assert.match(reviewSource, /Tentar novamente/);
});
