const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    const user = requireAuth(req, res);
    if (!user) return;

    const supabase = getSupabase();
    const action = req.query && req.query.action;

    // GET ?action=macro — return latest macro plan
    if (req.method === 'GET' && action === 'macro') {
      const { data, error } = await supabase
        .from('macro_plans')
        .select('id, plan_json, data_prova, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data && data.length > 0 ? data[0] : null);
    }

    // POST ?action=check_macro — check if user has a macro plan
    if (req.method === 'POST' && action === 'check_macro') {
      const { data, error } = await supabase
        .from('macro_plans')
        .select('id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) return res.status(500).json({ error: error.message });
      if (data && data.length > 0) {
        return res.status(200).json({ exists: true, created_at: data[0].created_at });
      }
      return res.status(200).json({ exists: false });
    }

    // Also support GET ?action=check_macro for convenience
    if (req.method === 'GET' && action === 'check_macro') {
      const { data, error } = await supabase
        .from('macro_plans')
        .select('id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) return res.status(500).json({ error: error.message });
      if (data && data.length > 0) {
        return res.status(200).json({ exists: true, created_at: data[0].created_at });
      }
      return res.status(200).json({ exists: false });
    }

    // POST (no action) — save study session (replaces /api/study-session)
    if (req.method === 'POST' && !action) {
      const { subject, durationMinutes, startedAt } = req.body || {};
      if (!subject) return res.status(400).json({ error: 'Campo subject é obrigatório.' });
      if (!durationMinutes || durationMinutes < 1) return res.status(400).json({ error: 'durationMinutes inválido.' });
      const { data: sd, error: se } = await supabase.from('study_sessions')
        .insert({ user_id: user.id, subject: subject.trim(), duration_minutes: durationMinutes, started_at: startedAt || new Date().toISOString() })
        .select('id').single();
      if (se) return res.status(200).json({ ok: true, id: null }); // table may not exist yet
      return res.status(200).json({ ok: true, id: sd.id });
    }

    // GET ?action=study-sessions
    if (req.method === 'GET' && action === 'study') {
      const { data, error } = await supabase.from('study_sessions')
        .select('*').eq('user_id', user.id).order('started_at', { ascending: false }).limit(30);
      if (error) return res.status(200).json([]); // table may not exist yet
      return res.status(200).json(data || []);
    }

    // GET — performance stats
    if (req.method === 'GET') {
      const { data: attempts, error } = await supabase
        .from('question_attempts')
        .select('subject, correct, attempted_at')
        .eq('user_id', user.id);

      if (error) return res.status(500).json({ error: error.message });

      // Per-subject stats
      const subjectMap = {};
      (attempts || []).forEach(function(a) {
        if (!subjectMap[a.subject]) {
          subjectMap[a.subject] = { total: 0, correct: 0, last_attempted: null };
        }
        subjectMap[a.subject].total++;
        if (a.correct) subjectMap[a.subject].correct++;
        const at = a.attempted_at;
        if (!subjectMap[a.subject].last_attempted || at > subjectMap[a.subject].last_attempted) {
          subjectMap[a.subject].last_attempted = at;
        }
      });

      const subjects = Object.keys(subjectMap).map(function(s) {
        const st = subjectMap[s];
        return {
          subject: s,
          total: st.total,
          correct: st.correct,
          wrong: st.total - st.correct,
          accuracy: st.total > 0 ? Math.round(st.correct / st.total * 100) : 0,
          last_attempted: st.last_attempted
        };
      });

      // Overall stats
      const totalAttempts = (attempts || []).length;
      const totalCorrect = (attempts || []).filter(a => a.correct).length;
      const overall = {
        total: totalAttempts,
        correct: totalCorrect,
        accuracy: totalAttempts > 0 ? Math.round(totalCorrect / totalAttempts * 100) : 0,
        subjects_with_data: subjects.length
      };

      // Weak subjects: accuracy < 60%, sorted by accuracy ASC
      const weakSubjects = subjects
        .filter(s => s.accuracy < 60)
        .sort((a, b) => a.accuracy - b.accuracy);

      // Recent trend: last 7 days attempts count
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentCount = (attempts || []).filter(function(a) {
        return new Date(a.attempted_at) >= sevenDaysAgo;
      }).length;

      return res.status(200).json({
        subjects,
        overall,
        weakSubjects,
        recentTrend: { last7Days: recentCount }
      });
    }

    return res.status(405).json({ error: 'Método não permitido' });

  } catch (err) {
    console.error('Performance error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
