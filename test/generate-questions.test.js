const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeTrueFalseQuestions,
  isTrueFalseQuestion
} = require('../api/generate-questions');

test('normalizes every generated item to Certo or Errado', () => {
  const questions = normalizeTrueFalseQuestions([
    { enunciado: 'Afirmação correta.', opcoes: { a: 'sim', b: 'não' }, gabarito: 'C' },
    { enunciado: 'Afirmação incorreta.', opcoes: { a: 'sim', b: 'não' }, gabarito: 'Errado' }
  ]);

  assert.deepEqual(questions.map(question => question.opcoes), [
    { a: 'Certo', b: 'Errado' },
    { a: 'Certo', b: 'Errado' }
  ]);
  assert.deepEqual(questions.map(question => question.gabarito), ['a', 'b']);
});

test('rejects cached multiple-choice questions from current reviews', () => {
  assert.equal(isTrueFalseQuestion({ opcoes: { a: 'Certo', b: 'Errado' } }), true);
  assert.equal(isTrueFalseQuestion({ opcoes: { a: 'Uma', b: 'Duas', c: 'Três' } }), false);
});
