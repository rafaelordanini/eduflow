const MACRO_PLAN_VERSION = 3;
const DEFAULT_LESSONS_PER_DAY = 2;
const MAX_LESSONS_PER_DAY = 20;

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
    const lesson = selected.lessons[selected.nextIndex];
    distributed.push({ subject: selected.subject, lesson });
    selected.nextIndex += 1;
    cursor = (selected.index + 1) % states.length;
  }

  return distributed;
}

function lessonHours(lesson) {
  const minutes = Number(lesson.duration_minutes) || 0;
  return minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : null;
}

function buildCompleteMacroPlan(subjects, lessons, options) {
  const config = options || {};
  const lessonsPerDay = clampLessonsPerDay(config.aulasPorDia);
  const startDate = isoDate(config.dataInicio) || todayIso();
  const doneByLessonId = config.doneByLessonId instanceof Map ? config.doneByLessonId : new Map();
  const distributed = distributeLessons(subjects, lessons);
  const totalLessons = distributed.length;
  const totalDays = totalLessons ? Math.ceil(totalLessons / lessonsPerDay) : 0;
  const totalWeeks = totalDays ? Math.ceil(totalDays / 7) : 0;
  const endDate = totalDays ? addDays(startDate, totalDays - 1) : startDate;
  const weeks = [];

  distributed.forEach(function(entry, slotIndex) {
    const dayIndex = Math.floor(slotIndex / lessonsPerDay);
    const weekIndex = Math.floor(dayIndex / 7);
    const scheduledDate = addDays(startDate, dayIndex);
    const hours = lessonHours(entry.lesson);

    if (!weeks[weekIndex]) {
      weeks[weekIndex] = {
        semana: weekIndex + 1,
        dataInicio: addDays(startDate, weekIndex * 7),
        dataFim: addDays(startDate, Math.min(((weekIndex + 1) * 7) - 1, totalDays - 1)),
        materias: [],
      };
    }

    weeks[weekIndex].materias.push({
      id: 'lesson-' + entry.lesson.id,
      nome: entry.subject.name,
      topico: entry.lesson.title,
      tipo: 'estudo',
      done: Boolean(doneByLessonId.get(String(entry.lesson.id))),
      subject_id: entry.subject.id,
      lesson_id: entry.lesson.id,
      lesson_title: entry.lesson.title,
      lesson_order: entry.lesson.order_index,
      data: scheduledDate,
      dia: dayIndex + 1,
      duration_minutes: Number(entry.lesson.duration_minutes) || 0,
      atividades: [{
        tipo: 'aula',
        descricao: 'Assistir à aula "' + entry.lesson.title + '"',
        horas: hours,
      }],
      leituras: '',
    });
  });

  const totalMinutes = distributed.reduce(function(total, entry) {
    return total + (Number(entry.lesson.duration_minutes) || 0);
  }, 0);

  return {
    macro_plan_version: MACRO_PLAN_VERSION,
    aulasPorDia: lessonsPerDay,
    totalAulas: totalLessons,
    totalDias: totalDays,
    totalSemanas: totalWeeks,
    totalHoras: Math.round((totalMinutes / 60) * 10) / 10,
    dataInicio: startDate,
    dataFim: endDate,
    resumo: totalLessons
      ? 'Todas as ' + totalLessons + ' aulas foram distribuídas em ' + totalDays + ' dias, com até ' + lessonsPerDay + ' aula' + (lessonsPerDay === 1 ? '' : 's') + ' por dia e alternância equilibrada entre as matérias.'
      : 'Nenhuma aula cadastrada foi encontrada para montar o Plano Mestre.',
    semanas: weeks,
  };
}

function allPlanItems(plan) {
  return (plan && plan.semanas || []).flatMap(function(week) { return week.materias || []; });
}

function repairMacroPlan(plan, subjects, lessons, options) {
  const doneByLessonId = new Map();
  allPlanItems(plan).forEach(function(item) {
    if (item.lesson_id != null && item.done) doneByLessonId.set(String(item.lesson_id), true);
  });
  if (options && options.doneByLessonId instanceof Map) {
    options.doneByLessonId.forEach(function(done, lessonId) {
      if (done) doneByLessonId.set(String(lessonId), true);
    });
  }

  const firstWeek = plan && plan.semanas && plan.semanas[0];
  return buildCompleteMacroPlan(subjects, lessons, {
    aulasPorDia: plan && plan.aulasPorDia,
    dataInicio: plan && plan.dataInicio || firstWeek && firstWeek.dataInicio,
    doneByLessonId,
  });
}

function planNeedsRepair(plan, subjects, lessons) {
  if (!plan || plan.macro_plan_version !== MACRO_PLAN_VERSION) return true;

  const lessonsPerDay = parseInt(plan.aulasPorDia, 10);
  if (!Number.isFinite(lessonsPerDay) || lessonsPerDay < 1 || lessonsPerDay > MAX_LESSONS_PER_DAY) return true;

  const curriculum = buildCurriculum(subjects, lessons);
  const expectedLessons = curriculum.activeSubjects.flatMap(function(subject) {
    return curriculum.lessonsBySubject.get(String(subject.id));
  });
  const expectedById = new Map(expectedLessons.map(function(lesson) { return [String(lesson.id), lesson]; }));
  const studyItems = allPlanItems(plan).filter(function(item) { return item.tipo === 'estudo'; });

  if (allPlanItems(plan).length !== studyItems.length || studyItems.length !== expectedLessons.length) return true;
  if (plan.totalAulas !== expectedLessons.length || plan.totalDias !== Math.ceil(expectedLessons.length / lessonsPerDay)) return true;

  const seen = new Set();
  const countByDate = new Map();
  const lessonIdsBySubject = new Map();

  for (const item of studyItems) {
    const lessonKey = String(item.lesson_id);
    const expected = expectedById.get(lessonKey);
    if (!expected || seen.has(lessonKey)) return true;
    if (item.lesson_title !== expected.title || item.subject_id !== expected.subject_id) return true;
    if (!isoDate(item.data)) return true;

    seen.add(lessonKey);
    countByDate.set(item.data, (countByDate.get(item.data) || 0) + 1);
    if (countByDate.get(item.data) > lessonsPerDay) return true;
    const subjectKey = String(item.subject_id);
    if (!lessonIdsBySubject.has(subjectKey)) lessonIdsBySubject.set(subjectKey, []);
    lessonIdsBySubject.get(subjectKey).push(lessonKey);
  }

  if (seen.size !== expectedById.size) return true;
  for (const subject of curriculum.activeSubjects) {
    const expectedIds = curriculum.lessonsBySubject.get(String(subject.id)).map(function(lesson) { return String(lesson.id); });
    const actualIds = lessonIdsBySubject.get(String(subject.id)) || [];
    if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) return true;
  }

  return false;
}

module.exports = {
  DEFAULT_LESSONS_PER_DAY,
  MACRO_PLAN_VERSION,
  MAX_LESSONS_PER_DAY,
  addDays,
  buildCompleteMacroPlan,
  buildCurriculum,
  distributeLessons,
  planNeedsRepair,
  repairMacroPlan,
};
