const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(fullPath) : [fullPath];
  });
}

test('Vercel deployment stays strictly below the Hobby function limit', () => {
  const functions = filesUnder('api').filter(file => file.endsWith('.js'));
  assert.ok(functions.length < 12, `expected fewer than 12 functions, found ${functions.length}: ${functions.join(', ')}`);
  assert.equal(functions.length, 11);
});

test('frontend uses only the consolidated plan and activity routes', () => {
  const source = fs.readFileSync('public/js/app.js', 'utf8');
  for (const obsoleteRoute of ['/api/generate-plan', '/api/generate-macro-plan', '/api/progress', '/api/performance']) {
    assert.doesNotMatch(source, new RegExp(obsoleteRoute), obsoleteRoute);
  }
  assert.match(source, /\/api\/plans\?kind=(daily|macro)/);
  assert.match(source, /\/api\/activity\?resource=(progress|performance)/);
});
