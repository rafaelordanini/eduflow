const { getSupabase } = require('../../lib/supabase');
const { cors, requireAdmin } = require('../../lib/middleware');

const OPENROUTER_MODEL = 'google/gemini-2.5-flash';

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const admin = requireAdmin(req, res);
    if (!admin) return;

    const { pdfText, year, subjectHints } = req.body || {};

    if (!pdfText) return res.status(400).json({ error: 'Informe pdfText com o conteúdo do PDF.' });
    if (!year) return res.status(400).json({ error: 'Informe o ano da prova (year).' });

    const systemPrompt = `Você é um especialista em extração de questões de concursos. Extraia TODAS as questões de múltipla escolha do texto de prova fornecido.

Para cada questão, identifique:
- enunciado completo (incluindo texto-base se houver)
- as 5 alternativas (a, b, c, d, e)
- o gabarito correto (letra)
- a matéria/subject da questão
- uma explicação breve (pode ser vazia se não disponível)

Responda SOMENTE com JSON válido:
{
  "questoes": [
    {
      "subject": "nome da matéria",
      "topic": "tópico específico se identificável",
      "enunciado": "texto completo da questão",
      "opcoes": { "a": "...", "b": "...", "c": "...", "d": "...", "e": "..." },
      "gabarito": "letra correta",
      "explicacao": ""
    }
  ]
}`;

    const userPrompt = `Extraia todas as questões de múltipla escolha deste texto da prova CACD ${year}${subjectHints ? ` (matérias: ${subjectHints})` : ''}:

${pdfText.substring(0, 15000)}

Retorne SOMENTE o JSON com todas as questões extraídas.`;

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
        temperature: 0.2,
        max_tokens: 8000
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'Erro ao chamar modelo de IA: ' + errText.substring(0, 200) });
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) return res.status(502).json({ error: 'Resposta vazia do modelo de IA.' });

    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      const match = content.match(/```json\n?([\s\S]+?)\n?```/) || content.match(/({[\s\S]+})/);
      if (match) result = JSON.parse(match[1]);
      else return res.status(502).json({ error: 'Resposta do modelo não está em formato válido.' });
    }

    const questoes = result.questoes || [];
    if (questoes.length === 0) {
      return res.status(200).json({ inserted: 0, message: 'Nenhuma questão extraída.' });
    }

    const supabase = getSupabase();

    const toInsert = questoes.map(q => ({
      source: 'exam',
      year: parseInt(year),
      subject: q.subject || 'Geral',
      topic: q.topic || null,
      enunciado: q.enunciado,
      opcoes: q.opcoes,
      gabarito: (q.gabarito || 'a').toLowerCase().trim(),
      explicacao: q.explicacao || null
    })).filter(q => q.enunciado && q.opcoes && q.gabarito);

    const { data, error } = await supabase
      .from('questions')
      .insert(toInsert)
      .select('id');

    if (error) throw error;

    return res.status(200).json({ inserted: data ? data.length : 0, total_extracted: questoes.length });

  } catch (err) {
    console.error('Ingest questions error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
