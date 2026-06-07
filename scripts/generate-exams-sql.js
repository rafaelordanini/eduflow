/**
 * Gera um arquivo SQL com todas as questões do CACD TPS (2003–2025).
 * Baixa os PDFs do Google Drive, extrai texto, usa IA para parsear questões
 * e gera INSERT statements prontos para colar no Supabase SQL Editor.
 *
 * Pré-requisitos (uma única vez):
 *   npm install googleapis pdf-parse
 *   gcloud auth application-default login
 *   # OU: GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *
 * Uso:
 *   node scripts/generate-exams-sql.js                   # todos os anos → output/all-exams.sql
 *   node scripts/generate-exams-sql.js --year=2010       # só um ano
 *   node scripts/generate-exams-sql.js --out=custom.sql  # caminho de saída
 *
 * Env vars necessárias (.env) — use UMA das opções abaixo:
 *   ANTHROPIC_API_KEY  → usa Claude (Haiku = barato, Sonnet = melhor qualidade)
 *   POE_API_KEY        → usa DeepSeek-V3 via Poe
 *   OPENROUTER_API_KEY → usa Gemini 2.5 Flash via OpenRouter
 *
 * Para escolher o modelo Claude, adicione também:
 *   ANTHROPIC_MODEL=claude-haiku-4-5-20251001   # mais barato
 *   ANTHROPIC_MODEL=claude-sonnet-4-6            # melhor qualidade (padrão)
 */

require('dotenv').config();
const { google } = require('googleapis');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const https = require('https');

const OPENROUTER_MODEL = 'google/gemini-2.5-flash';
const POE_BOT = 'deepseek-v3-5';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const ARGS = process.argv.slice(2);
const YEAR_ARG = (ARGS.find(a => a.startsWith('--year=')) || '').replace('--year=', '');
const OUT_ARG  = (ARGS.find(a => a.startsWith('--out='))  || '').replace('--out=', '');

const DRIVE_FILES = {
  2003: '18rLdrUH_N6fYNqv6MRT_wsx6bmw2gAd3',
  2004: '1b90TgW9uM8wYH9ZUj2LsvlFBk-s7rx91',
  2005: '1_2vhDv53RJ6VDQ-CpulKdPOpsfAUTLKl',
  2006: '1hRZj9NW1uCc1qwIFyp_ls8iaEf6lDfLz',
  2007: '1zwRTuZbdDff-SRLLcSQ-ObwgnZYl0Ou0',
  2008: '1nbs6icaCn5gLeDUlyDfgPawyDmqpy_51',
  2009: '16DzoOJb_jGSDSVRuYeZt541GIRAPwYGE',
  2010: '1pZynGhqSqYnf2Y__PP1S1vxA9zL0AC4T',
  2011: '11J9naOs8ehcdxEFd5167Atnzlz6rUPLh',
  2012: '1EWD68SC_DQOnKgXS1beXjD2vzPO2IcLw',
  2013: '1CvBn1lBPsJTshGoK_qkCLBKPIAxXP2xl',
  2014: '1iJ_qBfqnyeNliq8oZiz2ra0ftooXX2FE',
  2015: '17uTRJ9X0SgJX8fSjzBHeOLQMOwzVqyvK',
  2016: '1E7DNbUdyntvrKsdeMEoNXA8fukQSZh-A',
  2017: '1NNBJVYYJhMeFt9GaMxTy8UaAloVkUd91',
  2018: '14QcBYdsXLVu3konbZ4i6Zz-dddFTGMeo',
  2019: '1ckhn4tnLXcznRCqCMDjJT-qUZQNNGwmj',
  2020: '19hTg2iuPaUsMTo5zTACLWMmzORvTYMA2',
  // 2021: não disponível
  2022: '17B5QPpYcGPeyIWXNPmCSSIXcuLvRsi73',
  2023: '1qAu1RoVED4alsKRyUloR7yi_TH_xq7EP',
  2024: '13KcEQabJcI9Tbgvzngcg9PMR1i44S4kM',
  2025: '1qV75-1GR-0ItrUXdqMF5paO8qi-m1gvp',
};

