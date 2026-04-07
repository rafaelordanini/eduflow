const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
    try {
        if (cors(req, res)) return;
        const user = requireAuth(req, res);
        if (!user) return;
        const supabase = getSupabase();

        // ── GET: obter progresso ──
        if (req.method === 'GET') {
            const lessonId = req.query.lessonId ? parseInt(req.query.lessonId, 10) : null;

            let query = supabase.from('progress').select('*').eq('user_id', user.id);
            if (lessonId) query = query.eq('lesson_id', lessonId);

            const { data, error } = await query;
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json(data);
        }

        // ── POST: salvar/atualizar progresso ──
        if (req.method === 'POST') {
            const { lesson_id, current_time_seconds, completed } = req.body || {};
            if (!lesson_id) return res.status(400).json({ error: 'lesson_id é obrigatório.' });

            const upsertData = {
                user_id: user.id,
                lesson_id: parseInt(lesson_id, 10),
                last_accessed: new Date().toISOString()
            };
            if (current_time_seconds !== undefined) upsertData.current_time_seconds = parseInt(current_time_seconds, 10) || 0;
            if (completed !== undefined) upsertData.completed = !!completed;

            const { data, error } = await supabase
                .from('progress')
                .upsert(upsertData, { onConflict: 'user_id,lesson_id' })
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json(data);
        }

        return res.status(405).json({ error: 'Método não permitido' });
    } catch (err) {
        console.error('Progress error:', err);
        return res.status(500).json({ error: 'Erro interno do servidor: ' + (err.message || 'desconhecido') });
    }
};
