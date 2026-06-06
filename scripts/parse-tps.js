/**
 * Parser de TPS CACD a partir do texto do PDF.
 * Extrai itens numerados, gabarito e matéria de cada item.
 * Funciona para o formato CESPE (itens 1-150 numerados sequencialmente).
 */

const SUBJECT_HEADERS = [
  { pattern: /PORTUGU[ÊE]S/i,             subject: 'Português' },
  { pattern: /INGL[ÊE]S/i,                subject: 'Inglês' },
  { pattern: /HIST[ÓO]RIA DO BRASIL/i,     subject: 'História do Brasil' },
  { pattern: /HIST[ÓO]RIA MUNDIAL/i,       subject: 'História Mundial' },
  { pattern: /HIST[ÓO]RIA/i,              subject: 'História do Brasil' },
  { pattern: /POL[ÍI]TICA INTERNACIONAL/i, subject: 'Política Internacional' },
  { pattern: /RELA[ÇC][ÕO]ES INTERNACIONAIS/i, subject: 'Política Internacional' },
  { pattern: /ECONOMIA/i,                  subject: 'Economia' },
  { pattern: /DIREITO INTERNACIONAL/i,     subject: 'Direito Internacional' },
  { pattern: /DIREITO INTERNO/i,           subject: 'Direito Interno' },
  { pattern: /DIREITO/i,                   subject: 'Direito Interno' },
  { pattern: /GEOGRAFIA/i,                 subject: 'Geografia' },
];

// Tópicos inferidos por palavras-chave no enunciado
const TOPIC_HINTS = [
  [/mercosul/i, 'MERCOSUL e integração regional'],
  [/globaliza/i, 'Globalização'],
  [/OMC|GATT|com[eé]rcio internacional/i, 'Comércio Internacional'],
  [/ONU|Na[çc][õo]es Unidas/i, 'Organismos internacionais'],
  [/guerra fria/i, 'Guerra Fria'],
  [/segunda guerra/i, 'Segunda Guerra Mundial'],
  [/primeira guerra/i, 'Primeira Guerra Mundial'],
  [/rep[úu]blica velha/i, 'República Velha'],
  [/vargas|estado novo/i, 'Era Vargas'],
  [/constitui[çc][aã]o|constitucional/i, 'Direito Constitucional'],
  [/tratado|direito internacional p[úu]blico/i, 'Direito Internacional Público'],
  [/amazon[ia]|cerrado|bioma/i, 'Questão ambiental'],
  [/clima|aquecimento|kyoto/i, 'Questão ambiental'],
  [/plano real|inflação|banco central/i, 'Economia Brasileira'],
  [/microeconomia|oferta|demanda|mercado/i, 'Microeconomia'],
  [/macroeconomia|PIB|fiscal|monet[aá]ria/i, 'Macroeconomia'],
  [/política externa brasileira|itamaraty/i, 'Política Externa Brasileira'],
  [/interpreta[çc][aã]o de texto|coer[eê]ncia|coesão/i, 'Interpretação de texto'],
];

function inferTopic(text, subject) {
  for (const [re, topic] of TOPIC_HINTS) {
    if (re.test(text)) return topic;
  }
  // Default by subject
  const defaults = {
    'Português': 'Interpretação de texto',
    'Inglês': 'Reading comprehension',
    'História do Brasil': 'História do Brasil',
    'História Mundial': 'História Mundial',
    'Política Internacional': 'Política Internacional',
    'Economia': 'Economia',
    'Direito Interno': 'Direito Interno',
    'Direito Internacional': 'Direito Internacional',
    'Geografia': 'Geografia',
  };
  return defaults[subject] || subject;
}

/**
 * Extrai o gabarito do texto. Suporta 3 formatos:
 * A) 150 C/E em linha: "1 2 3 ... 30 / E C E C..."
 * B) Grid por questão: "QUESTÃO 01 ... 1 2 3 4 / E C C E ..."
 * C) Tabela 50 questões mistas C/E + múltipla escolha
 */
