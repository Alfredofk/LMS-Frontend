/*
  The report card's letterhead (backend 4dae152, grading-and-report-card ticket 10;
  owner 2026-10-22): the school's address and phone, and its logo, set by the
  Principal on Settings ("Kop rapor", LetterheadCard). Every report card closed from
  then on carries them; one closed before keeps what it was closed with. Pure.

  `/users/me` reads it back to the Principal as `membership.school.letterhead:
  { address | null, phone | null, hasLogo }` (null for anybody else).
*/

/** The backend's caps (school.schema.js letterheadBody), counted after trimming. */
export const ADDRESS_MAX = 300;
export const PHONE_MAX = 30;

/** The logo's rules (school.routes.js logoUpload, school.letterhead.js MAX_LOGO_SIDE). */
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_MAX_SIDE = 2000;
const LOGO_TYPES = ['image/jpeg', 'image/png'];

/** The form, filled from what is saved. */
export const letterheadDraftOf = (letterhead) => ({ address: letterhead?.address ?? '', phone: letterhead?.phone ?? '' });

/** `{ address?, phone? }` - keys, or `{}`. An empty box is no error: it clears that line. */
export function letterheadErrors(draft) {
  const errors = {};
  if (draft.address.trim().length > ADDRESS_MAX) errors.address = 'kop.error.addressLong';
  if (draft.phone.trim().length > PHONE_MAX) errors.phone = 'kop.error.phoneLong';
  return errors;
}

/** The PATCH body: only what changed, trimmed, an emptied one as null; null when nothing did. */
export function letterheadBody(letterhead, draft) {
  const body = {};
  for (const key of ['address', 'phone']) {
    const next = draft[key].trim() || null;
    if (next !== (letterhead?.[key] ?? null)) body[key] = next;
  }
  return Object.keys(body).length ? body : null;
}

/**
 * Why a picked file cannot be the logo, as a key - checked before it is sent, the
 * server checking again: a JPG or PNG, at most 2 MB. Its pixels are checked apart,
 * once the browser has read them (`logoSizeError`).
 */
export function logoFileError(file) {
  if (!file) return null;
  if (!LOGO_TYPES.includes(file.type)) return 'kop.error.logoType';
  if (file.size > LOGO_MAX_BYTES) return 'kop.error.logoBig';
  return null;
}

/** A logo wider or taller than 2000 pixels, read from the decoded image. */
export const logoSizeError = (width, height) => (width > LOGO_MAX_SIDE || height > LOGO_MAX_SIDE ? 'kop.error.logoPixels' : null);
