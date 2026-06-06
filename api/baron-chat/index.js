const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');

module.exports = async function handler(req, res) {
    try {
        if (cors(req, res)) return;
        if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

        const user = requireAuth(req, res);
        if (!user) return;

        const { message } = req.body || {};
        if (!message || typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({ error: 'Campo message é obrigatório.' });
        }

        const supabase = getSupabase();

        // Fetch last 20 messages for context
        const { data: historyRows } = await supabase
            .from('baron_messages')
            .select('role, content')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(20);
        const history = (historyRows || []).reverse();

        // Fetch performance summary per subject
        const { data: attempts } = await supabase
            .from('question_attempts')
            .select('subject, correct')
            .eq('user_id', user.id);

        const perfMap = {};
        (attempts || []).forEach(function(a) {
            if (!perfMap[a.subject]) perfMap[a.subject] = { correct: 0, total: 0 };
            perfMap[a.subject].total++;
            if (a.correct) perfMap[a.subject].correct++;
        });
        const performanceData = Object.keys(perfMap).length
            ? Object.entries(perfMap).map(function([subj, v]) {
                var pct = Math.round(v.correct / v.total * 100);
                return subj + ': ' + v.correct + '/' + v.total + ' (' + pct + '%)';
            }).join(', ')
            : 'Nenhum dado de desempenho ainda.';

        // Fetch study sessions last 7 days
        var sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { data: sessions } = await supabase
            .from('study_sessions')
            .select('subject, duration_minutes')
            .eq('user_id', user.id)
            .gte('started_at', sevenDaysAgo.toISOString());

        const studyMap = {};
        (sessions || []).forEach(function(s) {
            studyMap[s.subject] = (studyMap[s.subject] || 0) + s.duration_minutes;
        });
        const studyData = Object.keys(studyMap).length
            ? Object.entries(studyMap).map(function([subj, mins]) {
                return subj + ': ' + mins + ' min';
            }).join(', ')
            : 'Nenhuma sessão de estudo registrada nos últimos 7 dias.';

        // Build system prompt
        const systemPrompt = `Você é o Barão do EduFlow, coach especializado no CACD (Concurso de Admissão à Carreira Diplomática do Instituto Rio Branco). Você conhece profundamente o edital, as provas anteriores, a bibliografia recomendada e as estratégias de estudo mais eficazes.

DADOS DO ESTUDANTE:
- Desempenho por matéria: ${performanceData}
- Tempo de estudo últimos 7 dias: ${studyData}

Seu papel:
1. Analisar o desempenho e sugerir onde o estudante deve focar
2. Dar dicas estratégicas baseadas no edital e provas anteriores
3. Oferecer incentivo emocional genuíno (o CACD é difícil — valide o esforço)
4. Responder dúvidas sobre conteúdo, metodologia e gestão de tempo
5. Ser direto, inteligente e caloroso — como um mentor de verdade

Responda sempre em português, de forma concisa e prática. Máximo 3 parágrafos por resposta.`;

        // Build messages array for API
        const messages = [{ role: 'system', content: systemPrompt }];
        history.forEach(function(h) {
            messages.push({ role: h.role, content: h.content });
        });
        messages.push({ role: 'user', content: message.trim() });

        // Call OpenRouter
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY não configurada.' });

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + apiKey,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://eduflow.app',
                'X-Title': 'EduFlow CACD'
            },
            body: JSON.stringify({
                model: 'google/gemini-2.5-flash',
                messages: messages,
                max_tokens: 600
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('OpenRouter error:', errText);
            return res.status(502).json({ error: 'Erro ao chamar o modelo de IA.' });
        }

        const data = await response.json();
        const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
            ? data.choices[0].message.content.trim()
            : 'Não consegui gerar uma resposta. Tente novamente.';

        // Save user message and assistant reply
        await supabase.from('baron_messages').insert([
            { user_id: user.id, role: 'user', content: message.trim() },
            { user_id: user.id, role: 'assistant', content: reply }
        ]);

        return res.status(200).json({ reply });

    } catch (err) {
        console.error('Baron chat error:', err);
        return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
    }
};
