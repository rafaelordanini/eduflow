const test = require('node:test');
const assert = require('node:assert/strict');
const { formatContext, searchGuides, termsFor } = require('../lib/baron-knowledge');

test('extracts useful search terms without common Portuguese words', () => {
  assert.deepEqual(termsFor('O que os guias dizem sobre revisão de História?'), ['dizem', 'revisao', 'historia']);
});

test('retrieves relevant passages from the approved-candidate guides', () => {
  const results = searchGuides('revisão bibliografia preparação');
  assert.ok(results.length > 0);
  assert.equal(results[0].type, 'guide');
  assert.ok(results[0].title && results[0].year);
});

test('labels source types and caps documentary context', () => {
  const context = formatContext([
    { type: 'exam', title: 'Prova CACD 2024', questionId: 7, content: 'A'.repeat(300) },
    { type: 'guide', title: '2024 - Saruê', page: 12, content: 'B'.repeat(300) }
  ], 250);
  assert.match(context, /PROVA OFICIAL/);
  assert.ok(context.length <= 250);
});
