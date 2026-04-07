const { getSupabase } = require('../../lib/supabase');
const { cors, requireAdmin } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
    try {
        if (cors(req, res)) return;
        if (req.method !== 'PUT') return res.status(405).json({ error: 'Método não permitido' });

        const user = requireAdmin(req, res);
        if (!user) return;

        const { lessonId, direction } = req.body || {};
        if (!lessonId || (direction !== 1 && direction !== -1)) {
            return res.status(400).json({ error: 'lessonId e direction (1 ou -1) são obrigatórios.' });
        }

        const supabase = getSupabase();

        // Buscar a aula atual
        const { data: lesson } = await supabase.from('lessons').select('*').eq('id', lessonId).single();
        if (!lesson) return res.status(404).json({ error: 'Aula não encontrada.' });

        // Buscar todas as aulas da matéria
        const { data: all } = await supabase
            .from('lessons')
            .select('id, order_index')
            .eq('subject_id', lesson.subject_id)
            .order('order_index');

        const idx = all.findIndex(function(l) { return l.id === lessonId; });
        const swapIdx = idx + direction;
        if (swapIdx < 0 || swapIdx >= all.length) {
            return res.status(400).json({ error: 'Não é possível mover nessa direção.' });
        }

        // Trocar order_index
        const tempOrder = all[idx].order_index;
        await supabase.from('lessons').update({ order_index: all[swapIdx].order_index }).eq('id', all[idx].id);
        await supabase.from('lessons').update({ order_index: tempOrder }).eq('id', all[swapIdx].id);

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Reorder error:', err);
        return res.status(500).json({ error: 'Erro interno do servidor: ' + (err.message || 'desconhecido') });
    }
};
