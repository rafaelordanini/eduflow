function normalizeAnswer(value) {
  const answer = String(value || '').trim().toUpperCase();
  if (answer === 'C' || answer === 'E') return answer;
  throw new Error(`Resposta inválida no gabarito oficial: ${value}.`);
}

function questionKey(question) {
  const questionNumber = Number(question.questao_num ?? question.question_number);
  const itemNumber = Number(question.item_num ?? question.item_number);
  if (!Number.isInteger(questionNumber) || !Number.isInteger(itemNumber)) return null;
  return `${questionNumber}.${itemNumber}`;
}

function applyOfficialAnswerKey(questions, officialAnswers) {
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('Nenhuma questão foi extraída da prova.');
  }
  if (!Array.isArray(officialAnswers) || officialAnswers.length === 0) {
    throw new Error('O gabarito oficial definitivo não foi encontrado.');
  }

  const structured = officialAnswers.every(answer => (
    Number.isInteger(Number(answer.questao)) && Number.isInteger(Number(answer.item))
  ));

  if (!structured) {
    if (officialAnswers.length !== questions.length) {
      throw new Error(`Cobertura incompleta do gabarito oficial: ${officialAnswers.length} respostas para ${questions.length} itens.`);
    }
    return questions.map((question, index) => ({
      ...question,
      gabarito: normalizeAnswer(officialAnswers[index].answer ?? officialAnswers[index]),
    }));
  }

  const byKey = new Map();
  for (const officialAnswer of officialAnswers) {
    const key = `${Number(officialAnswer.questao)}.${Number(officialAnswer.item)}`;
    if (byKey.has(key)) throw new Error(`Item duplicado no gabarito oficial: ${key}.`);
    byKey.set(key, normalizeAnswer(officialAnswer.answer));
  }

  const seen = new Set();
  const verified = questions.map(question => {
    const key = questionKey(question);
    if (!key || seen.has(key)) throw new Error(`Numeração inválida ou duplicada na prova: ${key || 'ausente'}.`);
    seen.add(key);
    if (!byKey.has(key)) throw new Error(`Item ${key} não consta no gabarito oficial definitivo.`);
    return { ...question, gabarito: byKey.get(key) };
  });

  const unused = [...byKey.keys()].filter(key => !seen.has(key));
  if (unused.length) throw new Error(`O gabarito oficial contém ${unused.length} item(ns) sem questão correspondente.`);
  return verified;
}

module.exports = { applyOfficialAnswerKey };
