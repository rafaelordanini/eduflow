const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

    const user = requireAuth(req, res);
    if (!user) return;

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('daily_plans')
      .select('id, plan_date, hours_available, focus_subjects, plan_json')
      .eq('user_id', user.id)
      .order('plan_date', { ascending: false })
      .limit(30);

    if (error) throw error;

    return res.status(200).json(data || []);
  } catch (err) {
    console.error('Plans history error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
