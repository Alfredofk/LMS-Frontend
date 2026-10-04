/*
  Small decisions for showing a meeting's content (contentService), kept out of
  the drawer so they can be tested.
*/

/* What a browser shows in a tab; the rest is saved under its own name
   (the backend's INLINE_TYPES in content.service.js says the same). */
const INLINE = new Set(['pdf', 'jpg', 'png']);
export const opensInTab = (fileType) => INLINE.has(String(fileType ?? '').toLowerCase());
export const isImage = (fileType) => ['jpg', 'png'].includes(String(fileType ?? '').toLowerCase());

/** 1536 → "1,5 KB" / "1.5 KB": bytes in the reader's language. */
export function fileSize(bytes, lang = 'id') {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '';
  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toLocaleString(locale, { maximumFractionDigits: 1 })} KB`;
  return `${(kb / 1024).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`;
}

/**
 * The privacy-enhanced player for a YouTube video the server already parsed
 * (videoPayload: an 11-character id), or null for anything else. `origin` (the
 * page's own) turns on the IFrame API, so a student's progress can be read.
 */
export function youtubeEmbed(payload, { origin } = {}) {
  if (payload?.provider !== 'YOUTUBE' || !/^[A-Za-z0-9_-]{11}$/.test(payload.videoId ?? '')) return null;
  const api = origin ? `&enablejsapi=1&origin=${encodeURIComponent(origin)}` : '';
  return `https://www.youtube-nocookie.com/embed/${payload.videoId}?rel=0${api}`;
}

/** "https://www.example.com/a/b" → "example.com"; the raw text when it is no URL. */
export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return String(url ?? '');
  }
}

/** Only an https or http link is opened; anything else is shown, not followed. */
export const isWebLink = (url) => /^https?:\/\//i.test(String(url ?? ''));
