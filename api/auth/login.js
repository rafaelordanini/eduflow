const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getSupabase } = require('../../lib/supabase');
const { cors } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
    try {
        if (cors(req, res)) return;
        if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
        }

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
            return res.status(500).json({ error: 'Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_KEY não configuradas.' });
        }
        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ error: 'Variável de ambiente JWT_SECRET não configurada.' });
        }

        const supabase = getSupabase();
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .ilike('username', username.trim())
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, name: user.name, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.status(200).json({
            token,
            user: { id: user.id, username: user.username, name: user.name, role: user.role }
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Erro interno do servidor: ' + (err.message || 'desconhecido') });
    }
};
