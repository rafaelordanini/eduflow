const fs = require('node:fs');
const path = require('node:path');
const { getSupabase } = require('../../lib/supabase');
const { cors, requireAuth } = require('../../lib/middleware');
const { loadStaticPilotContent } = require('../../lib/lesson-content');
const { fetchDriveLessonSummary } = require('../../lib/drive-summary');

const TARGET_COUNT = 4;
const SUMMARY_LIMIT = 2500;
const DEEPSEEK_MODEL = 'deepseek-chat';

// Keep this prefix byte-for-byte stable: DeepSeek can reuse its prompt cache.
const SYSTEM_PROMPT = `Você cria assertivas Cebraspe de Certo/Errado para o CACD.
Cada item deve ser uma única afirmação autônoma, inequívoca e completa.
Use nível CACD e, nos itens errados, distratores por inversão conceitual ou anacronismo.
A justificativa deve citar uma tese, um autor ou uma obra de referência.
As opções são sempre {"a":"Certo","b":"Errado"} e o gabarito é "a" ou "b".
Responda SOMENTE com JSON válido, sem markdown.`;

function normalizeTrueFalseQuestions(questions) {
  return (Array.isArray(questions) ? questions : []).flatMap(question => {
    if (!question || typeof question.enunciado !== 'string') return [];
    const answer = String(question.gabarito || '').trim().toLowerCase();
    const gabarito = answer === 'c' || answer === 'certo' ? 'a'
      : answer === 'e' || answer === 'errado' ? 'b' : answer;
    if (!['a', 'b'].includes(gabarito)) return [];
    return [{ ...question, opcoes: { a: 'Certo', b: 'Errado' }, gabarito }];
  });
}

function isTrueFalseQuestion(question) {
  const options = question && question.opcoes;
  return Boolean(options && Object.keys(options).length === 2 &&
    String(options.a).toLowerCase() === 'certo' && String(options.b).toLowerCase() === 'errado');
}

function hasValidJudgmentStatement(question) {
  const text = String(question && question.enunciado || '').trim();
  return isTrueFalseQuestion(question) && text.length >= 20 && /[.!?][\])}'”’"]*$/.test(text) &&
    !/(julgue|avalie|analise)\s+(os\s+)?(itens|afirmações)|assinale\s+(a\s+)?(alternativa|opção)|concerning the text/i.test(text);
}

function isOfficial(question) {
  if (question && question.exam) return String(question.exam).toUpperCase() !== 'INÉDITA';
  return question && question.source === 'exam';
}

