const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
    try {
        if (cors(req, res)) return;

        const user = requireAuth(req, res);
        if (!user) return;

        const supabase = getSupabase();

        if (req.method === 'POST') {
            const { subject, durationMinutes, startedAt } = req.body || {};

            if (!subject || typeof subject !== 'string' || !subject.trim()) {
                return res.status(400).json({ error: 'Campo subject é obrigatório.' });
            }
            if (!durationMinutes || typeof durationMinutes !== 'number' || durationMinutes < 1) {
                return res.status(400).json({ error: 'Campo durationMinutes deve ser um número positivo.' });
            }
            if (!startedAt) {
                return res.status(400).json({ error: 'Campo startedAt é obrigatório.' });
            }

            const { data, error } = await supabase
                .from('study_sessions')
                .insert({
                    user_id: user.id,
                    subject: subject.trim(),
                    duration_minutes: durationMinutes,
                    started_at: startedAt
                })
                .select('id')
                .single();

            if (error) return res.status(500).json({ error: error.message });

            return res.status(200).json({ ok: true, id: data.id });

        } else if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('study_sessions')
                .select('*')
                .eq('user_id', user.id)
                .order('started_at', { ascending: false })
                .limit(30);

            if (error) return res.status(500).json({ error: error.message });

            return res.status(200).json(data || []);

        } else {
            return res.status(405).json({ error: 'Método não permitido' });
        }

    } catch (err) {
        console.error('Study session error:', err);
        return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
    }
};
