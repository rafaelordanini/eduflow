function driveFileId(lesson) {
    const urls = [lesson && lesson.drive_url, lesson && lesson.embed_url];
    for (const url of urls) {
        const match = String(url || '').trim().match(/\/file\/d\/([a-zA-Z0-9_-]+)|[?&]id=([a-zA-Z0-9_-]+)|^([a-zA-Z0-9_-]{15,})$/);
        if (match) return match[1] || match[2] || match[3];
    }
    return '';
}

function lessonQuality(lesson) {
    // The lessons whose titles start with "M" are the curated catalogue. This
    // preference must outweigh metadata such as duration on an old import.
    let score = /^M\d+A\d+/i.test(String(lesson.title || '').trim()) ? 100 : 0;
    if (Number(lesson.duration_minutes) > 0) score += 1;
    return score;
}

/**
 * Keeps one database row for each Google Drive video. Older imports can have
 * different titles and order indexes for the same file, so title comparison is
 * not sufficient. The richer, curated row wins when one is available.
 */
function deduplicateLessons(lessons) {
    const positions = new Map();
    const result = [];

    for (const lesson of lessons || []) {
        if (lesson.duplicate_of_id != null) continue;
        const fileId = driveFileId(lesson);
        // Position is mutable: only the actual video identifies a duplicate.
        const keys = fileId ? [`drive:${fileId}`] : [];
        if (keys.length === 0) {
            result.push(lesson);
            continue;
        }

        const position = keys.reduce((found, key) => (
            found === undefined ? positions.get(key) : found
        ), undefined);
        if (position === undefined) {
            keys.forEach((key) => positions.set(key, result.length));
            result.push(lesson);
        } else if (lessonQuality(lesson) > lessonQuality(result[position])) {
            result[position] = lesson;
        }
        keys.forEach((key) => positions.set(key, position === undefined ? result.length - 1 : position));
    }

    return result.sort((a, b) => Number(a.order_index) - Number(b.order_index));
}

function deduplicateCurriculumLessons(lessons) {
    const bySubject = new Map();

    for (const lesson of lessons || []) {
        const subjectId = String(lesson && lesson.subject_id);
        if (!bySubject.has(subjectId)) bySubject.set(subjectId, []);
        bySubject.get(subjectId).push(lesson);
    }

    return Array.from(bySubject.values()).flatMap(deduplicateLessons);
}

// Preserve historical plan completions and seen-lesson snapshots when an old
// imported row has been archived in favour of its curated counterpart.
function resolvePlanLessonAliases(plan, lessons) {
    if (!plan) return plan;
    const aliases = new Map((lessons || []).filter(l => l.duplicate_of_id != null)
        .map(l => [String(l.id), l.duplicate_of_id]));
    if (!aliases.size) return plan;
    const copy = JSON.parse(JSON.stringify(plan));
    const resolve = id => aliases.get(String(id)) || id;
    if (Array.isArray(copy.aulasVistas)) {
        copy.aulasVistas = Array.from(new Set(copy.aulasVistas.map(id => String(resolve(id)))));
    }
    (copy.semanas || []).forEach(week => (week.materias || []).forEach(item => {
        const oldId = item.lesson_id;
        const id = resolve(oldId);
        if (id === oldId) return;
        item.lesson_id = id;
        if (item.id === 'lesson-' + oldId) item.id = 'lesson-' + id;
        if (String(item.id || '').startsWith('review-' + oldId + '-')) {
            item.id = item.id.replace('review-' + oldId + '-', 'review-' + id + '-');
        }
        if (item.review_of_id === 'lesson-' + oldId) item.review_of_id = 'lesson-' + id;
    }));
    return copy;
}

module.exports = { deduplicateCurriculumLessons, deduplicateLessons, driveFileId, resolvePlanLessonAliases };
