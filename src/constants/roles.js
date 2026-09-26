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
  The four the role picker shows, in that order.

  GUARDIAN used to be absent here, because no screen served a guardian. It now
  has both halves: /get-started/guardian asks for the child and files the
  request, and /guardian ("Anak Saya") is where an approved guardian lands.
*/
export const SELECTABLE_ROLES = [
  ROLES.STUDENT,
  ROLES.TEACHER,
  ROLES.GUARDIAN,
  ROLES.PRINCIPAL,
];

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
  /* "Anak Saya": the guardian's children and their links — all the backend
     sends a guardian today (/users/me children[]). */
  [ROLES.GUARDIAN]: '/guardian',
};

/**
 * Whether the school behind this membership has been switched off by a platform
 * admin.
 *
 * Only `/users/me` can say so — it reports `school.deactivatedAt` since backend
 * `60ea459`. Sign-in cannot: `buildAuthClaims` drops a deactivated school's
 * membership entirely, so the login shape arrives as `null` and never gets here.
 *
 * The membership itself stays ACTIVE, which is exactly why this has to be asked
 * separately: every role on it still reads ACTIVE while the token behind them
 * carries no school, and every tenant-scoped route answers 403.
 */
export const isSchoolDeactivated = (membership) => Boolean(membership?.school?.deactivatedAt);

/**
 * A membership that has ended — the person left, or was removed — or null.
 *
 * Since backend `7a91eaf` `/users/me` answers, when nothing live is left, the
 * most recent REJECTED, CANCELLED **or LEFT** membership. LEFT carries `endedAt`,
 * and `endReason` when somebody else ended it — the reason the Principal or
 * homeroom teacher typed, shown to the person as written — or null when they
 * left on their own.
 *
 * **Its role rows are history, not access.** The backend leaves them as they
 * were, so a LEFT membership can still list TEACHER as ACTIVE; `activeRolesOf`
 * ignores them because the membership itself is not ACTIVE, and so does this.
 *
 * @returns {{ school: string|null, since: string|null, reason: string|null }|null}
 */
export function endedMembership(membership) {
  if (membership?.status !== 'LEFT') return null;
  return {
    school: membership.school?.name ?? null,
    since: membership.endedAt ?? null,
    reason: membership.endReason ?? null,
  };
}

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

  // Nor does one at a school that has been switched off: its dashboards would
  // answer 403 on every call, and /select-role says why instead.
  if (isSchoolDeactivated(membership)) return [];

  return (membership.roles ?? [])
    .map((entry) => (typeof entry === 'string' ? { role: entry, status: 'ACTIVE' } : entry))
    .filter((entry) => entry.status === 'ACTIVE')
    .map((entry) => entry.role)
    .filter((role) => role in ROLE_HOME);
}

/**
 * Every ACTIVE role somebody holds — including the ones with nowhere to go.
 *
 * The difference from `activeRolesOf` is the last filter, and it matters where
 * the question is "what is this person" rather than "where may they navigate".
 * Every role has a `ROLE_HOME` today, so the two agree; they part again the
 * moment a role exists that cannot be entered — GUARDIAN was one until /guardian.
 *
 * Use this to describe somebody. Use `activeRolesOf` to route them.
 *
 * @param {object|null} membership
 * @returns {string[]}
 */
export function heldRolesOf(membership) {
  if (!membership) return [];
  if (membership.status && membership.status !== 'ACTIVE') return [];
  if (isSchoolDeactivated(membership)) return [];

  return (membership.roles ?? [])
    .map((entry) => (typeof entry === 'string' ? { role: entry, status: 'ACTIVE' } : entry))
    .filter((entry) => entry?.status === 'ACTIVE')
    .map((entry) => entry.role);
}

/**
 * How this member may leave the school (backend `75e2fdd`, ticket 17):
 *
 *   'NONE'    — a Principal: a school is not left without its Principal
 *               (loadLeaver checks this first, so a Principal who also teaches
 *               cannot leave either);
 *   'REQUEST' — holding TEACHER or STUDENT: with a resignation letter the
 *               Principal approves (NEEDS_LEAVE_APPROVAL in membership.service.js);
 *   'DIRECT'  — anybody else, which today means a guardian: at once.
 *
 * Read from the ACTIVE roles, as the backend reads them. Null for somebody not
 * at a running school.
 *
 * @param {object|null} membership either shape
 * @returns {'NONE'|'REQUEST'|'DIRECT'|null}
 */
export function leaveModeOf(membership) {
  const held = heldRolesOf(membership);
  if (held.length === 0) return null;
  if (held.includes(ROLES.PRINCIPAL)) return 'NONE';
  if (held.includes(ROLES.TEACHER) || held.includes(ROLES.STUDENT)) return 'REQUEST';
  return 'DIRECT';
}

