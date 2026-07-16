const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildCompleteMacroPlan,
  distributeLessons,
  planNeedsRepair,
  repairMacroPlan,
} = require('../lib/macro-plan');

const subjects = [
  { id: 7, name: 'História do Brasil' },
  { id: 8, name: 'História Mundial' },
];
const lessons = [
  { id: 101, subject_id: 7, title: 'M1A1 — Período Colonial', order_index: 1, duration_minutes: 60 },
  { id: 102, subject_id: 7, title: 'M1A2 — O Bandeirantismo', order_index: 2, duration_minutes: 45 },
  { id: 205, subject_id: 7, title: 'M2A5 — Política Externa Brasileira', order_index: 105, duration_minutes: 60 },
  { id: 801, subject_id: 8, title: 'M1A1 — Absolutismo e Mercantilismo', order_index: 1, duration_minutes: 50 },
  { id: 802, subject_id: 8, title: 'M1A2 — Iluminismo', order_index: 2, duration_minutes: 50 },
];

function studyItems(plan) {
  return plan.semanas.flatMap(function(week) { return week.materias; });
}

test('inclui 100% das aulas cadastradas exatamente uma vez', function() {
  const plan = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 2, dataInicio: '2026-07-16' });
  const lessonIds = studyItems(plan).map(function(item) { return item.lesson_id; });

  assert.equal(plan.totalAulas, lessons.length);
  assert.deepEqual(new Set(lessonIds), new Set(lessons.map(function(lesson) { return lesson.id; })));
  assert.equal(lessonIds.length, lessons.length);
});

test('calcula somente os dias necessários e respeita o limite diário', function() {
  const plan = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 2, dataInicio: '2026-07-16' });
  const countsByDate = new Map();
  studyItems(plan).forEach(function(item) {
    countsByDate.set(item.data, (countsByDate.get(item.data) || 0) + 1);
  });

  assert.equal(plan.totalDias, 3);
  assert.equal(plan.dataInicio, '2026-07-16');
  assert.equal(plan.dataFim, '2026-07-18');
  assert.deepEqual(Array.from(countsByDate.values()), [2, 2, 1]);
});

test('mudar aulas por dia altera somente o ritmo, não a cobertura nem a sequência', function() {
  const slowPlan = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 1, dataInicio: '2026-07-16' });
  const fastPlan = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 3, dataInicio: '2026-07-16' });
  const slowIds = studyItems(slowPlan).map(function(item) { return item.lesson_id; });
  const fastIds = studyItems(fastPlan).map(function(item) { return item.lesson_id; });

  assert.deepEqual(fastIds, slowIds);
  assert.equal(slowPlan.totalDias, 5);
  assert.equal(fastPlan.totalDias, 2);
});

test('intercala matérias sem quebrar a ordem pedagógica de cada uma', function() {
  const distributed = distributeLessons(subjects, lessons);
  const firstTwoSubjects = distributed.slice(0, 2).map(function(entry) { return entry.subject.id; });
  const historyLessons = distributed
    .filter(function(entry) { return entry.subject.id === 7; })
    .map(function(entry) { return entry.lesson.id; });

  assert.deepEqual(firstTwoSubjects, [7, 8]);
  assert.deepEqual(historyLessons, [101, 102, 205]);
});

test('a primeira aparição de cada matéria aponta para sua primeira aula', function() {
  const plan = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 1, dataInicio: '2026-07-16' });
  const items = studyItems(plan);
  const firstBrazil = items.find(function(item) { return item.subject_id === 7; });
  const firstWorld = items.find(function(item) { return item.subject_id === 8; });

  assert.equal(firstBrazil.lesson_id, 101);
  assert.equal(firstBrazil.lesson_title, 'M1A1 — Período Colonial');
  assert.equal(firstWorld.lesson_id, 801);
  assert.ok(items.every(function(item) { return item.tipo === 'estudo'; }));
});

test('corrige planos antigos para cobertura total preservando aulas concluídas', function() {
  const oldPlan = {
    semanas: [{
      semana: 1,
      dataInicio: '2026-07-10',
      dataFim: '2026-07-16',
      materias: [{ lesson_id: 101, lesson_title: 'M1A1 — Período Colonial', done: true, tipo: 'estudo' }],
    }],
  };

  assert.equal(planNeedsRepair(oldPlan, subjects, lessons), true);
  const completedFromProgress = new Map([['802', true]]);
  const repaired = repairMacroPlan(oldPlan, subjects, lessons, { doneByLessonId: completedFromProgress });
  assert.equal(repaired.totalAulas, lessons.length);
  assert.equal(repaired.aulasPorDia, 2);
  assert.equal(repaired.dataInicio, '2026-07-10');
  assert.equal(studyItems(repaired).find(function(item) { return item.lesson_id === 101; }).done, true);
  assert.equal(studyItems(repaired).find(function(item) { return item.lesson_id === 802; }).done, true);
  assert.equal(planNeedsRepair(repaired, subjects, lessons), false);
});

test('detecta plano que deixou uma aula cadastrada de fora', function() {
  const plan = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 2, dataInicio: '2026-07-16' });
  plan.semanas[0].materias.shift();

  assert.equal(planNeedsRepair(plan, subjects, lessons), true);
});
