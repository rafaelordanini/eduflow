const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');

const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const DEEPSEEK_MAX_TOKENS = 4096;

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


function stripSimuladoForClient(simulado) {
  const questoes = (simulado.questoes || []).map(q => ({
    question_id: q.question_id,
    subject: q.subject,
    enunciado: q.enunciado,
    opcoes: q.opcoes,
    explicacao: simulado.finished_at ? q.explicacao : null,
    user_answer: q.user_answer || null,
    is_correct: simulado.finished_at ? q.is_correct : undefined
  }));

  const progress = simulado.config && simulado.config._progress || {};
  return {
    id: simulado.id,
    tipo: simulado.tipo,
    config: simulado.config,
    score: simulado.score,
    total: simulado.total,
    started_at: simulado.started_at,
    finished_at: simulado.finished_at,
    elapsed_seconds: progress.elapsed_seconds || 0,
    saved_at: progress.saved_at || null,
    questoes
  };
}

function mergeAnswersIntoQuestoes(questoes, respostas) {
  return (questoes || []).map((q, idx) => ({
    ...q,
    user_answer: respostas && respostas[idx] ? respostas[idx] : q.user_answer || null
  }));
}


async function getUserQuestionUsageCounts(supabase, userId) {
  const usage = {};

  const { data: simulados } = await supabase
    .from('simulados')
    .select('questoes')
    .eq('user_id', userId);

  (simulados || []).forEach(simulado => {
    (simulado.questoes || []).forEach(q => {
      if (!q || !q.question_id || !q.user_answer) return;
      const key = String(q.question_id);
      usage[key] = (usage[key] || 0) + 1;
    });
  });

  const { data: attempts } = await supabase
    .from('question_attempts')
    .select('question_id')
    .eq('user_id', userId)
    .not('question_id', 'is', null);

  (attempts || []).forEach(attempt => {
    if (!attempt.question_id) return;
    const key = String(attempt.question_id);
    usage[key] = (usage[key] || 0) + 1;
  });

  return usage;
}

function sortQuestionsByUserUsage(questions, usageCounts) {
  return (questions || [])
    .map((q, idx) => ({ q, idx, usage: usageCounts[String(q.id)] || 0, random: Math.random() }))
    .sort((a, b) => a.usage - b.usage || a.random - b.random || a.idx - b.idx)
    .map(item => item.q);
}