/*
  Which role somebody holding several walks in as, when nobody has chosen.

  The owner's order (2026-09-24): a Principal enters as Principal, a teacher who
  is also a guardian enters as Teacher. Switching is one tap away in the avatar
  menu, so picking for them costs nothing, while asking at every sign-in cost a
  screen. STUDENT never shares a membership with anything, so its place only
  matters for completeness.
*/
export const ROLE_PRIORITY = [ROLES.PRINCIPAL, ROLES.TEACHER, ROLES.STUDENT, ROLES.GUARDIAN];

/** The first of `roles` in ROLE_PRIORITY, or null for none. */
export const defaultRoleOf = (roles) => ROLE_PRIORITY.find((role) => (roles ?? []).includes(role)) ?? null;

/**
 * Whether /select-role should step aside and send this person to a dashboard —
 * the role to enter, or null when the picker has a reason to be on screen.
 *
 * It used to step aside only for exactly one enterable role, which asked every
 * teacher who is also a guardian (and every Principal who teaches) to choose at
 * each sign-in. Now it picks `defaultRoleOf` whatever the count. It stays when
 * it has something to say that belongs to this person:
 *
 *   - a role on the membership still **waiting** — its card carries the badge
 *     and its cancel button lives on that page;
 *   - a rejection not yet announced (`unseenRejection`, views/Role/rejections.js)
 *     — told once, then the picker steps aside again;
 *   - a school registration still waiting.
 *
 * A **cancelled** role is not one of them. It was: the old test was "any role
 * not ACTIVE", so a Principal who had once withdrawn a TEACHER request was held
 * on the picker at every visit, with nothing on it to read.
 *
 * The caller still enters its session's active role — AuthContext picks the
 * same default when none was chosen — so this decides *whether*, not *which*.
 *
 * @param {object|null} membership  either shape; only /users/me's carries statuses
 * @param {object|null} registration the latest of /school-registrations/mine
 * @param {{ unseenRejection?: boolean }} [options]
 * @returns {string|null}
 */
export function roleToEnter(membership, registration, { unseenRejection = false } = {}) {
  const enterable = activeRolesOf(membership);
  if (enterable.length === 0) return null;

  const waiting = (membership?.roles ?? []).some(
    (entry) => typeof entry !== 'string' && entry?.status === 'PENDING'
  );
  if (waiting || unseenRejection) return null;

  if (registration?.status === 'PENDING') return null;

  return defaultRoleOf(enterable);
}

/*
  Roles this app offers to add to a membership that already exists — the same
  two the backend adds (`ADDABLE_ROLES`, membership.schema.js:127), through
  `POST /api/memberships/me/roles`.

  GUARDIAN joined TEACHER once a child could be in a class: `resolveChild`
  refuses any child without a current placement, and a child is placed when a
  homeroom teacher releases their join request with a class chosen, which
  /join-requests does since 2026-09-24. A GUARDIAN added by the child's own
  homeroom teacher is ACTIVE at once; anybody else's waits for that teacher.
*/
export const ADDABLE_ROLES = [ROLES.TEACHER, ROLES.GUARDIAN];

/**
 * Whether this person already belongs to a running school — the one situation
 * where asking for a role means adding it, not joining.
 *
 * Both shapes: sign-in's carries no `status` and only ACTIVE roles, so holding
 * any role there is the answer; `/users/me` says ACTIVE outright. A switched-off
 * school does not count — its token carries no school, and `/me/roles` sits
 * behind `requireActiveMembership`.
 */
export const isEstablishedMember = (membership) =>
  heldRolesOf(membership).length > 0;

/**
 * The roles this person could add right now, from `ADDABLE_ROLES`.
 *
 * A role already held **or already waiting** is not offered — the backend refuses
 * both with 409. One turned down earlier, **or withdrawn by the person
 * themselves**, is offered again: the backend moves that row back to PENDING
 * rather than refusing it (`REOPENABLE`, membership.service.js:23). STUDENT is exclusive, so a
 * student is offered nothing (`assertRoleCombinationAllowed`, approval.js:34).
 *
 * @param {object|null} membership either shape
 * @returns {string[]}
 */
const REOPENABLE = ['REJECTED', 'CANCELLED'];

export function rolesToAdd(membership) {
  if (!isEstablishedMember(membership)) return [];

  const taken = (membership.roles ?? [])
    .map((entry) => (typeof entry === 'string' ? { role: entry, status: 'ACTIVE' } : entry))
    .filter((entry) => !REOPENABLE.includes(entry?.status))
    .map((entry) => entry.role);

  if (taken.includes(ROLES.STUDENT)) return [];
  return ADDABLE_ROLES.filter((role) => !taken.includes(role));
}

