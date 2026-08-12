const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const appSource = readFileSync('public/js/app.js', 'utf8');
const tipsBlock = appSource.match(/var BARON_TIPS = \[([\s\S]*?)\n\];/);

test('Barão offers a varied bank of concise, evidence-based tips', () => {
  assert.ok(tipsBlock, 'BARON_TIPS should be declared in app.js');

  const tips = [...tipsBlock[1].matchAll(/^\s*'(.+)',?$/gm)].map((match) => match[1]);

  assert.ok(tips.length >= 30 && tips.length <= 50, `expected 30–50 tips, found ${tips.length}`);
  assert.equal(new Set(tips).size, tips.length, 'tips should not be duplicated');
  assert.ok(tips.every((tip) => tip.length <= 140), 'tips should fit comfortably in the speech bubble');
  assert.doesNotMatch(tips.join('\n'), /pelo menos 4h|Rezek|Cervo & Bueno/);
});
