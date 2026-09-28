const crypto = require('node:crypto');

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

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

function withApiKey(url, apiKey) {
  if (!apiKey) return url;
  return `${url}${url.includes('?') ? '&' : '?'}key=${encodeURIComponent(apiKey)}`;
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function readServiceAccount(env = process.env) {
  const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON || env.GOOGLE_SERVICE_ACCOUNT_BASE64;
  if (raw) {
    try {
      const decoded = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      const credentials = JSON.parse(decoded);
      if (credentials.client_email && credentials.private_key) return credentials;
    } catch {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON inválida. Informe o JSON completo ou em Base64.');
    }
  }
  if (env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return {
      client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n')
    };
  }
  return null;
}

async function getServiceAccountToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: credentials.client_email,
    scope: DRIVE_READONLY_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${claims}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), credentials.private_key).toString('base64url');
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` })
  });
  if (!response.ok) throw new Error(`Não foi possível autenticar a conta de serviço do Google Drive (HTTP ${response.status}).`);
  const payload = await response.json();
  if (!payload.access_token) throw new Error('O Google não retornou um token de acesso para a conta de serviço.');
  return payload.access_token;
}

async function driveJson(url, auth) {
  const response = await fetch(withApiKey(url, auth.apiKey), { headers: auth.headers });
  if (!response.ok) {
    const hint = response.status === 401
      ? 'Configure uma chave da Drive API ou uma conta de serviço na Vercel.'
      : 'Compartilhe a pasta com a conta de serviço e confira a Drive API.';
    throw new Error(`Google Drive retornou HTTP ${response.status}. ${hint}`);
  }
  return response.json();
}

async function driveAuth(apiKey) {
  if (apiKey) return { apiKey, headers: {} };
  const credentials = readServiceAccount();
  if (!credentials) {
    throw new Error('Credenciais do Google Drive ausentes. Configure GOOGLE_DRIVE_API_KEY ou GOOGLE_SERVICE_ACCOUNT_JSON na Vercel.');
  }
  return { apiKey: '', headers: { Authorization: `Bearer ${await getServiceAccountToken(credentials)}` } };
}

async function fetchDriveLessonSummary(lesson, apiKey = process.env.GOOGLE_DRIVE_API_KEY || process.env.GOOGLE_API_KEY) {
  const videoId = extractDriveFileId(lesson && (lesson.drive_url || lesson.embed_url));
  if (!videoId) return '';
  const auth = await driveAuth(apiKey);

  const metadata = await driveJson(
    `${DRIVE_API}/${encodeURIComponent(videoId)}?fields=name,parents&supportsAllDrives=true`, auth
  );
  const parentId = metadata.parents && metadata.parents[0];
  if (!parentId) return '';

  const candidates = summaryFilenames(lesson, metadata.name);
  const nameFilter = candidates.map(name => `name='${name.replace(/'/g, "\\'")}'`).join(' or ');
  const query = `'${parentId.replace(/'/g, "\\'")}' in parents and trashed=false and (${nameFilter})`;
  const listing = await driveJson(
    `${DRIVE_API}?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=20&includeItemsFromAllDrives=true&supportsAllDrives=true`, auth
  );
  const files = Array.isArray(listing.files) ? listing.files : [];
  const summaryFile = candidates.map(name => files.find(file => file.name === name)).find(Boolean);
  if (!summaryFile) return '';

  const response = await fetch(withApiKey(
    `${DRIVE_API}/${encodeURIComponent(summaryFile.id)}?alt=media&supportsAllDrives=true`, auth.apiKey
  ), { headers: auth.headers });
  if (!response.ok) throw new Error(`Não foi possível baixar ${summaryFile.name} do Google Drive (HTTP ${response.status}).`);
  return (await response.text()).trim();
}

module.exports = {
  extractDriveFileId, lessonNumber, summaryFilenames, withApiKey, readServiceAccount,
  getServiceAccountToken, fetchDriveLessonSummary
};
