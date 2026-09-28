const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

function extractDriveFileId(url) {
  const value = String(url || '');
  const match = value.match(/\/d\/([a-zA-Z0-9_-]+)/) || value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function lessonNumber(orderIndex) {
  const value = Number(orderIndex);
  if (!Number.isInteger(value) || value < 1) return null;
  return ((value - 1) % 100) + 1;
}

function summaryFilenames(lesson, driveFilename) {
  const names = new Set();
  const addBase = value => {
    const base = String(value || '').trim().replace(/\.[^.]+$/, '');
    if (base) names.add(`${base}_resumo.txt`);
  };
  addBase(driveFilename);
  addBase(lesson && lesson.title);
  const number = lessonNumber(lesson && lesson.order_index);
  if (number) names.add(`aula${number}_resumo.txt`);
  return [...names];
}

async function driveJson(url, apiKey) {
  const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`);
  if (!response.ok) throw new Error(`Google Drive retornou HTTP ${response.status}.`);
  return response.json();
}

async function fetchDriveLessonSummary(lesson, apiKey = process.env.GOOGLE_DRIVE_API_KEY || process.env.GOOGLE_API_KEY) {
  if (!apiKey) throw new Error('GOOGLE_DRIVE_API_KEY não configurada na Vercel.');
  const videoId = extractDriveFileId(lesson && (lesson.drive_url || lesson.embed_url));
  if (!videoId) return '';

  const metadata = await driveJson(
    `${DRIVE_API}/${encodeURIComponent(videoId)}?fields=name,parents&supportsAllDrives=true`, apiKey
  );
  const parentId = metadata.parents && metadata.parents[0];
  if (!parentId) return '';

  const candidates = summaryFilenames(lesson, metadata.name);
  const nameFilter = candidates.map(name => `name='${name.replace(/'/g, "\\'")}'`).join(' or ');
  const query = `'${parentId.replace(/'/g, "\\'")}' in parents and trashed=false and (${nameFilter})`;
  const listing = await driveJson(
    `${DRIVE_API}?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=20&includeItemsFromAllDrives=true&supportsAllDrives=true`, apiKey
  );
  const files = Array.isArray(listing.files) ? listing.files : [];
  const summaryFile = candidates.map(name => files.find(file => file.name === name)).find(Boolean);
  if (!summaryFile) return '';

  const response = await fetch(
    `${DRIVE_API}/${encodeURIComponent(summaryFile.id)}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(apiKey)}`
  );
  if (!response.ok) throw new Error(`Não foi possível baixar ${summaryFile.name} do Google Drive (HTTP ${response.status}).`);
  return (await response.text()).trim();
}

module.exports = { extractDriveFileId, lessonNumber, summaryFilenames, fetchDriveLessonSummary };
