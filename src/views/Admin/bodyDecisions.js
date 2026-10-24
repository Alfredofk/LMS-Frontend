import { GOVERNING_BODY_KINDS } from '../GoverningBody/governingBody';

/*
  What the platform admin's Governing Body review decides (backend b5cfffd), kept out
  of the markup so it can be tested. The rules restate governingBody.schema.js and
  governingBody.service.js:

  - a reason for rejecting or switching off: 3-500 after trimming
    (`assertRejectionReason`); the note for restoring is optional, at most 500
    (`decisionBody`);
  - a correction (`editBody`): a name of 2-150, a kind of the three, an SK number of
    5-100 compared trimmed, spaces collapsed, in capitals - required for a
    foundation or an association, none for a government body
    (`updateGoverningBody`); at least one of the three changed.
*/

export const MIN_REASON = 3;
export const MAX_REASON = 500;

/** The dictionary key of what is wrong with a reason, or null. `kind`: 'reject' | 'deactivate' | 'reactivate'. */
export function reasonErrorOf(kind, reason) {
  const trimmed = String(reason ?? '').trim();
  if (trimmed.length > MAX_REASON) return 'gbr.reason.long';
  if (kind === 'reactivate') return null;
  if (trimmed.length < MIN_REASON) return kind === 'deactivate' ? 'gbr.deactivate.reason.required' : 'gbr.reject.reason.required';
  return null;
}

/** An SK number as the server keeps it: trimmed, spaces collapsed, in capitals. */
export const normaliseSk = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();

/** Whether a kind carries a Kemenkumham SK number: every kind but a government body. */
export const takesSk = (kind) => kind !== 'GOVERNMENT';

/** The correction form, filled from a body. */
export const correctionFormOf = (body) => ({ name: body?.name ?? '', kind: body?.kind ?? 'FOUNDATION', skNumber: body?.skNumber ?? '' });

/** Field -> dictionary key of what is wrong with the correction form; empty when nothing is. */
export function correctionErrorsOf(form) {
  const errors = {};
  const name = String(form?.name ?? '').trim();
  if (name.length < 2) errors.name = 'gbr.edit.error.nameShort';
  else if (name.length > 150) errors.name = 'gbr.edit.error.nameLong';
  if (!GOVERNING_BODY_KINDS.includes(form?.kind)) errors.kind = 'gbr.edit.error.kind';
  if (takesSk(form?.kind)) {
    const sk = normaliseSk(form?.skNumber);
    if (!sk) errors.skNumber = 'gbr.edit.skRequired';
    else if (sk.length < 5) errors.skNumber = 'gbr.edit.error.skShort';
    else if (sk.length > 100) errors.skNumber = 'gbr.edit.error.skLong';
  }
  return errors;
}

/**
 * The PATCH body for a correction: only what changed. A government body's number
 * goes as `null` (removed); a number typed for one is ignored. Null when nothing
 * changed - the server refuses an empty patch.
 */
export function correctionPatchOf(body, form) {
  const patch = {};
  const name = String(form?.name ?? '').trim();
  if (name !== body?.name) patch.name = name;
  if (form?.kind !== body?.kind) patch.kind = form.kind;
  const sk = takesSk(form?.kind) ? normaliseSk(form?.skNumber) : null;
  if (sk !== (body?.skNumber ?? null)) patch.skNumber = sk;
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Whether an approved registration's body is switched off. */
export const isBodyOff = (registration) => Boolean(registration?.governingBody?.deactivatedAt);
