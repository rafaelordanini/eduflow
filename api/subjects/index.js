const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth, requireAdmin } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
    try {
        if (cors(req, res)) return;
        const supabase = getSupabase();

        // ── GET: listar matérias (qualquer usuário autenticado) ──
        if (req.method === 'GET') {
            const user = requireAuth(req, res);
            if (!user) return;
            const { data, error } = await supabase
                .from('subjects')
                .select('*')
                .order('id');
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json(data);
        }

        // ── POST: criar matéria (admin) ──
        if (req.method === 'POST') {
            const user = requireAdmin(req, res);
            if (!user) return;
            const { name, description } = req.body || {};
            if (!name || !name.trim()) {
                return res.status(400).json({ error: 'Nome da matéria é obrigatório.' });
            }
            const { data, error } = await supabase
                .from('subjects')
                .insert({ name: name.trim(), description: (description || '').trim() })
                .select()
                .single();
            if (error) return res.status(500).json({ error: error.message });
            return res.status(201).json(data);
        }

        // ── PUT: atualizar matéria (admin, id via query param) ──
        if (req.method === 'PUT') {
            const user = requireAdmin(req, res);
            if (!user) return;
            const id = parseInt(req.query.id, 10);
            if (!id) return res.status(400).json({ error: 'ID inválido.' });

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

        // ── DELETE: excluir matéria (admin, id via query param, cascade remove aulas) ──
        if (req.method === 'DELETE') {
            const user = requireAdmin(req, res);
            if (!user) return;
            const id = parseInt(req.query.id, 10);
            if (!id) return res.status(400).json({ error: 'ID inválido.' });

            const { error } = await supabase.from('subjects').delete().eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Método não permitido' });
    } catch (err) {
        console.error('Subjects error:', err);
        return res.status(500).json({ error: 'Erro interno do servidor: ' + (err.message || 'desconhecido') });
    }
};
