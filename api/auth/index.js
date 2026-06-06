const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    const url = req.url || '';

    // GET /api/auth?action=me
    if (req.method === 'GET') {
      const user = requireAuth(req, res);
      if (!user) return;
      return res.status(200).json({ user: { id: user.id, username: user.username, name: user.name, role: user.role } });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const action = (req.body && req.body.action) || (url.includes('/reset') ? 'reset' : 'login');

    // POST action=login (default)
    if (action === 'login') {
      const { username, password } = req.body || {};
      if (!username || !password) return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
      if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'JWT_SECRET não configurado.' });

      const supabase = getSupabase();
      const { data: user, error } = await supabase.from('users').select('*').ilike('username', username.trim()).single();
      if (error || !user) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });

      const token = jwt.sign(
        { id: user.id, username: user.username, name: user.name, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.status(200).json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
    }

    // POST action=reset
    if (action === 'reset') {
      const { token, username, newPassword } = req.body || {};
      if (!token || !username || !newPassword) return res.status(400).json({ error: 'Token, usuário e nova senha são obrigatórios.' });
      if (newPassword.length < 4) return res.status(400).json({ error: 'A senha deve ter no mínimo 4 caracteres.' });
      if (!process.env.RESET_SECRET_TOKEN) return res.status(500).json({ error: 'RESET_SECRET_TOKEN não configurado.' });
      if (token !== process.env.RESET_SECRET_TOKEN) return res.status(403).json({ error: 'Token de recuperação inválido.' });

      const supabase = getSupabase();
      const { data: user, error: fetchError } = await supabase.from('users').select('id').ilike('username', username.trim()).single();
      if (fetchError || !user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash(newPassword, salt);
      const { error: updateError } = await supabase.from('users').update({ password_hash }).eq('id', user.id);
      if (updateError) return res.status(500).json({ error: 'Erro ao atualizar a senha.' });

      return res.status(200).json({ success: true, message: 'Senha atualizada com sucesso.' });
    }

    return res.status(400).json({ error: 'Ação desconhecida.' });

  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
