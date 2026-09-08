const test = require('node:test');
const assert = require('node:assert/strict');

const { applyOfficialAnswerCorrections } = require('../lib/official-answer-corrections');

test('aplica o gabarito oficial à questão das bandeiras do CACD 2008', () => {
  const question = {
    id: 123,
    year: 2008,
    enunciado: 'No século XVII, as bandeiras de apresamento de indígenas, embora fossem empresas privadas, contavam com a participação de mamelucos e de índios aliados, e tinham como principal objetivo suprir a mão de obra escrava para a lavoura açucareira do Nordeste.',
    gabarito: 'b',
    explicacao: 'A afirmação está errada.',
  };

  const corrected = applyOfficialAnswerCorrections(question);

  assert.equal(corrected.gabarito, 'a');
  assert.match(corrected.explicacao, /gabarito oficial do CACD 2008/);
  assert.equal(question.gabarito, 'b', 'a correção não deve alterar o objeto original');
});

test('não altera outras questões de 2008 nem enunciados iguais de outro ano', () => {
  const otherQuestion = { year: 2008, enunciado: 'Outra questão', gabarito: 'b' };
  const otherYear = {
    year: 2009,
    enunciado: 'No século XVII, as bandeiras de apresamento de indígenas',
    gabarito: 'b',
  };

  assert.strictEqual(applyOfficialAnswerCorrections(otherQuestion), otherQuestion);
  assert.strictEqual(applyOfficialAnswerCorrections(otherYear), otherYear);
});
