const SUBJECT_RULES = [
  ['Português', ['gramática', 'sintaxe', 'semântica', 'oração', 'pronome', 'concordância', 'regência', 'crase', 'pontuação', 'coesão', 'língua portuguesa']],
  ['Inglês', ['english', 'grammar', 'vocabulary', 'according to the text', 'word "', 'excerpt', 'reading comprehension']],
  ['História do Brasil', ['brasil colônia', 'império do brasil', 'república velha', 'era vargas', 'estado novo', 'getúlio', 'dom pedro', 'abolição', 'escravidão no brasil', 'constituição de 1934', 'constituição de 1937', 'golpe de 1964', 'regime militar', 'rio branco', 'tratado de petrópolis']],
  ['História Mundial', ['revolução francesa', 'revolução russa', 'revolução industrial', 'primeira guerra mundial', 'segunda guerra mundial', 'guerra fria', 'antigo regime', 'imperialismo', 'colonialismo', 'união soviética', 'nazismo', 'fascismo', 'iluminismo']],
  ['Política Internacional', ['política externa', 'relações internacionais', 'diplomacia', 'organização das nações unidas', 'conselho de segurança', 'mercosul', 'brics', 'união europeia', 'integração regional', 'cooperação internacional', 'ordem internacional']],
  ['Economia', ['inflação', 'balanço de pagamentos', 'política monetária', 'política fiscal', 'macroeconomia', 'microeconomia', 'produto interno bruto', 'taxa de juros', 'câmbio', 'desemprego', 'oferta e demanda', 'comércio internacional', 'vantagem comparativa']],
  ['Direito Internacional', ['direito internacional', 'tratado internacional', 'corte internacional de justiça', 'imunidade diplomática', 'responsabilidade internacional', 'direito do mar', 'jus cogens', 'costume internacional', 'extradição', 'refúgio']],
  ['Direito Interno', ['constituição federal', 'constituição de 1988', 'direito constitucional', 'administração pública', 'direitos fundamentais', 'controle de constitucionalidade', 'poder legislativo', 'poder judiciário', 'município', 'federação brasileira']],
  ['Geografia', ['território', 'urbanização', 'rede urbana', 'migração', 'demografia', 'geopolítica', 'meio ambiente', 'bioma', 'clima', 'cartografia', 'agricultura', 'industrialização', 'globalização', 'amazônia']],
];

const TOPIC_RULES = {
  Português: [
    ['Sintaxe e morfossintaxe', ['sintaxe', 'oração', 'pronome', 'concordância', 'regência', 'crase']],
    ['Semântica e vocabulário', ['semântica', 'sentido', 'significado', 'sinônimo', 'vocábulo']],
    ['Coesão e coerência textual', ['coesão', 'coerência', 'referente', 'conectivo']],
    ['Interpretação de texto', ['texto', 'autor', 'ideia', 'inferir', 'interpretação']],
  ],
  Inglês: [
    ['Grammar', ['grammar', 'grammatical', 'syntax', 'pronoun', 'referent']],
    ['Vocabulary', ['vocabulary', 'word "', 'means', 'synonymous', 'replaced by']],
    ['Reading comprehension', ['according to the text', 'author', 'comprehension', 'text']],
  ],
  'História do Brasil': [
    ['Brasil Colônia', ['brasil colônia', 'colonial', 'capitania', 'mineração', 'açúcar']],
    ['Império do Brasil', ['império', 'dom pedro', 'abolição', 'segundo reinado']],
    ['Primeira República', ['república velha', 'primeira república', 'rio branco', 'tratado de petrópolis']],
    ['Era Vargas', ['era vargas', 'getúlio', 'estado novo', 'constituição de 1934', 'constituição de 1937']],
    ['República de 1946 e regime militar', ['golpe de 1964', 'regime militar', 'ditadura', 'anos 1970']],
  ],
  'História Mundial': [
    ['Revoluções burguesas e industriais', ['revolução francesa', 'revolução industrial', 'antigo regime']],
    ['Primeira Guerra Mundial', ['primeira guerra mundial']],
    ['Revolução Russa e União Soviética', ['revolução russa', 'união soviética', 'bolchevique']],
    ['Fascismo e Segunda Guerra Mundial', ['segunda guerra mundial', 'nazismo', 'fascismo']],
    ['Guerra Fria', ['guerra fria']],
    ['Imperialismo e colonialismo', ['imperialismo', 'colonialismo']],
  ],
  'Política Internacional': [
    ['Organizações internacionais', ['organização das nações unidas', 'conselho de segurança', 'organizações internacionais']],
    ['Integração regional', ['mercosul', 'união europeia', 'integração regional']],
    ['Política Externa Brasileira', ['política externa brasileira', 'itamaraty']],
    ['Diplomacia e ordem internacional', ['diplomacia', 'ordem internacional', 'relações internacionais']],
  ],
  Economia: [
    ['Macroeconomia', ['inflação', 'produto interno bruto', 'desemprego', 'macroeconomia']],
    ['Política monetária e fiscal', ['política monetária', 'política fiscal', 'taxa de juros']],
    ['Economia internacional', ['balanço de pagamentos', 'câmbio', 'comércio internacional', 'vantagem comparativa']],
    ['Microeconomia', ['microeconomia', 'oferta e demanda']],
  ],
  'Direito Internacional': [
    ['Fontes do Direito Internacional', ['jus cogens', 'costume internacional', 'tratado internacional']],
    ['Solução de controvérsias internacionais', ['corte internacional de justiça']],
    ['Direito diplomático e consular', ['imunidade diplomática']],
    ['Responsabilidade internacional', ['responsabilidade internacional']],
    ['Direito do mar', ['direito do mar']],
  ],
  'Direito Interno': [
    ['Organização do Estado', ['município', 'federação brasileira', 'competência da união']],
    ['Direitos fundamentais', ['direitos fundamentais']],
    ['Poderes e controle de constitucionalidade', ['poder legislativo', 'poder judiciário', 'controle de constitucionalidade']],
    ['Administração pública', ['administração pública']],
    ['Direito Constitucional', ['constituição federal', 'constituição de 1988', 'direito constitucional']],
  ],
  Geografia: [
    ['Geografia urbana', ['urbanização', 'rede urbana']],
    ['População e migrações', ['migração', 'demografia']],
    ['Geografia agrária', ['agricultura', 'estrutura fundiária']],
    ['Meio ambiente e biomas', ['meio ambiente', 'bioma', 'amazônia', 'clima']],
    ['Geografia econômica e globalização', ['industrialização', 'globalização']],
    ['Geopolítica', ['geopolítica', 'território']],
  ],
};