function getQuestionId(question) {
  const value = question && (question.id != null ? question.id : question.question_id);
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function formatQuestion(question) {
  const questionId = getQuestionId(question);
  return {
    ...question,
    id: questionId,
    question_id: questionId,
    exam: isOfficial(question) ? (question.exam || 'TPS') : 'INÉDITA',
    fonte: isOfficial(question)
      ? `[TPS ${question.year || '—'} - Oficial]`
      : '[Inédita - Fixação]'
  };
}

function rankAssociatedQuestions(questions, attempts, now = Date.now()) {
  const latestByQuestion = new Map();
  for (const attempt of attempts || []) {
    if (!latestByQuestion.has(attempt.question_id)) latestByQuestion.set(attempt.question_id, attempt);
  }
  const cutoff = now - 45 * 24 * 60 * 60 * 1000;
  return (questions || []).map((question, index) => {
    const attempt = latestByQuestion.get(getQuestionId(question));
    let priority = 99;
    if (isOfficial(question) && !attempt) priority = 0;
    else if (isOfficial(question) && (attempt.is_correct === false || attempt.correct === false)) priority = 1;
    else if (isOfficial(question) && new Date(attempt.attempted_at).getTime() < cutoff) priority = 2;
    else if (!isOfficial(question)) priority = 3;
    return { question, priority, index };
  }).filter(item => item.priority < 99)
    .sort((a, b) => a.priority - b.priority || a.index - b.index)
    .map(item => item.question);
}

function safeTitle(title) {
  return String(title || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '').trim();
}

async function readLessonSummary(lesson, lessonContent) {
  const title = safeTitle(lesson.title);
  const candidates = [
    path.join(process.cwd(), `${title}_resumo.txt`),
    path.join(process.cwd(), 'resumos', `${title}_resumo.txt`),
    path.join(process.cwd(), 'public', 'resumos', `${title}_resumo.txt`)
  ];
  const summaryFile = candidates.find(file => fs.existsSync(file));
  let summary = summaryFile ? fs.readFileSync(summaryFile, 'utf8')
    : String(lessonContent && lessonContent.summary || '');
  if (!summary.trim()) summary = await fetchDriveLessonSummary(lesson);
  return summary.trim().slice(0, SUMMARY_LIMIT);
}

async function requestMissingQuestions({ subjectName, lessonTitle, summary, count }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY não configurada.');
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Aula: ${lessonTitle}\nDisciplina: ${subjectName}\nExtraia de 3 a 6 conceitos-chave e gere exatamente ${count} assertivas somente sobre o resumo. Retorne {"subject":"...","keywords":["..."],"questoes":[{"enunciado":"...","opcoes":{"a":"Certo","b":"Errado"},"gabarito":"a|b","explicacao":"..."}]}.\nRESUMO (máximo de 2500 caracteres):\n${summary}` }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_tokens: 280 * count
    })
  });
  if (!response.ok) throw new Error(`Erro ao chamar a DeepSeek: ${(await response.text()).slice(0, 200)}`);
  const payload = await response.json();
  const content = payload.choices && payload.choices[0] && payload.choices[0].message.content;
  if (!content) throw new Error('Resposta vazia da DeepSeek.');
  const result = JSON.parse(content);
  const questions = normalizeTrueFalseQuestions(result.questoes).filter(hasValidJudgmentStatement);
  if (questions.length !== count) throw new Error('A DeepSeek não retornou todas as assertivas solicitadas.');
  return { ...result, questoes: questions };
}

async function getAssociatedQuestions(supabase, lessonId) {
  const { data, error } = await supabase.from('lesson_questions')
    .select('questoes').eq('lesson_id', lessonId).maybeSingle();
  if (error) throw new Error(`Não foi possível consultar as questões da aula: ${error.message}`);
  return data && Array.isArray(data.questoes) ? data.questoes : [];
}

async function associateQuestions(supabase, lessonId, questions) {
  if (!questions.length) return;
  const existing = await getAssociatedQuestions(supabase, lessonId);
  const byId = new Map(existing.filter(question => getQuestionId(question) != null)
    .map(question => [getQuestionId(question), question]));
  const withoutId = existing.filter(question => getQuestionId(question) == null);
  for (const question of questions) {
    const questionId = getQuestionId(question);
    if (questionId != null) byId.set(questionId, question);
    else withoutId.push(question);
  }
  const { error } = await supabase.from('lesson_questions').upsert(
    { lesson_id: lessonId, questoes: Array.from(byId.values()).concat(withoutId) },
    { onConflict: 'lesson_id' }
  );
  if (error) throw new Error(`Não foi possível associar as questões: ${error.message}`);
}

async function selectForUser(supabase, lessonId, userId) {
  const associated = await getAssociatedQuestions(supabase, lessonId);
  if (!associated.length) return [];
  const ids = [...new Set(associated.map(getQuestionId).filter(id => id != null))];
  if (!ids.length) return rankAssociatedQuestions(associated, []).slice(0, TARGET_COUNT);
  const { data, error } = await supabase.from('question_attempts')
    .select('question_id, correct, attempted_at')
    .eq('user_id', userId).in('question_id', ids)
    .order('attempted_at', { ascending: false });
  if (error) throw new Error(`Não foi possível consultar as tentativas: ${error.message}`);
  return rankAssociatedQuestions(associated, data).slice(0, TARGET_COUNT);
}

async function findAndAssociateOfficialQuestions(supabase, lesson, subjectName, excludedIds) {
  const keywords = safeTitle(lesson.title).split(/\s+/).filter(word => word.length > 3).slice(0, 4);
  if (!keywords.length) return;
  const filters = keywords.map(word => `enunciado.ilike.%${word}%,topic.ilike.%${word}%`).join(',');
  let query = supabase.from('questions').select('*').eq('subject', subjectName)
    .eq('source', 'exam').or(filters).limit(TARGET_COUNT * 3);
  if (excludedIds.length) query = query.not('id', 'in', `(${excludedIds.join(',')})`);
  const { data, error } = await query;
  if (error) throw new Error(`Não foi possível buscar questões oficiais: ${error.message}`);
  const official = (data || []).filter(hasValidJudgmentStatement).slice(0, TARGET_COUNT);
  await associateQuestions(supabase, lesson.id, official);
}

async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
    const user = requireAuth(req, res);
    if (!user) return;
    const lessonId = req.body && req.body.lessonId;
    if (!lessonId) return res.status(400).json({ error: 'Informe o lessonId.' });

    const supabase = getSupabase();
    const { data: lesson, error: lessonError } = await supabase.from('lessons')
      .select('id, title, subject_id, order_index, drive_url, embed_url, subjects(name)').eq('id', lessonId).single();
    if (lessonError || !lesson) return res.status(404).json({ error: 'Aula não encontrada.' });
    const subjectName = lesson.subjects && lesson.subjects.name;

    let selected = await selectForUser(supabase, lessonId, user.id);
    if (selected.length === TARGET_COUNT) {
      return res.status(200).json({ questoes: selected.map(formatQuestion), cached: true, source: 'bank' });
    }

    const associated = await getAssociatedQuestions(supabase, lessonId);
    await findAndAssociateOfficialQuestions(supabase, lesson, subjectName,
      associated.map(getQuestionId).filter(id => id != null));
    selected = await selectForUser(supabase, lessonId, user.id);
    if (selected.length === TARGET_COUNT) {
      return res.status(200).json({ questoes: selected.map(formatQuestion), cached: true, source: 'bank' });
    }

    const missing = TARGET_COUNT - selected.length;
    const { data: lessonContent } = await supabase.from('lesson_contents').select('summary')
      .eq('lesson_id', lessonId).eq('processing_status', 'ready').maybeSingle();
    const content = lessonContent || loadStaticPilotContent(lessonId);
    const summary = await readLessonSummary(lesson, content);
    if (!summary) throw new Error('Resumo da aula não encontrado no banco, no deploy ou na pasta da aula no Google Drive. Configure GOOGLE_DRIVE_API_KEY para permitir a busca no Drive.');

    const generated = await requestMissingQuestions({ subjectName, lessonTitle: lesson.title, summary, count: missing });
    const rows = generated.questoes.map(question => ({
      source: 'ai', year: null, subject: subjectName, topic: lesson.title,
      enunciado: question.enunciado, opcoes: question.opcoes,
      gabarito: question.gabarito, explicacao: question.explicacao
    }));
    const { data: saved, error: saveError } = await supabase.from('questions').insert(rows).select('*');
    if (saveError) throw new Error(`Não foi possível salvar as assertivas: ${saveError.message}`);
    await associateQuestions(supabase, lessonId, saved);

    const combined = selected.concat(saved).slice(0, TARGET_COUNT).map(formatQuestion);
    return res.status(200).json({ questoes: combined, cached: false, source: selected.length ? 'mixed' : 'ai' });
  } catch (error) {
    console.error('Generate questions error:', error);
    return res.status(500).json({ error: `Erro interno: ${error.message || 'desconhecido'}` });
  }
}

module.exports = handler;
module.exports.normalizeTrueFalseQuestions = normalizeTrueFalseQuestions;
module.exports.isTrueFalseQuestion = isTrueFalseQuestion;
module.exports.hasValidJudgmentStatement = hasValidJudgmentStatement;
module.exports.isOfficial = isOfficial;
module.exports.getQuestionId = getQuestionId;
module.exports.rankAssociatedQuestions = rankAssociatedQuestions;
module.exports.readLessonSummary = readLessonSummary;
module.exports.requestMissingQuestions = requestMissingQuestions;
module.exports.SYSTEM_PROMPT = SYSTEM_PROMPT;
