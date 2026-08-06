const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');

const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const DEEPSEEK_MAX_TOKENS = 4096;

const systemPrompt = `Você é um especialista no CACD (Concurso de Admissão à Carreira Diplomática do Instituto Rio Branco). Seu papel é gerar itens de julgamento Certo ou Errado no estilo atual da prova TPS do CACD.

ESTILO DAS QUESTÕES CACD:
- Cada questão deve conter uma única afirmação autônoma a ser julgada
- As únicas respostas permitidas são "Certo" e "Errado"
- Afirmações analíticas que testam nuances (datas precisas, nomes de tratados, detalhes de política externa)
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
      "opcoes": { "a": "Certo", "b": "Errado" },
      "gabarito": "a ou b",
      "explicacao": "explicação detalhada de por que a afirmação está certa ou errada, com base em fatos históricos e fontes bibliográficas do CACD",
      "fonte": "Baseado em temas cobrados no CACD [ano(s)]"
    }
  ]
}`;

async function generateAIQuestions(subjectName, lessonTitle, count, offset = 0) {
  const userPrompt = `Gere ${count} questões de múltipla escolha no estilo exato das provas TPS do CACD (2003-2025) sobre o seguinte tópico: "${lessonTitle}" (matéria: ${subjectName}).

Requisitos obrigatórios:
1. PRIORIZE subtópicos e abordagens que já foram cobrados nas provas do CACD — mencione o ano na propriedade "fonte"
2. Questões desafiadoras que testam profundidade de conhecimento, não memorização superficial
3. Cada questão deve ser uma afirmação independente com exatamente duas opções: {"a":"Certo","b":"Errado"}; o gabarito deve ser somente "a" ou "b"
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

  const questoes = normalizeTrueFalseQuestions(result.questoes);
  if (questoes.length !== count) {
    throw new Error('O modelo não retornou todos os itens no formato Certo ou Errado.');
  }
  return questoes;
}

function normalizeTrueFalseQuestions(questions) {
  return (Array.isArray(questions) ? questions : []).flatMap(question => {
    if (!question || !question.enunciado) return [];
    const answer = String(question.gabarito || '').trim().toLowerCase();
    const normalizedAnswer = answer === 'c' || answer === 'certo' ? 'a'
      : answer === 'e' || answer === 'errado' ? 'b' : answer;
    if (normalizedAnswer !== 'a' && normalizedAnswer !== 'b') return [];
    return [{
      ...question,
      opcoes: { a: 'Certo', b: 'Errado' },
      gabarito: normalizedAnswer
    }];
  });
}

function isTrueFalseQuestion(question) {
  if (!question || !question.opcoes) return false;
  const keys = Object.keys(question.opcoes).sort();
  return keys.length === 2 && keys[0] === 'a' && keys[1] === 'b' &&
    String(question.opcoes.a).trim().toLowerCase() === 'certo' &&
    String(question.opcoes.b).trim().toLowerCase() === 'errado';
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

    const { data: bankData } = await bankQuery;
    const bankQuestions = (bankData || []).filter(isTrueFalseQuestion);

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

      const cachedQuestions = cached && Array.isArray(cached.questoes)
        ? cached.questoes.filter(isTrueFalseQuestion) : [];
      if (cachedQuestions.length >= count) {
        return res.status(200).json({ questoes: cachedQuestions.slice(0, count), cached: true, source: 'lesson_cache' });
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

module.exports.normalizeTrueFalseQuestions = normalizeTrueFalseQuestions;
module.exports.isTrueFalseQuestion = isTrueFalseQuestion;
