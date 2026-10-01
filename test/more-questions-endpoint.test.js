const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
let database;
const supabase = require('../lib/supabase');
const originalDb = supabase.getSupabase;
supabase.getSupabase = () => database;
const drive = require('../lib/drive-summary');
const originalSummary = drive.fetchDriveLessonSummary;
drive.fetchDriveLessonSummary = async () => 'Resumo sobre relações internacionais e condições da cooperação.';
const handler = require('../api/generate-questions');
supabase.getSupabase = originalDb;
drive.fetchDriveLessonSummary = originalSummary;

function question(id) {
  return {id, source:'ai', enunciado:'A assertiva número ' + id + ' contém uma relação completa.',
    opcoes:{a:'Certo',b:'Errado'}, gabarito:'a', explicacao:'Fundamentação no resumo.'};
}
function mockDatabase(initial) {
  let cache = initial.slice();
  let inserted = [];
  database = {
    from(table) {
      const query = {
        select() {return this;}, eq() {return this;}, in() {return this;},
        order() {return this;}, or() {return this;}, limit() {return this;}, not() {return this;},
        async maybeSingle() {return {data:{questoes:cache}};},
        async single() {return {data:{id:10,title:'Cooperação',subjects:{name:'RI'}}};},
        async upsert(row) {cache=row.questoes; return {};},
        insert(rows) {inserted=rows.map((q,i)=>({...q,id:100+i})); return this;},
        then(resolve,reject) {return Promise.resolve({data:table==='question_attempts'?[]:inserted}).then(resolve,reject);}
      };
      return query;
    }
  };
  return {get inserted() {return inserted;},get cache() {return cache;}};
}
async function request(excludeQuestions=[]) {
  const token = jwt.sign({id:42},process.env.JWT_SECRET);
  const res = {setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await handler({method:'POST',headers:{authorization:'Bearer '+token},body:{lessonId:10,excludeQuestions}},res);
  return res;
}
function setup(t) {
  const oldSecret=process.env.JWT_SECRET, oldKey=process.env.DEEPSEEK_API_KEY, oldFetch=global.fetch;
  process.env.JWT_SECRET='more-questions-test'; process.env.DEEPSEEK_API_KEY='test-key';
  t.after(()=>{
    for (const [key,value] of [['JWT_SECRET',oldSecret],['DEEPSEEK_API_KEY',oldKey]]) {
      if(value===undefined) delete process.env[key]; else process.env[key]=value;
    }
    global.fetch=oldFetch;
  });
}

test('successive batches use unseen questions from the lesson bank without AI',async t=>{
  setup(t); mockDatabase(Array.from({length:12},(_,i)=>question(i+1)));
  global.fetch=()=>{throw Error('AI must not be used when the bank has enough questions');};
  const seen=[];
  for(let batch=0;batch<3;batch++) {
    const res=await request(seen);
    assert.equal(res.code,200); assert.equal(res.body.source,'bank');
    assert.deepEqual(res.body.questoes.map(q=>q.id),[1,2,3,4].map(id=>id+4*batch));
    seen.push(...res.body.questoes);
  }
});

test('fills only the missing slots with new generated questions and saves them',async t=>{
  setup(t); const db=mockDatabase(Array.from({length:6},(_,i)=>question(i+1)));
  const seen=db.cache.slice(0,4); let calls=0;
  global.fetch=async (_url,options)=>{
    calls++; const body=JSON.parse(options.body);
    assert.match(body.messages[1].content,/exatamente 2 assertivas/);
    for(const q of db.cache) assert.ok(body.messages[1].content.includes(q.enunciado));
    return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({questoes:[question(100),question(101)]})}}]})};
  };
  const res=await request(seen);
  assert.equal(res.code,200); assert.equal(res.body.source,'mixed'); assert.equal(calls,1);
  assert.deepEqual(res.body.questoes.map(q=>q.id),[5,6,100,101]);
  assert.equal(db.inserted.length,2); assert.equal(db.cache.length,8);
});

test('excludes legacy items and duplicate texts even when they have different IDs',()=>{
  const excluded=[{id:1,enunciado:'Uma afirmação completa.'},{enunciado:'Questão antiga sem ID.'}];
  const result=handler.uniqueUnseenQuestions([
    {id:1,enunciado:'Outro texto.'},{id:2,enunciado:'  UMA afirmação   completa. '},
    {enunciado:'Questão antiga sem ID.'},question(3),{...question(3),id:4},question(5)
  ],excluded);
  assert.deepEqual(result.map(q=>q.id),[3,5]);
});

test('rejects repeated generated questions before saving a partial batch',async t=>{
  setup(t);const db=mockDatabase([question(1)]);
  global.fetch=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({questoes:[question(1),question(2),question(3),question(4)]})}}]})});
  const oldError=console.error;console.error=()=>{};t.after(()=>{console.error=oldError;});
  const res=await request([question(1)]);
  assert.equal(res.code,500);assert.equal(db.inserted.length,0);
});
