// Embed helpers. Pure — framework-free, testable.

/** Extract an 11-char YouTube video id from common URL shapes, else null. */
export function youtubeId(url) {
  const match = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/.exec(
    url || '',
  );
  return match ? match[1] : null;
}
