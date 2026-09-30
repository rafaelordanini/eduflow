const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
let database;
const supabase = require('../lib/supabase');
const getSupabase = supabase.getSupabase;
supabase.getSupabase = () => database;
const handler = require('../api/lessons');
supabase.getSupabase = getSupabase;

async function request(t, body, error, authenticated = true) {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'lesson-order-endpoint-test';
  t.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  const calls = [];
  database = {
    async rpc(name, args) {
      calls.push({name, args});
      return {error, data: error ? null : {success:true, position:args.p_position || 2}};
    },
    from() { throw new Error('Moves must use a single database transaction'); },
  };
  const token = jwt.sign({id:42, role:'student'}, process.env.JWT_SECRET);
  const response = {
    statusCode:200, setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  await handler({method:'PUT', query:{}, headers:authenticated ? {authorization:'Bearer '+token} : {}, body}, response);
  return {response, calls};
}

test('authenticated learners can move a lesson down through the transaction route', async t => {
  const {response, calls} = await request(t, {lessonId:34, direction:1});
  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls, [{name:'reorder_lesson', args:{p_lesson_id:34, p_direction:1, p_position:null}}]);
  assert.equal(response.body.success, true);
});

test('moving to a chosen position uses the same atomic route', async t => {
  const {response, calls} = await request(t, {lessonId:93, position:1});
  assert.equal(response.statusCode, 200);
  assert.deepEqual(calls[0].args, {p_lesson_id:93, p_direction:null, p_position:1});
});

test('invalid moves never reach the database', async t => {
  for (const body of [{lessonId:34, direction:0}, {lessonId:34, position:1.5},
    {lessonId:34, direction:1, position:2}, {lessonId:'34', direction:1}, {lessonId:34}]) {
    const {response, calls} = await request(t, body);
    assert.equal(response.statusCode, 400);
    assert.equal(calls.length, 0);
  }
});

test('unauthenticated moves are rejected before writing', async t => {
  const {response, calls} = await request(t, {lessonId:34, direction:1}, null, false);
  assert.equal(response.statusCode, 401);
  assert.equal(calls.length, 0);
});

test('missing lessons and out-of-range positions return actionable errors', async t => {
  for (const [code, status] of [['P0002',404], ['22023',400]]) {
    const {response} = await request(t, {lessonId:34, direction:-1}, {code, message:'Posição inválida'});
    assert.equal(response.statusCode, status);
    assert.equal(response.body.error, 'Posição inválida');
  }
});
