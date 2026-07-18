const MACRO_PLAN_VERSION = 5;
const DEFAULT_LESSONS_PER_DAY = 2;
const MAX_LESSONS_PER_DAY = 20;
const DEFAULT_REST_DAYS_PER_WEEK = 0;
const MAX_REST_DAYS_PER_WEEK = 6;
const REVIEW_INTERVALS_DAYS = [1, 7, 30];
const PLAN_MODE_LESSONS_PER_DAY = 'aulas_por_dia';
const PLAN_MODE_EXAM_DATE = 'data_prova';

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
  if (!match) return null;
  const candidate = match[0];
  const date = new Date(candidate + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().split('T')[0] === candidate
    ? candidate
    : null;
}

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateString, days) {
  const date = new Date(dateString + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

function daysBetweenInclusive(startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  return Math.floor((end - start) / 86400000) + 1;
}

function normalizeMacroPlanRequest(body, currentDate) {
  const input = body || {};
  const mode = input.modoPlanejamento;
  const startDate = isoDate(currentDate) || todayIso();

  if (mode !== PLAN_MODE_LESSONS_PER_DAY && mode !== PLAN_MODE_EXAM_DATE) {
    return { error: 'Escolha o modo aulas por dia ou data da prova.' };
  }

  if (mode === PLAN_MODE_LESSONS_PER_DAY) {
    if (input.dataProva) {
      return { error: 'No modo aulas por dia, não informe a data da prova.' };
    }
    const lessonsPerDay = parseInt(input.aulasPorDia, 10);
    const restDaysPerWeek = parseInt(input.diasDescansoPorSemana == null ? 0 : input.diasDescansoPorSemana, 10);
    if (!Number.isFinite(lessonsPerDay) || lessonsPerDay < 1 || lessonsPerDay > MAX_LESSONS_PER_DAY) {
      return { error: 'Informe entre 1 e ' + MAX_LESSONS_PER_DAY + ' aulas por dia.' };
    }
    if (!Number.isFinite(restDaysPerWeek) || restDaysPerWeek < 0 || restDaysPerWeek > MAX_REST_DAYS_PER_WEEK) {
      return { error: 'Informe entre 0 e ' + MAX_REST_DAYS_PER_WEEK + ' dias de descanso por semana.' };
    }
    return {
      value: {
        modoPlanejamento: mode,
        aulasPorDia: lessonsPerDay,
        diasDescansoPorSemana: restDaysPerWeek,
        dataProva: null,
      },
    };
  }

  if (input.aulasPorDia != null || input.diasDescansoPorSemana != null) {
    return { error: 'No modo data da prova, o ritmo diário é calculado automaticamente.' };
  }
  const examDate = isoDate(input.dataProva);
  if (!examDate || examDate !== String(input.dataProva)) {
    return { error: 'Informe uma data da prova válida.' };
  }
  if (daysBetweenInclusive(startDate, examDate) < 1) {
    return { error: 'A data da prova não pode ser anterior à data de início.' };
  }
  return {
    value: {
      modoPlanejamento: mode,
      aulasPorDia: null,
      diasDescansoPorSemana: 0,
      dataProva: examDate,
    },
  };
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

function scheduleLessonDaysByExamDate(distributed, calendarDays) {
  const totalLessons = distributed.length;
  if (!totalLessons) return [];
  if (calendarDays <= 1 || totalLessons === 1) {
    return distributed.map(function(entry) { return { entry, dayIndex: 0 }; });
  }

  return distributed.map(function(entry, sequence) {
    return {
      entry,
      dayIndex: Math.floor((sequence * (calendarDays - 1)) / (totalLessons - 1)),
    };
  });
}

function buildCompleteMacroPlan(subjects, lessons, options) {
  const config = options || {};
  const mode = config.modoPlanejamento === PLAN_MODE_EXAM_DATE
    ? PLAN_MODE_EXAM_DATE
    : PLAN_MODE_LESSONS_PER_DAY;
  const startDate = isoDate(config.dataInicio) || todayIso();
  const examDate = mode === PLAN_MODE_EXAM_DATE ? isoDate(config.dataProva) : null;
  const doneByLessonId = config.doneByLessonId instanceof Map ? config.doneByLessonId : new Map();
  const doneByItemId = config.doneByItemId instanceof Map ? config.doneByItemId : new Map();
  const distributed = distributeLessons(subjects, lessons);
  let lessonsPerDay;
  let restDaysPerWeek;
  let lessonSlots;

  if (mode === PLAN_MODE_EXAM_DATE) {
    const calendarDays = examDate ? daysBetweenInclusive(startDate, examDate) : 0;
    if (calendarDays < 1) {
      throw new RangeError('A data da prova deve ser igual ou posterior à data de início.');
    }
    lessonsPerDay = distributed.length ? Math.max(1, Math.ceil(distributed.length / calendarDays)) : 1;
    restDaysPerWeek = 0;
    lessonSlots = scheduleLessonDaysByExamDate(distributed, calendarDays);
  } else {
    lessonsPerDay = clampLessonsPerDay(config.aulasPorDia);
    restDaysPerWeek = clampRestDaysPerWeek(config.diasDescansoPorSemana);
    lessonSlots = scheduleLessonDays(distributed, lessonsPerDay, restDaysPerWeek);
  }
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
  const totalStudyDays = totalLessons
    ? new Set(lessonSlots.map(function(slot) { return slot.dayIndex; })).size
    : 0;
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
  const examDateLabel = examDate ? examDate.split('-').reverse().join('/') : null;

  return {
    macro_plan_version: MACRO_PLAN_VERSION,
    modoPlanejamento: mode,
    aulasPorDia: lessonsPerDay,
    diasDescansoPorSemana: restDaysPerWeek,
    dataProva: examDate,
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
      ? (mode === PLAN_MODE_EXAM_DATE
        ? 'Todas as ' + totalLessons + ' aulas foram distribuídas até a prova em ' + examDateLabel + ', com até ' + lessonsPerDay + ' aula' + (lessonsPerDay === 1 ? '' : 's') + ' por dia e revisões em D+1, D+7 e D+30.'
        : 'Todas as ' + totalLessons + ' aulas foram distribuídas com até ' + lessonsPerDay + ' aula' + (lessonsPerDay === 1 ? '' : 's') + ' por dia, ' + restDaysPerWeek + ' dia' + (restDaysPerWeek === 1 ? '' : 's') + ' de descanso por semana e revisões em D+1, D+7 e D+30.')
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
  const requestedMode = plan && plan.modoPlanejamento === PLAN_MODE_EXAM_DATE
    ? PLAN_MODE_EXAM_DATE
    : PLAN_MODE_LESSONS_PER_DAY;
  const startDate = plan && plan.dataInicio || firstWeek && firstWeek.dataInicio;
  const examDate = plan && plan.dataProva || options && options.dataProva;
  const repairMode = requestedMode === PLAN_MODE_EXAM_DATE && isoDate(examDate) &&
    daysBetweenInclusive(isoDate(startDate) || todayIso(), isoDate(examDate)) >= 1
    ? PLAN_MODE_EXAM_DATE
    : PLAN_MODE_LESSONS_PER_DAY;
  return buildCompleteMacroPlan(subjects, lessons, {
    modoPlanejamento: repairMode,
    aulasPorDia: plan && plan.aulasPorDia,
    diasDescansoPorSemana: plan && plan.diasDescansoPorSemana,
    dataInicio: startDate,
    dataProva: repairMode === PLAN_MODE_EXAM_DATE ? examDate : null,
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

  const mode = plan.modoPlanejamento;
  if (mode !== PLAN_MODE_LESSONS_PER_DAY && mode !== PLAN_MODE_EXAM_DATE) return true;

  const lessonsPerDay = parseInt(plan.aulasPorDia, 10);
  const restDaysPerWeek = parseInt(plan.diasDescansoPorSemana, 10);
  if (!Number.isFinite(lessonsPerDay) || lessonsPerDay < 1) return true;
  if (mode === PLAN_MODE_LESSONS_PER_DAY && lessonsPerDay > MAX_LESSONS_PER_DAY) return true;
  if (!Number.isFinite(restDaysPerWeek) || restDaysPerWeek < 0 || restDaysPerWeek > MAX_REST_DAYS_PER_WEEK) return true;
  if (mode === PLAN_MODE_EXAM_DATE && (!isoDate(plan.dataProva) ||
      daysBetweenInclusive(plan.dataInicio, plan.dataProva) < 1 ||
      plan.diasDescansoPorSemana !== 0)) return true;
  if (mode === PLAN_MODE_LESSONS_PER_DAY && plan.dataProva != null) return true;

  const expected = buildCompleteMacroPlan(subjects, lessons, {
    modoPlanejamento: mode,
    aulasPorDia: lessonsPerDay,
    diasDescansoPorSemana: restDaysPerWeek,
    dataInicio: plan.dataInicio,
    dataProva: plan.dataProva,
  });
  const scalarFields = [
    'modoPlanejamento', 'aulasPorDia', 'diasDescansoPorSemana', 'dataProva',
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
  PLAN_MODE_EXAM_DATE,
  PLAN_MODE_LESSONS_PER_DAY,
  REVIEW_INTERVALS_DAYS,
  addDays,
  buildCompleteMacroPlan,
  buildCurriculum,
  distributeLessons,
  isRestDay,
  normalizeMacroPlanRequest,
  planNeedsRepair,
  repairMacroPlan,
};
