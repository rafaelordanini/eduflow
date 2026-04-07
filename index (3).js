const { getSupabase } = require('../../lib/supabase');
const { cors, requireAdmin } = require('../../lib/middleware');

function convertDriveUrl(url) {
    if (!url || !url.trim()) return '';
    url = url.trim();
    var patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/, /^([a-zA-Z0-9_-]{15,})$/];
    for (var i = 0; i < patterns.length; i++) {
        var match = url.match(patterns[i]);
        if (match) return 'https://drive.google.com/file/d/' + match[1] + '/preview';
    }
    return '';
}

module.exports = async function handler(req, res) {
    try {
        if (cors(req, res)) return;
        const user = requireAdmin(req, res);
        if (!user) return;

        const id = parseInt(req.query.id, 10);
        if (!id) return res.status(400).json({ error: 'ID inválido.' });
        const supabase = getSupabase();

        // ── PUT: atualizar aula ──
        if (req.method === 'PUT') {
            const { title, drive_url, duration_minutes, order_index } = req.body || {};
            const updates = {};
            if (title) updates.title = title.trim();
            if (drive_url !== undefined) {
                updates.drive_url = drive_url.trim();
                updates.embed_url = convertDriveUrl(drive_url);
            }
            if (duration_minutes !== undefined) updates.duration_minutes = parseInt(duration_minutes, 10) || 0;
            if (order_index !== undefined) updates.order_index = parseInt(order_index, 10);

            const { data, error } = await supabase
                .from('lessons')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (error) return res.status(500).json({ error: error.message });
            if (!data) return res.status(404).json({ error: 'Aula não encontrada.' });
            return res.status(200).json(data);
        }

        // ── DELETE: excluir aula e reordenar restantes ──
        if (req.method === 'DELETE') {
            // Buscar aula para saber subject_id
            const { data: lesson } = await supabase.from('lessons').select('subject_id, order_index').eq('id', id).single();
            if (!lesson) return res.status(404).json({ error: 'Aula não encontrada.' });

            const { error } = await supabase.from('lessons').delete().eq('id', id);
            if (error) return res.status(500).json({ error: error.message });

            // Reordenar restantes
            const { data: remaining } = await supabase
                .from('lessons')
                .select('id, order_index')
                .eq('subject_id', lesson.subject_id)
                .order('order_index');

            if (remaining) {
                for (let i = 0; i < remaining.length; i++) {
                    if (remaining[i].order_index !== i + 1) {
                        await supabase.from('lessons').update({ order_index: i + 1 }).eq('id', remaining[i].id);
                    }
                }
            }

            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Método não permitido' });
    } catch (err) {
        console.error('Lesson [id] error:', err);
        return res.status(500).json({ error: 'Erro interno do servidor: ' + (err.message || 'desconhecido') });
    }
};
