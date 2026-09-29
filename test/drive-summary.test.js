const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractDriveFileId,
  lessonNumber,
  summaryFilenames,
  findSummaryFile,
  exportMimeType,
  fetchDriveLessonSummary,
  readServiceAccount
} = require('../lib/drive-summary');

test('derives the sibling summary name from the Drive video and lesson order', () => {
  assert.equal(extractDriveFileId('https://drive.google.com/file/d/video-123/view'), 'video-123');
  assert.equal(lessonNumber(102), 2);
  assert.deepEqual(summaryFilenames({ title: 'aula2', order_index: 102 }, 'aula2.mp4'), ['aula2_resumo.txt']);
});

test('matches the real summary name without depending on case or extension', () => {
  const file = findSummaryFile([
    { id: 'pdf-summary', name: 'AULA2_RESUMO.PDF', mimeType: 'application/pdf' }
  ], ['aula2_resumo.txt']);
  assert.equal(file.id, 'pdf-summary');
  assert.equal(exportMimeType('application/vnd.google-apps.document'), 'text/plain');
});

test('finds and downloads a summary in the same Google Drive folder', async t => {
  const previousFetch = global.fetch;
  t.after(() => { global.fetch = previousFetch; });
  const requests = [];
  const previousInfo = console.info;
  const logs = [];
  console.info = (...args) => logs.push(args);
  t.after(() => { console.info = previousInfo; });
  global.fetch = async url => {
    requests.push(url);
    if (requests.length === 1) return {
      ok: true,
      json: async () => ({ name: 'aula2.mp4', parents: ['module-folder'] })
    };
    if (requests.length === 2) return {
      ok: true,
      json: async () => ({ files: [{ id: 'summary-123', name: 'Aula2_Resumo.MD', mimeType: 'text/markdown' }] })
    };
    return { ok: true, text: async () => 'Resumo da aula 2.' };
  };

  const summary = await fetchDriveLessonSummary({
    title: 'aula2', order_index: 2,
    drive_url: 'https://drive.google.com/file/d/video-123/view'
  }, 'api-key');

  assert.equal(summary, 'Resumo da aula 2.');
  assert.equal(requests.length, 3);
  const listRequest = decodeURIComponent(requests[1]);
  assert.match(listRequest, /q='module-folder' in parents and trashed = false/);
  assert.doesNotMatch(listRequest, /name=/);
  assert.match(listRequest, /fields=files\(id,name,mimeType,shortcutDetails\)/);
  assert.match(listRequest, /includeItemsFromAllDrives=true/);
  assert.match(listRequest, /supportsAllDrives=true/);
  assert.match(requests[2], /summary-123.*alt=media/);
  assert.match(requests[2], /supportsAllDrives=true/);
  assert.equal(logs[0][1].folderId, 'module-folder');
  assert.equal(logs[0][1].foundFileId, 'summary-123');
  assert.equal(logs[0][1].mimeType, 'text/markdown');
  assert.equal(logs[0][1].isShortcut, false);
  assert.doesNotMatch(logs[0][1].apiUrl, /key=/);
});

test('accesses publicly shared Drive files with an API key', async t => {
  const previousFetch = global.fetch;
  t.after(() => { global.fetch = previousFetch; });
  const requests = [];
  global.fetch = async url => {
    requests.push(url);
    if (requests.length === 1) return { ok: true, json: async () => ({ name: 'aula4.mp4', parents: ['public-folder'] }) };
    if (requests.length === 2) return { ok: true, json: async () => ({ files: [{ id: 'public-summary', name: 'aula4_resumo.txt', mimeType: 'text/plain' }] }) };
    return { ok: true, text: async () => 'Resumo público.' };
  };
  const summary = await fetchDriveLessonSummary({
    title: 'aula4', order_index: 4,
    drive_url: 'https://drive.google.com/file/d/public-video/view'
  }, 'public-api-key');
  assert.equal(summary, 'Resumo público.');
  assert.ok(requests.every(url => url.includes('key=public-api-key')));
});

test('exports a native Google document instead of requesting alt=media', async t => {
  const previousFetch = global.fetch;
  const previousInfo = console.info;
  t.after(() => { global.fetch = previousFetch; console.info = previousInfo; });
  console.info = () => {};
  const requests = [];
  global.fetch = async url => {
    requests.push(url);
    if (requests.length === 1) return { ok: true, json: async () => ({ name: 'aula3.mp4', parents: ['folder'] }) };
    if (requests.length === 2) return { ok: true, json: async () => ({ files: [{
      id: 'native-doc', name: 'AULA3_RESUMO', mimeType: 'application/vnd.google-apps.document'
    }] }) };
    return { ok: true, text: async () => 'Documento exportado.' };
  };

  assert.equal(await fetchDriveLessonSummary({ order_index: 3, drive_url: 'https://drive.google.com/file/d/video/view' }, 'key'), 'Documento exportado.');
  assert.match(requests[2], /native-doc\/export\?mimeType=text%2Fplain/);
  assert.doesNotMatch(requests[2], /alt=media/);
});

