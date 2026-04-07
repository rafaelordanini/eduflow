const { getSupabase } = require('../../lib/supabase');
const { cors, requireAdmin } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
    if (cors(req, res)) return;
    const user = requireAdmin(req, res);
    if (!user) return;

    const id = parseInt(req.query.id, 10);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });
    const supabase = getSupabase();

    // ── PUT: atualizar matéria ──
    if (req.method === 'PUT') {
        const { name, description } = req.body || {};
        const updates = {};
        if (name) updates.name = name.trim();
        if (description !== undefined) updates.description = description.trim();

        const { data, error } = await supabase
            .from('subjects')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) return res.status(500).json({ error: error.message });
        if (!data) return res.status(404).json({ error: 'Matéria não encontrada.' });
        return res.status(200).json(data);
    }

    // ── DELETE: excluir matéria (cascade remove aulas) ──
    if (req.method === 'DELETE') {
        const { error } = await supabase.from('subjects').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Método não permitido' });
};
