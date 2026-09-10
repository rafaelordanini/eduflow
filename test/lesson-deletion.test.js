const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('student lesson rows expose an accessible permanent-delete action', () => {
  const app = fs.readFileSync('public/js/app.js', 'utf8');

  assert.match(app, /title="Excluir aula permanentemente"/);
  assert.match(app, /event\.stopPropagation\(\);handleDeleteLessonApi/);
  assert.match(app, /Esta ação não pode ser desfeita/);
});

test('lessons API returns all stored rows and permits authenticated deletion', () => {
  const endpoint = fs.readFileSync('api/lessons/index.js', 'utf8');

  assert.doesNotMatch(endpoint, /deduplicateLessons\(data\)/);
  assert.match(endpoint, /if \(req\.method === 'DELETE'\)[\s\S]*?requireAuth\(req, res\)/);
});

