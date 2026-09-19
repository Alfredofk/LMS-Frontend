/**
 * The backend's role vocabulary, in one place.
 *
 * These names are the Prisma enum SchoolRole verbatim, uppercase and singular.
 * Nothing in this app may invent its own: a role arrives from the API as one of
 * these four strings and is compared as-is, never lowercased, never translated
 * into a word the server would not recognise.
 *
 * There is no `headmaster` here. The word is PRINCIPAL. The UI calls that role
 * "Organization" on screen, which is a label, not an identifier — see ROLE_LABEL.
 */

export const ROLES = {
  STUDENT: 'STUDENT',
  TEACHER: 'TEACHER',
  PRINCIPAL: 'PRINCIPAL',
  GUARDIAN: 'GUARDIAN',
};

/*
  The three this frontend has pages for, in the order the role picker shows them.
  GUARDIAN is deliberately absent: the backend grants it, but no screen here
  serves a guardian yet, so offering the card would promise something that does
  not exist. Somebody holding only GUARDIAN lands on /select-role with nothing
  they can pick.
*/
export const SELECTABLE_ROLES = [ROLES.STUDENT, ROLES.TEACHER, ROLES.PRINCIPAL];

/*
  Translation keys, not words. A role's name differs by more than spelling
  between the two languages: PRINCIPAL is the card that *registers a school*, so
  Indonesian reads it as "Sekolah" rather than a literal rendering of
  "Organization". Keeping keys here lets each dictionary say what the card means.
*/
export const ROLE_LABEL_KEY = {
  [ROLES.STUDENT]: 'role.STUDENT.label',
  [ROLES.TEACHER]: 'role.TEACHER.label',
  [ROLES.PRINCIPAL]: 'role.PRINCIPAL.label',
  [ROLES.GUARDIAN]: 'role.GUARDIAN.label',
};

/** The one-line pitch under each label on the role picker. */
export const ROLE_TAGLINE_KEY = {
  [ROLES.STUDENT]: 'role.STUDENT.tagline',
  [ROLES.TEACHER]: 'role.TEACHER.tagline',
  [ROLES.PRINCIPAL]: 'role.PRINCIPAL.tagline',
  [ROLES.GUARDIAN]: 'role.GUARDIAN.tagline',
};

/*
  Where each role lands after it is chosen.

  The principal's path still reads /headmaster/dashboard. That is a URL, not
  domain vocabulary, and renaming it touches routing and every link that points
  at it — a separate change from getting the role names right.
*/
export const ROLE_HOME = {
  [ROLES.STUDENT]: '/dashboard',
  [ROLES.TEACHER]: '/teacher/dashboard',
  [ROLES.PRINCIPAL]: '/headmaster/dashboard',
};

/**
 * The roles a person may actually enter with.
 *
 * Two shapes reach this. Sign-in sends `membership.roles` as plain strings and
 * includes only ACTIVE ones (auth.service.js buildAuthClaims). `GET /users/me`
 * sends objects carrying each role's own approval status, where PENDING and
 * REJECTED are both present and neither may be entered. Normalising here keeps
 * that difference out of every caller.
 *
 * @param {object|null} membership
 * @returns {string[]} role names that are usable right now
 */
export function activeRolesOf(membership) {
  if (!membership) return [];

  // A membership still awaiting approval carries no usable role, whatever its
  // rows say.
  if (membership.status && membership.status !== 'ACTIVE') return [];

  return (membership.roles ?? [])
    .map((entry) => (typeof entry === 'string' ? { role: entry, status: 'ACTIVE' } : entry))
    .filter((entry) => entry.status === 'ACTIVE')
    .map((entry) => entry.role)
    .filter((role) => role in ROLE_HOME);
}

/** Where to send somebody who holds these roles and has picked `activeRole`. */
export const homeFor = (role) => ROLE_HOME[role] ?? '/select-role';