/**
 * The roles still waiting on a membership that is already ACTIVE — the ones
 * this person may take back (`POST /memberships/me/roles/:role/cancel`).
 *
 * TEACHER and GUARDIAN only, the backend's `roleParams`. Only `/users/me`'s
 * shape can answer: sign-in's carries ACTIVE roles and nothing else. A PENDING
 * *membership* is a different thing — the whole join request is withdrawn, not
 * one role of it — and a switched-off school answers nothing, because the route
 * sits behind `requireActiveMembership`.
 *
 * @param {object|null} membership
 * @returns {string[]}
 */
export function cancellableRolesOf(membership) {
  if (membership?.status !== 'ACTIVE' || isSchoolDeactivated(membership)) return [];
  return (membership.roles ?? [])
    .filter((entry) => typeof entry === 'object' && entry?.status === 'PENDING')
    .map((entry) => entry.role)
    .filter((role) => role === ROLES.TEACHER || role === ROLES.GUARDIAN);
}

/**
 * Whether adding this role takes effect at once rather than waiting.
 *
 * One case only: a Principal adding TEACHER. There is nobody above them inside
 * the school to release it, so the backend grants it on the spot and records
 * the same person submitting and approving (membership.service.js:438).
 */
export const addsInstantly = (membership, role) =>
  role === ROLES.TEACHER && heldRolesOf(membership).includes(ROLES.PRINCIPAL);

/*
  Which join requests belong to which point of view on /join-requests.

  The backend decides who may release what from the database, not from the role
  somebody is working as (`reviewerScope`, membership.service.js): being the
  Principal releases TEACHER, being a class's homeroom teacher releases STUDENT
  and GUARDIAN for it. Somebody who is both saw every kind in one queue whichever
  role they had picked — the owner found that confusing (2026-09-24). So the
  queue is split by the active role: the Principal's desk deals with teachers,
  the teacher's desk with students and guardians. Student requests are not shown
  to the Principal's desk at all, by the owner's choice.
*/
export const REVIEW_ROLES_BY_POV = {
  [ROLES.PRINCIPAL]: [ROLES.TEACHER],
  [ROLES.TEACHER]: [ROLES.STUDENT, ROLES.GUARDIAN],
};

/** Whether a request (the review queue's shape) is shown to somebody working as `activeRole`. */
export function requestInPov(request, activeRole) {
  const wanted = REVIEW_ROLES_BY_POV[activeRole] ?? [];
  return (request?.roles ?? []).some((entry) => wanted.includes(entry.role));
}

/**
 * A guardian's child links this reader may decide from this desk: PENDING, the
 * backend's `canRelease`, and only at the teacher's desk, where GUARDIAN is
 * released. On a further child (`POST /me/children`) these are ALL there is to
 * decide — the membership and its GUARDIAN role are already ACTIVE, and the
 * backend approves the link on its own ("link alone", decideRequest).
 */
export function releasableLinksInPov(request, activeRole) {
  const wanted = REVIEW_ROLES_BY_POV[activeRole] ?? [];
  if (!wanted.includes(ROLES.GUARDIAN)) return [];
  return (request?.children ?? []).filter((link) => link.canRelease && link.status === 'PENDING');
}

/**
 * The roles on a request this reader may release **from this desk**: the
 * backend's `canRelease`, narrowed to the active role's kinds.
 */
export function releasableInPov(request, activeRole) {
  const wanted = REVIEW_ROLES_BY_POV[activeRole] ?? [];
  return (request?.roles ?? []).filter((entry) => entry.canRelease && wanted.includes(entry.role));
}

/*
  Where a card on the role picker leads when its role is **not** held yet.

  It lived inside SelectRolePage until the rejection notice needed it too — a
  "try again" button has to know where trying again happens. Two copies of a
  role-to-path table is one copy too many, so it sits with the rest of the role
  vocabulary instead.

  Note this is not ROLE_HOME: that is where somebody goes once they hold a role,
  this is where they go to ask for one.

  For somebody already at a school, /get-started/teacher is where TEACHER is
  **added** rather than joined — GetStartedPage decides which, from
  `rolesToAdd`, so the picker and the rejection notice need no second table.
*/
export const GET_STARTED_PATH = {
  [ROLES.STUDENT]: '/get-started/student',
  [ROLES.TEACHER]: '/get-started/teacher',
  [ROLES.GUARDIAN]: '/get-started/guardian',
  [ROLES.PRINCIPAL]: '/get-started/organization',
};

/** Where to send somebody who holds these roles and has picked `activeRole`. */
export const homeFor = (role) => ROLE_HOME[role] ?? '/select-role';
