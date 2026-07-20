const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');
const {
  buildCompleteMacroPlan,
  normalizeMacroPlanRequest,
  planNeedsRepair,
  repairMacroPlan,
  rescheduleMacroPlanFromPendingStudy,
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
          new Date().toISOString().split('T')[0]
        );
        const { error: updateError } = await supabase
          .from('macro_plans').update({ plan_json: macroPlan.plan_json }).eq('id', macroPlan.id);
        if (updateError) throw updateError;
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

    const startDate = new Date().toISOString().split('T')[0];
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
    const existingPlan = existingResult.data && existingResult.data.plan_json;
    mergeCompletedFromPlan(completedLessons, completedItems, existingPlan);
    if (existingPlan) {
      const normalizedExistingPlan = repairMacroPlan(existingPlan, curriculum.subjects, curriculum.lessons, {
        dataProva: existingResult.data && existingResult.data.data_prova,
        doneByLessonId: completedLessons,
        doneByItemId: completedItems,
      });
      mergeCompletedFromPlan(completedLessons, completedItems, normalizedExistingPlan);
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
    });

    const { error: deleteError } = await supabase.from('macro_plans').delete().eq('user_id', user.id);
    if (deleteError) throw deleteError;
    const { error: insertError } = await supabase.from('macro_plans').insert({
      user_id: user.id,
      plan_json: plan,
      // The current Supabase schema keeps this column NOT NULL. In pace mode,
      // store the calculated lesson completion date; plan_json is the source
      // of truth and keeps dataProva as null.
      data_prova: plan.dataProva || plan.dataFimAulas,
    });
    if (insertError) throw insertError;

    return res.status(200).json(plan);
  } catch (err) {
    console.error('Generate macro plan error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
