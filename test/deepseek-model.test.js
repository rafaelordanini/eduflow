const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const modelConsumers = [
  'api/analyze-lesson/index.js',
  'api/baron-chat/index.js',
  'api/generate-plan/index.js',
  'api/questions/index.js',
  'api/simulado/index.js',
  'scripts/ai-review-all-question-classifications.js',
  'scripts/generate-exams-sql.js',
  'scripts/import-all-exams.js',
  'scripts/ingest-exam-questions.js',
  'scripts/process-year.js',
  'scripts/process_geography_lesson.py',
];

test('every DeepSeek consumer is locked to V4.1 Flash', () => {
  for (const file of modelConsumers) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /deepseek-v4\.1-flash/, file);
    assert.doesNotMatch(source, /process\.env\.DEEPSEEK_MODEL|os\.environ\.get\(["']DEEPSEEK_MODEL/, file);
  }
});

test('question generation uses economical DeepSeek Chat without reasoning output', () => {
  const source = fs.readFileSync('api/generate-questions/index.js', 'utf8');
  assert.match(source, /DEEPSEEK_MODEL = 'deepseek-chat'/);
  assert.doesNotMatch(source, /deepseek-reasoner|thinking/);
});

test('automation workflows cannot override V4.1 Flash', () => {
  for (const file of [
    '.github/workflows/deepseek-question-audit.yml',
    '.github/workflows/process-geography-lesson.yml',
  ]) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /DEEPSEEK_MODEL: deepseek-v4\.1-flash/, file);
    assert.doesNotMatch(source, /inputs\.model|vars\.DEEPSEEK_MODEL/, file);
  }
});
