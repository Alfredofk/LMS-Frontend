import { ROLES, ROLE_PRIORITY } from './roles';

/*
  Several schools per person (backend 72e546b, governing-body ticket 01; owner
  2026-10-22). One live membership per person per school, at any number of schools -
  a Student still holds one on the whole platform. Every sign-in is bound to one
  school: the answer of sign-in, refresh, `POST /auth/place` and `/users/me` carries
  `membership` (the token's school) and `places: [{ kind: 'SCHOOL', id, name,
  subdomain, roles }]` (every school the person may open); `/users/me` also
  `otherSchools` (the newest membership at each school they may not open: a request
  waiting, turned down or cancelled, an end, or an ACTIVE one at a school switched
  off). A sign-in with several places and none chosen opens none (`membership:
  null`) until `POST /auth/place`.

  A Governing Body seat is a Place too (backend b5cfffd, ticket 03): `{ kind:
  'GOVERNING_BODY', id, name, subdomain, roles: ['ADMIN'] }`, opened by
  `governingBodyId` where a school is by `schoolId`. A sign-in for it names no school
  (`membership: null`) and carries `governingBody` instead. So a place is told apart
  by its kind and its id together, and the open one is whichever of the two the
  session holds (`openPlaceOf`).

  The owner's choices: this device remembers the last place per account and opens
  it by itself; otherwise "Pilih sekolah" (/choose-school) asks. A body is listed
  among the schools with "Admin yayasan" under its name, and the words around the
  list say "sekolah atau yayasan" only while one is in it (owner, 2026-10-24). Pure,
  but for the remembered place, which lives in localStorage like the language - a
  preference of the machine, not of the sign-in.
*/

export const PLACE_KINDS = { SCHOOL: 'SCHOOL', GOVERNING_BODY: 'GOVERNING_BODY' };

/* The key kept its name: what it held before ticket 03 is still read (a bare school id). */
const LAST_PLACE_KEY = 'lms_last_school:';

/** Whether this place is a Governing Body seat rather than a school. */
export const isGoverningBody = (place) => place?.kind === PLACE_KINDS.GOVERNING_BODY;

/** Whether a list of places holds a Governing Body, which changes the words around it. */
export const hasGoverningBody = (places) => (places ?? []).some(isGoverningBody);

const kindOf = (place) => place?.kind ?? PLACE_KINDS.SCHOOL;

/** Whether two places are the same one: kind and id both. */
export const samePlace = (a, b) => Boolean(a?.id && b?.id) && kindOf(a) === kindOf(b) && a.id === b.id;

/** How `POST /auth/place` and `POST /auth/handoff` name a place: one of the two ids. */
export const placeRequestOf = (place) => (isGoverningBody(place) ? { governingBodyId: place.id } : { schoolId: place?.id });

/**
 * The place this device last opened for this account, `{ kind, id }`, or null. One
 * written before governing bodies existed is a bare school id, and reads as one.
 */
export function rememberedPlaceOf(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(LAST_PLACE_KEY + userId);
    if (!raw) return null;
    const cut = raw.indexOf(':');
    if (cut < 0) return { kind: PLACE_KINDS.SCHOOL, id: raw };
    return { kind: raw.slice(0, cut), id: raw.slice(cut + 1) };
  } catch {
    return null;
  }
}

/** Remember the place a sign-in opened, `{ kind, id }`, for the next sign-in on this device. */
export function rememberPlace(userId, place) {
  if (!userId || !place?.id) return;
  try {
    localStorage.setItem(LAST_PLACE_KEY + userId, `${kindOf(place)}:${place.id}`);
  } catch {
    /* Storage unavailable: the next sign-in asks again. */
  }
}

/** The school id a membership is for, in either shape (sign-in's `schoolId`, /users/me's `school.id`). */
export const schoolIdOf = (membership) => membership?.schoolId ?? membership?.school?.id ?? null;

