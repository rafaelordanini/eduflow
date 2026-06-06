const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');

const OPENROUTER_MODEL = 'google/gemini-2.5-flash';

// CACD distribution: total 65 questions
const CACD_DISTRIBUTION = [
  { subject: 'Português', count: 10 },
  { subject: 'História do Brasil', count: 12 },
  { subject: 'História Mundial', count: 10 },
  { subject: 'Política Internacional', count: 8 },
  { subject: 'Economia', count: 8 },
  { subject: 'Direito Interno', count: 7 },
  { subject: 'Direito Internacional', count: 5 },
  { subject: 'Geografia', count: 3 },
  { subject: 'Inglês', count: 2 },
];

async function generateAIQuestionsForSubject(subjectName, count) {
  const systemPrompt = `Você é um especialista no CACD (Concurso de Admissão à Carreira Diplomática do Instituto Rio Branco). Gere questões de múltipla escolha no estilo das provas TPS do CACD.

Responda SOMENTE com JSON válido (sem markdown):
{
  "questoes": [
    {
      "enunciado": "texto da questão",
      "opcoes": { "a": "...", "b": "...", "c": "...", "d": "...", "e": "..." },
      "gabarito": "a",
      "explicacao": "explicação detalhada"
    }
  ]
}`;

  const userPrompt = `Gere ${count} questões de múltipla escolha no estilo CACD sobre a matéria: ${subjectName}. Retorne SOMENTE o JSON, sem markdown.`;

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
    throw new Error('Erro ao chamar IA para ' + subjectName + ': ' + errText.substring(0, 200));
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content;
  if (!content) throw new Error('Resposta vazia do modelo de IA para ' + subjectName);

  let result;
  try {
    result = JSON.parse(content);
  } catch (e) {
    const match = content.match(/```json\n?([\s\S]+?)\n?```/) || content.match(/({[\s\S]+})/);
    if (match) result = JSON.parse(match[1]);
    else throw new Error('Resposta inválida do modelo para ' + subjectName);
  }

  return (result.questoes || []).map(q => ({ ...q, subject: subjectName }));
}

