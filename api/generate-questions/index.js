const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');

const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const DEEPSEEK_MAX_TOKENS = 4096;

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

async function generateAIQuestions(subjectName, lessonTitle, count, offset = 0) {
  const userPrompt = `Gere ${count} questões de múltipla escolha no estilo exato das provas TPS do CACD (2003-2025) sobre o seguinte tópico: "${lessonTitle}" (matéria: ${subjectName}).

Requisitos obrigatórios:
1. PRIORIZE subtópicos e abordagens que já foram cobrados nas provas do CACD — mencione o ano na propriedade "fonte"
2. Questões desafiadoras que testam profundidade de conhecimento, não memorização superficial
3. Alternativas plausíveis que testam distinções sutis (ex: datas, conceitos parecidos, nomes de acordos)
4. A explicação deve citar as fontes bibliográficas do CACD relevantes (ex: Fausto HB, Cervo HPEB, Rezek DI)
5. Escreva em português do Brasil, com linguagem acadêmica
${offset > 0 ? `6. Gere questões DIFERENTES das ${offset} questões já geradas anteriormente sobre este tópico` : ''}
6. Retorne SOMENTE o JSON, sem markdown`;

  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
  if (!deepseekApiKey) {
    throw new Error('DEEPSEEK_API_KEY não configurada.');
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${deepseekApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      temperature: 0.8,
      max_tokens: DEEPSEEK_MAX_TOKENS
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Erro ao chamar o modelo DeepSeek: ' + errText.substring(0, 200));
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;

  if (!content) throw new Error('Resposta vazia do modelo de IA.');

  let result;
  try {
    result = JSON.parse(content);
  } catch (e) {
    const match = content.match(/```json\n?([\s\S]+?)\n?```/) || content.match(/({[\s\S]+})/);
    if (match) {
      result = JSON.parse(match[1]);
    } else {
      throw new Error('Resposta do modelo não está em formato válido.');
    }
  }

  return result.questoes || [];
}

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const user = requireAuth(req, res);
    if (!user) return;

    const { lessonId, subjectName, lessonTitle, count = 5, offset = 0, forceNew = false } = req.body || {};

    if (!lessonId) return res.status(400).json({ error: 'Informe o lessonId.' });
    if (!subjectName || !lessonTitle) return res.status(400).json({ error: 'Informe subjectName e lessonTitle.' });

    const supabase = getSupabase();

    // If forceNew, skip cache and generate fresh AI questions
    if (forceNew) {
      const newQuestoes = await generateAIQuestions(subjectName, lessonTitle, count, offset);

      // Save new AI questions to global questions bank
      const questionsToInsert = newQuestoes.map(q => ({
        source: 'ai',
        subject: subjectName,
        topic: lessonTitle,
        enunciado: q.enunciado,
        opcoes: q.opcoes,
        gabarito: q.gabarito,
        explicacao: q.explicacao
      }));
      const { data: savedQuestions } = await supabase
        .from('questions')
        .insert(questionsToInsert)
        .select('id');

      // Save to lesson_questions as well (append to existing)
      const { data: existing } = await supabase
        .from('lesson_questions')
        .select('questoes')
        .eq('lesson_id', lessonId)
        .single();

      const existingQuestoes = existing ? (existing.questoes || []) : [];
      const combined = existingQuestoes.concat(newQuestoes);
      await supabase.from('lesson_questions').upsert({
        lesson_id: lessonId,
        questoes: combined,
      }, { onConflict: 'lesson_id' });

      return res.status(200).json({ questoes: newQuestoes, cached: false, source: 'ai' });
    }

    // Search the questions bank first
    const keywords = lessonTitle.split(' ').filter(w => w.length > 3).slice(0, 4);
    let bankQuery = supabase
      .from('questions')
      .select('*')
      .ilike('subject', `%${subjectName}%`)
      .limit(count);

    if (keywords.length > 0) {
      // Search by topic or enunciado keywords
      bankQuery = supabase
        .from('questions')
        .select('*')
        .ilike('subject', `%${subjectName}%`)
        .or(`topic.ilike.%${lessonTitle}%,enunciado.ilike.%${keywords[0]}%`)
        .limit(count);
    }

    const { data: bankQuestions } = await bankQuery;

    if (bankQuestions && bankQuestions.length >= count) {
      // Enough real/cached questions found
      const questoes = bankQuestions.map(q => ({
        enunciado: q.enunciado,
        opcoes: q.opcoes,
        gabarito: q.gabarito,
        explicacao: q.explicacao,
        fonte: q.source === 'exam' ? `Prova CACD ${q.year || ''}`.trim() : 'Gerado por IA',
        question_id: q.id
      }));
      return res.status(200).json({ questoes, cached: true, source: 'bank' });
    }

    // Check lesson_questions cache (old-style JSONB cache)
    if (!bankQuestions || bankQuestions.length === 0) {
      const { data: cached } = await supabase
        .from('lesson_questions')
        .select('questoes')
        .eq('lesson_id', lessonId)
        .single();

      if (cached && cached.questoes && cached.questoes.length >= count) {
        return res.status(200).json({ questoes: cached.questoes.slice(0, count), cached: true, source: 'lesson_cache' });
      }
    }

    // Generate missing questions via AI
    const alreadyHave = bankQuestions ? bankQuestions.length : 0;
    const needed = count - alreadyHave;
    const newQuestoes = await generateAIQuestions(subjectName, lessonTitle, needed, alreadyHave);

    // Save new AI questions to global questions bank
    const questionsToInsert = newQuestoes.map(q => ({
      source: 'ai',
      subject: subjectName,
      topic: lessonTitle,
      enunciado: q.enunciado,
      opcoes: q.opcoes,
      gabarito: q.gabarito,
      explicacao: q.explicacao
    }));
    await supabase.from('questions').insert(questionsToInsert);

    // Combine bank questions + new AI questions
    const bankFormatted = (bankQuestions || []).map(q => ({
      enunciado: q.enunciado,
      opcoes: q.opcoes,
      gabarito: q.gabarito,
      explicacao: q.explicacao,
      fonte: q.source === 'exam' ? `Prova CACD ${q.year || ''}`.trim() : 'Gerado por IA',
      question_id: q.id
    }));
    const combined = bankFormatted.concat(newQuestoes);

    // Cache in lesson_questions
    await supabase.from('lesson_questions').upsert({
      lesson_id: lessonId,
      questoes: combined,
    }, { onConflict: 'lesson_id' });

    return res.status(200).json({ questoes: combined, cached: false, source: 'mixed' });

  } catch (err) {
    console.error('Generate questions error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
