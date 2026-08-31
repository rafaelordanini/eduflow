const test = require('node:test');
const assert = require('node:assert/strict');
const { deduplicateLessons, driveFileId } = require('../lib/lesson-deduplication');

test('extracts the same Drive id from view and preview URLs', () => {
    assert.equal(driveFileId({ drive_url: 'https://drive.google.com/file/d/video_123/view' }), 'video_123');
    assert.equal(driveFileId({ embed_url: 'https://drive.google.com/file/d/video_123/preview' }), 'video_123');
});

test('removes duplicate imports and preserves the curated lesson', () => {
    const lessons = [
        { id: 20, title: 'Panorama geral periodo colonial', drive_url: 'https://drive.google.com/file/d/abc/view', duration_minutes: 0, order_index: 1 },
        { id: 10, title: 'M1A1 - PERÍODO COLONIAL', embed_url: 'https://drive.google.com/file/d/abc/preview', duration_minutes: 135, order_index: 1 },
        { id: 30, title: 'M1A2 - O Bandeirantismo', drive_url: 'https://drive.google.com/file/d/def/view', duration_minutes: 130, order_index: 2 },
    ];

    assert.deepEqual(deduplicateLessons(lessons).map((lesson) => lesson.id), [10, 30]);
});

test('merges the same order even with different Drive ids and always prefers a title starting with M', () => {
    const lessons = [
        { id: 20, title: 'Panorama geral período colonial', drive_url: 'https://drive.google.com/file/d/old-import/view', duration_minutes: 180, order_index: 1 },
        { id: 10, title: 'M1A1 - PERÍODO COLONIAL', drive_url: 'https://drive.google.com/file/d/curated/view', duration_minutes: 0, order_index: 1 },
    ];

    assert.deepEqual(deduplicateLessons(lessons).map((lesson) => lesson.id), [10]);
});

test('does not merge lessons without a recognizable Drive file id', () => {
    const lessons = [
        { id: 1, drive_url: '', order_index: 1 },
        { id: 2, drive_url: '', order_index: 2 },
    ];
    assert.equal(deduplicateLessons(lessons).length, 2);
});