async function fetchQuestionsForSubjects(supabase, subjectList, fonte) {
  const allQuestoes = [];

  for (const { subject, count } of subjectList) {
    let questoes = [];

    if (fonte === 'real' || fonte === 'mixed') {
      const { data: real } = await supabase
        .from('questions')
        .select('*')
        .ilike('subject', `%${subject}%`)
        .eq('source', 'exam')
        .limit(count);

      if (real) questoes = real.map(q => ({ ...q, _subject: subject }));
    }

    if (fonte === 'ai' || (fonte === 'mixed' && questoes.length < count)) {
      const { data: aiQ } = await supabase
        .from('questions')
        .select('*')
        .ilike('subject', `%${subject}%`)
        .eq('source', 'ai')
        .limit(count - questoes.length);

      if (aiQ) questoes = questoes.concat(aiQ.map(q => ({ ...q, _subject: subject })));
    }

    // If still not enough, generate via AI and save
    if (questoes.length < count) {
      const needed = count - questoes.length;
      const generated = await generateAIQuestionsForSubject(subject, needed);

      const toInsert = generated.map(q => ({
        source: 'ai',
        subject: subject,
        topic: null,
        enunciado: q.enunciado,
        opcoes: q.opcoes,
        gabarito: q.gabarito,
        explicacao: q.explicacao
      }));

      const { data: saved } = await supabase.from('questions').insert(toInsert).select();
      if (saved) questoes = questoes.concat(saved.map(q => ({ ...q, _subject: subject })));
    }

    // Normalize to simulado format (without gabarito exposed)
    const formatted = questoes.slice(0, count).map(q => ({
      question_id: q.id,
      subject: subject,
      enunciado: q.enunciado,
      opcoes: q.opcoes,
      gabarito: q.gabarito, // stored server-side, stripped before sending
      explicacao: q.explicacao,
      user_answer: null
    }));

    allQuestoes.push(...formatted);
  }

  return allQuestoes;
}

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    const user = requireAuth(req, res);
    if (!user) return;

    const supabase = getSupabase();

    if (req.method === 'GET') {
      const limit = parseInt(req.query.limit) || 10;
      const { data, error } = await supabase
        .from('simulados')
        .select('id, tipo, config, score, total, started_at, finished_at')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return res.status(200).json({ simulados: data || [] });
    }

    if (req.method === 'POST') {
      const { action } = req.body || {};

      if (action === 'create') {
        const { tipo, config } = req.body;
        if (!tipo || !config) return res.status(400).json({ error: 'Informe tipo e config.' });

        let subjectList;
        if (tipo === 'cacd') {
          subjectList = CACD_DISTRIBUTION;
        } else if (tipo === 'custom') {
          if (!config.subjects || !Array.isArray(config.subjects)) {
            return res.status(400).json({ error: 'config.subjects deve ser array para tipo custom.' });
          }
          subjectList = config.subjects;
        } else {
          return res.status(400).json({ error: 'tipo deve ser "cacd" ou "custom".' });
        }

        const fonte = config.fonte || 'ai';
        const allQuestoes = await fetchQuestionsForSubjects(supabase, subjectList, fonte);

        const total = allQuestoes.length;

        // Strip gabarito before saving/sending (keep internally)
        const questoesForDB = allQuestoes; // full data with gabarito stored in DB
        const questoesForClient = allQuestoes.map(q => ({
          question_id: q.question_id,
          subject: q.subject,
          enunciado: q.enunciado,
          opcoes: q.opcoes,
          explicacao: null, // hide until submitted
          user_answer: null
        }));

        const { data: simulado, error } = await supabase
          .from('simulados')
          .insert({
            user_id: user.id,
            tipo,
            config,
            questoes: questoesForDB,
            total,
          })
          .select()
          .single();

        if (error) throw error;

        return res.status(201).json({ simuladoId: simulado.id, questoes: questoesForClient });
      }

      if (action === 'submit') {
        const { simuladoId, respostas } = req.body;
        if (!simuladoId) return res.status(400).json({ error: 'Informe simuladoId.' });

        const { data: simulado, error } = await supabase
          .from('simulados')
          .select('*')
          .eq('id', simuladoId)
          .eq('user_id', user.id)
          .single();

        if (error || !simulado) return res.status(404).json({ error: 'Simulado não encontrado.' });
        if (simulado.finished_at) return res.status(400).json({ error: 'Simulado já finalizado.' });

        const questoes = simulado.questoes || [];
        let correct = 0;

        const questoesComGabarito = questoes.map((q, idx) => {
          const userAnswer = respostas ? respostas[idx] : null;
          const isCorrect = userAnswer && userAnswer.toLowerCase() === (q.gabarito || '').toLowerCase();
          if (isCorrect) correct++;
          return {
            ...q,
            user_answer: userAnswer,
            is_correct: isCorrect
          };
        });

        const total = questoes.length;
        const score = correct;

        await supabase
          .from('simulados')
          .update({
            questoes: questoesComGabarito,
            score,
            total,
            finished_at: new Date().toISOString()
          })
          .eq('id', simuladoId);

        // Group results by subject
        const subjectStats = {};
        questoesComGabarito.forEach(q => {
          const s = q.subject || 'Geral';
          if (!subjectStats[s]) subjectStats[s] = { correct: 0, total: 0 };
          subjectStats[s].total++;
          if (q.is_correct) subjectStats[s].correct++;
        });

        return res.status(200).json({ score, total, questoes_with_gabarito: questoesComGabarito, subject_stats: subjectStats });
      }

      return res.status(400).json({ error: 'action deve ser "create" ou "submit".' });
    }

    return res.status(405).json({ error: 'Método não permitido' });

  } catch (err) {
    console.error('Simulado error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
