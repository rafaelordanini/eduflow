const test = require('node:test');
const assert = require('node:assert/strict');

const {
  planNeedsRepair,
  repairMacroPlan,
  scoreTopicLesson,
} = require('../lib/macro-plan');

const subjects = [{ id: 7, name: 'História do Brasil' }];
const lessons = [
  { id: 101, subject_id: 7, title: 'M1A1 — Período Colonial', order_index: 1 },
  { id: 102, subject_id: 7, title: 'M1A2 — O Bandeirantismo', order_index: 2 },
  { id: 205, subject_id: 7, title: 'M2A5 — Política Externa Brasileira', order_index: 105 },
  { id: 311, subject_id: 7, title: 'M3A11 — Era Vargas', order_index: 211 },
];

function planWithWeeks(itemsByWeek) {
  return {
    semanas: itemsByWeek.map(function(items, index) {
      return { semana: index + 1, materias: items };
    }),
  };
}

test('associa História do Brasil Colonial à aula introdutória, não à Política Externa', function() {
  const plan = planWithWeeks([[
    { nome: 'História do Brasil', topico: 'História do Brasil Colonial', atividades: [] },
  ]]);

  const repaired = repairMacroPlan(plan, subjects, lessons);
  const item = repaired.semanas[0].materias[0];

  assert.equal(item.lesson_id, 101);
  assert.equal(item.lesson_title, 'M1A1 — Período Colonial');
  assert.equal(scoreTopicLesson(item.topico, lessons[2].title, subjects[0].name), 0);
});

test('primeira aparição da matéria é estudo e aponta para a primeira aula', function() {
  const plan = planWithWeeks([[
    { nome: 'História do Brasil', topico: 'Era Vargas', tipo: 'revisao', atividades: [] },
  ]]);

  const repaired = repairMacroPlan(plan, subjects, lessons);
  const firstItem = repaired.semanas[0].materias[0];

  assert.equal(firstItem.tipo, 'estudo');
  assert.equal(firstItem.lesson_id, 101);
  assert.equal(firstItem.topico, 'M1A1 — Período Colonial');
});

test('associa estudos em ordem pedagógica crescente', function() {
  const plan = planWithWeeks([
    [{ nome: 'História do Brasil', topico: 'Período Colonial', atividades: [] }],
    [{ nome: 'História do Brasil', topico: 'Era Vargas', atividades: [] }],
    [{ nome: 'História do Brasil', topico: 'Política Externa Brasileira', atividades: [] }],
  ]);

  const repaired = repairMacroPlan(plan, subjects, lessons);
  const studyOrders = repaired.semanas.flatMap(function(week) {
    return week.materias.filter(function(item) { return item.tipo === 'estudo'; });
  }).map(function(item) {
    return lessons.find(function(lesson) { return lesson.id === item.lesson_id; }).order_index;
  });

  assert.deepEqual(studyOrders, [1, 211, 211]);
  assert.ok(studyOrders.every(function(order, index) { return index === 0 || order >= studyOrders[index - 1]; }));
});

test('cria revisões somente depois do estudo e preserva o vínculo da aula', function() {
  const plan = planWithWeeks([
    [{ nome: 'História do Brasil', topico: 'Período Colonial', atividades: [] }],
    [],
    [],
    [],
    [],
  ]);

  const repaired = repairMacroPlan(plan, subjects, lessons);
  const firstAppearances = repaired.semanas.flatMap(function(week, weekIndex) {
    return week.materias.map(function(item) { return { ...item, weekIndex }; });
  });
  const firstStudy = firstAppearances.find(function(item) { return item.tipo === 'estudo'; });
  const reviews = firstAppearances.filter(function(item) { return item.tipo === 'revisao'; });

  assert.equal(firstStudy.weekIndex, 0);
  assert.deepEqual(reviews.map(function(item) { return item.weekIndex; }), [1, 2, 4]);
  assert.ok(reviews.every(function(item) {
    return item.weekIndex > firstStudy.weekIndex &&
      item.lesson_id === firstStudy.lesson_id &&
      item.lesson_title === firstStudy.lesson_title;
  }));
});

test('corrige plano antigo ao carregá-lo e reconhece o resultado como atual', function() {
  const oldPlan = planWithWeeks([
    [{ id: 'w1-m0', nome: 'História do Brasil', topico: 'Período Colonial', tipo: 'estudo' }],
    [{
      id: 'rev-w1-HistóriadoBrasil-d7',
      nome: 'História do Brasil',
      topico: 'Revisão espaçada: Período Colonial',
      tipo: 'revisao',
      done: true,
    }],
  ]);

  assert.equal(planNeedsRepair(oldPlan, subjects, lessons), true);
  const repaired = repairMacroPlan(oldPlan, subjects, lessons);
  assert.equal(planNeedsRepair(repaired, subjects, lessons), false);
  assert.equal(repaired.semanas[1].materias[0].done, true);
  assert.equal(repaired.semanas[1].materias[0].lesson_id, 101);
});
