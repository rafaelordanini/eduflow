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

    const systemPrompt = `Você é um especialista no CACD (Concurso de Admissão à Carreira Diplomática do Instituto Rio Branco). Seu papel é gerar questões de múltipla escolha no estilo exato das provas TPS do CACD aplicadas de 2003 a 2025.

ESTILO DAS QUESTÕES CACD:
- Enunciados longos e analíticos, com contexto histórico/conceitual antes da pergunta
- 5 alternativas (a-e), todas plausíveis, com apenas uma correta
- Afirmações que testam nuances (datas precisas, nomes de tratados, detalhes de política externa)
- Frequentemente usam estrutura "Julgue as afirmações I, II, III, IV e V" ou apresentam um texto-base
- PRIORIZE tópicos e abordagens que JÁ FORAM cobrados em provas anteriores do CACD
- As questões de história têm forte ênfase em relações internacionais do Brasil e política externa
- As questões de economia focam em política econômica brasileira e teoria econômica aplicada
- As questões de direito internacional focam em tratados, costumes e jurisprudência do CIJ

Exemplos de questões reais CACD 2024 (TPS):
- "Acerca do colonialismo, do imperialismo e das políticas de dominação nos séculos XIX e XX..."
- "A respeito do Plano de Metas, implementado no governo de Juscelino Kubitschek..."
- "Considerando conceitos relacionados ao balanço de pagamentos bem como a sua estrutura..."

Responda SOMENTE com JSON válido (sem markdown):
{
  "questoes": [
    {
      "enunciado": "texto da questão",
      "opcoes": { "a": "...", "b": "...", "c": "...", "d": "...", "e": "..." },
      "gabarito": "a",
      "explicacao": "explicação detalhada: por que a alternativa correta está certa e as demais erradas, com base em fatos históricos e fontes bibliográficas do CACD",
      "fonte": "Baseado em temas cobrados no CACD [ano(s)]"
    }
  ]
}`;

    const userPrompt = `Gere ${count} questões de múltipla escolha no estilo exato das provas TPS do CACD (2003-2025) sobre o seguinte tópico: "${lessonTitle}" (matéria: ${subjectName}).

Requisitos obrigatórios:
1. PRIORIZE subtópicos e abordagens que já foram cobrados nas provas do CACD — mencione o ano na propriedade "fonte"
2. Questões desafiadoras que testam profundidade de conhecimento, não memorização superficial
3. Alternativas plausíveis que testam distinções sutis (ex: datas, conceitos parecidos, nomes de acordos)
4. A explicação deve citar as fontes bibliográficas do CACD relevantes (ex: Fausto HB, Cervo HPEB, Rezek DI)
5. Escreva em português do Brasil, com linguagem acadêmica
6. Retorne SOMENTE o JSON, sem markdown`;

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
