const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  normalizeTrueFalseQuestions,
  hasValidJudgmentStatement,
  isOfficial,
  getQuestionId,
  rankAssociatedQuestions,
  requestMissingQuestions,
  SYSTEM_PROMPT
} = require('../api/generate-questions');

test('recognizes the existing questions schema provenance', () => {
  assert.equal(isOfficial({ source: 'exam' }), true);
  assert.equal(isOfficial({ source: 'ai' }), false);
  assert.equal(isOfficial({ exam: 'INÉDITA', source: 'exam' }), false);
});

test('uses the existing JSONB lesson cache instead of a missing PostgREST relationship', () => {
  const source = fs.readFileSync('api/generate-questions/index.js', 'utf8');
  assert.match(source, /select\('questoes'\)/);
  assert.doesNotMatch(source, /questions\(\*\)|question_id, questions/);
  assert.match(source, /source: 'ai', year: null/);
});

test('handles legacy cached questions without sending undefined ids to PostgreSQL', () => {
  assert.equal(getQuestionId({ id: 42 }), 42);
  assert.equal(getQuestionId({ question_id: '43' }), 43);
  assert.equal(getQuestionId({ enunciado: 'Legacy AI item without an id.' }), null);

  const ranked = rankAssociatedQuestions([
    { question_id: 43, source: 'exam' },
    { source: 'ai' }
  ], [{ question_id: 43, correct: false, attempted_at: '2026-09-28T00:00:00Z' }]);
  assert.deepEqual(ranked.map(getQuestionId), [43, null]);
});

test('normalizes generated items to Certo or Errado', () => {
  const questions = normalizeTrueFalseQuestions([
    { enunciado: 'Esta é uma afirmação completa e correta.', gabarito: 'C' },
    { enunciado: 'Esta é uma afirmação completa e incorreta.', gabarito: 'Errado' }
  ]);
  assert.deepEqual(questions.map(q => q.opcoes), [
    { a: 'Certo', b: 'Errado' }, { a: 'Certo', b: 'Errado' }
  ]);
  assert.deepEqual(questions.map(q => q.gabarito), ['a', 'b']);
  assert.ok(questions.every(hasValidJudgmentStatement));
});

test('applies the per-user priority queue', () => {
  const questions = [
    { id: 1, exam: 'TPS', enunciado: 'Oficial sem tentativa.' },
    { id: 2, exam: 'TPS', enunciado: 'Oficial respondida com erro.' },
    { id: 3, exam: 'TPS', enunciado: 'Oficial respondida há muito tempo.' },
    { id: 4, exam: 'INÉDITA', enunciado: 'Assertiva inédita previamente salva.' },
    { id: 5, exam: 'TPS', enunciado: 'Oficial correta e recente.' }
  ];
  const now = Date.parse('2026-09-28T12:00:00Z');
  const attempts = [
    { question_id: 2, correct: false, attempted_at: '2026-09-27T12:00:00Z' },
    { question_id: 3, correct: true, attempted_at: '2026-07-01T12:00:00Z' },
    { question_id: 5, correct: true, attempted_at: '2026-09-27T12:00:00Z' }
  ];
  assert.deepEqual(rankAssociatedQuestions(questions, attempts, now).map(q => q.id), [1, 2, 3, 4]);
});

test('makes one proportional, cached-prompt DeepSeek request', async t => {
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousFetch = global.fetch;
  process.env.DEEPSEEK_API_KEY = 'test-key';
  t.after(() => {
    if (previousKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previousKey;
    global.fetch = previousFetch;
  });
  let calls = 0;
  global.fetch = async (_url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'deepseek-chat');
    assert.equal(body.temperature, 0.3);
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.equal(body.max_tokens, 560);
    assert.equal(body.messages[0].content, SYSTEM_PROMPT);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
      subject: 'História', keywords: ['Tratado'], questoes: [
        { enunciado: 'A primeira afirmação histórica está completa.', gabarito: 'a', explicacao: 'Segundo Autor, Obra.' },
        { enunciado: 'A segunda afirmação histórica também está completa.', gabarito: 'b', explicacao: 'Segundo Autor, Obra.' }
      ]
    }) } }] }) };
  };
  const result = await requestMissingQuestions({ subjectName: 'História', lessonTitle: 'Tratados', summary: 'Resumo.', count: 2 });
  assert.equal(calls, 1);
  assert.equal(result.questoes.length, 2);
});