async function fetchQuestionsForSubjects(supabase, subjectList, fonte, userId) {
  const usageCounts = await getUserQuestionUsageCounts(supabase, userId);
  const allQuestoes = [];

  for (const { subject, count } of subjectList) {
    let questoes = [];

    if (fonte === 'real' || fonte === 'mixed') {
      const { data: real } = await supabase
        .from('questions')
        .select('*')
        .ilike('subject', `%${subject}%`)
        .eq('source', 'exam')
        .limit(Math.max(count * 5, 100));

      if (real) questoes = sortQuestionsByUserUsage(real, usageCounts).map(q => ({ ...q, _subject: subject }));
    }

    if (fonte === 'ai' || (fonte === 'mixed' && questoes.length < count)) {
      const { data: aiQ } = await supabase
        .from('questions')
        .select('*')
        .ilike('subject', `%${subject}%`)
        .eq('source', 'ai')
        .limit(Math.max((count - questoes.length) * 5, 100));

      if (aiQ) questoes = questoes.concat(sortQuestionsByUserUsage(aiQ, usageCounts).map(q => ({ ...q, _subject: subject })));
    }

    // Only fall back to AI generation when fonte explicitly includes AI
    if (questoes.length < count && (fonte === 'ai' || fonte === 'mixed')) {
      const needed = Math.min(count - questoes.length, 3); // cap to avoid timeout
      try {
        const generated = await generateAIQuestionsForSubject(subject, needed);
        const toInsert = generated.map(q => ({
          source: 'ai', subject, topic: null,
          enunciado: q.enunciado, opcoes: q.opcoes, gabarito: q.gabarito, explicacao: q.explicacao
        }));
        const { data: saved } = await supabase.from('questions').insert(toInsert).select();
        if (saved) questoes = questoes.concat(saved.map(q => ({ ...q, _subject: subject })));
      } catch (e) {
        console.error('AI gen failed for', subject, e.message);
      }
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
      if (req.query.ongoing === 'true') {
        const { data: ongoing, error: ongoingError } = await supabase
          .from('simulados')
          .select('*')
          .eq('user_id', user.id)
          .is('finished_at', null)
          .order('started_at', { ascending: false });

        if (ongoingError) throw ongoingError;
        return res.status(200).json({ simulados: (ongoing || []).map(stripSimuladoForClient) });
      }

      if (req.query.active === 'true') {
        const { data: active, error: activeError } = await supabase
          .from('simulados')
          .select('*')
          .eq('user_id', user.id)
          .is('finished_at', null)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeError) throw activeError;
        return res.status(200).json({ simulado: active ? stripSimuladoForClient(active) : null });
      }

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
        const allQuestoes = await fetchQuestionsForSubjects(supabase, subjectList, fonte, user.id);

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

        return res.status(201).json({ simuladoId: simulado.id, tipo: simulado.tipo, config: simulado.config, started_at: simulado.started_at, elapsed_seconds: 0, questoes: questoesForClient });
      }

      if (action === 'save') {
        const { simuladoId, respostas, elapsedSeconds } = req.body;
        if (!simuladoId) return res.status(400).json({ error: 'Informe simuladoId.' });

        const { data: simulado, error } = await supabase
          .from('simulados')
          .select('*')
          .eq('id', simuladoId)
          .eq('user_id', user.id)
          .single();

        if (error || !simulado) return res.status(404).json({ error: 'Simulado não encontrado.' });
        if (simulado.finished_at) return res.status(400).json({ error: 'Simulado já finalizado.' });

        const savedAt = new Date().toISOString();
        const updatedConfig = {
          ...(simulado.config || {}),
          _progress: {
            ...((simulado.config && simulado.config._progress) || {}),
            elapsed_seconds: Math.max(0, parseInt(elapsedSeconds, 10) || 0),
            saved_at: savedAt
          }
        };
        const questoes = mergeAnswersIntoQuestoes(simulado.questoes || [], respostas || {});

        const { data: updated, error: updateError } = await supabase
          .from('simulados')
          .update({ questoes, config: updatedConfig })
          .eq('id', simuladoId)
          .eq('user_id', user.id)
          .select('*')
          .single();

        if (updateError) throw updateError;
        return res.status(200).json({ simulado: stripSimuladoForClient(updated) });
      }

      if (action === 'cancel') {
        const { simuladoId } = req.body;
        if (!simuladoId) return res.status(400).json({ error: 'Informe simuladoId.' });

        const { data: simulado, error } = await supabase
          .from('simulados')
          .select('id, finished_at')
          .eq('id', simuladoId)
          .eq('user_id', user.id)
          .single();

        if (error || !simulado) return res.status(404).json({ error: 'Simulado não encontrado.' });
        if (simulado.finished_at) return res.status(400).json({ error: 'Simulado já finalizado.' });

        const { error: deleteError } = await supabase
          .from('simulados')
          .delete()
          .eq('id', simuladoId)
          .eq('user_id', user.id);

        if (deleteError) throw deleteError;
        return res.status(200).json({ ok: true });
      }

      if (action === 'save') {
        const { simuladoId, respostas, elapsedSeconds } = req.body;
        if (!simuladoId) return res.status(400).json({ error: 'Informe simuladoId.' });

        const { data: simulado, error } = await supabase
          .from('simulados')
          .select('*')
          .eq('id', simuladoId)
          .eq('user_id', user.id)
          .single();

        if (error || !simulado) return res.status(404).json({ error: 'Simulado não encontrado.' });
        if (simulado.finished_at) return res.status(400).json({ error: 'Simulado já finalizado.' });

        const savedAt = new Date().toISOString();
        const updatedConfig = {
          ...(simulado.config || {}),
          _progress: {
            ...((simulado.config && simulado.config._progress) || {}),
            elapsed_seconds: Math.max(0, parseInt(elapsedSeconds, 10) || 0),
            saved_at: savedAt
          }
        };
        const questoes = mergeAnswersIntoQuestoes(simulado.questoes || [], respostas || {});

        const { data: updated, error: updateError } = await supabase
          .from('simulados')
          .update({ questoes, config: updatedConfig })
          .eq('id', simuladoId)
          .eq('user_id', user.id)
          .select('*')
          .single();

        if (updateError) throw updateError;
        return res.status(200).json({ simulado: stripSimuladoForClient(updated) });
      }

      if (action === 'cancel') {
        const { simuladoId } = req.body;
        if (!simuladoId) return res.status(400).json({ error: 'Informe simuladoId.' });

        const { data: simulado, error } = await supabase
          .from('simulados')
          .select('id, finished_at')
          .eq('id', simuladoId)
          .eq('user_id', user.id)
          .single();

        if (error || !simulado) return res.status(404).json({ error: 'Simulado não encontrado.' });
        if (simulado.finished_at) return res.status(400).json({ error: 'Simulado já finalizado.' });

        const { error: deleteError } = await supabase
          .from('simulados')
          .delete()
          .eq('id', simuladoId)
          .eq('user_id', user.id);

        if (deleteError) throw deleteError;
        return res.status(200).json({ ok: true });
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
          const userAnswer = respostas && respostas[idx] ? respostas[idx] : q.user_answer || null;
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

      return res.status(400).json({ error: 'action deve ser "create", "save", "cancel" ou "submit".' });
    }

    return res.status(405).json({ error: 'Método não permitido' });

  } catch (err) {
    console.error('Simulado error:', err);
    return res.status(500).json({ error: 'Erro interno: ' + (err.message || 'desconhecido') });
  }
};
