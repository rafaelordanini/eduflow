const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth, requireAdmin } = require('../../lib/middleware');

function convertDriveUrl(url) {
    if (!url || !url.trim()) return '';
    url = url.trim();
    var patterns = [
        /\/file\/d\/([a-zA-Z0-9_-]+)/,
        /[?&]id=([a-zA-Z0-9_-]+)/,
        /^([a-zA-Z0-9_-]{15,})$/
    ];
    for (var i = 0; i < patterns.length; i++) {
        var match = url.match(patterns[i]);
        if (match) return 'https://drive.google.com/file/d/' + match[1] + '/preview';
    }
    return '';
}

module.exports = async function handler(req, res) {
    if (cors(req, res)) return;
    const supabase = getSupabase();

    // ── GET: listar aulas de uma matéria ──
    if (req.method === 'GET') {
        const user = requireAuth(req, res);
        if (!user) return;
        const subjectId = parseInt(req.query.subjectId, 10);
        if (!subjectId) return res.status(400).json({ error: 'subjectId é obrigatório.' });

        const { data, error } = await supabase
            .from('lessons')
            .select('*')
            .eq('subject_id', subjectId)
            .order('order_index');
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data);
    }

    // ── POST: criar aula (admin) ──
    if (req.method === 'POST') {
        const user = requireAdmin(req, res);
        if (!user) return;
        const { subject_id, title, drive_url, duration_minutes } = req.body || {};
        if (!subject_id || !title) {
            return res.status(400).json({ error: 'subject_id e title são obrigatórios.' });
        }

        // Determinar próximo order_index
        const { data: existing } = await supabase
            .from('lessons')
            .select('order_index')
            .eq('subject_id', subject_id)
            .order('order_index', { ascending: false })
            .limit(1);

        const nextOrder = (existing && existing.length > 0) ? existing[0].order_index + 1 : 1;
        const embedUrl = convertDriveUrl(drive_url || '');

        const { data, error } = await supabase
            .from('lessons')
            .insert({
                subject_id,
                title: title.trim(),
                drive_url: (drive_url || '').trim(),
                embed_url: embedUrl,
                duration_minutes: parseInt(duration_minutes, 10) || 0,
                order_index: nextOrder
            })
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(201).json(data);
    }

    return res.status(405).json({ error: 'Método não permitido' });
};