// Some CACD language items use a historical, legal or economic passage as
// source material. In those cases the skill being assessed is stated in the
// item itself and must take precedence over the subject matter of the passage.
// These expressions deliberately describe linguistic operations rather than
// isolated words such as "texto", which also occur in other subjects.
const PORTUGUESE_TASK_RULES = [
  ['Sintaxe e morfossintaxe', [
    /acento grave/, /crase/, /classe gramatical/, /correcao gramatical/,
    /funcao sintatica/, /oracao subordinada/, /regencia/, /concordancia/,
    /emprego (?:da|de|do|das|dos) (?:forma|preposicao|pronome|verbo)/,
  ]],
  ['Semântica e vocabulário', [
    /sentido (?:da palavra|do termo|da expressao|atribuido|original)/,
    /significado (?:da palavra|do termo|da expressao)/, /sinonim/, /vocabulo/,
  ]],
  ['Coesão e coerência textual', [
    /referente/, /coesao/, /coerencia/,
    /(?:pronome|termo|expressao).{0,40}retoma(?:r|ria)?/,
    /elemento de referencia/, /conectivo/,
  ]],
  ['Interpretação de texto', [
    /depreende-se (?:do|da) texto/, /infere-se (?:do|da) texto/,
    /ideia (?:do|expressa no) texto/, /segundo o autor/,
  ]],
];

const PORTUGUESE_REWRITE_RULES = [
  /substitui(?:r|cao|do|ria)/,
  /poderia ser (?:corretamente )?(?:substituid|reescrit)/,
  /mant(?:em|eria|endo) (?:a )?(?:correcao|coerencia|sentido)/,
  /sem prejuizo (?:da correcao gramatical|do sentido)/,
];

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function questionText(question) {
  const options = question.opcoes && typeof question.opcoes === 'object'
    ? Object.values(question.opcoes).join(' ')
    : '';
  return normalize([question.enunciado, options, question.explicacao].filter(Boolean).join(' '));
}

function scoreRules(text, rules) {
  return rules.map(([name, terms]) => ({
    name,
    score: terms.reduce((score, term) => score + (text.includes(normalize(term)) ? Math.max(1, term.split(' ').length) : 0), 0),
  })).sort((a, b) => b.score - a.score);
}

function portugueseTask(text) {
  for (const [topic, patterns] of PORTUGUESE_TASK_RULES) {
    if (patterns.some(pattern => pattern.test(text))) return topic;
  }

  // Rewriting on its own can also describe a factual reformulation. Require a
  // textual anchor so that it is unambiguously a Portuguese-language task.
  const hasRewrite = PORTUGUESE_REWRITE_RULES.some(pattern => pattern.test(text));
  const hasTextualAnchor = /(?:no|do) trecho|termo|palavra|expressao|periodo|correcao gramatical/.test(text);
  return hasRewrite && hasTextualAnchor ? 'Redação e estilo' : null;
}

function classifyQuestion(question) {
  const text = questionText(question);
  const languageTopic = portugueseTask(text);
  if (languageTopic) {
    return {
      subject: 'Português',
      topic: languageTopic,
      subjectConfidence: 1,
      topicConfidence: 1,
    };
  }
  const subjects = scoreRules(text, SUBJECT_RULES);
  const currentSubject = SUBJECT_RULES.some(([name]) => name === question.subject) ? question.subject : null;
  // A single generic word (for example, "território") is not enough to move a
  // question between subjects. Multi-word expressions and corroborating terms
  // can safely override the imported classification.
  const subject = subjects[0].score >= 2 ? subjects[0].name : currentSubject;
  const topics = subject ? scoreRules(text, TOPIC_RULES[subject] || []) : [];

  return {
    subject: subject || question.subject || null,
    topic: topics[0]?.score > 0 ? topics[0].name : (question.topic || null),
    subjectConfidence: subjects[0].score === 0 ? 0 : subjects[0].score / Math.max(subjects[0].score + (subjects[1]?.score || 0), 1),
    topicConfidence: !topics[0]?.score ? 0 : topics[0].score / Math.max(topics[0].score + (topics[1]?.score || 0), 1),
  };
}

module.exports = { classifyQuestion, normalize, portugueseTask, SUBJECT_RULES, TOPIC_RULES };