// Escapa aspas simples para SQL
function sqlStr(s) {
  if (s == null) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function rowToSql(year, q) {
  const enunciado = `Q${q.questao_num} Item ${q.item_num} (TPS ${year}): ${q.enunciado || ''} | ${q.item_text || ''}`.substring(0, 1000);
  const gabarito = q.gabarito === 'C' ? 'a' : 'b';
  return (
    `  ('exam', ${year}, ${sqlStr(q.subject)}, ${sqlStr(q.topic || null)}, ` +
    `${sqlStr(enunciado)}, '{"a":"Certo","b":"Errado"}'::jsonb, '${gabarito}', NULL)`
  );
}

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  return auth.getClient();
}

async function downloadPdf(fileId, authClient) {
  const drive = google.drive({ version: 'v3', auth: authClient });
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(response.data);
}

// Calls Anthropic API and returns the full text response
async function callClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return data.content?.[0]?.text || '';
}

// Calls Poe API (SSE) and returns the full concatenated text response
async function callPoe(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      version: '1.0',
      type: 'query',
      query: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const req = https.request({
      hostname: 'api.poe.com',
      path: `/bot/${POE_BOT}`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.POE_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let chunks = [];
      let raw = '';
      res.on('data', (d) => { raw += d.toString(); });
      res.on('end', () => {
        // Parse SSE: each line is "data: {...}"
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.event === 'text' && evt.data && evt.data.text) chunks.push(evt.data.text);
            if (evt.event === 'error') return reject(new Error(evt.data?.text || 'Poe error'));
          } catch (_) {}
        }
        resolve(chunks.join(''));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function extractQuestionsFromText(fullText, year) {
  // Include gabarito section even if text is very long
  const gabaritoIdx = fullText.search(/GABARITO|QUESTÕES\s+1\s+2/i);
  let textSlice;
  if (gabaritoIdx > 0 && gabaritoIdx > 35000) {
    textSlice = fullText.substring(0, 35000) + '\n\n...\n\n' + fullText.substring(gabaritoIdx);
  } else {
    textSlice = fullText.substring(0, 50000);
  }

  const prompt = `Você é um especialista no CACD (Concurso de Admissão à Carreira Diplomática).

Abaixo está o texto completo do TPS ${year} do CACD, contendo o caderno de questões e o gabarito oficial.

TEXTO COMPLETO:
${textSlice}

O TPS do CACD é uma prova de Certo/Errado (C ou E). Cada QUESTÃO tem geralmente 5 itens que devem ser julgados.
Os itens podem ser marcados com símbolos especiais (Ø Ù Ú Û Ü), letras ou simplesmente listados como parágrafos seguidos.
O gabarito está ao final do texto — use-o para preencher o campo "gabarito" de cada item.

Para CADA item de CADA questão, extraia:
- subject: matéria (Português, Inglês, História do Brasil, História Mundial, Política Internacional, Economia, Direito Interno, Direito Internacional, Geografia)
- topic: tópico específico dentro da matéria (ex: "Interpretação de texto", "Guerra Fria", "Política Externa Brasileira")
- questao_num: número da questão (inteiro)
- item_num: número do item dentro da questão (1 a 5)
- enunciado: texto do enunciado/contexto da questão pai (máx 400 chars) — NÃO inclua o texto do item aqui
- item_text: texto EXATO do item a ser julgado (certo ou errado), copiado do PDF
- gabarito: "C" ou "E" conforme gabarito oficial

IMPORTANTE:
- Copie o texto dos itens EXATAMENTE como aparece, sem parafrasear
- Inclua o texto de contexto completo no campo "enunciado"
- O campo "item_text" deve conter apenas o texto do item específico

Responda APENAS com JSON válido, sem markdown:
{"questoes":[{"subject":"...","topic":"...","questao_num":1,"item_num":1,"enunciado":"...","item_text":"...","gabarito":"C"}]}`;

  let content;
  if (process.env.ANTHROPIC_API_KEY) {
    content = await callClaude(prompt);
  } else if (process.env.POE_API_KEY) {
    content = await callPoe(prompt);
  } else {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://eduflow.vercel.app',
        'X-Title': 'Barão CACD SQL Generator',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 32000,
      }),
    });
    if (!response.ok) throw new Error(`OpenRouter ${response.status}: ${await response.text()}`);
    const data = await response.json();
    content = data.choices?.[0]?.message?.content || '';
  }

  const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const match = cleaned.match(/\{[\s\S]+\}/);
  if (!match) throw new Error('Nenhum JSON encontrado na resposta');
  return JSON.parse(match[0]).questoes || [];
}

