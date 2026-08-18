const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isPilotLesson,
  normalizeAnalysis,
  formatLessonContext,
  loadStaticPilotContent
} = require('../lib/lesson-content');

test('restricts the pilot to Geography lesson one', () => {
  assert.equal(isPilotLesson({ order_index: 1 }, { name: 'Geografia' }), true);
  assert.equal(isPilotLesson({ order_index: 2 }, { name: 'Geografia' }), false);
  assert.equal(isPilotLesson({ order_index: 1 }, { name: 'Economia' }), false);
});

test('returns no static pilot content before the workflow publishes it', () => {
  assert.equal(loadStaticPilotContent(999999), null);
});

test('normalizes a valid DeepSeek analysis', () => {
  const value = normalizeAnalysis({
    suggested_title: ' História do pensamento geográfico ',
    summary: ' A aula apresenta a formação da Geografia. ',
    topics: ['Geografia clássica', 'Ratzel'],
    keywords: ['território'],
    references: ['Obra mencionada']
  });
  assert.equal(value.suggested_title, 'História do pensamento geográfico');
  assert.deepEqual(value.topics, ['Geografia clássica', 'Ratzel']);
});

test('rejects incomplete analyses and formats only ready content', () => {
  assert.throws(() => normalizeAnalysis({ summary: 'sem tópicos' }), /não contém/);
  assert.equal(formatLessonContext({ processing_status: 'failed' }), '');
  assert.match(formatLessonContext({
    processing_status: 'ready',
    suggested_title: 'Pensamento geográfico',
    summary: 'Resumo fiel.',
    topics: ['Ratzel'],
    references: []
  }), /Conteúdo efetivamente abordado: Ratzel/);
});
