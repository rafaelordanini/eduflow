const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractDriveFileId,
  lessonNumber,
  summaryFilenames,
  fetchDriveLessonSummary
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

test('does not access Drive when no API key is configured', async () => {
  assert.equal(await fetchDriveLessonSummary({ drive_url: 'https://drive.google.com/file/d/video/view' }, ''), '');
});
