const test = require('node:test');
const assert = require('node:assert/strict');
const { stringifyCsv } = require('../scripts/question-review-csv');
const { parseCsv } = require('../scripts/review-all-question-classifications');

test('production export round-trips multiline questions and JSON options', () => {
  const csv = stringifyCsv([{ id: 14434, source: 'exam', year: 2014, subject: 'Economia', topic: 'Economia', enunciado: 'Ratzel,\n"Geopolítica"', opcoes: { a: 'Certo', b: 'Errado' }, gabarito: 'b' }]);
  const [row] = parseCsv(csv);
  assert.equal(row.id, '14434');
  assert.equal(row.enunciado, 'Ratzel,\n"Geopolítica"');
  assert.deepEqual(JSON.parse(row.opcoes), { a: 'Certo', b: 'Errado' });
});
