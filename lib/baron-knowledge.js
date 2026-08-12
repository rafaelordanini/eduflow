const fs = require('node:fs');
const path = require('node:path');

const GUIDE_FILES = [
  '2013 - Filhote de Gnu.md', '2014 - Calango Lumbrera.md',
  '2015 - Orlando Lagartixa.md', '2016 - Texugo Melívoro.md',
  '2017 - Canarinho Pistola.md', '2018 - Capivara Cética.md',
  '2019 - Esperança Equilibrista.md', '2020-21 - Jacaré Esmerado.md',
  '2022 - Ema Oblíqua e Dissimulada.md', '2023 - Vira-Lata Caramelo Descomplexado.md',
  '2024 - Saruê Malabarista.md', '2025 - Carcará Indômita.md'
];
const STOP_WORDS = new Set('a ao aos as com como da das de do dos e em entre essa esse esta este eu guia guias me no nos o os ou para por prova provas que qual quais se sobre sua um uma'.split(' '));
let guideChunks;

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function termsFor(query) {
  return [...new Set(normalize(query).match(/[a-z0-9]{3,}/g) || [])]
    .filter(term => !STOP_WORDS.has(term)).slice(0, 12);
}

function score(text, terms) {
  const normalized = normalize(text);
  return terms.reduce((total, term) => total + (normalized.split(term).length - 1), 0);
}

function loadGuideChunks(rootDir = path.join(__dirname, '..')) {
  if (guideChunks && rootDir === path.join(__dirname, '..')) return guideChunks;
  const chunks = [];
  GUIDE_FILES.forEach(file => {
    const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
    const title = file.replace(/\.md$/, '');
    const year = title.match(/^\d{4}(?:-\d{2})?/)?.[0];
    let page = null;
    let buffer = '';
    content.split('\n').forEach(line => {
      const marker = line.match(/<!-- Página (\d+) -->/);
      if (marker) page = Number(marker[1]);
      if (!line.trim() || marker) {
        if (buffer.trim().length >= 80) chunks.push({ type: 'guide', title, year, page, content: buffer.trim() });
        buffer = '';
      } else if (!line.startsWith('---') && !line.startsWith('source_pdf:') && !line.startsWith('conversion:')) {
        buffer += (buffer ? '\n' : '') + line;
      }
    });
    if (buffer.trim().length >= 80) chunks.push({ type: 'guide', title, year, page, content: buffer.trim() });
  });
  if (rootDir === path.join(__dirname, '..')) guideChunks = chunks;
  return chunks;
}

async function searchExams(supabase, terms) {
  const { data, error } = await supabase.from('questions').select('id, year, subject, topic, enunciado, opcoes, gabarito, explicacao').eq('source', 'exam').limit(1000);
  if (error) throw error;
  return (data || []).map(q => ({
    type: 'exam', title: `Prova CACD ${q.year || ''}`.trim(), year: q.year,
    questionId: q.id, subject: q.subject,
    content: [q.enunciado, q.opcoes && JSON.stringify(q.opcoes), `Gabarito: ${q.gabarito}`, q.explicacao].filter(Boolean).join('\n'),
    relevance: score([q.subject, q.topic, q.enunciado, q.explicacao].join(' '), terms)
  })).filter(item => item.relevance > 0).sort((a, b) => b.relevance - a.relevance).slice(0, 4);
}

function searchGuides(query, rootDir) {
  const terms = termsFor(query);
  return loadGuideChunks(rootDir).map(item => ({ ...item, relevance: score(item.content, terms) }))
    .filter(item => item.relevance > 0).sort((a, b) => b.relevance - a.relevance).slice(0, 4);
}

async function searchWeb(query, fetchImpl = global.fetch) {
  if (!process.env.TAVILY_API_KEY || !fetchImpl) return [];
  const response = await fetchImpl('https://api.tavily.com/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query, search_depth: 'advanced', max_results: 4, include_answer: false })
  });
  if (!response.ok) throw new Error(`Pesquisa web respondeu com status ${response.status}`);
  const payload = await response.json();
  return (payload.results || []).map(result => ({ type: 'web', title: result.title, url: result.url, content: result.content, relevance: result.score || 0 }));
}

function formatContext(sources, maxChars = 10000) {
  let remaining = maxChars;
  return sources.map((source, index) => {
    const label = source.type === 'exam' ? `PROVA OFICIAL — ${source.title}, questão ${source.questionId}`
      : source.type === 'guide' ? `GUIA DE APROVADOS — ${source.title}${source.page ? `, p. ${source.page}` : ''}`
        : `FONTE WEB — ${source.title} (${source.url})`;
    const content = source.content.slice(0, Math.max(0, remaining - label.length - 20));
    remaining -= content.length + label.length + 20;
    return remaining >= 0 && content ? `[Fonte ${index + 1}: ${label}]\n${content}` : '';
  }).filter(Boolean).join('\n\n');
}

async function retrieveKnowledge({ query, supabase, rootDir, fetchImpl }) {
  const terms = termsFor(query);
  const [exams, guides] = await Promise.all([searchExams(supabase, terms), Promise.resolve(searchGuides(query, rootDir))]);
  let web = [];
  if (exams.length + guides.length < 2) {
    try {
      web = await searchWeb(query, fetchImpl);
    } catch (error) {
      // Documentary results remain useful even when the optional web provider is unavailable.
      console.error('Baron web search error:', error);
    }
  }
  const sources = [...exams, ...guides, ...web];
  return { context: formatContext(sources), sources: sources.map(({ content, relevance, ...source }) => source) };
}

module.exports = { formatContext, loadGuideChunks, retrieveKnowledge, searchGuides, termsFor };
