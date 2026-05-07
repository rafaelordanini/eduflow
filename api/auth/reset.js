const bcrypt = require('bcryptjs');
const { getSupabase } = require('../../lib/supabase');
const { cors } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
    try {
        if (cors(req, res)) return;
        if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

        const { token, username, newPassword } = req.body || {};

        if (!token || !username || !newPassword) {
            return res.status(400).json({ error: 'Token, usuário e nova senha são obrigatórios.' });
        }

        if (newPassword.length < 4) {
             return res.status(400).json({ error: 'A senha deve ter no mínimo 4 caracteres.' });
        }

        if (!process.env.RESET_SECRET_TOKEN) {
            return res.status(500).json({ error: 'Variável de ambiente RESET_SECRET_TOKEN não configurada no servidor.' });
        }

        if (token !== process.env.RESET_SECRET_TOKEN) {
            return res.status(403).json({ error: 'Token de recuperação inválido.' });
        }

        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
            return res.status(500).json({ error: 'Variáveis de ambiente do Supabase não configuradas.' });
        }

        const supabase = getSupabase();

        // Verifica se o usuário existe
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('id')
            .ilike('username', username.trim())
            .single();

        if (fetchError || !user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        // Gera o hash da nova senha
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);

        // Atualiza a senha no banco
        const { error: updateError } = await supabase
            .from('users')
            .update({ password_hash })
            .eq('id', user.id);

        if (updateError) {
             return res.status(500).json({ error: 'Erro ao atualizar a senha no banco de dados.' });
        }

        return res.status(200).json({ success: true, message: 'Senha atualizada com sucesso.' });
    } catch (err) {
        console.error('Reset password error:', err);
        return res.status(500).json({ error: 'Erro interno do servidor: ' + (err.message || 'desconhecido') });
    }
};