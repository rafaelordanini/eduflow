const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PLAN_MODE_EXAM_DATE,
  PLAN_MODE_LESSONS_PER_DAY,
  REVIEW_INTERVALS_DAYS,
  buildCompleteMacroPlan,
  getSequentialStudyDate,
  distributeLessons,
  normalizeMacroPlanRequest,
  planNeedsRepair,
  repairMacroPlan,
  rescheduleMacroPlanFromPendingStudy,
  advanceMacroPlanDay,
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

function allItems(plan) {
  return plan.semanas.flatMap(function(week) { return week.materias; });
}

function studyItems(plan) {
  return allItems(plan).filter(function(item) { return item.tipo === 'estudo'; });
}

function reviewItems(plan) {
  return allItems(plan).filter(function(item) { return item.tipo === 'revisao'; });
}

function dateDiffDays(from, to) {
  return Math.round((new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 86400000);
}

test('inclui 100% das aulas cadastradas exatamente uma vez', function() {
  const plan = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 2, dataInicio: '2026-07-16' });
  const lessonIds = studyItems(plan).map(function(item) { return item.lesson_id; });

  assert.equal(plan.totalAulas, lessons.length);
  assert.deepEqual(new Set(lessonIds), new Set(lessons.map(function(lesson) { return lesson.id; })));
  assert.equal(lessonIds.length, lessons.length);
});

test('calcula os dias necessários para as aulas e respeita o limite diário', function() {
  const plan = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 2, dataInicio: '2026-07-16' });
  const countsByDate = new Map();
  studyItems(plan).forEach(function(item) {
    countsByDate.set(item.data, (countsByDate.get(item.data) || 0) + 1);
  });

  assert.equal(plan.totalDiasEstudo, 3);
  assert.equal(plan.totalDiasAulas, 3);
  assert.equal(plan.dataInicio, '2026-07-16');
  assert.equal(plan.dataFimAulas, '2026-07-18');
  assert.deepEqual(Array.from(countsByDate.values()), [2, 2, 1]);
});

test('mudar aulas por dia altera o ritmo, não a cobertura nem a sequência', function() {
  const slowPlan = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 1, dataInicio: '2026-07-16' });
  const fastPlan = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 3, dataInicio: '2026-07-16' });
  const slowIds = studyItems(slowPlan).map(function(item) { return item.lesson_id; });
  const fastIds = studyItems(fastPlan).map(function(item) { return item.lesson_id; });

  assert.deepEqual(fastIds, slowIds);
  assert.equal(slowPlan.totalDiasEstudo, 5);
  assert.equal(fastPlan.totalDiasEstudo, 2);
});

test('modo data da prova calcula o teto diário e distribui todas as aulas até a data-alvo', function() {
  const plan = buildCompleteMacroPlan(subjects, lessons, {
    modoPlanejamento: PLAN_MODE_EXAM_DATE,
    dataInicio: '2026-07-16',
    dataProva: '2026-07-18',
  });
  const studies = studyItems(plan);
  const countsByDate = new Map();
  studies.forEach(function(item) {
    countsByDate.set(item.data, (countsByDate.get(item.data) || 0) + 1);
  });

  assert.equal(plan.modoPlanejamento, PLAN_MODE_EXAM_DATE);
  assert.equal(plan.dataProva, '2026-07-18');
  assert.equal(plan.aulasPorDia, 2);
  assert.equal(plan.diasDescansoPorSemana, 0);
  assert.equal(plan.totalAulas, lessons.length);
  assert.equal(plan.dataFimAulas, '2026-07-18');
  assert.equal(plan.totalDiasAulas, 3);
  assert.ok(Array.from(countsByDate.values()).every(function(count) { return count <= 2; }));
  assert.equal(planNeedsRepair(plan, subjects, lessons), false);
});

test('modo data da prova aceita a carga necessária mesmo acima do limite do modo manual', function() {
  const manyLessons = Array.from({ length: 25 }, function(_, index) {
    return { id: 1000 + index, subject_id: 7, title: 'Aula ' + (index + 1), order_index: index + 1 };
  });
  const plan = buildCompleteMacroPlan(subjects, manyLessons, {
    modoPlanejamento: PLAN_MODE_EXAM_DATE,
    dataInicio: '2026-07-16',
    dataProva: '2026-07-16',
  });

  assert.equal(plan.aulasPorDia, 25);
  assert.equal(studyItems(plan).length, 25);
  assert.ok(studyItems(plan).every(function(item) { return item.data === '2026-07-16'; }));
});

