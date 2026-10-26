/*
  An independent School's Principal asking a Governing Body to take it in (backend
  261a9c7, governing-body ticket 08; owner 2026-10-26, F1-F6), kept out of the markup so
  it can be tested.

  Whether the School is a body's comes from `/users/me` since backend 227473f
  (`membership.school.governingBody: { name } | null`; owner 2026-10-26, D): one line
  naming the body, no form, no history. The School's requests cannot say it: a School let
  go by its body keeps its APPROVED request (walked 2026-10-26, Bintang Jaya), so an
  approved request is told as what it was, beside the form. A refusal "already belongs"
  met on this visit (`governed`) still says so, nameless, should the read be older.
*/

/**
 * What the card shows: 'MEMBER' (under a body: `bodyName` from /users/me, or null when
 * only the 409 met here said so), 'WAITING' (cancellable), or 'OPEN' (the form) - after
 * a rejection with its reason, or with the newest approval as history (`approved`).
 */
export function affiliationStateOf(requests, { governed = false, bodyName = null } = {}) {
  const newest = (Array.isArray(requests) ? requests : [])[0] ?? null;
  if (bodyName) return { state: 'MEMBER', request: null, bodyName };
  if (governed) return { state: 'MEMBER', request: null, bodyName: null };
  if (newest?.status === 'PENDING') return { state: 'WAITING', request: newest };
  if (newest?.status === 'REJECTED') return { state: 'OPEN', request: newest, rejected: true, approved: false };
  if (newest?.status === 'APPROVED') return { state: 'OPEN', request: newest, rejected: false, approved: true };
  return { state: 'OPEN', request: null, rejected: false, approved: false };
}
