const { cors, requireAuth } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
    try {
        if (cors(req, res)) return;
        if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

        const user = requireAuth(req, res);
        if (!user) return;

        return res.status(200).json({
            user: { id: user.id, username: user.username, name: user.name, role: user.role }
        });
    } catch (err) {
        console.error('Me error:', err);
        return res.status(500).json({ error: 'Erro interno do servidor: ' + (err.message || 'desconhecido') });
    }
};
