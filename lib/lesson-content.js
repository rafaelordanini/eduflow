const PILOT_SUBJECT = 'Geografia';
const PILOT_ORDER_INDEX = 1;

function isPilotLesson(lesson, subject) {
  return Boolean(lesson && subject &&
    subject.name === PILOT_SUBJECT &&
    Number(lesson.order_index) === PILOT_ORDER_INDEX);
}

function normalizeAnalysis(value) {
  const topics = Array.isArray(value && value.topics) ? value.topics : [];
  const references = Array.isArray(value && value.references) ? value.references : [];
  const keywords = Array.isArray(value && value.keywords) ? value.keywords : [];
  const summary = String(value && value.summary || '').trim();
  const suggestedTitle = String(value && value.suggested_title || '').trim();

  if (!summary || !suggestedTitle || topics.length === 0) {
    throw new Error('A análise não contém título, resumo e tópicos válidos.');
  }

  return {
    summary,
    suggested_title: suggestedTitle.slice(0, 255),
    topics: topics.map(topic => String(topic).trim()).filter(Boolean).slice(0, 20),
    keywords: keywords.map(keyword => String(keyword).trim()).filter(Boolean).slice(0, 40),
    references: references.map(reference => String(reference).trim()).filter(Boolean).slice(0, 20)
  };
}

function formatLessonContext(content) {
  if (!content || content.processing_status !== 'ready') return '';
  const topics = Array.isArray(content.topics) ? content.topics.join('; ') : '';
  const references = Array.isArray(content.references) ? content.references.join('; ') : '';
  return [
    `Título analisado: ${content.suggested_title || ''}`,
    `Resumo da aula: ${content.summary || ''}`,
    `Conteúdo efetivamente abordado: ${topics}`,
    references ? `Referências mencionadas ou pertinentes: ${references}` : ''
  ].filter(Boolean).join('\n');
}

module.exports = {
  PILOT_SUBJECT,
  PILOT_ORDER_INDEX,
  isPilotLesson,
  normalizeAnalysis,
  formatLessonContext
};
