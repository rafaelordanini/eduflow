const test = require('node:test');
const assert = require('node:assert/strict');
const { QUESTION_TAXONOMY } = require('../lib/question-taxonomy');
const { buildPrompt, extractJson, validateDecisions, requestBatch, reviewBatchAdaptive, buildOutputs } = require('../scripts/ai-review-all-question-classifications');

const rows = [{
  id: '14515',
  subject: 'História Mundial',
  topic: 'História Mundial',
  enunciado: 'Acerca do regime civil-militar (1964-1985), julgue o item.',
  opcoes: '{"a":"Certo","b":"Errado"}',
  explicacao: '',
}];

const aiDecision = {
  id: 14515,
  subject: 'História do Brasil',
  topic: 'República de 1946 e regime militar',
  confidence: 0.99,
  reason: 'O item avalia a ditadura brasileira iniciada em 1964.',
};

test('AI prompt sends the complete question and closed taxonomy', () => {
  const prompt = JSON.parse(buildPrompt(rows));
  assert.deepEqual(prompt.taxonomy, QUESTION_TAXONOMY);
  assert.equal(prompt.questions[0].statement, rows[0].enunciado);
  assert.deepEqual(prompt.questions[0].options, { a: 'Certo', b: 'Errado' });
});

test('rejects missing, reordered and out-of-taxonomy AI decisions', () => {
  assert.throws(() => validateDecisions(rows, { decisions: [] }), /Quantidade/);
  assert.throws(() => validateDecisions(rows, { decisions: [{ ...aiDecision, id: 2 }] }), /fora de ordem/);
  assert.throws(() => validateDecisions(rows, { decisions: [{ ...aiDecision, topic: 'Tópico inventado' }] }), /fora da taxonomia/);
});

test('reports empty or truncated DeepSeek JSON clearly', () => {
  assert.throws(() => extractJson(''), /conteúdo vazio/);
  assert.throws(() => extractJson('{"decisions": ['), /JSON incompleto ou inválido/);
});

test('splits a malformed batch and preserves every individual decision', async () => {
  const twoRows = [rows[0], { ...rows[0], id: '14516' }];
  const reviewer = async batch => {
    if (batch.length > 1) throw new Error('JSON truncado');
    return [{ ...aiDecision, id: Number(batch[0].id) }];
  };
  const decisions = await reviewBatchAdaptive(twoRows, reviewer);
  assert.deepEqual(decisions.map(item => item.id), [14515, 14516]);
});

test('calls DeepSeek V4 and validates its structured response', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ decisions: [aiDecision] }) } }] }) };
  };
  const decisions = await requestBatch(rows, 'secret-value', fetchImpl);
  assert.deepEqual(decisions, [aiDecision]);
  assert.match(request.url, /deepseek/);
  assert.match(request.options.headers.Authorization, /^Bearer /);
  assert.equal(request.body.response_format.type, 'json_object');
  assert.match(request.body.model, /^deepseek-v4/);
  assert.match(request.body.messages.map(message => message.content).join(' '), /json/i);
});

test('builds a full decision ledger and an applicable correction artifact', () => {
  const csv = 'id,subject,topic,enunciado,opcoes,explicacao\n14515,História Mundial,História Mundial,Regime militar,"{""a"":""Certo""}",\n';
  const outputs = buildOutputs(csv, rows, new Map([[14515, aiDecision]]));
  assert.equal(outputs.audit.reviewed_count, 1);
  assert.equal(outputs.audit.decisions[0].reason, aiDecision.reason);
  assert.equal(outputs.corrections.correction_count, 1);
  assert.deepEqual(outputs.corrections.corrections[0].reviewed, { subject: aiDecision.subject, topic: aiDecision.topic });
});

test('GitHub Action maps the eduflow secret only to the DeepSeek API key', () => {
  const workflow = require('node:fs').readFileSync('.github/workflows/deepseek-question-audit.yml', 'utf8');
  assert.match(workflow, /DEEPSEEK_API_KEY:\s*\$\{\{ secrets\.eduflow \}\}/);
  assert.match(workflow, /npm run questions:audit-all/);
  assert.doesNotMatch(workflow, /echo.*secrets\.eduflow/);
});
