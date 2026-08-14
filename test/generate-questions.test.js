const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeTrueFalseQuestions,
  isTrueFalseQuestion,
  hasValidJudgmentStatement,
  reviewGeneratedQuestions,
  selectReviewedBankQuestions
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

test('rejects commands and disconnected source fragments instead of judgment items', () => {
  const options = { a: 'Certo', b: 'Errado' };
  assert.equal(hasValidJudgmentStatement({
    enunciado: 'Concerning the text above, judge the following items.',
    opcoes: options
  }), false);
  assert.equal(hasValidJudgmentStatement({
    enunciado: 'Considerando a situação hipotética descrita, julgue os itens a seguir.',
    opcoes: options
  }), false);
  assert.equal(hasValidJudgmentStatement({
    enunciado: 'A nacionalidade brasileira nata pode decorrer dos critérios territorial e sanguíneo previstos na Constituição.',
    opcoes: options
  }), true);
});

test('uses AI review to rewrite generated questions and select only relevant bank items', async t => {
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = global.fetch;
  process.env.DEEPSEEK_API_KEY = 'test-key';
  t.after(() => {
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
    global.fetch = previousFetch;
  });

  const responses = [
    { questoes: [{ enunciado: 'A Constituição de 1988 adota o jus soli como regra de atribuição da nacionalidade brasileira originária.', opcoes: { a: 'Certo', b: 'Errado' }, gabarito: 'a', explicacao: 'A regra consta do art. 12.', fonte: 'Constituição Federal' }] },
    { indices_aprovados: [1] }
  ];
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(responses.shift()) } }] })
  });

  const reviewed = await reviewGeneratedQuestions('Direito', 'Nacionalidade', [{
    enunciado: 'Julgue os itens a seguir.', opcoes: { a: 'Certo', b: 'Errado' }, gabarito: 'a'
  }]);
  assert.equal(reviewed.length, 1);
  assert.match(reviewed[0].enunciado, /Constituição de 1988/);

  const bank = await selectReviewedBankQuestions('Direito', 'Nacionalidade', [
    { enunciado: 'Questão longa, porém alheia ao tópico indicado para esta aula.', opcoes: { a: 'Certo', b: 'Errado' } },
    { enunciado: 'Brasileiros natos não podem ser extraditados pelo Brasil.', opcoes: { a: 'Certo', b: 'Errado' } }
  ]);
  assert.deepEqual(bank.map(question => question.enunciado), ['Brasileiros natos não podem ser extraditados pelo Brasil.']);
});
