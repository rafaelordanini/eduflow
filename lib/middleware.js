const jwt = require('jsonwebtoken');

/** Handle CORS preflight — returns true if request was handled */
function cors(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }
    return false;
}

/** Extract and verify JWT from Authorization header */
function verifyToken(req) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    try {
        return jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    } catch (_e) {
        return null;
    }
}

/** Require valid auth — returns user payload or sends 401 */
function requireAuth(req, res) {
    const user = verifyToken(req);
    if (!user) {
        res.status(401).json({ error: 'Não autorizado. Faça login novamente.' });
        return null;
    }
    return user;
}

/** Require admin role — returns user payload or sends 403 */
function requireAdmin(req, res) {
    const user = requireAuth(req, res);
    if (!user) return null;
    if (user.role !== 'admin') {
        res.status(403).json({ error: 'Acesso restrito a administradores.' });
        return null;
    }
    return user;
}

module.exports = { cors, verifyToken, requireAuth, requireAdmin };
