/**
 * Import ALL CACD TPS exams (2003–2025) from Google Drive into Supabase.
 *
 * Prerequisites (run once):
 *   npm install googleapis pdf-parse node-fetch
 *   gcloud auth application-default login
 *   # OR: set GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *
 * Usage:
 *   node scripts/import-all-exams.js            # import all missing years
 *   node scripts/import-all-exams.js --year=2010 # reimport a specific year
 *   node scripts/import-all-exams.js --dry-run   # extract only, no DB insert
 *
 * Required env vars (in .env):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY   (service role key)
 *   OPENROUTER_API_KEY
 */

require('dotenv').config();
const { google } = require('googleapis');
const pdfParse = require('pdf-parse');
const { createClient } = require('@supabase/supabase-js');

// ─── Config ──────────────────────────────────────────────────────────────────

const OPENROUTER_MODEL = 'google/gemini-2.5-flash';
const BATCH_SIZE = 50;

const ARGS = process.argv.slice(2);
const DRY_RUN = ARGS.includes('--dry-run');
const YEAR_ARG = (ARGS.find(a => a.startsWith('--year=')) || '').replace('--year=', '');
const FORCE = ARGS.includes('--force');

// Google Drive file IDs for each TPS year (combined caderno+gabarito PDFs)
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
  // 2021: not available
  2022: '17B5QPpYcGPeyIWXNPmCSSIXcuLvRsi73',
  2023: '1qAu1RoVED4alsKRyUloR7yi_TH_xq7EP',
  2024: '13KcEQabJcI9Tbgvzngcg9PMR1i44S4kM',
  2025: '1qV75-1GR-0ItrUXdqMF5paO8qi-m1gvp',
};

// ─── Clients ─────────────────────────────────────────────────────────────────

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// ─── Google Drive download ────────────────────────────────────────────────────

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

async function extractPdfText(pdfBuffer) {
  const data = await pdfParse(pdfBuffer);
  return data.text || '';
}

// ─── OpenRouter extraction ────────────────────────────────────────────────────

