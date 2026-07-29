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

test('classifies a grammar item from a Brazilian-history passage as Português', () => {
  const result = classifyQuestion({
    subject: 'História do Brasil',
    topic: 'Brasil Colônia',
    enunciado: 'Q14 Item 1 TPS 2006: A história do Brasil está ligada à expansão colonial portuguesa. | No trecho “ligada à da expansão comercial e colonial europeia”, o acento grave indica crase de preposição e pronome, o qual substitui “história”.',
  });

  assert.equal(result.subject, 'Português');
  assert.equal(result.topic, 'Sintaxe e morfossintaxe');
  assert.equal(result.subjectConfidence, 1);
});

test('recognizes textual rewriting even when the source passage is about economics', () => {
  const result = classifyQuestion({
    subject: 'Economia',
    topic: 'Macroeconomia',
    enunciado: 'A inflação e a política monetária afetam a taxa de juros. No trecho acima, a expressão “taxa de juros” poderia ser substituída pelo termo indicado sem prejuízo da correção gramatical.',
  });

  assert.equal(result.subject, 'Português');
  assert.equal(result.topic, 'Sintaxe e morfossintaxe');
});

test('keeps a factual history assertion in História do Brasil', () => {
  const result = classifyQuestion({
    subject: 'História do Brasil',
    topic: 'Brasil Colônia',
    enunciado: 'A expansão colonial portuguesa vinculou a história do Brasil à competição comercial europeia.',
  });

  assert.equal(result.subject, 'História do Brasil');
  assert.equal(result.topic, 'Brasil Colônia');
});