function extractGabarito(text) {
  // Busca TODAS as ocorrências de gabarito oficial e combina C/E tokens
  const pattern = /GABARIT[OA]S?\s+OFICIAIS\s+DEFINITIV|GABARITO DEFINITIVO DAS PROVAS/gi;
  const matches = [...text.matchAll(pattern)];

  if (matches.length === 0) return null;

  // Combina todos os blocos de gabarito (ex: PRIMEIRA + SEGUNDA ETAPA)
  let combined = '';
  for (const m of matches) {
    combined += text.slice(m.index, m.index + 6000) + '\n';
  }
  const gabSection = combined;

  // Formato B (moderno): "QUESTÃO 01 QUESTÃO 02 ... / 1 2 3 4 1 2 3 4 / E C C E E C..."
  // Detectado pela presença de "QUESTÃO 0" seguido de sequência de C/E
  if (/QUESTÃO\s+0[0-9]/i.test(gabSection)) {
    // Pega bloco da prova MANHÃ ou Tipo A (primeira prova)
    const blocoMatch = gabSection.match(/(?:MANHÃ|Prova Tipo[^\n]*A)[^\n]*\n([\s\S]{200,3000}?)(?:\n\n[A-Z]{3}|\nQUESTÃO 01[\s\S]{0,20}QUESTÃO 02[\s\S]{0,20}QUESTÃO 03|$)/i);
    const bloco = blocoMatch ? blocoMatch[1] : gabSection;
    const allCE = bloco.match(/\b[CE]\b/g) || [];
    if (allCE.length >= 100) return allCE.slice(0, 150);
    // fallback: pegar todos CE do gabSection
    const allCE2 = gabSection.match(/\b[CE]\b/g) || [];
    return allCE2.slice(0, 150);
  }

  // Formato A (150 sequenciais em linhas com ≥10 C/E cada)
  const lines = gabSection.split('\n');
  const answers = [];
  for (const line of lines) {
    const ces = line.match(/\b[CE]\b/g);
    if (ces && ces.length >= 10) answers.push(...ces);
    if (answers.length >= 150) break;
  }
  if (answers.length >= 100) return answers.slice(0, 150);

  // Formato C / fallback: todos CE do bloco
  const allCE = gabSection.match(/\b[CE]\b/g) || [];
  return allCE.length >= 100 ? allCE.slice(0, 150) : null;
}

/**
 * Extrai itens numerados do texto (formato: número isolado seguido de texto).
 * Retorna array de { num, text, subject, topic }
 */
function extractItems(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const items = [];
  let currentSubject = 'Português';
  let currentContext = ''; // texto de contexto/enunciado atual
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detecta mudança de matéria
    for (const sh of SUBJECT_HEADERS) {
      if (sh.pattern.test(line) && line.length < 60) {
        currentSubject = sh.subject;
        currentContext = '';
        break;
      }
    }

    // Para de processar quando chegar no gabarito
    if (/GABARIT[OA]S?\s+OFICIAIS/i.test(line)) break;

    // Detecta item numerado: linha começa com número 1-150
    const numMatch = line.match(/^(\d{1,3})\s+(.+)$/);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      if (num >= 1 && num <= 150) {
        let itemText = numMatch[2];
        // Concatena linhas seguintes até próximo item ou linha vazia
        let j = i + 1;
        while (j < lines.length) {
          const next = lines[j];
          if (/^(\d{1,3})\s+/.test(next) && parseInt(next.match(/^(\d+)/)[1]) === num + 1) break;
          if (/GABARIT[OA]/i.test(next)) break;
          if (next.length === 0) break;
          // Linha de contexto/texto (não numerada)
          if (!/^\d+\s/.test(next) || parseInt(next) > 150) {
            itemText += ' ' + next;
          }
          j++;
          if (itemText.length > 800) break;
        }
        items.push({
          num,
          text: itemText.trim().substring(0, 800),
          subject: currentSubject,
          topic: inferTopic(itemText + ' ' + currentContext, currentSubject),
          context: currentContext.substring(0, 400),
        });
        i = j;
        continue;
      }
    }

    // Acumula contexto (parágrafos que não são itens numerados)
    if (line.length > 30 && !/^\d+$/.test(line)) {
      currentContext = (currentContext + ' ' + line).trim().substring(0, 500);
    }

    i++;
  }

  return items;
}

