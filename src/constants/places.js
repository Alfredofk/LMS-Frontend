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

  The owner's choices: this device remembers the last school per account and opens
  it by itself; otherwise "Pilih sekolah" (/choose-school) asks. Pure, but for the
  remembered school, which lives in localStorage like the language - a preference
  of the machine, not of the sign-in.
*/

const LAST_SCHOOL_KEY = 'lms_last_school:';

/** The school this device last opened for this account, or null. */
export function rememberedSchoolOf(userId) {
  if (!userId) return null;
  try {
    return localStorage.getItem(LAST_SCHOOL_KEY + userId);
  } catch {
    return null;
  }
}

/** Remember the school a sign-in opened, for the next sign-in on this device. */
export function rememberSchool(userId, schoolId) {
  if (!userId || !schoolId) return;
  try {
    localStorage.setItem(LAST_SCHOOL_KEY + userId, schoolId);
  } catch {
    /* Storage unavailable: the next sign-in asks again. */
  }
}

/** The school id a membership is for, in either shape (sign-in's `schoolId`, /users/me's `school.id`). */
export const schoolIdOf = (membership) => membership?.schoolId ?? membership?.school?.id ?? null;

/** Whether a sign-in opened no school while several may be opened: the person has to choose. */
export const needsPlaceChoice = (answer) => !answer?.membership && (answer?.places?.length ?? 0) > 1;

/** The remembered school when it may still be opened, else null (then the person chooses). */
export const placeToOpen = (places, remembered) => (remembered && (places ?? []).some((place) => place.id === remembered) ? remembered : null);

/** A school's roles in the app's order of precedence (Kepala Sekolah first), for showing. */
export const placeRolesOf = (place) => ROLE_PRIORITY.filter((role) => (place?.roles ?? []).includes(role));

/** The schools to offer a switch to: every place but the one open now. */
export const otherPlacesOf = (places, currentSchoolId) => (places ?? []).filter((place) => place.id !== currentSchoolId);

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
