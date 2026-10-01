const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('public/js/app.js','utf8');
function setup() {
  const requests=[];
  const top={disabled:false,innerHTML:''};
  const score={insertAdjacentHTML(_position,html){out.added+=html;}};
  const out={innerHTML:'',added:'',button:null,
    querySelector(selector){return selector==='.mais-questoes-btn'?this.button:score;},
    appendChild(button){this.button=button;button.remove=()=>{if(this.button===button)this.button=null;};}
  };
  const context={document:{getElementById(id){return id==='questions-output'?out:top;},createElement(){return {style:{}};}},
    API:{generateQuestions(payload){return new Promise((resolve,reject)=>requests.push({payload,resolve,reject}));}},
    escapeHtml:String,renderEnunciado:q=>q.enunciado,buildTopicBadge:()=>'',baronFloatPose(){},showToast(){},
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function renderQuestionsSection('),source.indexOf('\nfunction findLessonAndRender(')),context);
  context.updateQuestoesScore=()=>{};
  context.renderQuestionsSection(10,'RI','Cooperação');
  function batch(start){return {questoes:Array.from({length:4},(_,i)=>({id:start+i,enunciado:'Assertiva '+(start+i),opcoes:{a:'Certo',b:'Errado'},exam:'INÉDITA'}))};}
  return {context,requests,top,out,batch};
}
test('both controls keep adding four with continuous numbering and preserve the existing output',async()=>{
  const {context:c,requests,top,out,batch}=setup();
  const initial=c.gerarQuestoes(10,'RI','Cooperação');requests[0].resolve(batch(1));await initial;
  assert.match(top.innerHTML,/Gerar mais questões/);assert.match(out.button.innerHTML,/Gerar mais questões/);
  const previous=out.innerHTML;
  const next=c.gerarMaisQuestoes(10,'RI','Cooperação');
  assert.equal(top.disabled,true);assert.equal(out.button.disabled,true);
  assert.equal(requests[1].payload.count,4);assert.equal(requests[1].payload.excludeQuestions.length,4);
  requests[1].resolve(batch(5));await next;
  assert.equal(out.innerHTML,previous);assert.match(out.added,/Questão 8\./);assert.match(out.added,/Inédita - Fixação/);
  const again=c.gerarQuestoes(10,'RI','Cooperação');
  assert.equal(requests[2].payload.excludeQuestions.length,8);requests[2].resolve(batch(9));await again;
  assert.equal(c._questoesAtivas.length,12);assert.equal(c._lessonQuestoesMeta.currentCount,12);
  assert.match(out.added,/Questão 12\./);assert.equal(out.button.disabled,false);
});
test('double clicks and errors preserve questions and allow retry',async()=>{
  const {context:c,requests,top,out,batch}=setup();
  const first=c.gerarQuestoes(10,'RI','Cooperação');requests[0].resolve(batch(1));await first;
  const next=c.gerarMaisQuestoes(10,'RI','Cooperação');c.gerarMaisQuestoes(10,'RI','Cooperação');
  assert.equal(requests.length,2);requests[1].reject(Error('Falha de rede'));await next;
  assert.equal(c._questoesAtivas.length,4);assert.equal(top.disabled,false);assert.equal(out.button.disabled,false);
  const retry=c.gerarMaisQuestoes(10,'RI','Cooperação');requests[2].resolve(batch(5));await retry;
  assert.equal(c._questoesAtivas.length,8);
});
test('an outstanding batch cannot populate a newly opened lesson',async()=>{
  const {context:c,requests,out,batch}=setup();
  const first=c.gerarQuestoes(10,'RI','Cooperação');requests[0].resolve(batch(1));await first;
  const next=c.gerarMaisQuestoes(10,'RI','Cooperação');c.renderQuestionsSection(20,'Geografia','Clima');
  requests[1].resolve(batch(5));await next;
  assert.equal(out.added,'');assert.equal(c._questoesAtivas.length,0);assert.equal(c._lessonQuestoesMeta.loading,false);
});

function setupReview() {
  const requests=[];
  const count={textContent:''};
  const body={innerHTML:'',added:'',button:null,
    querySelector(){return count;},
    insertAdjacentHTML(_position,html){this.added+=html;},
    appendChild(button){this.button=button;button.remove=()=>{if(this.button===button)this.button=null;};}
  };
  const overlay={isConnected:false,querySelector(){return body;},remove(){this.isConnected=false;}};
  const context={document:{createElement(tag){return tag==='div'?overlay:{style:{}};},body:{appendChild(){overlay.isConnected=true;}}},
    API:{generateQuestions(payload){return new Promise((resolve,reject)=>requests.push({payload,resolve,reject}));},request(){return Promise.resolve({questions:[]});}},
    escapeHtml:String,renderEnunciado:q=>q.enunciado,showToast(){},_js:JSON.stringify,_jsNull:JSON.stringify,
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function renderReviewQuestionCard('),source.indexOf('\nfunction conferirRevisao(')),context);
  const batch=start=>({questoes:Array.from({length:4},(_,i)=>({id:start+i,enunciado:'Assertiva '+(start+i),opcoes:{a:'Certo',b:'Errado'}}))});
  return {context,requests,body,overlay,count,batch};
}
test('master-plan reviews also append repeatable batches without replacing answered cards',async()=>{
  const {context:c,requests,body,count,batch}=setupReview();
  const initial=c.abrirRevisaoPlano('RI','Revisão',10,'Cooperação');requests[0].resolve(batch(1));await initial;
  assert.match(body.button.innerHTML,/Gerar mais questões/);
  const previous=body.added;
  const next=body.button.onclick();body.button.onclick();assert.equal(requests.length,2);
  assert.equal(requests[1].payload.count,4);assert.equal(requests[1].payload.excludeQuestions.length,4);
  requests[1].resolve(batch(5));await next;
  assert.ok(body.added.startsWith(previous));assert.match(body.added,/QUESTÃO 8/);assert.match(count.textContent,/8 questões/);
  const again=body.button.onclick();requests[2].resolve(batch(9));await again;
  assert.equal(requests[2].payload.excludeQuestions.length,8);assert.match(count.textContent,/12 questões/);
});
test('review batch failures remain retryable and closed reviews ignore pending results',async()=>{
  const {context:c,requests,body,overlay,batch}=setupReview();
  const initial=c.abrirRevisaoPlano('RI','Revisão',10,'Cooperação');requests[0].resolve(batch(1));await initial;
  const before=body.added;
  const next=body.button.onclick();requests[1].reject(Error('Falha de rede'));await next;
  assert.equal(body.added,before);assert.equal(body.button.disabled,false);
  const retry=body.button.onclick();overlay.remove();requests[2].resolve(batch(5));await retry;
  assert.equal(body.added,before);
});
