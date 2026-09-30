const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

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

test('prefers the video summary for duplicate lessons regardless of Drive listing order', () => {
  const files = [
    { id: 'order-six', name: 'aula6_resumo.txt' },
    { id: 'order-seven', name: 'aula7_resumo.txt' },
    { id: 'title', name: 'M1A4 - Morfologia_resumo.txt' },
    { id: 'video', name: 'AULA4_RESUMO.TXT' }
  ];
  for (const lesson of [
    { title: 'M1A4 - Morfologia', order_index: 6 },
    { title: 'aula4', order_index: 7 }
  ]) {
    const candidates = summaryFilenames(lesson, 'aula4.mp4');
    for (const listing of [files, [...files].reverse()]) {
      assert.equal(findSummaryFile(listing, candidates).id, 'video');
    }
  }
});

test('uses the title before lesson order when the video summary is missing', () => {
  const candidates = summaryFilenames({ title: 'M1A4 - Morfologia', order_index: 6 }, 'aula4.mp4');
  const orderSummary = { id: 'order', name: 'aula6_resumo.txt' };
  const titleSummary = { id: 'title', name: 'M1A4 - MORFOLOGIA_RESUMO.md' };
  assert.equal(findSummaryFile([orderSummary, titleSummary], candidates).id, 'title');
  assert.equal(findSummaryFile([orderSummary], candidates).id, 'order');
  assert.equal(findSummaryFile([], candidates), undefined);
});

