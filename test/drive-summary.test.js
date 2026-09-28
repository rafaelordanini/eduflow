const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractDriveFileId,
  lessonNumber,
  summaryFilenames,
  fetchDriveLessonSummary,
  readServiceAccount
} = require('../lib/drive-summary');

test('derives the sibling summary name from the Drive video and lesson order', () => {
  assert.equal(extractDriveFileId('https://drive.google.com/file/d/video-123/view'), 'video-123');
  assert.equal(lessonNumber(102), 2);
  assert.deepEqual(summaryFilenames({ title: 'aula2', order_index: 102 }, 'aula2.mp4'), ['aula2_resumo.txt']);
});

test('finds and downloads a summary in the same Google Drive folder', async t => {
  const previousFetch = global.fetch;
  t.after(() => { global.fetch = previousFetch; });
  const requests = [];
  global.fetch = async url => {
    requests.push(url);
    if (requests.length === 1) return {
      ok: true,
      json: async () => ({ name: 'aula2.mp4', parents: ['module-folder'] })
    };
    if (requests.length === 2) return {
      ok: true,
      json: async () => ({ files: [{ id: 'summary-123', name: 'aula2_resumo.txt' }] })
    };
    return { ok: true, text: async () => 'Resumo da aula 2.' };
  };

  const summary = await fetchDriveLessonSummary({
    title: 'aula2', order_index: 2,
    drive_url: 'https://drive.google.com/file/d/video-123/view'
  }, 'api-key');

  assert.equal(summary, 'Resumo da aula 2.');
  assert.equal(requests.length, 3);
  assert.match(decodeURIComponent(requests[1]), /'module-folder' in parents/);
  assert.match(requests[2], /summary-123.*alt=media/);
});

test('accesses publicly shared Drive files with an API key', async t => {
  const previousFetch = global.fetch;
  t.after(() => { global.fetch = previousFetch; });
  const requests = [];
  global.fetch = async url => {
    requests.push(url);
    if (requests.length === 1) return { ok: true, json: async () => ({ name: 'aula4.mp4', parents: ['public-folder'] }) };
    if (requests.length === 2) return { ok: true, json: async () => ({ files: [{ id: 'public-summary', name: 'aula4_resumo.txt' }] }) };
    return { ok: true, text: async () => 'Resumo público.' };
  };
  const summary = await fetchDriveLessonSummary({
    title: 'aula4', order_index: 4,
    drive_url: 'https://drive.google.com/file/d/public-video/view'
  }, 'public-api-key');
  assert.equal(summary, 'Resumo público.');
  assert.ok(requests.every(url => url.includes('key=public-api-key')));
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
