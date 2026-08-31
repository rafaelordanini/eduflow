function driveFileId(lesson) {
    const urls = [lesson && lesson.drive_url, lesson && lesson.embed_url];
    for (const url of urls) {
        const match = String(url || '').match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
        if (match) return match[1];
    }
    return '';
}

function lessonQuality(lesson) {
    // The lessons whose titles start with "M" are the curated catalogue. This
    // preference must outweigh metadata such as duration on an old import.
    let score = /^M/i.test(String(lesson.title || '').trim()) ? 100 : 0;
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
        const fileId = driveFileId(lesson);
        const orderIndex = Number(lesson && lesson.order_index);
        // The two import processes used different Drive links in some rows, but
        // assigned the same subject order. Since this function receives lessons
        // for one subject, order_index is the reliable fallback identity.
        const keys = [];
        if (Number.isFinite(orderIndex)) keys.push(`order:${orderIndex}`);
        if (fileId) keys.push(`drive:${fileId}`);
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

module.exports = { deduplicateLessons, driveFileId };
