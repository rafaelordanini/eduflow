const { getSupabase } = require('../supabase');
const { cors, requireAuth } = require('../middleware');
const { deduplicateCurriculumLessons, driveFileId, resolvePlanLessonAliases } = require('../lesson-deduplication');
const {
  buildCompleteMacroPlan,
  advanceMacroPlanDay,
  normalizeMacroPlanRequest,
  planNeedsRepair,
  repairMacroPlan,
  rescheduleMacroPlanFromPendingStudy,
  todayIso,
} = require('../macro-plan');

async function loadCurriculum(supabase) {
  const [subjectResult, lessonResult] = await Promise.all([
    supabase.from('subjects').select('id, name').order('id'),
    supabase.from('lessons').select('id, subject_id, title, order_index, duration_minutes, drive_url, embed_url, duplicate_of_id')
      .order('subject_id').order('order_index').order('id'),
  ]);
  if (subjectResult.error) throw subjectResult.error;
  if (lessonResult.error) throw lessonResult.error;
  return {
    subjects: subjectResult.data || [],
    lessons: deduplicateCurriculumLessons(lessonResult.data || []),
    rawLessons: lessonResult.data || [],
  };
}

function mapCompletedDuplicates(curriculum, completedLessons) {
  const seenRows = curriculum.rawLessons.filter(lesson => lesson.duplicate_of_id == null && completedLessons.get(String(lesson.id)));
  curriculum.lessons.forEach(function(lesson) {
    if (seenRows.some(seen => String(seen.subject_id) === String(lesson.subject_id) &&
      (driveFileId(lesson) && driveFileId(seen) === driveFileId(lesson)))) {
      completedLessons.set(String(lesson.id), true);
    }
  });
}

async function loadCompletedLessons(supabase, userId) {
  const { data, error } = await supabase
    .from('progress').select('lesson_id, lessons!inner(duplicate_of_id)').eq('user_id', userId)
    .eq('completed', true).is('lessons.duplicate_of_id', null);
  if (error) throw error;
  return new Map((data || []).map(function(progress) { return [String(progress.lesson_id), true]; }));
}