/** The place a session has open, `{ kind, id }`: its school, else its Governing Body, else null. */
export function openPlaceOf({ membership, governingBody } = {}) {
  const schoolId = schoolIdOf(membership);
  if (schoolId) return { kind: PLACE_KINDS.SCHOOL, id: schoolId };
  if (governingBody?.id) return { kind: PLACE_KINDS.GOVERNING_BODY, id: governingBody.id };
  return null;
}

/** Whether a sign-in opened no place while several may be opened: the person has to choose. */
export const needsPlaceChoice = (answer) => !openPlaceOf(answer ?? {}) && (answer?.places?.length ?? 0) > 1;

/** The remembered place when it may still be opened, else null (then the person chooses). */
export const placeToOpen = (places, remembered) => (remembered && (places ?? []).some((place) => samePlace(place, remembered)) ? remembered : null);

/** A school's roles in the app's order of precedence (Kepala Sekolah first), for showing. A body's seat holds none of them. */
export const placeRolesOf = (place) => (isGoverningBody(place) ? [] : ROLE_PRIORITY.filter((role) => (place?.roles ?? []).includes(role)));

/** The dictionary keys of the line under a place's name: its roles, or "Admin yayasan" for a body. */
export const placeRoleKeysOf = (place) => (isGoverningBody(place) ? ['place.governingBodyAdmin'] : placeRolesOf(place).map((role) => `roleTitle.${role}`));

/** The places to offer a switch to: every place but the one open now (`{ kind, id }` or null). */
export const otherPlacesOf = (places, current) => (places ?? []).filter((place) => !samePlace(place, current));

const LIVE = ['PENDING', 'ACTIVE'];
const liveRoleNames = (membership) =>
  (membership?.roles ?? []).filter((entry) => typeof entry === 'string' || LIVE.includes(entry?.status)).map((entry) => (typeof entry === 'string' ? entry : entry.role));

/**
 * Whether this person may ask to join, or found, another school: not a Student, or
 * asking to be one, anywhere (membership.eligibility.js assertMayJoin - a student
 * belongs to one school only). A membership that has ended or was turned down holds
 * nothing.
 */
export function mayJoinAnother(membership, otherSchools) {
  const live = [membership, ...(otherSchools ?? [])].filter((row) => row && (row.status === undefined || LIVE.includes(row.status)));
  return !live.some((row) => liveRoleNames(row).includes(ROLES.STUDENT));
}

/**
 * One row of "Sekolah lain" per `otherSchools` entry: `{ id, schoolName, state,
 * reason, roles }`, state WAITING | REJECTED | CANCELLED | ENDED | SWITCHED_OFF,
 * `reason` the reviewer's words or the end's, `roles` the roles asked for or held.
 */
export function otherSchoolRows(otherSchools) {
  return (otherSchools ?? []).map((row) => {
    const roles = (row.roles ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.role));
    const rejected = (row.roles ?? []).find((entry) => entry?.status === 'REJECTED' && entry.rejectionReason);
    let state = 'ENDED';
    if (row.status === 'PENDING') state = 'WAITING';
    else if (row.status === 'REJECTED') state = 'REJECTED';
    else if (row.status === 'CANCELLED') state = 'CANCELLED';
    else if (row.status === 'ACTIVE') state = 'SWITCHED_OFF';
    const reason = state === 'REJECTED' ? (rejected?.rejectionReason ?? null) : state === 'ENDED' ? (row.endReason ?? null) : null;
    return { id: row.id, schoolName: row.school?.name ?? '', state, reason, roles };
  });
}

/** Every join request still waiting - the one /users/me names as `membership` and those at other schools - `{ id, schoolName }`. */
export function waitingRequestsOf(membership, otherSchools) {
  return [membership, ...(otherSchools ?? [])]
    .filter((row) => row?.status === 'PENDING' && row.id)
    .map((row) => ({ id: row.id, schoolName: row.school?.name ?? '' }));
}
