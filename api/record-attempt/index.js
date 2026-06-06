const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const user = requireAuth(req, res);
    if (!user) return;

    const { subject, topic, question_id, correct } = req.body || {};

    if (!subject) return res.status(400).json({ error: 'Campo subject é obrigatório.' });
    if (typeof correct !== 'boolean') return res.status(400).json({ error: 'Campo correct deve ser boolean.' });

    const supabase = getSupabase();
    const { error } = await supabase.from('question_attempts').insert({
      user_id: user.id,
      subject: subject,
      topic: topic || null,
      question_id: question_id || null,
      correct: correct
    });

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Record attempt error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
