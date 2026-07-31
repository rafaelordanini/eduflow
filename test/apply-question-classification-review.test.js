const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { validateReview, assertSourceIntegrity, assertPreconditions } = require('../scripts/apply-question-classification-review');

const correction = { id: 1, expected: { subject: 'Economia', topic: '' }, reviewed: { subject: 'Economia', topic: 'Macroeconomia' } };

test('validates a review and normalizes empty topics', () => {
  const review = validateReview({ schema_version: 1, reviewed_count: 1, correction_count: 1, corrections: [structuredClone(correction)] });
  assert.equal(review.corrections[0].expected.topic, null);
});

test('rejects duplicate IDs', () => {
  assert.throws(() => validateReview({ schema_version: 1, reviewed_count: 2, correction_count: 2, corrections: [structuredClone(correction), structuredClone(correction)] }), /duplicado/);
});

test('aborts if database classification differs from the exported state', () => {
  const item = validateReview({ schema_version: 1, reviewed_count: 1, correction_count: 1, corrections: [structuredClone(correction)] }).corrections[0];
  assert.throws(() => assertPreconditions([item], new Map([[1, { id: 1, subject: 'Geografia', topic: null }]])), /abortada/);
  assert.doesNotThrow(() => assertPreconditions([item], new Map([[1, { id: 1, subject: 'Economia', topic: null }]])));
});

test('allows resuming when a correction was already applied', () => {
  const item = validateReview({ schema_version: 1, reviewed_count: 1, correction_count: 1, corrections: [structuredClone(correction)] }).corrections[0];
  const current = new Map([[1, { id: 1, ...item.reviewed }]]);
  assert.doesNotThrow(() => assertPreconditions([item], current));
});

test('checked-in review artifact is internally consistent', () => {
  const review = JSON.parse(fs.readFileSync('data/review/question-classification-corrections.json', 'utf8'));
  assert.doesNotThrow(() => validateReview(review));
  assert.equal(review.reviewed_count, 5620);
  assert.ok(review.corrections.length > 0);
});

test('rejects applying a global audit against a changed source export', () => {
  const crypto = require('node:crypto');
  const source = 'original export';
  const review = { source_sha256: crypto.createHash('sha256').update(source).digest('hex') };
  assert.doesNotThrow(() => assertSourceIntegrity(review, source));
  assert.throws(() => assertSourceIntegrity(review, 'changed export'), /CSV de origem mudou/);
});
