import { GOVERNING_BODY_KINDS } from '../GoverningBody/governingBody';
import { normaliseNpyp, npypError } from '../Role/bodyRegistration';

/*
  What the platform admin's Governing Body review decides (backend b5cfffd), kept out
  of the markup so it can be tested. The rules restate governingBody.schema.js and
  governingBody.service.js:

  - a reason for rejecting or switching off: 3-500 after trimming
    (`assertRejectionReason`); the note for restoring is optional, at most 500
    (`decisionBody`);
  - a correction (`editBody`): a name of 2-150, a kind of the three, an SK number of
    5-100 compared trimmed, spaces collapsed, in capitals, and since backend c79b56f
    (ticket 04b) an NPYP of six letters and digits; a foundation or an association
    has an NPYP and an SK number only if it has one, a government body neither
    (`updateGoverningBody`); at least one changed. An NPYP once held is never
    cleared; a body from before 04b with none may stay without, until one is added.
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

/** Whether a kind carries the numbers - an NPYP, and an SK number if it has one: every kind but a government body. */
export const takesSk = (kind) => kind !== 'GOVERNMENT';

/** The correction form, filled from a body. */
export const correctionFormOf = (body) => ({
  name: body?.name ?? '',
  kind: body?.kind ?? 'FOUNDATION',
  npyp: body?.npyp ?? '',
  skNumber: body?.skNumber ?? '',
});

/**
 * Whether the correction must carry an NPYP (the service's rule): a foundation or an
 * association that held one, or that was a government body. One from before c79b56f
 * with none keeps working without.
 */
export const npypRequiredOf = (body, kind) => takesSk(kind) && Boolean(body?.npyp || body?.kind === 'GOVERNMENT');

/** Field -> dictionary key of what is wrong with the correction form; empty when nothing is. */
export function correctionErrorsOf(form, body) {
  const errors = {};
  const name = String(form?.name ?? '').trim();
  if (name.length < 2) errors.name = 'gbr.edit.error.nameShort';
  else if (name.length > 150) errors.name = 'gbr.edit.error.nameLong';
  if (!GOVERNING_BODY_KINDS.includes(form?.kind)) errors.kind = 'gbr.edit.error.kind';
  if (takesSk(form?.kind)) {
    const npyp = npypError(form?.npyp, { required: npypRequiredOf(body, form.kind) });
    if (npyp) errors.npyp = npyp.key === 'gbreg.npyp.required' ? 'gbr.edit.npypRequired' : npyp.key;
    const sk = normaliseSk(form?.skNumber);
    if (sk && sk.length < 5) errors.skNumber = 'gbr.edit.error.skShort';
    else if (sk.length > 100) errors.skNumber = 'gbr.edit.error.skLong';
  }
  return errors;
}

/**
 * The PATCH body for a correction: only what changed. An emptied SK number goes as
 * `null` (removed); a government body's numbers go as `null` both; numbers typed for
 * one are ignored. Null when nothing changed - the server refuses an empty patch.
 */
export function correctionPatchOf(body, form) {
  const patch = {};
  const name = String(form?.name ?? '').trim();
  if (name !== body?.name) patch.name = name;
  if (form?.kind !== body?.kind) patch.kind = form.kind;
  const npyp = takesSk(form?.kind) ? normaliseNpyp(form?.npyp) || null : null;
  if (npyp !== (body?.npyp ?? null)) patch.npyp = npyp;
  const sk = takesSk(form?.kind) ? normaliseSk(form?.skNumber) || null : null;
  if (sk !== (body?.skNumber ?? null)) patch.skNumber = sk;
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Whether an approved registration's body is switched off. */
export const isBodyOff = (registration) => Boolean(registration?.governingBody?.deactivatedAt);

/*
  A body's admins, for the Platform Admin (backend 8aff4f4, `GET /admin/governing-
  bodies/:id/admins`, the senior first): the brake removes any sitting admin, the
  senior or the last included, and the Platform Admin decides the applications only
  while nobody sits (`assertNoSittingAdmin`, 409 otherwise).
*/

/** Whether the Platform Admin decides the applications: only while the body has no admin. */
export const decidesApplications = (admins) => Array.isArray(admins) && admins.length === 0;

/**
 * What removing this seat leaves, for the question: 'LAST' when the body is then left
 * with no admin, 'SENIOR' with `next` when the senior goes and the next becomes
 * senior, otherwise null.
 */
export function removalNoteOf(admins, seatId) {
  const list = Array.isArray(admins) ? admins : [];
  const seat = list.find((admin) => admin.id === seatId);
  if (!seat) return null;
  const others = list.filter((admin) => admin.id !== seatId);
  if (others.length === 0) return { state: 'LAST' };
  if (seat.senior) return { state: 'SENIOR', next: others[0] };
  return null;
}
