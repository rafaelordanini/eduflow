const test = require('node:test');
const assert = require('node:assert/strict');

const { applyOfficialAnswerKey } = require('../lib/official-answer-key');

test('substitui respostas da IA pelo gabarito oficial estruturado', () => {
  const questions = [
    { questao_num: 3, item_num: 1, gabarito: 'E' },
    { questao_num: 3, item_num: 2, gabarito: 'C' },
  ];
  const official = [
    { questao: 3, item: 1, answer: 'C' },
    { questao: 3, item: 2, answer: 'E' },
  ];

  assert.deepEqual(applyOfficialAnswerKey(questions, official).map(item => item.gabarito), ['C', 'E']);
});

test('aceita gabarito oficial sequencial somente com cobertura integral', () => {
  const questions = [{ questao_num: 1, item_num: 1 }, { questao_num: 1, item_num: 2 }];
  assert.deepEqual(applyOfficialAnswerKey(questions, ['E', 'C']).map(item => item.gabarito), ['E', 'C']);
  assert.throws(() => applyOfficialAnswerKey(questions, ['E']), /Cobertura incompleta/);
});

test('interrompe a importação diante de item ausente, excedente ou duplicado', () => {
  const questions = [{ questao_num: 1, item_num: 1 }];
  assert.throws(
    () => applyOfficialAnswerKey(questions, [{ questao: 1, item: 2, answer: 'C' }]),
    /não consta/,
  );
  assert.throws(
    () => applyOfficialAnswerKey(questions, [
      { questao: 1, item: 1, answer: 'C' },
      { questao: 1, item: 2, answer: 'E' },
    ]),
    /sem questão correspondente/,
  );
  assert.throws(
    () => applyOfficialAnswerKey(questions, [
      { questao: 1, item: 1, answer: 'C' },
      { questao: 1, item: 1, answer: 'E' },
    ]),
    /duplicado/,
  );
});
