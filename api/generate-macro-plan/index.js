const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');
const {
  MAX_LESSONS_PER_DAY,
  MAX_REST_DAYS_PER_WEEK,
  buildCompleteMacroPlan,
  planNeedsRepair,
  repairMacroPlan,
} = require('../../lib/macro-plan');

async function loadCurriculum(supabase) {
  const [subjectResult, lessonResult] = await Promise.all([
    supabase.from('subjects').select('id, name').order('id'),
    supabase.from('lessons').select('id, subject_id, title, order_index, duration_minutes')
      .order('subject_id').order('order_index').order('id'),
  ]);
  if (subjectResult.error) throw subjectResult.error;
  if (lessonResult.error) throw lessonResult.error;
  return { subjects: subjectResult.data || [], lessons: lessonResult.data || [] };
}

async function loadCompletedLessons(supabase, userId) {
  const { data, error } = await supabase
    .from('progress').select('lesson_id').eq('user_id', userId).eq('completed', true);
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
      if (planNeedsRepair(macroPlan.plan_json, curriculum.subjects, curriculum.lessons)) {
        const completedLessons = await loadCompletedLessons(supabase, user.id);
        const completedItems = new Map();
        mergeCompletedFromPlan(completedLessons, completedItems, macroPlan.plan_json);
        macroPlan.plan_json = repairMacroPlan(
          macroPlan.plan_json,
          curriculum.subjects,
          curriculum.lessons,
          { doneByLessonId: completedLessons, doneByItemId: completedItems }
        );
        const { error: updateError } = await supabase
          .from('macro_plans').update({ plan_json: macroPlan.plan_json }).eq('id', macroPlan.id);
        if (updateError) throw updateError;
      }

      return res.status(200).json(macroPlan);
    }

    if (req.method === 'PUT') {
      const { itemId, done } = req.body || {};
      if (!itemId || typeof done !== 'boolean') {
        return res.status(400).json({ error: 'Informe itemId e done (boolean).' });
      }

      const { data: macroPlan, error: fetchError } = await supabase
        .from('macro_plans').select('id, plan_json').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (fetchError || !macroPlan) return res.status(404).json({ error: 'Plano não encontrado.' });

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

    const { dataProva, aulasPorDia, diasDescansoPorSemana } = req.body || {};
    const parsedLessonsPerDay = parseInt(aulasPorDia, 10);
    const parsedRestDays = parseInt(diasDescansoPorSemana == null ? 0 : diasDescansoPorSemana, 10);
    if (!dataProva) return res.status(400).json({ error: 'Informe a data da prova (dataProva).' });
    if (!Number.isFinite(parsedLessonsPerDay) || parsedLessonsPerDay < 1 || parsedLessonsPerDay > MAX_LESSONS_PER_DAY) {
      return res.status(400).json({ error: 'Informe entre 1 e ' + MAX_LESSONS_PER_DAY + ' aulas por dia.' });
    }
    if (!Number.isFinite(parsedRestDays) || parsedRestDays < 0 || parsedRestDays > MAX_REST_DAYS_PER_WEEK) {
      return res.status(400).json({ error: 'Informe entre 0 e ' + MAX_REST_DAYS_PER_WEEK + ' dias de descanso por semana.' });
    }

    const [curriculum, completedLessons, existingResult] = await Promise.all([
      loadCurriculum(supabase),
      loadCompletedLessons(supabase, user.id),
      supabase.from('macro_plans').select('plan_json').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (existingResult.error) throw existingResult.error;
    const completedItems = new Map();
    const existingPlan = existingResult.data && existingResult.data.plan_json;
    mergeCompletedFromPlan(completedLessons, completedItems, existingPlan);
    if (existingPlan) {
      const normalizedExistingPlan = repairMacroPlan(existingPlan, curriculum.subjects, curriculum.lessons, {
        doneByLessonId: completedLessons,
        doneByItemId: completedItems,
      });
      mergeCompletedFromPlan(completedLessons, completedItems, normalizedExistingPlan);
    }
    if (!curriculum.lessons.length) {
      return res.status(400).json({ error: 'Nenhuma aula cadastrada no Supabase para montar o plano.' });
    }

    const plan = buildCompleteMacroPlan(curriculum.subjects, curriculum.lessons, {
      aulasPorDia: parsedLessonsPerDay,
      diasDescansoPorSemana: parsedRestDays,
      dataInicio: new Date().toISOString().split('T')[0],
      doneByLessonId: completedLessons,
      doneByItemId: completedItems,
    });

    const { error: deleteError } = await supabase.from('macro_plans').delete().eq('user_id', user.id);
    if (deleteError) throw deleteError;
    const { error: insertError } = await supabase.from('macro_plans').insert({
      user_id: user.id,
      plan_json: plan,
      data_prova: dataProva,
    });
    if (insertError) throw insertError;

    return res.status(200).json(plan);
  } catch (err) {
    console.error('Generate macro plan error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