test('follows a Drive shortcut and downloads its target', async t => {
  const previousFetch = global.fetch;
  const previousInfo = console.info;
  t.after(() => { global.fetch = previousFetch; console.info = previousInfo; });
  console.info = () => {};
  const requests = [];
  global.fetch = async url => {
    requests.push(url);
    if (requests.length === 1) return { ok: true, json: async () => ({ name: 'aula5.mp4', parents: ['folder'] }) };
    if (requests.length === 2) return { ok: true, json: async () => ({ files: [{
      id: 'shortcut-id', name: 'aula5_resumo.txt', mimeType: 'application/vnd.google-apps.shortcut',
      shortcutDetails: { targetId: 'target-id' }
    }] }) };
    if (requests.length === 3) return { ok: true, json: async () => ({ id: 'target-id', name: 'Resumo.txt', mimeType: 'text/plain' }) };
    return { ok: true, text: async () => 'Destino do atalho.' };
  };

  assert.equal(await fetchDriveLessonSummary({ order_index: 5, drive_url: 'https://drive.google.com/file/d/video/view' }, 'key'), 'Destino do atalho.');
  assert.match(requests[2], /target-id.*fields=id,name,mimeType,shortcutDetails.*supportsAllDrives=true/);
  assert.match(requests[3], /target-id.*alt=media/);
});

test('distinguishes folder, missing summary, and download failures', async t => {
  const previousFetch = global.fetch;
  const previousInfo = console.info;
  t.after(() => { global.fetch = previousFetch; console.info = previousInfo; });
  console.info = () => {};

  global.fetch = async () => ({ ok: false, status: 404 });
  await assert.rejects(fetchDriveLessonSummary({ drive_url: 'https://drive.google.com/file/d/video/view' }, 'key'), /Pasta não encontrada/);

  let call = 0;
  global.fetch = async () => ++call === 1
    ? { ok: true, json: async () => ({ name: 'aula.mp4', parents: ['folder'] }) }
    : { ok: true, json: async () => ({ files: [] }) };
  await assert.rejects(fetchDriveLessonSummary({ drive_url: 'https://drive.google.com/file/d/video/view' }, 'key'), /Resumo não encontrado na pasta/);

  call = 0;
  global.fetch = async () => {
    call += 1;
    if (call === 1) return { ok: true, json: async () => ({ name: 'aula.mp4', parents: ['folder'] }) };
    if (call === 2) return { ok: true, json: async () => ({ files: [{ id: 'summary', name: 'aula_resumo.pdf', mimeType: 'application/pdf' }] }) };
    return { ok: false, status: 403 };
  };
  await assert.rejects(fetchDriveLessonSummary({ drive_url: 'https://drive.google.com/file/d/video/view' }, 'key'), /Resumo encontrado, mas falhou ao baixar/);
});


test('reads service account credentials from Vercel environment variables', () => {
  assert.deepEqual(readServiceAccount({
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'drive-reader@example.iam.gserviceaccount.com',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'line1\\nline2'
  }), {
    client_email: 'drive-reader@example.iam.gserviceaccount.com',
    private_key: 'line1\nline2'
  });
});

test('fails before calling Drive anonymously when credentials are absent', async t => {
  const previousFetch = global.fetch;
  const previousJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const previousBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
  const previousEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const previousKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  t.after(() => {
    global.fetch = previousFetch;
    for (const [name, value] of Object.entries({
      GOOGLE_SERVICE_ACCOUNT_JSON: previousJson,
      GOOGLE_SERVICE_ACCOUNT_BASE64: previousBase64,
      GOOGLE_SERVICE_ACCOUNT_EMAIL: previousEmail,
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: previousKey
    })) value === undefined ? delete process.env[name] : process.env[name] = value;
  });
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_BASE64;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  global.fetch = async () => { throw new Error('anonymous request must not happen'); };

  await assert.rejects(fetchDriveLessonSummary({
    drive_url: 'https://drive.google.com/file/d/video-123/view'
  }, ''), /Credenciais do Google Drive ausentes/);
});
