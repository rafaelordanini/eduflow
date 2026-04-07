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

        return res.status(405).json({ error: 'Método não permitido' });
    } catch (err) {
        console.error('Users error:', err);
        return res.status(500).json({ error: 'Erro interno do servidor: ' + (err.message || 'desconhecido') });
    }
};
