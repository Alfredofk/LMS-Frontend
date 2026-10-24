/*
  Asking to be a Governing Body's admin through its code (backend 3d7d05a,
  governing-body ticket 04), kept out of the markup so it can be tested.

  The code is the School Code's shape (governingBody.schema.js `code`): 8 of
  [A-Z2-9], typed from a WhatsApp message, so trimmed and put in capitals first.

  A seat (`GET /governing-body-applications/mine`, newest first) is PENDING, then
  ACTIVE or REJECTED, or CANCELLED by its applicant; an ACTIVE one ends LEFT, with an
  `endReason` when the senior or a Platform Admin removed it. The lookup names a body
  by `{ name, kind }` only - no id - so the seats are told apart by those two.
*/

const BODY_CODE_PATTERN = /^[A-Z2-9]{8}$/;

export const normaliseBodyCode = (value) => String(value ?? '').trim().toUpperCase();

/** What is wrong with a typed Governing Body Code, as `{ key }`, or null. */
export function validateBodyCode(value) {
  const code = normaliseBodyCode(value);
  if (!code) return { key: 'gbapp.code.required' };
  if (!BODY_CODE_PATTERN.test(code)) return { key: 'gbapp.code.format' };
  return null;
}

/**
 * One line per body, from its newest seat: 'WAITING' (cancellable), 'REJECTED' with
 * the senior's reason, or 'REMOVED' with the reason the seat ended. An admin seat
 * held now is a place, and a cancelled application or a plain leave says nothing.
 */
export function seatLinesOf(seats) {
  const seen = new Set();
  const lines = [];
  for (const seat of Array.isArray(seats) ? seats : []) {
    const body = seat.governingBody ?? {};
    const key = `${body.kind}:${body.name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const line = { id: seat.id, name: body.name ?? '' };
    if (seat.status === 'PENDING') lines.push({ ...line, state: 'WAITING' });
    else if (seat.status === 'REJECTED') lines.push({ ...line, state: 'REJECTED', reason: seat.rejectionReason ?? null });
    else if (seat.status === 'LEFT' && seat.endReason) lines.push({ ...line, state: 'REMOVED', reason: seat.endReason });
  }
  return lines;
}
