const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyQuestion } = require('../lib/question-classifier');

test('moves Brazilian constitutional questions out of Português', () => {
  const result = classifyQuestion({ subject: 'Português', topic: 'Interpretação de texto', enunciado: 'A Constituição de 1988 atribui ao município a educação infantil e o ensino fundamental na federação brasileira.' });
  assert.equal(result.subject, 'Direito Interno');
  assert.equal(result.topic, 'Organização do Estado');
});

test('assigns specific world-history topics from the statement', () => {
  const result = classifyQuestion({ subject: 'Português', topic: null, enunciado: 'Na Revolução Russa, os dirigentes bolcheviques enfrentaram os camponeses durante a guerra civil.' });
  assert.equal(result.subject, 'História Mundial');
  assert.equal(result.topic, 'Revolução Russa e União Soviética');
});

test('distinguishes international law from international politics', () => {
  const result = classifyQuestion({ subject: 'Política Internacional', enunciado: 'Segundo o costume internacional e as normas de jus cogens, analise a responsabilidade internacional dos Estados.' });
  assert.equal(result.subject, 'Direito Internacional');
  assert.equal(result.topic, 'Fontes do Direito Internacional');
});

test('does not invent a classification for content-free placeholders', () => {
  const result = classifyQuestion({ subject: 'Política Internacional', topic: null, enunciado: 'Item 12 (TPS 2025) — consulte o caderno original' });
  assert.equal(result.subject, 'Política Internacional');
  assert.equal(result.topic, null);
  assert.equal(result.subjectConfidence, 0);
});
