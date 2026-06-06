/**
 * Processa um ano: lê o arquivo de texto do PDF (já salvo),
 * chama OpenRouter e grava SQL em output/tps-YEAR.sql
 * Uso: node scripts/process-year.js <year> <caminho-arquivo-json>
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const year = process.argv[2];
const filePath = process.argv[3];

if (!year || !filePath) {
  console.error('Uso: node process-year.js <year> <arquivo>');
  process.exit(1);
}

function sqlStr(s) {
  if (s == null) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

async function extractQuestions(fullText, year) {
  const prompt = `Você é um especialista no CACD (Concurso de Admissão à Carreira Diplomática).

Abaixo está o texto completo do TPS ${year} do CACD, contendo o caderno de questões e o gabarito oficial.

TEXTO:
${fullText.substring(0, 40000)}

O TPS consiste em questões de Certo/Errado (C/E). Cada QUESTÃO tem 5 itens numerados.

Extraia TODOS os itens. Para cada item informe:
- subject: matéria (Português, Inglês, História do Brasil, História Mundial, Política Internacional, Economia, Direito Interno, Direito Internacional, Geografia)
- topic: tópico específico dentro da matéria
- questao_num: número da questão (inteiro)
- item_num: número do item 1 a 5
- enunciado: contexto/enunciado da questão (máx 500 chars)
- item_text: texto do item a ser julgado
- gabarito: "C" ou "E" conforme gabarito oficial do final do PDF

Responda APENAS com JSON válido sem markdown:
{"questoes":[{"subject":"...","topic":"...","questao_num":1,"item_num":1,"enunciado":"...","item_text":"...","gabarito":"C"}]}`;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://eduflow.vercel.app',
      'X-Title': 'EduFlow CACD Import',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 32000,
    }),
  });

  if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const match = cleaned.match(/\{[\s\S]+\}/);
  if (!match) throw new Error('Sem JSON na resposta');
  return JSON.parse(match[0]).questoes || [];
}

async function main() {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  const fullText = parsed.fileContent || parsed;

  console.log(`[${year}] ${fullText.length} chars — chamando OpenRouter...`);

  const questoes = await extractQuestions(String(fullText), year);
  console.log(`[${year}] ${questoes.length} itens extraídos`);

  const outDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const lines = [];
  lines.push(`-- TPS ${year} — ${questoes.length} itens`);
  lines.push(`DELETE FROM questions WHERE source = 'exam' AND year = ${year};`);
  lines.push(`INSERT INTO questions (source, year, subject, topic, enunciado, opcoes, gabarito, explicacao) VALUES`);
  lines.push(questoes.map(q => {
    const enunciado = `Q${q.questao_num} Item ${q.item_num} (TPS ${year}): ${q.enunciado || ''} | ${q.item_text || ''}`.substring(0, 1000);
    const gabarito = q.gabarito === 'C' ? 'a' : 'b';
    return `  ('exam', ${year}, ${sqlStr(q.subject)}, ${sqlStr(q.topic || null)}, ${sqlStr(enunciado)}, '{"a":"Certo","b":"Errado"}'::jsonb, '${gabarito}', NULL)`;
  }).join(',\n'));
  lines.push(';');

  const outFile = path.join(outDir, `tps-${year}.sql`);
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(`[${year}] SQL salvo: ${outFile}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