test('downloads the real video summary instead of a mismatched order summary', async t => {
  const previousFetch = global.fetch;
  const previousInfo = console.info;
  t.after(() => { global.fetch = previousFetch; console.info = previousInfo; });
  console.info = () => {};
  const requests = [];
  global.fetch = async url => {
    requests.push(url);
    if (requests.length === 1) return { ok: true, json: async () => ({ name: 'aula4.mp4', parents: ['module-one'] }) };
    if (requests.length === 2) return { ok: true, json: async () => ({ files: [
      { id: 'wrong-summary', name: 'aula6_resumo.txt', mimeType: 'text/plain' },
      { id: 'morphology-summary', name: 'aula4_resumo.txt', mimeType: 'text/plain' }
    ] }) };
    assert.match(url, /\/morphology-summary\?alt=media/);
    return { ok: true, text: async () => 'Resumo de Morfologia.' };
  };
  const summary = await fetchDriveLessonSummary({
    title: 'M1A4 - Morfologia', order_index: 6,
    drive_url: 'https://drive.google.com/file/d/video-four/view'
  }, 'key');
  assert.equal(summary, 'Resumo de Morfologia.');
  assert.equal(requests.length, 3);
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
  await assert.rejects(fetchDriveLessonSummary({ drive_url: 'https://drive.google.com/file/d/video/view' }, 'key'), error =>
    error.code === 'DRIVE_REQUEST_FAILED' && /HTTP 404/.test(error.message) && /acesso público/.test(error.message));

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

test('reports actionable Drive failures without leaking the raw error response', async t => {
  const previousFetch = global.fetch;
  t.after(() => { global.fetch = previousFetch; });
  for (const [status, reason, expected] of [
    [401, 'authError', /credenciais e as restrições/],
    [403, 'accessNotConfigured', /Habilite a Google Drive API/],
    [403, 'SERVICE_DISABLED', /Habilite a Google Drive API/],
    [400, 'API_KEY_INVALID', /credenciais e as restrições/],
    [403, 'API_KEY_HTTP_REFERRER_BLOCKED', /credenciais e as restrições/],
    [403, 'insufficientFilePermissions', /acesso público/],
    [403, 'rateLimitExceeded', /limite de requisições/],
    [429, '', /limite de requisições/],
    [404, 'notFound', /Confira o link/],
    [500, '', /Tente novamente/]
  ]) {
    global.fetch = async () => ({ ok: false, status, json: async () => ({
      error: { message: 'SECRET_RAW_RESPONSE', errors: [{ reason }], details: [{ reason }] }
    }) });
    await assert.rejects(fetchDriveLessonSummary({ drive_url: 'https://drive.google.com/file/d/video/view' }, 'key'), error => {
      assert.equal(error.code, 'DRIVE_REQUEST_FAILED');
      assert.match(error.message, new RegExp(`HTTP ${status}`));
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /SECRET_RAW_RESPONSE|key=/);
      assert.equal(error.cause.status, status);
      return true;
    });
  }
});

test('reports a folder listing failure separately from a missing summary', async t => {
  const previousFetch = global.fetch;
  t.after(() => { global.fetch = previousFetch; });
  let calls = 0;
  global.fetch = async () => ++calls === 1
    ? { ok: true, json: async () => ({ name: 'aula1.mp4', parents: ['folder'] }) }
    : { ok: false, status: 403, json: async () => ({ error: { errors: [{ reason: 'insufficientFilePermissions' }] } }) };
  await assert.rejects(fetchDriveLessonSummary({ drive_url: 'https://drive.google.com/file/d/video/view' }, 'key'), error =>
    error.code === 'DRIVE_REQUEST_FAILED' && /listagem.*HTTP 403/.test(error.message));
  assert.equal(calls, 2);
});

test('explains that a playable video may have an inaccessible parent folder', async t => {
  const previousFetch = global.fetch;
  t.after(() => { global.fetch = previousFetch; });
  global.fetch = async () => ({ ok: true, json: async () => ({ name: 'aula1.mp4' }) });
  await assert.rejects(fetchDriveLessonSummary({ drive_url: 'https://drive.google.com/file/d/video/view' }, 'key'), error =>
    error.code === 'FOLDER_NOT_FOUND' && /vídeo está acessível/.test(error.message) && /Compartilhe a pasta/.test(error.message));
});

test('uses service account access even when an API key is also configured', async t => {
  const names = ['GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_SERVICE_ACCOUNT_BASE64',
    'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', 'GOOGLE_DRIVE_API_KEY'];
  const savedEnv = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const previousFetch = global.fetch;
  const previousInfo = console.info;
  t.after(() => {
    global.fetch = previousFetch;
    console.info = previousInfo;
    for (const [name, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  for (const name of names) delete process.env[name];
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    client_email: 'reader@example.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' })
  });
  process.env.GOOGLE_DRIVE_API_KEY = 'public-key';
  console.info = () => {};
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push(url);
    assert.doesNotMatch(url, /key=public-key/);
    if (url === 'https://oauth2.googleapis.com/token') {
      assert.equal(options.method, 'POST');
      return { ok: true, json: async () => ({ access_token: 'service-token' }) };
    }
    assert.equal(options.headers.Authorization, 'Bearer service-token');
    if (requests.length === 2) return { ok: true, json: async () => ({ name: 'aula1.mp4', parents: ['private-folder'] }) };
    if (requests.length === 3) return { ok: true, json: async () => ({ files: [{ id: 'summary', name: 'aula1_resumo.txt', mimeType: 'text/plain' }] }) };
    return { ok: true, text: async () => 'Resumo privado.' };
  };
  const lesson = { drive_url: 'https://drive.google.com/file/d/video/view' };
  assert.equal(await fetchDriveLessonSummary(lesson), 'Resumo privado.');
  assert.equal(requests.length, 4);

  // Missing access with a service account must explain which identity needs sharing.
  global.fetch = async url => url === 'https://oauth2.googleapis.com/token'
    ? { ok: true, json: async () => ({ access_token: 'service-token' }) }
    : { ok: false, status: 404, json: async () => ({ error: { errors: [{ reason: 'notFound' }] } }) };
  await assert.rejects(fetchDriveLessonSummary(lesson), /HTTP 404.*client_email/);
});