function mergeCompletedFromPlan(doneByLessonId, doneByItemId, plan) {
  (plan && plan.semanas || []).forEach(function(week) {
    (week.materias || []).forEach(function(item) {
      if (!item.done) return;
      if (item.id) doneByItemId.set(String(item.id), true);
      if (item.tipo === 'estudo' && item.lesson_id != null) {
        doneByLessonId.set(String(item.lesson_id), true);
      }
    });
  });
}

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    const user = requireAuth(req, res);
    if (!user) return;

    const supabase = getSupabase();

    if (req.method === 'GET') {
      const { data: macroPlan, error } = await supabase
        .from('macro_plans')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!macroPlan) return res.status(200).json(null);

      const curriculum = await loadCurriculum(supabase);
      const originalPlan = macroPlan.plan_json;
      macroPlan.plan_json = resolvePlanLessonAliases(originalPlan, curriculum.rawLessons);
      if (planNeedsRepair(macroPlan.plan_json, curriculum.subjects, curriculum.lessons) ||
          JSON.stringify(macroPlan.plan_json) !== JSON.stringify(originalPlan)) {
        const completedLessons = await loadCompletedLessons(supabase, user.id);
        const completedItems = new Map();
        mergeCompletedFromPlan(completedLessons, completedItems, macroPlan.plan_json);
        macroPlan.plan_json = repairMacroPlan(
          macroPlan.plan_json,
          curriculum.subjects,
          curriculum.lessons,
          {
            dataProva: macroPlan.data_prova,
            doneByLessonId: completedLessons,
            doneByItemId: completedItems,
          }
        );
        const { error: updateError } = await supabase
          .from('macro_plans').update({ plan_json: macroPlan.plan_json }).eq('id', macroPlan.id);
        if (updateError) throw updateError;
      }

      return res.status(200).json(macroPlan);
    }

    if (req.method === 'PUT') {
      const { itemId, done, action } = req.body || {};

      const { data: macroPlan, error: fetchError } = await supabase
        .from('macro_plans').select('id, plan_json').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (fetchError || !macroPlan) return res.status(404).json({ error: 'Plano não encontrado.' });

      if (action === 'reschedule_from_pending') {
        macroPlan.plan_json = rescheduleMacroPlanFromPendingStudy(
          macroPlan.plan_json,
          todayIso()
        );
        const { error: updateError } = await supabase
          .from('macro_plans').update({ plan_json: macroPlan.plan_json }).eq('id', macroPlan.id);
        if (updateError) throw updateError;
        return res.status(200).json({ ok: true, plan_json: macroPlan.plan_json });
      }

      if (action === 'advance_day') {
        const today = todayIso();
        const items = (macroPlan.plan_json.semanas || []).flatMap(function(week) { return week.materias || []; });
        const pendingToday = items.some(function(item) { return item.data === today && !item.done; });
        const hasFutureItems = items.some(function(item) { return item.data > today; });
        if (pendingToday) {
          return res.status(409).json({ error: 'Conclua as tarefas de hoje antes de avançar o plano.' });
        }
        if (!hasFutureItems) {
          return res.status(400).json({ error: 'Não há um próximo dia de estudos no Plano Mestre.' });
        }

        macroPlan.plan_json = advanceMacroPlanDay(macroPlan.plan_json, today);
        const { error: updateError } = await supabase
          .from('macro_plans').update({ plan_json: macroPlan.plan_json }).eq('id', macroPlan.id);
        if (updateError) throw updateError;

        // The generated daily plan described the old schedule. Removing it
        // makes Plano de Hoje immediately offer a fresh plan for the new day.
        const { error: dailyPlanError } = await supabase.from('daily_plans')
          .delete().eq('user_id', user.id).eq('plan_date', today);
        if (dailyPlanError) throw dailyPlanError;
        return res.status(200).json({ ok: true, plan_json: macroPlan.plan_json });
      }

      if (!itemId || typeof done !== 'boolean') {
        return res.status(400).json({ error: 'Informe itemId e done (boolean).' });
      }

      let found = false;
      (macroPlan.plan_json.semanas || []).forEach(function(week) {
        (week.materias || []).forEach(function(item) {
          if (item.id === itemId) { item.done = done; found = true; }
        });
      });
      if (!found) return res.status(404).json({ error: 'Item não encontrado no plano.' });

      const { error: updateError } = await supabase
        .from('macro_plans').update({ plan_json: macroPlan.plan_json }).eq('id', macroPlan.id);
      if (updateError) throw updateError;
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const startDate = todayIso();
    const normalizedRequest = normalizeMacroPlanRequest(req.body, startDate);
    if (normalizedRequest.error) return res.status(400).json({ error: normalizedRequest.error });
    const planOptions = normalizedRequest.value;

    const [curriculum, completedLessons, existingResult] = await Promise.all([
      loadCurriculum(supabase),
      loadCompletedLessons(supabase, user.id),
      supabase.from('macro_plans').select('plan_json, data_prova').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (existingResult.error) throw existingResult.error;
    const completedItems = new Map();
    const existingPlan = resolvePlanLessonAliases(existingResult.data && existingResult.data.plan_json, curriculum.rawLessons);
    if (planOptions.modoRecriacao === 'continuar') {
      mergeCompletedFromPlan(completedLessons, completedItems, existingPlan);
      mapCompletedDuplicates(curriculum, completedLessons);
      // A recreated calendar starts fresh review cycles for seen lessons.
      completedItems.clear();
    } else {
      completedLessons.clear();
    }
    if (!curriculum.lessons.length) {
      return res.status(400).json({ error: 'Nenhuma aula cadastrada no Supabase para montar o plano.' });
    }

    const plan = buildCompleteMacroPlan(curriculum.subjects, curriculum.lessons, {
      modoPlanejamento: planOptions.modoPlanejamento,
      aulasPorDia: planOptions.aulasPorDia,
      diasDescansoPorSemana: planOptions.diasDescansoPorSemana,
      dataInicio: startDate,
      dataProva: planOptions.dataProva,
      doneByLessonId: completedLessons,
      doneByItemId: completedItems,
      modoRecriacao: planOptions.modoRecriacao,
    });

    // Replace the calendar, optionally reset progress and invalidate stale daily
    // plans in one transaction. A failed save leaves the old state untouched.
    const { error: saveError } = await supabase.rpc('recreate_macro_plan', {
      p_user_id: user.id,
      p_plan: plan,
      p_data_prova: plan.dataProva || plan.dataFimAulas,
      p_reset_progress: planOptions.modoRecriacao === 'do_zero',
      p_start_date: startDate,
    });
    if (saveError) throw saveError;

    return res.status(200).json(plan);
  } catch (err) {
    console.error('Generate macro plan error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
