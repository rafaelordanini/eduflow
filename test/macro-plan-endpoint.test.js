const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

let activeDatabase;
const supabaseModule = require('../lib/supabase');
const originalGetSupabase = supabaseModule.getSupabase;
supabaseModule.getSupabase = () => activeDatabase;
const handler = require('../lib/endpoints/macro-plan');
supabaseModule.getSupabase = originalGetSupabase;

const subjects = [{ id: 1, name: 'Português' }, { id: 2, name: 'Geografia' }];
const lessons = [
  { id: 11, subject_id: 1, title: 'M1A1 - Introdução', order_index: 1, drive_url: '/file/d/one/view' },
  { id: 12, subject_id: 1, title: 'M1A2 - Morfologia', order_index: 2 },
  { id: 21, subject_id: 2, title: 'M1A1 - Introdução', order_index: 1 },
  { id: 22, subject_id: 2, title: 'M1A2 - Geopolítica', order_index: 2 },
  { id: 99, subject_id: 1, title: 'aula1', order_index: 3, drive_url: '/file/d/one/view' },
];

function setup(t, rpcError) {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'isolated-plan-endpoint-test-secret';
  t.after(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  const calls = [];
  const tableResults = {
    subjects: subjects,
    lessons: lessons,
    progress: [{ lesson_id: 99 }],
    macro_plans: { plan_json: { semanas: [{ materias: [
      { id: 'lesson-21', lesson_id: 21, tipo: 'estudo', done: true },
      { id: 'review-11-d1', lesson_id: 11, tipo: 'revisao', done: true },
    ] }] } },
  };
  activeDatabase = {
    from(table) {
      calls.push({ table });
      const query = {
        select() { return query; },
        eq(key, value) { calls.push({ table, key, value }); return query; },
        is(key, value) { calls.push({ table, key, value }); return query; },
        order() { return query; },
        limit() { return query; },
        maybeSingle() { return Promise.resolve({ data: tableResults[table] }); },
        then(resolve, reject) { return Promise.resolve({ data: tableResults[table] }).then(resolve, reject); },
      };
      return query;
    },
    async rpc(name, args) { calls.push({ name, args }); return { error: rpcError }; },
  };
  const token = jwt.sign({ id: 42, role: 'student' }, process.env.JWT_SECRET);
  const response = {
    statusCode: 200,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  return { calls, response, token };
}

async function recreate(t, mode, rpcError) {
  const context = setup(t, rpcError);
  await handler({ method: 'POST', headers: { authorization: 'Bearer ' + context.token }, body: {
    modoPlanejamento: 'aulas_por_dia', aulasPorDia: 1, modoRecriacao: mode,
    user_id: 999, // The authenticated user, never client input, owns all changes.
  } }, context.response);
  return context;
}

test('continua sem repetir a cópia vista e respeita conclusões do plano antigo', async t => {
  const { calls, response } = await recreate(t, 'continuar');
  assert.equal(response.statusCode, 200);
  const items = response.body.semanas.flatMap(week => week.materias);
  assert.deepEqual(items.filter(item => item.tipo === 'estudo').map(item => item.lesson_id), [12, 22]);
  assert.ok(items.filter(item => item.tipo === 'revisao').every(item => !item.done));
  const save = calls.find(call => call.name === 'recreate_macro_plan');
  assert.equal(save.args.p_reset_progress, false);
  assert.equal(save.args.p_user_id, 42);
  assert.ok(calls.filter(call => call.key === 'user_id').every(call => call.value === 42));
});

test('recomeça com a primeira aula de cada matéria e solicita zerar o progresso', async t => {
  const { calls, response } = await recreate(t, 'do_zero');
  assert.equal(response.statusCode, 200);
  const items = response.body.semanas.flatMap(week => week.materias);
  const study = items.filter(item => item.tipo === 'estudo');
  assert.deepEqual(study.map(item => item.lesson_id), [11, 21, 12, 22]);
  assert.ok(items.every(item => !item.done));
  assert.equal(response.body.totalAulasVistas, 0);
  const save = calls.find(call => call.name === 'recreate_macro_plan');
  assert.equal(save.args.p_reset_progress, true);
  assert.equal(save.args.p_user_id, 42);
  assert.equal(save.args.p_start_date, response.body.dataInicio);
});

test('rejeita opção inválida antes de consultar ou alterar o banco', async t => {
  const { calls, response } = await recreate(t, 'invalido');
  assert.equal(response.statusCode, 400);
  assert.equal(calls.length, 0);
});

test('uma falha na transação retorna erro em vez de confirmar o reinício', async t => {
  const previousError = console.error;
  console.error = () => {};
  t.after(() => { console.error = previousError; });
  const { calls, response } = await recreate(t, 'do_zero', { message: 'Falha ao salvar' });
  assert.equal(response.statusCode, 500);
  assert.match(response.body.error, /Falha ao salvar/);
  assert.equal(calls.filter(call => call.name).length, 1);
});