async function extractQuestionsFromText(fullText, year) {
  const prompt = `Você é um especialista no CACD (Concurso de Admissão à Carreira Diplomática).

Abaixo está o texto completo do TPS ${year} do CACD, incluindo o caderno de questões e o gabarito oficial.

TEXTO COMPLETO:
${fullText.substring(0, 40000)}

O TPS do CACD consiste em questões de Certo/Errado. Cada QUESTÃO tem 5 itens numerados.

Extraia TODOS os itens no formato JSON. Para cada item extraia:
- subject: matéria (Português, Inglês, História do Brasil, História Mundial, Política Internacional, Economia, Direito Interno, Direito Internacional, Geografia)
- topic: tópico específico dentro da matéria
- questao_num: número da questão (inteiro)
- item_num: número do item dentro da questão (1 a 5)
- enunciado: texto do enunciado/contexto da questão (máx 800 chars)
- item_text: texto específico do item a ser julgado
- gabarito: "C" (Certo) ou "E" (Errado) conforme gabarito oficial

Responda APENAS com JSON válido, sem markdown, sem explicações:
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
      model: OPENROUTER_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 32000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  // Strip markdown code fences if present
  const cleaned = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const match = cleaned.match(/\{[\s\S]+\}/);
  if (!match) throw new Error('No JSON found in OpenRouter response');

  const parsed = JSON.parse(match[0]);
  return parsed.questoes || [];
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function countExisting(year) {
  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'exam')
    .eq('year', year);
  return count || 0;
}

async function deleteYear(year) {
  await supabase.from('questions').delete().eq('source', 'exam').eq('year', year);
}

async function insertBatch(rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const { error } = await supabase.from('questions').insert(rows.slice(i, i + BATCH_SIZE));
    if (error) throw new Error(`Insert error: ${error.message}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function processYear(year, authClient) {
  const fileId = DRIVE_FILES[year];
  if (!fileId) {
    console.log(`  [${year}] No Drive file configured — skipping`);
    return { year, status: 'skipped', reason: 'no file' };
  }

  const existing = await countExisting(year);
  if (existing > 0 && !FORCE) {
    console.log(`  [${year}] Already has ${existing} questions — skipping (use --force to reimport)`);
    return { year, status: 'skipped', reason: 'already imported', count: existing };
  }

  console.log(`  [${year}] Downloading PDF from Drive...`);
  let pdfBuffer;
  try {
    pdfBuffer = await downloadPdf(fileId, authClient);
  } catch (e) {
    console.error(`  [${year}] Drive download failed: ${e.message}`);
    return { year, status: 'error', error: e.message };
  }

  console.log(`  [${year}] Extracting text from PDF (${Math.round(pdfBuffer.length / 1024)} KB)...`);
  let fullText;
  try {
    fullText = await extractPdfText(pdfBuffer);
    console.log(`  [${year}] Extracted ${fullText.length} chars`);
  } catch (e) {
    console.error(`  [${year}] PDF parse failed: ${e.message}`);
    return { year, status: 'error', error: e.message };
  }

  console.log(`  [${year}] Calling OpenRouter (${OPENROUTER_MODEL}) for question extraction...`);
  let questoes;
  try {
    questoes = await extractQuestionsFromText(fullText, year);
    console.log(`  [${year}] Extracted ${questoes.length} items`);
  } catch (e) {
    console.error(`  [${year}] AI extraction failed: ${e.message}`);
    return { year, status: 'error', error: e.message };
  }

  if (!questoes || questoes.length === 0) {
    return { year, status: 'error', error: 'No questions extracted' };
  }

  const rows = questoes.map(q => ({
    source: 'exam',
    year: Number(year),
    subject: q.subject,
    topic: q.topic || null,
    enunciado: `Q${q.questao_num} Item ${q.item_num} (TPS ${year}): ${q.enunciado || ''} | ${q.item_text || ''}`.substring(0, 1000),
    opcoes: { a: 'Certo', b: 'Errado' },
    gabarito: q.gabarito === 'C' ? 'a' : 'b',
    explicacao: null,
  }));

  if (DRY_RUN) {
    console.log(`  [${year}] DRY RUN — would insert ${rows.length} rows`);
    console.log(`  [${year}] Sample:`, JSON.stringify(rows[0], null, 2));
    return { year, status: 'dry-run', count: rows.length };
  }

  if (existing > 0) {
    console.log(`  [${year}] Deleting ${existing} existing rows (--force)...`);
    await deleteYear(year);
  }

  console.log(`  [${year}] Inserting ${rows.length} rows into Supabase...`);
  try {
    await insertBatch(rows);
    console.log(`  [${year}] ✓ Done — ${rows.length} rows inserted`);
    return { year, status: 'ok', count: rows.length };
  } catch (e) {
    console.error(`  [${year}] Insert failed: ${e.message}`);
    return { year, status: 'error', error: e.message };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log(' EduFlow — CACD TPS Bulk Import (2003–2025)');
  console.log('═══════════════════════════════════════════════════');
  if (DRY_RUN) console.log(' MODE: DRY RUN (no DB writes)');
  if (FORCE)   console.log(' MODE: FORCE (will overwrite existing)');
  console.log('');

  if (!process.env.OPENROUTER_API_KEY) {
    console.error('ERROR: OPENROUTER_API_KEY not set in .env');
    process.exit(1);
  }
  if (!process.env.SUPABASE_URL) {
    console.error('ERROR: SUPABASE_URL not set in .env');
    process.exit(1);
  }

  console.log('Authenticating with Google Drive...');
  let authClient;
  try {
    authClient = await getAuthClient();
    console.log('Google auth OK\n');
  } catch (e) {
    console.error('Google auth failed:', e.message);
    console.error('Run: gcloud auth application-default login');
    console.error('Or set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path');
    process.exit(1);
  }

  const years = YEAR_ARG
    ? [Number(YEAR_ARG)]
    : Object.keys(DRIVE_FILES).map(Number).sort();

  const results = [];
  for (const year of years) {
    const result = await processYear(year, authClient);
    results.push(result);
    // Small pause between years to avoid rate limits
    if (years.indexOf(year) < years.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(' Summary');
  console.log('═══════════════════════════════════════════════════');
  for (const r of results) {
    const icon = r.status === 'ok' ? '✓' : r.status === 'skipped' ? '–' : r.status === 'dry-run' ? '○' : '✗';
    const detail = r.status === 'error' ? r.error : r.count ? `${r.count} questões` : r.reason || '';
    console.log(`  ${icon} ${r.year}: ${r.status}  ${detail}`);
  }

  const ok = results.filter(r => r.status === 'ok').length;
  const total = results.filter(r => r.status === 'ok').reduce((s, r) => s + (r.count || 0), 0);
  console.log(`\nDone. ${ok} years imported, ${total} total questions.`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
