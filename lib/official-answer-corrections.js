const OFFICIAL_ANSWER_CORRECTIONS = [
  {
    year: 2008,
    statement: 'no seculo xvii, as bandeiras de apresamento de indigenas',
    answer: 'a',
    explanation: 'Certo, conforme o gabarito oficial do CACD 2008. No século XVII, as bandeiras de apresamento eram empreendimentos privados que contavam com mamelucos e indígenas aliados e tinham como objetivo principal capturar indígenas para suprir a demanda por mão de obra escravizada, inclusive na lavoura açucareira nordestina.',
  },
];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function applyOfficialAnswerCorrections(question) {
  const enunciado = normalize(question?.enunciado);
  const correction = OFFICIAL_ANSWER_CORRECTIONS.find(item => (
    Number(question?.year) === item.year && enunciado.includes(item.statement)
  ));

  if (!correction) return question;

  return {
    ...question,
    gabarito: correction.answer,
    explicacao: correction.explanation,
  };
}

module.exports = { applyOfficialAnswerCorrections };
