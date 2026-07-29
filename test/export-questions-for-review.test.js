const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchAllQuestions } = require('../scripts/export-questions-for-review');

test('exports every Supabase page in stable id order', async () => {
  const pages = [
    Array.from({ length: 500 }, (_, index) => ({ id: index + 1 })),
    [{ id: 501 }, { id: 502 }],
  ];
  const ranges = [];
  const supabase = {
    from(table) {
      assert.equal(table, 'questions');
      return {
        select(columns) {
          assert.match(columns, /enunciado/);
          return {
            order(column, options) {
              assert.equal(column, 'id');
              assert.deepEqual(options, { ascending: true });
              return {
                range(from, to) {
                  ranges.push([from, to]);
                  return Promise.resolve({ data: pages.shift(), error: null });
                },
              };
            },
          };
        },
      };
    },
  };

  const questions = await fetchAllQuestions(supabase);
  assert.equal(questions.length, 502);
  assert.deepEqual(ranges, [[0, 499], [500, 999]]);
});
