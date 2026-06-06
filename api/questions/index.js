const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth, requireAdmin } = require('../../lib/middleware');

const OPENROUTER_MODEL = 'google/gemini-2.5-flash';

async function extractQuestionsFromExam(examText, gabaritoText, year, turno) {
  const prompt = `Você é um especialista no CACD (Concurso de Admissão à Carreira Diplomática).

Abaixo está o texto de uma prova TPS do CACD do ano ${year} (${turno}) e seu gabarito oficial.

TEXTO DA PROVA:
${examText.substring(0, 15000)}

GABARITO:
${gabaritoText.substring(0, 3000)}

Extraia TODAS as questões no formato JSON abaixo. Cada QUESTÃO do CACD tem múltiplos itens (geralmente 5, numerados ou com letras). Cada item é uma afirmação a ser julgada como Certo ou Errado.

Para cada item, extraia:
- subject: matéria (Português, Inglês, História do Brasil, História Mundial, Política Internacional, Economia, Direito Interno, Direito Internacional, Geografia)
- topic: tópico específico dentro da matéria (ex: "Linguística textual", "Guerra Fria", "Política Externa Brasileira")
- questao_num: número da questão (1-30 ou similar)
- item_num: número do item dentro da questão (1, 2, 3, 4, 5)
- enunciado: texto da questão/contexto (máx 500 chars) — pode incluir o enunciado da questão pai
- item_text: o texto específico do item a ser julgado (afirmação)
- gabarito: "C" ou "E" (conforme gabarito oficial)

Responda APENAS com JSON válido (sem markdown):
{
  "questoes": [
    {
      "subject": "Português",
      "topic": "Interpretação de texto",
      "questao_num": 1,
      "item_num": 1,
      "enunciado": "Texto sobre X. Julgue os itens a seguir.",
      "item_text": "A afirmação Y está correta porque...",
      "gabarito": "C"
    }
  ]
}`;

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
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) throw new Error('OpenRouter error: ' + response.status);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const match = content.match(/\{[\s\S]+\}/) || [];
  const parsed = JSON.parse(match[0] || content);
  return parsed.questoes || [];
}

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    const user = requireAuth(req, res);
    if (!user) return;

    const supabase = getSupabase();

    if (req.method === 'GET') {
      const { subject, topic, limit = 20, offset = 0, source, year, count_only } = req.query;

      if (count_only === 'true') {
        let q = supabase.from('questions').select('id', { count: 'exact', head: true });
        if (subject) q = q.ilike('subject', `%${subject}%`);
        if (source) q = q.eq('source', source);
        if (year) q = q.eq('year', Number(year));
        const { count, error } = await q;
        if (error) throw error;
        return res.status(200).json({ count: count || 0 });
      }

      let query = supabase
        .from('questions')
        .select('*')
        .range(Number(offset), Number(offset) + Number(limit) - 1)
        .order('year', { ascending: true })
        .order('created_at', { ascending: true });

      if (subject) query = query.ilike('subject', `%${subject}%`);
      if (topic) query = query.ilike('topic', `%${topic}%`);
      if (source) query = query.eq('source', source);
      if (year) query = query.eq('year', Number(year));

      const { data, error } = await query;
      if (error) throw error;

      return res.status(200).json({ questions: data || [] });
    }

    if (req.method === 'POST') {
      const { action } = req.body || {};

      // action=record — save a question attempt
      if (action === 'record') {
        const { subject, topic, question_id, correct } = req.body;
        if (!subject) return res.status(400).json({ error: 'Campo subject é obrigatório.' });
        if (typeof correct !== 'boolean') return res.status(400).json({ error: 'Campo correct deve ser boolean.' });
        const { error } = await supabase.from('question_attempts').insert({
          user_id: user.id, subject, topic: topic || null, question_id: question_id || null, correct
        });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }

      const admin = requireAdmin(req, res);
      if (!admin) return;

      // action=update-topic — update topic for a specific question
      if (action === 'update-topic') {
        const { id, topic } = req.body;
        if (!id) return res.status(400).json({ error: 'id é obrigatório.' });
        const { error } = await supabase.from('questions').update({ topic: topic || null }).eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ ok: true });
      }

      // action=import-exam — AI-assisted import from raw exam text
      if (action === 'import-exam') {
        const { examText, gabaritoText, year, turno = 'manhã' } = req.body;
        if (!examText || !gabaritoText || !year) {
          return res.status(400).json({ error: 'examText, gabaritoText e year são obrigatórios.' });
        }

        // Check if this year is already imported
        const { count: existing } = await supabase
          .from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('source', 'exam')
          .eq('year', Number(year));

        const questoes = await extractQuestionsFromExam(examText, gabaritoText, year, turno);

        if (!questoes || questoes.length === 0) {
          return res.status(422).json({ error: 'Nenhuma questão extraída. Verifique o texto.' });
        }

        const rows = questoes.map(q => ({
          source: 'exam',
          year: Number(year),
          subject: q.subject,
          topic: q.topic || null,
          enunciado: `Q${q.questao_num} Item ${q.item_num} (TPS ${year}): ${q.enunciado || ''}`.substring(0, 1000),
          opcoes: { a: 'Certo', b: 'Errado' },
          gabarito: q.gabarito === 'C' ? 'a' : 'b',
          explicacao: null,
        }));

        // Insert in batches
        const BATCH = 50;
        let inserted = 0;
        for (let i = 0; i < rows.length; i += BATCH) {
          const { error } = await supabase.from('questions').insert(rows.slice(i, i + BATCH));
          if (error) throw error;
          inserted += Math.min(BATCH, rows.length - i);
        }

        return res.status(200).json({
          ok: true,
          inserted,
          year,
          already_had: existing || 0,
          message: `${inserted} questões importadas do TPS ${year}.`
        });
      }

      // Default: insert single question
      const { source = 'exam', year, subject, topic, enunciado, opcoes, gabarito, explicacao } = req.body || {};

      if (!subject || !enunciado || !opcoes || !gabarito) {
        return res.status(400).json({ error: 'Campos obrigatórios: subject, enunciado, opcoes, gabarito.' });
      }

      const { data, error } = await supabase
        .from('questions')
        .insert({ source, year, subject, topic, enunciado, opcoes, gabarito, explicacao })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({ question: data });
    }

    return res.status(405).json({ error: 'Método não permitido' });

  } catch (err) {
    console.error('Questions error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
