const bcrypt = require('bcryptjs');
const { getSupabase } = require('../../lib/supabase');
const { cors, requireAdmin } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
    try {
        if (cors(req, res)) return;
        const user = requireAdmin(req, res);
        if (!user) return;
        const supabase = getSupabase();

        // ── GET: listar todos os usuários ──
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('users')
                .select('id, username, name, role, created_at')
                .order('id');
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json(data);
        }

        // ── POST: criar novo usuário ──
        if (req.method === 'POST') {
            const { username, password, name, role } = req.body || {};
            if (!username || !password || !name) {
                return res.status(400).json({ error: 'username, password e name são obrigatórios.' });
            }
            if (password.length < 4) {
                return res.status(400).json({ error: 'Senha deve ter no mínimo 4 caracteres.' });
            }
            const validRole = (role === 'admin' || role === 'student') ? role : 'student';
            const hash = await bcrypt.hash(password, 10);

            const { data, error } = await supabase
                .from('users')
                .insert({ username: username.trim().toLowerCase(), password_hash: hash, name: name.trim(), role: validRole })
                .select('id, username, name, role, created_at')
                .single();

            if (error) {
                if (error.code === '23505') return res.status(409).json({ error: 'Este nome de usuário já existe.' });
                return res.status(500).json({ error: error.message });
            }
            return res.status(201).json(data);
        }

        // ── PUT: atualizar usuário (id via query param) ──
        if (req.method === 'PUT') {
            const id = parseInt(req.query.id, 10);
            if (!id) return res.status(400).json({ error: 'ID inválido.' });

            const { username, password, name, role } = req.body || {};
            const updates = {};
            if (username) updates.username = username.trim().toLowerCase();
            if (name) updates.name = name.trim();
            if (role === 'admin' || role === 'student') updates.role = role;
            if (password && password.length >= 4) {
                updates.password_hash = await bcrypt.hash(password, 10);
            }

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: 'Nenhum campo para atualizar.' });
            }

            const { data, error } = await supabase
                .from('users')
                .update(updates)
                .eq('id', id)
                .select('id, username, name, role, created_at')
                .single();

            if (error) {
                if (error.code === '23505') return res.status(409).json({ error: 'Este nome de usuário já existe.' });
                return res.status(500).json({ error: error.message });
            }
            if (!data) return res.status(404).json({ error: 'Usuário não encontrado.' });
            return res.status(200).json(data);
        }

        // ── DELETE: excluir usuário (id via query param) ──
        if (req.method === 'DELETE') {
            const id = parseInt(req.query.id, 10);
            if (!id) return res.status(400).json({ error: 'ID inválido.' });

            if (id === user.id) {
                return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário.' });
            }
            const { error } = await supabase.from('users').delete().eq('id', id);
            if (error) return res.status(500).json({ error: error.message });
            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Método não permitido' });
    } catch (err) {
        console.error('Users error:', err);
        return res.status(500).json({ error: 'Erro interno do servidor: ' + (err.message || 'desconhecido') });
    }
};
