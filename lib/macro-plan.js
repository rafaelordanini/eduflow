const MACRO_PLAN_VERSION = 2;
const REVIEW_INTERVALS = [1, 2, 4];
const MIN_TOPIC_SCORE = 4;

const STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'da', 'das', 'de', 'do', 'dos', 'e', 'em',
  'na', 'nas', 'no', 'nos', 'o', 'os', 'ou', 'para', 'por', 'sem', 'sob',
  'sobre', 'um', 'uma', 'uns', 'umas', 'parte', 'partes', 'p', 'pt',
]);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^revisao\s+espacada\s*:\s*/i, '')
    .replace(/^[a-z]\d+[a-z]?\d*\s*[-–—:]\s*/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isRelatedToken(token, subjectToken) {
  if (token === subjectToken) return true;
  if (token.length < 5 || subjectToken.length < 5) return false;
  return token.startsWith(subjectToken.slice(0, 5)) || subjectToken.startsWith(token.slice(0, 5));
}

function meaningfulTokens(value, subjectName) {
  const subjectTokens = normalizeText(subjectName).split(/\s+/).filter(Boolean);
  return normalizeText(value).split(/\s+/).filter(function(token) {
    if (token.length < 3 || STOP_WORDS.has(token)) return false;
    return !subjectTokens.some(function(subjectToken) { return isRelatedToken(token, subjectToken); });
  });
}

function scoreTopicLesson(topic, lessonTitle, subjectName) {
  const topicTokens = meaningfulTokens(topic, subjectName);
  const lessonTokens = meaningfulTokens(lessonTitle, subjectName);
  let score = 0;

  topicTokens.forEach(function(topicToken) {
    if (lessonTokens.includes(topicToken)) {
      score += 4;
      return;
    }

    if (topicToken.length >= 5 && lessonTokens.some(function(lessonToken) {
      return lessonToken.length >= 5 && (
        topicToken.startsWith(lessonToken.slice(0, 5)) ||
        lessonToken.startsWith(topicToken.slice(0, 5))
      );
    })) {
      score += 2;
    }
  });

  return score;
}

function compareLessons(a, b) {
  const orderA = Number.isFinite(Number(a.order_index)) ? Number(a.order_index) : Number.MAX_SAFE_INTEGER;
  const orderB = Number.isFinite(Number(b.order_index)) ? Number(b.order_index) : Number.MAX_SAFE_INTEGER;
  return orderA - orderB || Number(a.id) - Number(b.id);
}

function buildCurriculum(subjects, lessons) {
  const subjectByName = new Map();
  const subjectById = new Map();
  const lessonsBySubject = new Map();

  (subjects || []).forEach(function(subject) {
    subjectByName.set(normalizeText(subject.name), subject);
    subjectById.set(String(subject.id), subject);
  });

  (lessons || []).forEach(function(lesson) {
    const key = String(lesson.subject_id);
    if (!lessonsBySubject.has(key)) lessonsBySubject.set(key, []);
    lessonsBySubject.get(key).push(lesson);
  });

  lessonsBySubject.forEach(function(subjectLessons) { subjectLessons.sort(compareLessons); });
  return { subjectByName, subjectById, lessonsBySubject };
}

function isGeneratedReview(item) {
  return item && (
    /^rev-/i.test(item.id || '') ||
    Boolean(item.review_of_id) ||
    (item.tipo === 'revisao' && /^revis[aã]o\s+espa[cç]ada\s*:/i.test(item.topico || ''))
  );
}

function lessonForStudyItem(item, subject, subjectLessons, lastLessonIndex) {
  if (!subjectLessons.length) return { lesson: null, index: -1, matched: false };

  if (lastLessonIndex < 0) {
    const firstLesson = subjectLessons[0];
    return {
      lesson: firstLesson,
      index: 0,
      matched: scoreTopicLesson(item.topico, firstLesson.title, subject && subject.name) >= MIN_TOPIC_SCORE,
    };
  }

  const firstAvailableIndex = Math.min(lastLessonIndex + 1, subjectLessons.length - 1);
  let bestIndex = firstAvailableIndex;
  let bestScore = 0;

  for (let index = firstAvailableIndex; index < subjectLessons.length; index += 1) {
    const score = scoreTopicLesson(item.topico, subjectLessons[index].title, subject && subject.name);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  if (bestScore < MIN_TOPIC_SCORE) bestIndex = firstAvailableIndex;
  return {
    lesson: subjectLessons[bestIndex],
    index: bestIndex,
    matched: bestScore >= MIN_TOPIC_SCORE,
  };
}

function retargetToLesson(item, lesson) {
  const totalHours = (item.atividades || []).reduce(function(total, activity) {
    return total + (Number(activity.horas) || 0);
  }, 0);

  return {
    ...item,
    topico: lesson.title,
    atividades: [{
      tipo: 'aula',
      descricao: 'Assistir à aula "' + lesson.title + '"',
      horas: totalHours || 1,
    }],
    leituras: '',
  };
}

function reviewId(sourceWeekIndex, subjectName, interval) {
  const compactSubject = String(subjectName || 'materia').replace(/\s+/g, '');
  return 'rev-w' + (sourceWeekIndex + 1) + '-' + compactSubject + '-d' + (interval * 7);
}

function repairMacroPlan(plan, subjects, lessons) {
  const repaired = JSON.parse(JSON.stringify(plan || {}));
  repaired.semanas = Array.isArray(repaired.semanas) ? repaired.semanas : [];

  const curriculum = buildCurriculum(subjects, lessons);
  const reviewDoneById = new Map();
  const sequencingState = new Map();

  repaired.semanas.forEach(function(week) {
    (week.materias || []).forEach(function(item) {
      if (isGeneratedReview(item)) reviewDoneById.set(item.id, Boolean(item.done));
    });
  });

  repaired.semanas.forEach(function(week, weekIndex) {
    const sourceItems = (week.materias || []).filter(function(item) { return !isGeneratedReview(item); });
    week.materias = sourceItems.map(function(originalItem, itemIndex) {
      const subjectFromId = originalItem.subject_id != null
        ? curriculum.subjectById.get(String(originalItem.subject_id))
        : null;
      const subject = subjectFromId || curriculum.subjectByName.get(normalizeText(originalItem.nome));
      const subjectId = subject ? subject.id : (originalItem.subject_id || null);
      const subjectKey = subjectId != null ? String(subjectId) : 'name:' + normalizeText(originalItem.nome);
      const subjectLessons = subjectId != null
        ? (curriculum.lessonsBySubject.get(String(subjectId)) || [])
        : [];
      const lastLessonIndex = sequencingState.has(subjectKey) ? sequencingState.get(subjectKey) : -1;
      const association = lessonForStudyItem(originalItem, subject, subjectLessons, lastLessonIndex);
      let item = { ...originalItem };

      if (association.lesson && !association.matched) item = retargetToLesson(item, association.lesson);
      if (association.lesson) sequencingState.set(subjectKey, association.index);

      return {
        ...item,
        id: item.id || 'w' + (weekIndex + 1) + '-m' + itemIndex,
        tipo: 'estudo',
        done: Boolean(item.done),
        subject_id: subjectId,
        lesson_id: association.lesson ? association.lesson.id : null,
        lesson_title: association.lesson ? association.lesson.title : null,
      };
    });
  });

  const addedReviews = new Set();
  repaired.semanas.forEach(function(week, sourceWeekIndex) {
    week.materias.filter(function(item) { return item.tipo === 'estudo'; }).forEach(function(sourceItem) {
      REVIEW_INTERVALS.forEach(function(interval) {
        const targetWeekIndex = sourceWeekIndex + interval;
        if (targetWeekIndex >= repaired.semanas.length) return;

        const targetWeek = repaired.semanas[targetWeekIndex];
        const subjectKey = sourceItem.subject_id != null
          ? 'id:' + sourceItem.subject_id
          : 'name:' + normalizeText(sourceItem.nome);
        const targetKey = targetWeekIndex + ':' + subjectKey;
        if (addedReviews.has(targetKey)) return;

        const hasStudyThatWeek = (targetWeek.materias || []).some(function(item) {
          if (item.tipo !== 'estudo') return false;
          if (sourceItem.subject_id != null) return item.subject_id === sourceItem.subject_id;
          return normalizeText(item.nome) === normalizeText(sourceItem.nome);
        });
        if (hasStudyThatWeek) return;

        const id = reviewId(sourceWeekIndex, sourceItem.nome, interval);
        addedReviews.add(targetKey);
        targetWeek.materias.push({
          id,
          nome: sourceItem.nome,
          topico: 'Revisão espaçada: ' + (sourceItem.topico || sourceItem.nome),
          tipo: 'revisao',
          done: reviewDoneById.get(id) || false,
          subject_id: sourceItem.subject_id,
          lesson_id: sourceItem.lesson_id,
          lesson_title: sourceItem.lesson_title,
          review_of_id: sourceItem.id,
          atividades: [{
            tipo: 'revisao',
            descricao: 'Fazer exercícios de ' + sourceItem.nome + ' (revisão espaçada em ' + (interval * 7) + ' dias)',
            horas: 1,
          }],
          leituras: '',
        });
      });
    });
  });

  repaired.macro_plan_version = MACRO_PLAN_VERSION;
  return repaired;
}

function planNeedsRepair(plan, subjects, lessons) {
  if (!plan || plan.macro_plan_version !== MACRO_PLAN_VERSION) return true;

  const curriculum = buildCurriculum(subjects, lessons);
  const firstStudyWeekBySubject = new Map();
  const lastOrderBySubject = new Map();

  for (let weekIndex = 0; weekIndex < (plan.semanas || []).length; weekIndex += 1) {
    const items = plan.semanas[weekIndex].materias || [];
    for (const item of items) {
      if (!Object.prototype.hasOwnProperty.call(item, 'lesson_id') ||
          !Object.prototype.hasOwnProperty.call(item, 'lesson_title')) return true;

      const subjectKey = item.subject_id != null
        ? 'id:' + item.subject_id
        : 'name:' + normalizeText(item.nome);
      const subject = item.subject_id != null
        ? curriculum.subjectById.get(String(item.subject_id))
        : curriculum.subjectByName.get(normalizeText(item.nome));
      if (subject && item.subject_id !== subject.id) return true;
      const subjectLessons = subject
        ? (curriculum.lessonsBySubject.get(String(subject.id)) || [])
        : [];

      if (item.tipo === 'revisao') {
        if (!firstStudyWeekBySubject.has(subjectKey) || firstStudyWeekBySubject.get(subjectKey) >= weekIndex) return true;
        if (!subjectLessons.length) {
          if (item.lesson_id !== null || item.lesson_title !== null) return true;
        } else {
          const reviewLesson = subjectLessons.find(function(candidate) { return candidate.id === item.lesson_id; });
          if (!reviewLesson || reviewLesson.title !== item.lesson_title) return true;
        }
        continue;
      }

      if (item.tipo !== 'estudo') return true;
      if (!firstStudyWeekBySubject.has(subjectKey)) firstStudyWeekBySubject.set(subjectKey, weekIndex);

      if (!subjectLessons.length) {
        if (item.lesson_id !== null || item.lesson_title !== null) return true;
        continue;
      }

      const lesson = subjectLessons.find(function(candidate) { return candidate.id === item.lesson_id; });
      if (!lesson || lesson.title !== item.lesson_title) return true;
      const order = Number(lesson.order_index);
      if (!lastOrderBySubject.has(subjectKey) && lesson.id !== subjectLessons[0].id) return true;
      if (lastOrderBySubject.has(subjectKey) && order < lastOrderBySubject.get(subjectKey)) return true;
      lastOrderBySubject.set(subjectKey, order);
    }
  }

  return false;
}

function formatLessonCatalog(subjects, lessons) {
  const curriculum = buildCurriculum(subjects, lessons);
  return (subjects || []).map(function(subject) {
    const subjectLessons = curriculum.lessonsBySubject.get(String(subject.id)) || [];
    if (!subjectLessons.length) return '**' + subject.name + '**: nenhuma aula cadastrada';
    return '**' + subject.name + '**:\n' + subjectLessons.map(function(lesson) {
      return '  • ordem ' + lesson.order_index + ' | lesson_id ' + lesson.id + ' | ' + lesson.title;
    }).join('\n');
  }).join('\n\n');
}

module.exports = {
  MACRO_PLAN_VERSION,
  buildCurriculum,
  formatLessonCatalog,
  normalizeText,
  planNeedsRepair,
  repairMacroPlan,
  scoreTopicLesson,
};
