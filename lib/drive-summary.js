const crypto = require('node:crypto');

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_READONLY_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const GOOGLE_APPS_PREFIX = 'application/vnd.google-apps.';

class DriveSummaryError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'DriveSummaryError';
    this.code = code;
  }
}

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

function normalizedBasename(value) {
  return String(value || '').trim().replace(/\.[^.]+$/, '').normalize('NFC').toLocaleLowerCase('pt-BR');
}

function findSummaryFile(files, candidates) {
  // Preserve video name, lesson title, then lesson number priority.
  for (const candidate of candidates) {
    const wanted = normalizedBasename(candidate);
    const match = (files || []).find(file => normalizedBasename(file && file.name) === wanted);
    if (match) return match;
  }
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

async function driveRequest(url, auth) {
  return fetch(withApiKey(url, auth.apiKey), { headers: auth.headers });
}

async function driveJson(url, auth) {
  const response = await driveRequest(url, auth);
  if (!response.ok) {
    // Keep structured diagnostics without exposing Google's raw response or credentials.
    let payload;
    try { payload = await response.json(); } catch { payload = null; }
    const error = new Error(`Google Drive retornou HTTP ${response.status}.`);
    error.status = response.status;
    error.reasons = [
      ...(payload?.error?.errors || []).map(item => item.reason),
      ...(payload?.error?.details || []).map(item => item.reason)
    ].filter(Boolean);
    throw error;
  }
  return response.json();
}

async function driveAuth(apiKey) {
  const credentials = readServiceAccount();
  if (credentials) {
    return { apiKey: '', headers: { Authorization: `Bearer ${await getServiceAccountToken(credentials)}` } };
  }
  if (apiKey) return { apiKey, headers: {} };
  throw new Error('Credenciais do Google Drive ausentes. Configure GOOGLE_DRIVE_API_KEY ou GOOGLE_SERVICE_ACCOUNT_JSON na Vercel.');
}

function exportMimeType(mimeType) {
  const type = String(mimeType || '');
  if (type === `${GOOGLE_APPS_PREFIX}document` || type === `${GOOGLE_APPS_PREFIX}presentation`) return 'text/plain';
  if (type === `${GOOGLE_APPS_PREFIX}spreadsheet`) return 'text/csv';
  if (type === `${GOOGLE_APPS_PREFIX}drawing`) return 'application/pdf';
  if (type === `${GOOGLE_APPS_PREFIX}script`) return 'application/vnd.google-apps.script+json';
  return null;
}

function downloadUrl(file) {
  const mimeType = String(file && file.mimeType || '');
  const exportType = exportMimeType(mimeType);
  if (mimeType.startsWith(GOOGLE_APPS_PREFIX)) {
    if (!exportType) return null;
    return `${DRIVE_API}/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exportType)}&supportsAllDrives=true`;
  }
  return `${DRIVE_API}/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`;
}

function summaryError(code, detail, cause) {
  const labels = {
    FOLDER_NOT_FOUND: 'Pasta não encontrada no Google Drive.',
    DRIVE_REQUEST_FAILED: 'Não foi possível acessar a aula no Google Drive.',
    SUMMARY_NOT_FOUND: 'Resumo não encontrado na pasta do Google Drive.',
    DOWNLOAD_FAILED: 'Resumo encontrado, mas falhou ao baixar do Google Drive.'
  };
  return new DriveSummaryError(code, `${labels[code]}${detail ? ` ${detail}` : ''}`, cause ? { cause } : undefined);
}

function driveAccessError(error, detail, auth) {
  const reasons = error.reasons || [];
  let instruction;
  if (reasons.some(reason => ['accessNotConfigured', 'SERVICE_DISABLED'].includes(reason))) {
    instruction = 'Habilite a Google Drive API no projeto da credencial configurada na Vercel.';
  } else if (error.status === 429 || reasons.some(reason =>
    ['rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded', 'RESOURCE_EXHAUSTED'].includes(reason))) {
    instruction = 'O limite de requisições da Google Drive API foi atingido. Aguarde e verifique a cota do projeto.';
  } else if (error.status === 401 || reasons.some(reason =>
    ['keyInvalid', 'API_KEY_INVALID', 'API_KEY_SERVICE_BLOCKED', 'API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_IP_ADDRESS_BLOCKED'].includes(reason))) {
    instruction = 'Verifique as credenciais e as restrições da Google Drive API configuradas na Vercel.';
  } else if ([403, 404].includes(error.status)) {
    instruction = auth.apiKey
      ? 'Confira o link da aula e o acesso público à pasta, ao vídeo e ao resumo. Para arquivos privados, configure uma conta de serviço e compartilhe a pasta com ela.'
      : 'Confira o link da aula e compartilhe a pasta que contém o vídeo e o resumo com o e-mail client_email da conta de serviço configurada na Vercel.';
  } else {
    instruction = 'Tente novamente. Se o erro persistir, verifique a conexão com a Google Drive API.';
  }
  return summaryError('DRIVE_REQUEST_FAILED',
    `${detail}${error.status ? ` HTTP ${error.status}.` : ''} ${instruction}`, error);
}

async function resolveTarget(file, auth) {
  if (file.mimeType !== `${GOOGLE_APPS_PREFIX}shortcut`) return file;
  const targetId = file.shortcutDetails && file.shortcutDetails.targetId;
  if (!targetId) throw summaryError('DOWNLOAD_FAILED', 'O atalho não informa o arquivo de destino.');
  const url = `${DRIVE_API}/${encodeURIComponent(targetId)}?fields=id,name,mimeType,shortcutDetails&supportsAllDrives=true`;
  try {
    return await driveJson(url, auth);
  } catch (error) {
    throw summaryError('DOWNLOAD_FAILED', `Não foi possível consultar o destino do atalho (HTTP ${error.message.match(/HTTP (\d+)/)?.[1] || 'desconhecido'}).`, error);
  }
}

async function fetchDriveLessonSummary(lesson, apiKey = process.env.GOOGLE_DRIVE_API_KEY || process.env.GOOGLE_API_KEY) {
  const videoId = extractDriveFileId(lesson && (lesson.drive_url || lesson.embed_url));
  if (!videoId) throw summaryError('FOLDER_NOT_FOUND', 'A aula não possui uma URL válida do Drive.');
  const auth = await driveAuth(apiKey);

  let metadata;
  try {
    metadata = await driveJson(
      `${DRIVE_API}/${encodeURIComponent(videoId)}?fields=name,parents&supportsAllDrives=true`, auth
    );
  } catch (error) {
    throw driveAccessError(error, 'A consulta ao arquivo do vídeo falhou.', auth);
  }
  const folderId = metadata.parents && metadata.parents[0];
  if (!folderId) throw summaryError('FOLDER_NOT_FOUND',
    'O vídeo está acessível, mas sua pasta pai não está disponível para a credencial. Compartilhe a pasta que contém o vídeo e o resumo com a conta de serviço ou torne a pasta pública se estiver usando apenas uma API key.');

  const candidates = summaryFilenames(lesson, metadata.name);
  const query = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed = false`;
  const listUrl = `${DRIVE_API}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent('files(id,name,mimeType,shortcutDetails)')}&pageSize=1000&includeItemsFromAllDrives=true&supportsAllDrives=true`;
  let listing;
  try {
    listing = await driveJson(listUrl, auth);
  } catch (error) {
    throw driveAccessError(error, 'A listagem do conteúdo da pasta falhou.', auth);
  }
  const summaryFile = findSummaryFile(Array.isArray(listing.files) ? listing.files : [], candidates);
  if (!summaryFile) {
    throw summaryError('SUMMARY_NOT_FOUND', `Nomes procurados: ${candidates.join(', ')}.`);
  }

  let target;
  try {
    target = await resolveTarget(summaryFile, auth);
  } catch (error) {
    if (error instanceof DriveSummaryError) throw error;
    throw summaryError('DOWNLOAD_FAILED', '', error);
  }
  const url = downloadUrl(target);
  const isShortcut = summaryFile.mimeType === `${GOOGLE_APPS_PREFIX}shortcut`;
  console.info('Google Drive summary download', {
    folderId,
    searchedNames: candidates,
    foundFileId: summaryFile.id,
    mimeType: target.mimeType,
    isShortcut,
    apiUrl: url
  });
  if (!url) throw summaryError('DOWNLOAD_FAILED', `O tipo ${target.mimeType} não possui formato de exportação compatível.`);

  let response;
  try {
    response = await driveRequest(url, auth);
  } catch (error) {
    throw summaryError('DOWNLOAD_FAILED', 'A requisição ao Drive falhou.', error);
  }
  if (!response.ok) throw summaryError('DOWNLOAD_FAILED', `O Drive respondeu HTTP ${response.status}.`);
  return (await response.text()).trim();
}

module.exports = {
  DriveSummaryError, extractDriveFileId, lessonNumber, summaryFilenames, normalizedBasename,
  findSummaryFile, withApiKey, readServiceAccount, getServiceAccountToken, exportMimeType,
  downloadUrl, fetchDriveLessonSummary
};
