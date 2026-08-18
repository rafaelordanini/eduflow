const { getSupabase } = require('../../lib/supabase');
const { cors, requireAdmin } = require('../../lib/middleware');
const { isPilotLesson, normalizeAnalysis } = require('../../lib/lesson-content');

const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

async function analyzeTranscript(transcript) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        {
          role: 'system',
          content: 'Você analisa transcrições de aulas do CACD. Extraia somente conteúdos efetivamente abordados. Não invente bibliografia. Responda apenas JSON válido.'
        },
        {
          role: 'user',
          content: `Analise a transcrição da Aula 1 de Geografia e retorne {"suggested_title":"título específico","summary":"resumo fiel","topics":["tópico específico"],"keywords":["termo"],"references":["obra explicitamente mencionada"]}.\n\nTRANSCRIÇÃO:\n${transcript}`
        }
      ]
    })
  });
  if (!response.ok) throw new Error(`DeepSeek retornou HTTP ${response.status}.`);
  const body = await response.json();
  const content = body.choices && body.choices[0] && body.choices[0].message && body.choices[0].message.content;
  if (!content) throw new Error('Resposta vazia do DeepSeek.');
  return normalizeAnalysis(JSON.parse(content));
}

module.exports = async function handler(req, res) {
  try {
    if (cors(req, res)) return;
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
    if (!process.env.DEEPSEEK_API_KEY) return res.status(500).json({ error: 'DEEPSEEK_API_KEY não configurada.' });

    const lessonId = Number(req.body && req.body.lessonId);
    const transcript = String(req.body && req.body.transcript || '').trim();
    if (!lessonId || transcript.length < 200) {
      return res.status(400).json({ error: 'Informe lessonId e uma transcrição com pelo menos 200 caracteres.' });
    }

    const supabase = getSupabase();
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons').select('id, subject_id, order_index, subjects(id, name)').eq('id', lessonId).single();
    if (lessonError || !lesson) return res.status(404).json({ error: 'Aula não encontrada.' });
    if (!isPilotLesson(lesson, lesson.subjects)) {
      return res.status(400).json({ error: 'O piloto está restrito à Aula 1 de Geografia.' });
    }

    await supabase.from('lesson_contents').upsert({
      lesson_id: lessonId, transcript, processing_status: 'analyzing', error_message: null
    }, { onConflict: 'lesson_id' });

    try {
      const analysis = await analyzeTranscript(transcript);
      const record = {
        lesson_id: lessonId,
        transcript,
        ...analysis,
        processing_status: 'ready',
        model: DEEPSEEK_MODEL,
        prompt_version: 1,
        error_message: null,
        processed_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('lesson_contents')
        .upsert(record, { onConflict: 'lesson_id' }).select('*').single();
      if (error) throw error;
      return res.status(200).json(data);
    } catch (error) {
      await supabase.from('lesson_contents').update({
        processing_status: 'failed', error_message: String(error.message || error).slice(0, 1000)
      }).eq('lesson_id', lessonId);
      throw error;
    }
  } catch (error) {
    console.error('Analyze lesson error:', error);
    return res.status(500).json({ error: `Erro ao analisar aula: ${error.message || 'desconhecido'}` });
  }
};

module.exports.analyzeTranscript = analyzeTranscript;
