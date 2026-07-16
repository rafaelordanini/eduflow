const MACRO_PLAN_VERSION = 4;
const DEFAULT_LESSONS_PER_DAY = 2;
const MAX_LESSONS_PER_DAY = 20;
const DEFAULT_REST_DAYS_PER_WEEK = 0;
const MAX_REST_DAYS_PER_WEEK = 6;
const REVIEW_INTERVALS_DAYS = [1, 7, 30];

function compareLessons(a, b) {
  const orderA = Number.isFinite(Number(a.order_index)) ? Number(a.order_index) : Number.MAX_SAFE_INTEGER;
  const orderB = Number.isFinite(Number(b.order_index)) ? Number(b.order_index) : Number.MAX_SAFE_INTEGER;
  return orderA - orderB || Number(a.id) - Number(b.id);
}

function clampLessonsPerDay(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LESSONS_PER_DAY;
  return Math.max(1, Math.min(MAX_LESSONS_PER_DAY, parsed));
}

function clampRestDaysPerWeek(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_REST_DAYS_PER_WEEK;
  return Math.max(0, Math.min(MAX_REST_DAYS_PER_WEEK, parsed));
}

function isoDate(value) {
  const match = String(value || '').match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateString, days) {
  const date = new Date(dateString + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

function studyDayIndexes(restDaysPerWeek) {
  const restDays = clampRestDaysPerWeek(restDaysPerWeek);
  const studyDays = 7 - restDays;
  const indexes = new Set();

  for (let slot = 0; slot < studyDays; slot += 1) {
    indexes.add(Math.floor((slot * 7) / studyDays));
  }

  return indexes;
}

function isRestDay(dayIndex, restDaysPerWeek) {
  const studyDays = studyDayIndexes(restDaysPerWeek);
  return !studyDays.has(((dayIndex % 7) + 7) % 7);
}

function nextStudyDayIndex(dayIndex, restDaysPerWeek) {
  let candidate = dayIndex;
  while (isRestDay(candidate, restDaysPerWeek)) candidate += 1;
  return candidate;
}

function buildCurriculum(subjects, lessons) {
  const subjectById = new Map();
  const lessonsBySubject = new Map();

  (subjects || []).forEach(function(subject) {
    subjectById.set(String(subject.id), subject);
    lessonsBySubject.set(String(subject.id), []);
  });

  (lessons || []).forEach(function(lesson) {
    const key = String(lesson.subject_id);
    if (subjectById.has(key)) lessonsBySubject.get(key).push(lesson);
  });

  lessonsBySubject.forEach(function(subjectLessons) { subjectLessons.sort(compareLessons); });
  const activeSubjects = (subjects || []).filter(function(subject) {
    return (lessonsBySubject.get(String(subject.id)) || []).length > 0;
  });

  return { activeSubjects, subjectById, lessonsBySubject };
}

// Weighted round-robin: every subject advances at roughly the same percentage,
// while each subject's own lessons always remain in pedagogical order.
function distributeLessons(subjects, lessons) {
  const curriculum = buildCurriculum(subjects, lessons);
  const states = curriculum.activeSubjects.map(function(subject, index) {
    const subjectLessons = curriculum.lessonsBySubject.get(String(subject.id));
    return { subject, lessons: subjectLessons, nextIndex: 0, index };
  });
  const distributed = [];
  let cursor = 0;

  while (states.some(function(state) { return state.nextIndex < state.lessons.length; })) {
    const available = states.filter(function(state) { return state.nextIndex < state.lessons.length; });
    const minProgress = Math.min.apply(null, available.map(function(state) {
      return state.nextIndex / state.lessons.length;
    }));
    const tied = available.filter(function(state) {
      return Math.abs((state.nextIndex / state.lessons.length) - minProgress) < 1e-12;
    });
    tied.sort(function(a, b) {
      const distanceA = (a.index - cursor + states.length) % states.length;
      const distanceB = (b.index - cursor + states.length) % states.length;
      return distanceA - distanceB;
    });

    const selected = tied[0];
    distributed.push({ subject: selected.subject, lesson: selected.lessons[selected.nextIndex] });
    selected.nextIndex += 1;
    cursor = (selected.index + 1) % states.length;
  }

  return distributed;
}

function lessonHours(lesson) {
  const minutes = Number(lesson.duration_minutes) || 0;
  return minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : null;
}

function scheduleLessonDays(distributed, lessonsPerDay, restDaysPerWeek) {
  const slots = [];
  let dayIndex = nextStudyDayIndex(0, restDaysPerWeek);
  let lessonsOnDay = 0;

  distributed.forEach(function(entry) {
    slots.push({ entry, dayIndex });
    lessonsOnDay += 1;
    if (lessonsOnDay >= lessonsPerDay) {
      dayIndex = nextStudyDayIndex(dayIndex + 1, restDaysPerWeek);
      lessonsOnDay = 0;
    }
  });

  return slots;
}

function buildCompleteMacroPlan(subjects, lessons, options) {
  const config = options || {};
  const lessonsPerDay = clampLessonsPerDay(config.aulasPorDia);
  const restDaysPerWeek = clampRestDaysPerWeek(config.diasDescansoPorSemana);
  const startDate = isoDate(config.dataInicio) || todayIso();
  const doneByLessonId = config.doneByLessonId instanceof Map ? config.doneByLessonId : new Map();
  const doneByItemId = config.doneByItemId instanceof Map ? config.doneByItemId : new Map();
  const distributed = distributeLessons(subjects, lessons);
  const lessonSlots = scheduleLessonDays(distributed, lessonsPerDay, restDaysPerWeek);
  const scheduledItems = [];

  lessonSlots.forEach(function(slot, sequence) {
    const entry = slot.entry;
    const itemId = 'lesson-' + entry.lesson.id;
    const hours = lessonHours(entry.lesson);
    scheduledItems.push({
      dayIndex: slot.dayIndex,
      sequence,
      item: {
        id: itemId,
        nome: entry.subject.name,
        topico: entry.lesson.title,
        tipo: 'estudo',
        done: Boolean(doneByItemId.get(itemId) || doneByLessonId.get(String(entry.lesson.id))),
        subject_id: entry.subject.id,
        lesson_id: entry.lesson.id,
        lesson_title: entry.lesson.title,
        lesson_order: entry.lesson.order_index,
        data: addDays(startDate, slot.dayIndex),
        dia: slot.dayIndex + 1,
        duration_minutes: Number(entry.lesson.duration_minutes) || 0,
        atividades: [{
          tipo: 'aula',
          descricao: 'Assistir à aula "' + entry.lesson.title + '"',
          horas: hours,
        }],
        leituras: '',
      },
    });
  });

  const studyItems = scheduledItems.slice();
  studyItems.forEach(function(source) {
    REVIEW_INTERVALS_DAYS.forEach(function(interval, intervalIndex) {
      const reviewDayIndex = nextStudyDayIndex(source.dayIndex + interval, restDaysPerWeek);
      const reviewId = 'review-' + source.item.lesson_id + '-d' + interval;
      scheduledItems.push({
        dayIndex: reviewDayIndex,
        sequence: lessonSlots.length + (source.sequence * REVIEW_INTERVALS_DAYS.length) + intervalIndex,
        item: {
          id: reviewId,
          nome: source.item.nome,
          topico: 'Revisão espaçada (D+' + interval + '): ' + source.item.lesson_title,
          tipo: 'revisao',
          done: Boolean(doneByItemId.get(reviewId)),
          subject_id: source.item.subject_id,
          lesson_id: source.item.lesson_id,
          lesson_title: source.item.lesson_title,
          lesson_order: source.item.lesson_order,
          review_of_id: source.item.id,
          review_interval_days: interval,
          data: addDays(startDate, reviewDayIndex),
          dia: reviewDayIndex + 1,
          duration_minutes: 30,
          atividades: [{
            tipo: 'revisao',
            descricao: 'Revisar a aula "' + source.item.lesson_title + '" após ' + interval + ' dia' + (interval === 1 ? '' : 's'),
            horas: 0.5,
          }],
          leituras: '',
        },
      });
    });
  });

  scheduledItems.sort(function(a, b) {
    return a.dayIndex - b.dayIndex ||
      (a.item.tipo === b.item.tipo ? 0 : (a.item.tipo === 'estudo' ? -1 : 1)) ||
      a.sequence - b.sequence;
  });

  const totalLessons = lessonSlots.length;
  const totalStudyDays = totalLessons ? Math.ceil(totalLessons / lessonsPerDay) : 0;
  const lastLessonDayIndex = totalLessons ? lessonSlots[lessonSlots.length - 1].dayIndex : 0;
  const lastPlanDayIndex = scheduledItems.length
    ? scheduledItems[scheduledItems.length - 1].dayIndex
    : 0;
  const totalLessonCalendarDays = totalLessons ? lastLessonDayIndex + 1 : 0;
  const totalPlanDays = scheduledItems.length ? lastPlanDayIndex + 1 : 0;
  const totalWeeks = totalPlanDays ? Math.ceil(totalPlanDays / 7) : 0;
  const weeks = [];

  for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex += 1) {
    const firstDayIndex = weekIndex * 7;
    const finalDayIndex = Math.min(((weekIndex + 1) * 7) - 1, lastPlanDayIndex);
    const restDates = [];
    for (let dayIndex = firstDayIndex; dayIndex <= finalDayIndex; dayIndex += 1) {
      if (isRestDay(dayIndex, restDaysPerWeek)) restDates.push(addDays(startDate, dayIndex));
    }
    weeks.push({
      semana: weekIndex + 1,
      dataInicio: addDays(startDate, firstDayIndex),
      dataFim: addDays(startDate, finalDayIndex),
      datasDescanso: restDates,
      materias: [],
    });
  }

  scheduledItems.forEach(function(scheduled) {
    weeks[Math.floor(scheduled.dayIndex / 7)].materias.push(scheduled.item);
  });

  const totalLessonMinutes = distributed.reduce(function(total, entry) {
    return total + (Number(entry.lesson.duration_minutes) || 0);
  }, 0);
  const totalReviewMinutes = totalLessons * REVIEW_INTERVALS_DAYS.length * 30;

  return {
    macro_plan_version: MACRO_PLAN_VERSION,
    aulasPorDia: lessonsPerDay,
    diasDescansoPorSemana: restDaysPerWeek,
    totalAulas: totalLessons,
    totalRevisoes: totalLessons * REVIEW_INTERVALS_DAYS.length,
    totalDiasEstudo: totalStudyDays,
    totalDiasAulas: totalLessonCalendarDays,
    totalDias: totalPlanDays,
    totalSemanas: totalWeeks,
    totalHoras: Math.round(((totalLessonMinutes + totalReviewMinutes) / 60) * 10) / 10,
    dataInicio: startDate,
    dataFimAulas: totalLessons ? addDays(startDate, lastLessonDayIndex) : startDate,
    dataFim: scheduledItems.length ? addDays(startDate, lastPlanDayIndex) : startDate,
    resumo: totalLessons
      ? 'Todas as ' + totalLessons + ' aulas foram distribuídas com até ' + lessonsPerDay + ' aula' + (lessonsPerDay === 1 ? '' : 's') + ' por dia, ' + restDaysPerWeek + ' dia' + (restDaysPerWeek === 1 ? '' : 's') + ' de descanso por semana e revisões em D+1, D+7 e D+30.'
      : 'Nenhuma aula cadastrada foi encontrada para montar o Plano Mestre.',
    semanas: weeks,
  };
}

function allPlanItems(plan) {
  return (plan && plan.semanas || []).flatMap(function(week) { return week.materias || []; });
}

function mergeDoneMap(target, source) {
  if (!(source instanceof Map)) return;
  source.forEach(function(done, key) {
    if (done) target.set(String(key), true);
  });
}

function repairMacroPlan(plan, subjects, lessons, options) {
  const doneByLessonId = new Map();
  const doneByItemId = new Map();

  allPlanItems(plan).forEach(function(item) {
    if (!item.done) return;
    if (item.id) doneByItemId.set(String(item.id), true);
    if (item.tipo === 'estudo' && item.lesson_id != null) {
      doneByLessonId.set(String(item.lesson_id), true);
    }

    if (item.tipo === 'revisao' && item.lesson_id != null) {
      const intervalMatch = String(item.id || '').match(/-d(\d+)$/);
      const interval = Number(item.review_interval_days || intervalMatch && intervalMatch[1]);
      if (REVIEW_INTERVALS_DAYS.includes(interval)) {
        doneByItemId.set('review-' + item.lesson_id + '-d' + interval, true);
      }
    }
  });

  if (options) {
    mergeDoneMap(doneByLessonId, options.doneByLessonId);
    mergeDoneMap(doneByItemId, options.doneByItemId);
  }

  const firstWeek = plan && plan.semanas && plan.semanas[0];
  return buildCompleteMacroPlan(subjects, lessons, {
    aulasPorDia: plan && plan.aulasPorDia,
    diasDescansoPorSemana: plan && plan.diasDescansoPorSemana,
    dataInicio: plan && plan.dataInicio || firstWeek && firstWeek.dataInicio,
    doneByLessonId,
    doneByItemId,
  });
}

function itemSignature(item) {
  return JSON.stringify([
    item.id,
    item.nome,
    item.topico,
    item.tipo,
    item.subject_id,
    item.lesson_id,
    item.lesson_title,
    item.lesson_order,
    item.review_of_id || null,
    item.review_interval_days || null,
    item.data,
    item.dia,
    item.duration_minutes,
  ]);
}

function planNeedsRepair(plan, subjects, lessons) {
  if (!plan || plan.macro_plan_version !== MACRO_PLAN_VERSION) return true;
  if (!isoDate(plan.dataInicio)) return true;

  const lessonsPerDay = parseInt(plan.aulasPorDia, 10);
  const restDaysPerWeek = parseInt(plan.diasDescansoPorSemana, 10);
  if (!Number.isFinite(lessonsPerDay) || lessonsPerDay < 1 || lessonsPerDay > MAX_LESSONS_PER_DAY) return true;
  if (!Number.isFinite(restDaysPerWeek) || restDaysPerWeek < 0 || restDaysPerWeek > MAX_REST_DAYS_PER_WEEK) return true;

  const expected = buildCompleteMacroPlan(subjects, lessons, {
    aulasPorDia: lessonsPerDay,
    diasDescansoPorSemana: restDaysPerWeek,
    dataInicio: plan.dataInicio,
  });
  const scalarFields = [
    'totalAulas', 'totalRevisoes', 'totalDiasEstudo', 'totalDiasAulas',
    'totalDias', 'totalSemanas', 'dataFimAulas', 'dataFim',
  ];
  if (scalarFields.some(function(field) { return plan[field] !== expected[field]; })) return true;
  if (!Array.isArray(plan.semanas) || plan.semanas.length !== expected.semanas.length) return true;

  for (let weekIndex = 0; weekIndex < expected.semanas.length; weekIndex += 1) {
    const actualWeek = plan.semanas[weekIndex];
    const expectedWeek = expected.semanas[weekIndex];
    if (actualWeek.semana !== expectedWeek.semana ||
        actualWeek.dataInicio !== expectedWeek.dataInicio ||
        actualWeek.dataFim !== expectedWeek.dataFim ||
        JSON.stringify(actualWeek.datasDescanso || []) !== JSON.stringify(expectedWeek.datasDescanso)) return true;

    const actualItems = actualWeek.materias || [];
    const expectedItems = expectedWeek.materias;
    if (actualItems.length !== expectedItems.length) return true;
    for (let itemIndex = 0; itemIndex < expectedItems.length; itemIndex += 1) {
      if (itemSignature(actualItems[itemIndex]) !== itemSignature(expectedItems[itemIndex])) return true;
      if (typeof actualItems[itemIndex].done !== 'boolean') return true;
    }
  }

  return false;
}

module.exports = {
  DEFAULT_LESSONS_PER_DAY,
  DEFAULT_REST_DAYS_PER_WEEK,
  MACRO_PLAN_VERSION,
  MAX_LESSONS_PER_DAY,
  MAX_REST_DAYS_PER_WEEK,
  REVIEW_INTERVALS_DAYS,
  addDays,
  buildCompleteMacroPlan,
  buildCurriculum,
  distributeLessons,
  isRestDay,
  planNeedsRepair,
  repairMacroPlan,
};
