/*
  An independent School's Principal asking a Governing Body to take it in (backend
  261a9c7, governing-body ticket 08; owner 2026-10-26, F1-F6), kept out of the markup so
  it can be tested.

  `/users/me` does not say whether the School is a body's (asked of David), and the
  School's requests (`GET /school/affiliation-requests`, newest first) cannot say it
  either: a School let go by its body keeps its APPROVED request (walked 2026-10-26,
  Bintang Jaya). So only a refusal "already belongs" met on this visit (`governed`)
  makes the card say the School is a body's; an approved request is told as what it
  was, beside the form.
*/

/**
 * What the card shows: 'MEMBER' (known to be under a body: the 409 met here), 'WAITING'
 * (cancellable), or 'OPEN' (the form) - after a rejection with its reason, or with the
 * newest approval as history (`approved`).
 */
export function affiliationStateOf(requests, { governed = false } = {}) {
  const newest = (Array.isArray(requests) ? requests : [])[0] ?? null;
  if (governed) return { state: 'MEMBER', request: null };
  if (newest?.status === 'PENDING') return { state: 'WAITING', request: newest };
  if (newest?.status === 'REJECTED') return { state: 'OPEN', request: newest, rejected: true, approved: false };
  if (newest?.status === 'APPROVED') return { state: 'OPEN', request: newest, rejected: false, approved: true };
  return { state: 'OPEN', request: null, rejected: false, approved: false };
}
