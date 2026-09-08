const test = require('node:test');
const assert = require('node:assert/strict');
const { separateQuestion } = require('../scripts/separate-question-texts');

test('separates long supporting text, command and item', () => {
  const result = separateQuestion({
    source: 'exam', texto_apoio: null, comando: null, explicacao: null,
    enunciado: 'Q12 Item 4 (TPS 2003): Texto longo. Outra frase. Com relação ao texto, julgue os itens a seguir. | Esta é a afirmação julgada.',
  });
  assert.deepEqual(result, { status: 'separated', patch: {
    texto_apoio: 'Texto longo. Outra frase.',
    comando: 'Com relação ao texto, julgue os itens a seguir.',
    enunciado: 'Esta é a afirmação julgada.',
  }});
});

test('uses curated metadata without losing multiline long text', () => {
  const result = separateQuestion({ source: 'exam', texto_apoio: null, comando: null, enunciado: 'legado', explicacao: JSON.stringify({ context_text: 'linha 1\nlinha 2', command_text: 'Julgue.', item_text: 'Item completo.' }) });
  assert.equal(result.patch.texto_apoio, 'linha 1\nlinha 2');
  assert.equal(result.patch.comando, 'Julgue.');
  assert.equal(result.patch.enunciado, 'Item completo.');
});

test('quarantines a legacy exam row truncated before its item', () => {
  const result = separateQuestion({ source: 'exam', texto_apoio: null, comando: null, explicacao: null, enunciado: 'Q12 Item 1 (TPS 2003): ' + 'x'.repeat(974) });
  assert.deepEqual(result, { status: 'quarantine', patch: { source: 'exam_quarantined' } });
});