test('aceita somente os campos pertencentes ao modo de planejamento escolhido', function() {
  const pace = normalizeMacroPlanRequest({
    modoPlanejamento: PLAN_MODE_LESSONS_PER_DAY,
    aulasPorDia: 3,
    diasDescansoPorSemana: 2,
  }, '2026-07-16');
  const deadline = normalizeMacroPlanRequest({
    modoPlanejamento: PLAN_MODE_EXAM_DATE,
    dataProva: '2026-07-20',
  }, '2026-07-16');
  const mixedPace = normalizeMacroPlanRequest({
    modoPlanejamento: PLAN_MODE_LESSONS_PER_DAY,
    aulasPorDia: 3,
    diasDescansoPorSemana: 2,
    dataProva: '2026-07-20',
  }, '2026-07-16');
  const mixedDeadline = normalizeMacroPlanRequest({
    modoPlanejamento: PLAN_MODE_EXAM_DATE,
    dataProva: '2026-07-20',
    aulasPorDia: 3,
  }, '2026-07-16');

  assert.equal(pace.value.modoPlanejamento, PLAN_MODE_LESSONS_PER_DAY);
  assert.equal(pace.value.dataProva, null);
  assert.equal(deadline.value.modoPlanejamento, PLAN_MODE_EXAM_DATE);
  assert.equal(deadline.value.aulasPorDia, null);
  assert.match(mixedPace.error, /não informe a data da prova/i);
  assert.match(mixedDeadline.error, /calculado automaticamente/i);
});

test('respeita a quantidade semanal de descansos sem agendar tarefas nesses dias', function() {
  const plan = buildCompleteMacroPlan(subjects, lessons, {
    aulasPorDia: 1,
    diasDescansoPorSemana: 2,
    dataInicio: '2026-07-16',
  });
  const fullWeeks = plan.semanas.filter(function(week) {
    return dateDiffDays(week.dataInicio, week.dataFim) === 6;
  });
  const restDates = new Set(plan.semanas.flatMap(function(week) { return week.datasDescanso; }));

  assert.ok(fullWeeks.length > 0);
  assert.ok(fullWeeks.every(function(week) { return week.datasDescanso.length === 2; }));
  assert.ok(allItems(plan).every(function(item) { return !restDates.has(item.data); }));
  assert.equal(plan.totalDiasEstudo, 5);
  assert.equal(plan.totalDiasAulas, 6);
  assert.equal(plan.dataFimAulas, '2026-07-21');
});

test('cria revisões D+1, D+7 e D+30 somente depois de cada aula', function() {
  const plan = buildCompleteMacroPlan(subjects, lessons, {
    aulasPorDia: 2,
    diasDescansoPorSemana: 2,
    dataInicio: '2026-07-16',
  });
  const studiesById = new Map(studyItems(plan).map(function(item) { return [item.id, item]; }));
  const reviews = reviewItems(plan);

  assert.equal(plan.totalRevisoes, lessons.length * REVIEW_INTERVALS_DAYS.length);
  assert.equal(reviews.length, plan.totalRevisoes);

  studyItems(plan).forEach(function(study) {
    const lessonReviews = reviews.filter(function(review) { return review.review_of_id === study.id; });
    assert.deepEqual(lessonReviews.map(function(review) { return review.review_interval_days; }).sort(function(a, b) { return a - b; }), REVIEW_INTERVALS_DAYS);
  });

  assert.ok(reviews.every(function(review) {
    const source = studiesById.get(review.review_of_id);
    return source &&
      review.lesson_id === source.lesson_id &&
      review.lesson_title === source.lesson_title &&
      dateDiffDays(source.data, review.data) >= review.review_interval_days;
  }));
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

test('a primeira aparição de cada matéria é sua primeira aula, nunca uma revisão', function() {
  const plan = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 1, dataInicio: '2026-07-16' });
  const items = allItems(plan);
  const firstBrazil = items.find(function(item) { return item.subject_id === 7; });
  const firstWorld = items.find(function(item) { return item.subject_id === 8; });

  assert.equal(firstBrazil.tipo, 'estudo');
  assert.equal(firstBrazil.lesson_id, 101);
  assert.equal(firstBrazil.lesson_title, 'M1A1 — Período Colonial');
  assert.equal(firstWorld.tipo, 'estudo');
  assert.equal(firstWorld.lesson_id, 801);
});