function sqlStr(s) {
  if (s == null) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

/**
 * Formato 2005-2013: gabarito como tabela com questões em colunas, itens em linhas.
 * Padrão: "1 2 3 4 5 ... 26 / 1 C C C C... / 2 E C C E..."
 */
function extractGabaritoTabela(text) {
  // Localiza a seção de gabarito com questões objetivas
  const idx = text.search(/GABARIT[OA]S?\s+OFICIAIS\s+DEFINITIV[OA]S?|GABARITOS OFICIAIS DEFINITIVOS/i);
  if (idx === -1) return null;
  const section = text.slice(idx, idx + 6000);

  // Procura blocos do tipo "Questão item 1 item 2 item 3 item 4"
  // seguido por linhas "1 E C E C" ou "2 C C E E"
  const tabelaMatch = section.match(/Questão\s+item\s+1\s+item\s+2\s+item\s+3\s+item\s+4([\s\S]{100,3000}?)(?:OBSERVA|NOTA:|RAZÕES|$)/i);
  if (tabelaMatch) {
    const tabela = tabelaMatch[1];
    const answers = []; // {questao, item, answer}
    for (const line of tabela.split('\n')) {
      // Linha como "29 C E C E" ou "29 C E C E" ou "30X C E C C" (X=anulado)
      const m = line.match(/^\s*(\d+)\s+([CEABDX])\s+([CEABDX])\s+([CEABDX])\s+([CEABDX])/);
      if (m) {
        const q = parseInt(m[1]);
        for (let i = 1; i <= 4; i++) {
          const a = m[i + 1];
          if (a === 'C' || a === 'E') answers.push({ questao: q, item: i, answer: a });
        }
      }
    }
    if (answers.length > 50) return answers;
  }

  // Formato 2005: questões em colunas numéricas, itens em rows (row 1=item1, etc.)
  // "1 2 3 4 5 6 ... 26\n1 C C C C C...\n2 E C C E..."
  const rowMatch = section.match(/\b1\s+2\s+3\s+4\s+5[\s\d]+\n((?:\s*[1-4]\s+[CE\s]+\n){2,5})/);
  if (rowMatch) {
    const rows = rowMatch[1].trim().split('\n');
    const colsLine = rowMatch[0].split('\n')[0];
    const questoesNums = colsLine.match(/\d+/g).map(Number);
    const answers = [];
    for (const row of rows) {
      const vals = row.trim().match(/\d+|[CE]/g);
      if (!vals || vals.length < 2) continue;
      const itemNum = parseInt(vals[0]);
      let col = 0;
      for (let i = 1; i < vals.length; i++) {
        if (vals[i] === 'C' || vals[i] === 'E') {
          const q = questoesNums[col] || col + 1;
          answers.push({ questao: q, item: itemNum, answer: vals[i] });
          col++;
        }
      }
    }
    if (answers.length > 30) return answers;
  }

  return null;
}

function parseTPS(text, year) {
  // Try tabela format first (2005-2013 style)
  const tabelaAnswers = extractGabaritoTabela(text);
  if (tabelaAnswers && tabelaAnswers.length > 50) {
    const items = extractItems(text);
    const rows = tabelaAnswers.map((a, idx) => {
      const itemText = items.find(it => it.num === idx + 1);
      return {
        source: 'exam',
        year: Number(year),
        subject: itemText ? itemText.subject : 'Política Internacional',
        topic: itemText ? itemText.topic : null,
        enunciado: `Q${a.questao} Item ${a.item} (TPS ${year})${itemText ? ': ' + itemText.text.substring(0, 600) : ' — consulte o caderno original'}`,
        gabarito: a.answer === 'C' ? 'a' : 'b',
      };
    });
    return { rows, gabaritoLen: tabelaAnswers.length, itemsFound: items.length };
  }

  const gabarito = extractGabarito(text);
  if (!gabarito || gabarito.length < 80) {
    return { error: `Gabarito não encontrado ou incompleto (${gabarito ? gabarito.length : 0} itens)` };
  }

  const items = extractItems(text);
  // Accept partial item extraction — fill gaps with placeholder text
  const minItems = gabarito.length;

  const rows = [];
  for (let idx = 0; idx < Math.min(150, gabarito.length); idx++) {
    const item = items.find(it => it.num === idx + 1);
    const answer = gabarito[idx]; // 'C' ou 'E'
    if (!answer) continue;

    const enunciado = item
      ? `Item ${idx + 1} (TPS ${year}): ${item.context ? item.context + ' | ' : ''}${item.text}`.substring(0, 1000)
      : `Item ${idx + 1} (TPS ${year}) — consulte o caderno original`;

    // Try to infer subject from position when item not found
    let subject = 'Política Internacional';
    let topic = null;
    if (item) { subject = item.subject; topic = item.topic; }

    rows.push({
      source: 'exam',
      year: Number(year),
      subject,
      topic,
      enunciado,
      gabarito: answer === 'C' ? 'a' : 'b',
    });
  }

  return { rows, gabaritoLen: gabarito.length, itemsFound: items.length };
}

function generateSQL(rows, year) {
  const lines = [];
  lines.push(`-- TPS ${year} — ${rows.length} itens`);
  lines.push(`DELETE FROM questions WHERE source = 'exam' AND year = ${year};`);
  lines.push(`INSERT INTO questions (source, year, subject, topic, enunciado, opcoes, gabarito, explicacao) VALUES`);
  lines.push(rows.map(r =>
    `  ('exam', ${r.year}, ${sqlStr(r.subject)}, ${sqlStr(r.topic)}, ${sqlStr(r.enunciado)}, '{"a":"Certo","b":"Errado"}'::jsonb, '${r.gabarito}', NULL)`
  ).join(',\n'));
  lines.push(';');
  return lines.join('\n');
}

module.exports = { parseTPS, generateSQL, extractGabarito, extractItems };

// Se rodado direto: node parse-tps.js <year> <arquivo>
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const year = process.argv[2];
  const filePath = process.argv[3];
  if (!year || !filePath) { console.error('Uso: node parse-tps.js <year> <arquivo>'); process.exit(1); }

  const raw = fs.readFileSync(filePath, 'utf8');
  const text = JSON.parse(raw).fileContent || raw;
  const result = parseTPS(text, year);

  if (result.error) { console.error(`ERRO [${year}]:`, result.error); process.exit(1); }

  console.log(`[${year}] gabarito=${result.gabaritoLen} itens_no_texto=${result.itemsFound} rows=${result.rows.length}`);

  const outDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  const outFile = path.join(outDir, `tps-${year}.sql`);
  fs.writeFileSync(outFile, generateSQL(result.rows, year));
  console.log(`SQL salvo: ${outFile}`);
}