async function processYear(year, authClient) {
  process.stdout.write(`[${year}] Baixando PDF... `);
  const pdfBuffer = await downloadPdf(DRIVE_FILES[year], authClient);
  process.stdout.write(`${Math.round(pdfBuffer.length / 1024)} KB | `);

  process.stdout.write('Extraindo texto... ');
  const data = await pdfParse(pdfBuffer);
  const fullText = data.text || '';
  process.stdout.write(`${fullText.length} chars | `);

  process.stdout.write('Chamando IA... ');
  const questoes = await extractQuestionsFromText(fullText, year);
  console.log(`${questoes.length} itens extraídos ✓`);

  return questoes;
}

async function main() {
  console.log('══════════════════════════════════════════════════');
  console.log('  Barão — Gerador de SQL para TPS CACD');
  console.log('══════════════════════════════════════════════════\n');

  if (!process.env.ANTHROPIC_API_KEY && !process.env.POE_API_KEY && !process.env.OPENROUTER_API_KEY) {
    console.error('ERRO: defina ANTHROPIC_API_KEY, POE_API_KEY ou OPENROUTER_API_KEY no .env');
    process.exit(1);
  }
  const aiProvider = process.env.ANTHROPIC_API_KEY
    ? `Claude (${ANTHROPIC_MODEL})`
    : process.env.POE_API_KEY ? `Poe/${POE_BOT}` : `OpenRouter/${OPENROUTER_MODEL}`;
  console.log(`IA: ${aiProvider}`);

  console.log('Autenticando com Google Drive...');
  let authClient;
  try {
    authClient = await getAuthClient();
    console.log('Google auth OK\n');
  } catch (e) {
    console.error('Falha na autenticação Google:', e.message);
    console.error('Execute: gcloud auth application-default login');
    process.exit(1);
  }

  const years = YEAR_ARG
    ? [Number(YEAR_ARG)]
    : Object.keys(DRIVE_FILES).map(Number).sort();

  const outDir = path.join(__dirname, '..', 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  const outFile = OUT_ARG
    ? path.resolve(OUT_ARG)
    : YEAR_ARG
      ? path.join(outDir, `tps-${YEAR_ARG}.sql`)
      : path.join(outDir, 'all-exams.sql');

  const lines = [];
  lines.push('-- CACD TPS — questões geradas automaticamente via IA');
  lines.push(`-- Anos: ${years.join(', ')}`);
  lines.push(`-- Gerado em: ${new Date().toISOString()}`);
  lines.push('');

  const summary = [];

  for (const year of years) {
    try {
      const questoes = await processYear(year, authClient);

      lines.push(`-- ─── TPS ${year} (${questoes.length} itens) ─────────────────────────`);
      lines.push(`DELETE FROM questions WHERE source = 'exam' AND year = ${year};`);
      lines.push('INSERT INTO questions (source, year, subject, topic, enunciado, opcoes, gabarito, explicacao) VALUES');
      lines.push(questoes.map(q => rowToSql(year, q)).join(',\n'));
      lines.push(';');
      lines.push('');

      summary.push({ year, count: questoes.length, ok: true });

      // Grava progressivamente (segurança em caso de crash)
      fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
    } catch (e) {
      console.error(`[${year}] ERRO: ${e.message}`);
      lines.push(`-- [${year}] ERRO: ${e.message}`);
      summary.push({ year, ok: false, error: e.message });
    }

    // Pausa entre anos para não sobrecarregar a API
    if (years.indexOf(year) < years.length - 1) {
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');

  console.log('\n══════════════════════════════════════════════════');
  console.log('  Resumo');
  console.log('══════════════════════════════════════════════════');
  let total = 0;
  for (const s of summary) {
    if (s.ok) {
      console.log(`  ✓ ${s.year}: ${s.count} questões`);
      total += s.count;
    } else {
      console.log(`  ✗ ${s.year}: ${s.error}`);
    }
  }
  console.log(`\nTotal: ${total} questões`);
  console.log(`SQL gerado em: ${outFile}`);
  console.log('\nCole o arquivo no Supabase SQL Editor e clique em Run.');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
