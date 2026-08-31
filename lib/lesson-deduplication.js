function driveFileId(lesson) {
    const urls = [lesson && lesson.drive_url, lesson && lesson.embed_url];
    for (const url of urls) {
        const match = String(url || '').match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match) return match[1];
    }
    return '';
}

function lessonQuality(lesson) {
    let score = Number(lesson.duration_minutes) > 0 ? 2 : 0;
    if (/^M\d+A\d+\b/i.test(String(lesson.title || ''))) score += 1;
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
        const fileId = driveFileId(lesson);
        if (!fileId) {
            result.push(lesson);
            continue;
        }

        const position = positions.get(fileId);
        if (position === undefined) {
            positions.set(fileId, result.length);
            result.push(lesson);
        } else if (lessonQuality(lesson) > lessonQuality(result[position])) {
            result[position] = lesson;
        }
    }

    return result.sort((a, b) => Number(a.order_index) - Number(b.order_index));
}

module.exports = { deduplicateLessons, driveFileId };
