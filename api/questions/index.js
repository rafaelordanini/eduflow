const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth, requireAdmin } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    const user = requireAuth(req, res);
    if (!user) return;

    const supabase = getSupabase();

    if (req.method === 'GET') {
      const { subject, topic, limit = 20, offset = 0, source } = req.query;

      let query = supabase
        .from('questions')
        .select('*')
        .range(Number(offset), Number(offset) + Number(limit) - 1)
        .order('created_at', { ascending: false });

      if (subject) query = query.ilike('subject', `%${subject}%`);
      if (topic) query = query.ilike('topic', `%${topic}%`);
      if (source) query = query.eq('source', source);

      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json({ questions: data || [] });
    }

    if (req.method === 'POST') {
      const { action } = req.body || {};

      // action=record — save a question attempt (replaces /api/record-attempt)
      if (action === 'record') {
        const { subject, topic, question_id, correct } = req.body;
        if (!subject) return res.status(400).json({ error: 'Campo subject é obrigatório.' });
        if (typeof correct !== 'boolean') return res.status(400).json({ error: 'Campo correct deve ser boolean.' });
        const { error } = await supabase.from('question_attempts').insert({
          user_id: user.id, subject, topic: topic || null, question_id: question_id || null, correct
        });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }

      const admin = requireAdmin(req, res);
      if (!admin) return;

      const { source = 'exam', year, subject, topic, enunciado, opcoes, gabarito, explicacao } = req.body || {};

      if (!subject || !enunciado || !opcoes || !gabarito) {
        return res.status(400).json({ error: 'Campos obrigatórios: subject, enunciado, opcoes, gabarito.' });
      }

      const { data, error } = await supabase
        .from('questions')
        .insert({ source, year, subject, topic, enunciado, opcoes, gabarito, explicacao })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ question: data });
    }

    return res.status(405).json({ error: 'Método não permitido' });

  } catch (err) {
    console.error('Questions error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
