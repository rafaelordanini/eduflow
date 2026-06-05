const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');

const OPENROUTER_MODEL = 'google/gemini-2.5-flash';

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const user = requireAuth(req, res);
    if (!user) return;

    const { lessonId, subjectName, lessonTitle, count = 5 } = req.body || {};

    if (!lessonId) return res.status(400).json({ error: 'Informe o lessonId.' });
    if (!subjectName || !lessonTitle) return res.status(400).json({ error: 'Informe subjectName e lessonTitle.' });

    const supabase = getSupabase();

    // Check cache
    const { data: cached } = await supabase
      .from('lesson_questions')
      .select('questoes')
      .eq('lesson_id', lessonId)
      .single();

    if (cached) {
      return res.status(200).json({ questoes: cached.questoes, cached: true });
    }

    const systemPrompt = `You are an expert in CACD (Concurso de Admissão à Carreira Diplomática do Instituto Rio Branco) exams. You generate multiple-choice questions in the exact style of CACD TPS past exams (2003-2025).

Respond ONLY with valid JSON (no markdown):
{
  "questoes": [
    {
      "enunciado": "question text here",
      "opcoes": { "a": "...", "b": "...", "c": "...", "d": "...", "e": "..." },
      "gabarito": "a",
      "explicacao": "detailed explanation of the correct answer"
    }
  ]
}`;

    const userPrompt = `Generate ${count} multiple-choice questions in the exact style of CACD TPS past exams (2003-2025) about the following topic: "${lessonTitle}" (subject: ${subjectName}).

Requirements:
- Each question should be challenging and test deep understanding
- Include 5 options (a-e) with exactly one correct answer
- Questions should reflect the analytical style of CACD exams
- The explanation should cite relevant sources and explain why the correct answer is right and why the others are wrong
- Write the questions in Portuguese (Brazil)
- Return ONLY the JSON, no markdown`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://eduflow.vercel.app',
        'X-Title': 'EduFlow CACD Coach',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'Erro ao chamar o modelo de IA: ' + errText.substring(0, 200) });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) return res.status(502).json({ error: 'Resposta vazia do modelo de IA.' });

    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      const match = content.match(/```json\n?([\s\S]+?)\n?```/) || content.match(/({[\s\S]+})/);
      if (match) {
        result = JSON.parse(match[1]);
      } else {
        return res.status(502).json({ error: 'Resposta do modelo não está em formato válido.' });
      }
    }

    // Cache in DB
    await supabase.from('lesson_questions').upsert({
      lesson_id: lessonId,
      questoes: result.questoes,
    }, { onConflict: 'lesson_id' });

    return res.status(200).json({ questoes: result.questoes, cached: false });

  } catch (err) {
    console.error('Generate questions error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