test('corrige planos antigos preservando aulas e revisões concluídas', function() {
  const oldPlan = {
    semanas: [{
      semana: 1,
      dataInicio: '2026-07-10',
      dataFim: '2026-07-16',
      materias: [{ lesson_id: 101, lesson_title: 'M1A1 — Período Colonial', done: true, tipo: 'estudo' }],
    }],
  };
  const completedFromProgress = new Map([['802', true]]);
  const completedItems = new Map([['review-101-d1', true]]);

  assert.equal(planNeedsRepair(oldPlan, subjects, lessons), true);
  const repaired = repairMacroPlan(oldPlan, subjects, lessons, {
    doneByLessonId: completedFromProgress,
    doneByItemId: completedItems,
  });

  assert.equal(repaired.totalAulas, lessons.length);
  assert.equal(repaired.aulasPorDia, 2);
  assert.equal(repaired.diasDescansoPorSemana, 0);
  assert.equal(repaired.dataInicio, '2026-07-10');
  assert.equal(studyItems(repaired).find(function(item) { return item.lesson_id === 101; }).done, true);
  assert.equal(studyItems(repaired).find(function(item) { return item.lesson_id === 802; }).done, true);
  assert.equal(reviewItems(repaired).find(function(item) { return item.id === 'review-101-d1'; }).done, true);
  assert.equal(planNeedsRepair(repaired, subjects, lessons), false);
});

test('detecta plano que deixou uma aula ou revisão obrigatória de fora', function() {
  const missingLesson = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 2, dataInicio: '2026-07-16' });
  const lessonWeek = missingLesson.semanas.find(function(week) {
    return week.materias.some(function(item) { return item.tipo === 'estudo'; });
  });
  lessonWeek.materias.splice(lessonWeek.materias.findIndex(function(item) { return item.tipo === 'estudo'; }), 1);

  const missingReview = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 2, dataInicio: '2026-07-16' });
  const reviewWeek = missingReview.semanas.find(function(week) {
    return week.materias.some(function(item) { return item.tipo === 'revisao'; });
  });
  reviewWeek.materias.splice(reviewWeek.materias.findIndex(function(item) { return item.tipo === 'revisao'; }), 1);

  assert.equal(planNeedsRepair(missingLesson, subjects, lessons), true);
  assert.equal(planNeedsRepair(missingReview, subjects, lessons), true);
});


test('mantém o Plano de Hoje na primeira aula pendente atrasada', function() {
  const plan = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 1, dataInicio: '2026-07-16' });
  const studies = studyItems(plan);
  studies[0].done = true;
  studies[1].done = false;

  assert.equal(getSequentialStudyDate(plan, '2026-07-20'), studies[1].data);
});

test('atualiza datas para que a primeira aula pendente vire hoje', function() {
  const plan = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 1, dataInicio: '2026-07-16' });
  const studies = studyItems(plan);
  studies[0].done = true;
  studies[1].done = false;

  const updated = rescheduleMacroPlanFromPendingStudy(plan, '2026-07-20');
  const updatedStudies = studyItems(updated);

  assert.equal(updatedStudies[1].data, '2026-07-20');
  assert.equal(updatedStudies[0].done, true);
  assert.equal(updatedStudies[1].done, false);
  assert.equal(dateDiffDays(plan.dataInicio, updated.dataInicio), dateDiffDays(studies[1].data, '2026-07-20'));
});

test('antecipa o próximo dia e todo o planejamento futuro sem alterar o dia concluído', function() {
  const plan = buildCompleteMacroPlan(subjects, lessons, { aulasPorDia: 1, dataInicio: '2026-08-13' });
  const originalStudies = studyItems(plan);
  originalStudies[0].done = true;
  const originalFirstDate = originalStudies[0].data;
  const originalNextDate = originalStudies[1].data;
  const originalEnd = plan.dataFim;

  const updated = advanceMacroPlanDay(plan, '2026-08-13');
  const updatedStudies = studyItems(updated);

  assert.equal(updatedStudies[0].data, originalFirstDate);
  assert.equal(updatedStudies[0].done, true);
  assert.equal(updatedStudies[1].data, '2026-08-13');
  assert.equal(dateDiffDays(updatedStudies[1].data, originalNextDate), 1);
  assert.equal(dateDiffDays(updated.dataFim, originalEnd), 1);
  assert.deepEqual(updated.calendarAdvanceDates, ['2026-08-13']);
  assert.equal(planNeedsRepair(updated, subjects, lessons), false);
  assert.equal(plan.dataFim, originalEnd, 'não deve alterar o objeto original');
});
