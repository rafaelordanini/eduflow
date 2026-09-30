const test = require('node:test');
const assert = require('node:assert/strict');
const { deduplicateCurriculumLessons, deduplicateLessons, driveFileId, resolvePlanLessonAliases } = require('../lib/lesson-deduplication');

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

test('preserves different videos with the same position during reordering', () => {
    const lessons = [
        { id: 20, title: 'Panorama geral período colonial', drive_url: 'https://drive.google.com/file/d/old-import/view', duration_minutes: 180, order_index: 1 },
        { id: 10, title: 'M1A1 - PERÍODO COLONIAL', drive_url: 'https://drive.google.com/file/d/curated/view', duration_minutes: 0, order_index: 1 },
    ];

    assert.deepEqual(deduplicateLessons(lessons).map((lesson) => lesson.id), [20, 10]);
});

test('does not merge lessons without a recognizable Drive file id', () => {
    const lessons = [
        { id: 1, drive_url: '', order_index: 1 },
        { id: 2, drive_url: '', order_index: 2 },
    ];
    assert.equal(deduplicateLessons(lessons).length, 2);
});

test('deduplicates each subject independently', () => {
    const lessons = [
        { id: 1, subject_id: 10, title: 'M1A1', order_index: 1, drive_url: '/file/d/video/view' },
        { id: 2, subject_id: 10, title: 'Old lesson', order_index: 9, drive_url: '/file/d/video/preview' },
        { id: 3, subject_id: 20, title: 'M1A1', order_index: 1, drive_url: '/file/d/video/view' },
    ];

    assert.deepEqual(deduplicateCurriculumLessons(lessons).map((lesson) => lesson.id), [1, 3]);
});

test('URL variants resolve to the same video and archived aliases stay hidden', () => {
    const lessons = [
        { id: 1, title: 'M1A1', drive_url: 'https://drive.google.com/open?id=video_file_id_12345', order_index: 1 },
        { id: 2, title: 'aula1', drive_url: 'video_file_id_12345', order_index: 5 },
        { id: 3, title: 'Archived copy', duplicate_of_id: 1, order_index: 3 },
    ];
    assert.deepEqual(deduplicateLessons(lessons).map(l => l.id), [1]);
});

test('aliases retain plan completions, review links and seen snapshots without mutating the source', () => {
    const plan = { aulasVistas: ['99', '11'], semanas: [{ materias: [
        { id: 'lesson-99', lesson_id: 99, tipo: 'estudo', done: true },
        { id: 'review-99-d7', lesson_id: 99, review_of_id: 'lesson-99', tipo: 'revisao', done: true },
    ] }] };
    const result = resolvePlanLessonAliases(plan, [{ id: 99, duplicate_of_id: 11 }]);
    assert.deepEqual(result.aulasVistas, ['11']);
    assert.equal(result.semanas[0].materias[0].id, 'lesson-11');
    assert.equal(result.semanas[0].materias[0].done, true);
    assert.equal(result.semanas[0].materias[1].id, 'review-11-d7');
    assert.equal(result.semanas[0].materias[1].review_of_id, 'lesson-11');
    assert.equal(plan.semanas[0].materias[0].lesson_id, 99);
});
