import { api } from './apiClient';

/**
 * Joining a school that already exists: the applicant's half of it.
 *
 * Ticket 05, and the thing that finally makes a dashboard reachable by an
 * ordinary account. Founding a school (`schoolService`) creates the first
 * PRINCIPAL; this is how everybody else gets in.
 *
 * The first two routes sit under `/api/memberships` behind `requireAuth` and
 * **nothing else** — deliberately, because the caller is precisely somebody who
 * holds no membership yet. The third, `addRoles`, is the exception, and says so. The reviewer's side lives at `/api/membership-requests` and
 * needs an ACTIVE one, which is why it is a different router and will be a
 * different service.
 *
 * Both share one rate limiter keyed on the user, not the IP: a whole school
 * sitting behind one address would otherwise share a single budget.
 */
export const membershipService = {
  /**
   * Turn a School Code into enough of a school to recognise.
   *
   * Three fields, and that is the whole point: it says "yes, this is SMA Negeri
   * 1 Contoh in Jakarta" without exposing a class list, a roster, or anything
   * else a leaked code could be fished with. It is a confirmation step, not a
   * directory.
   *
   * The code is 8 characters from an alphabet with no 0, O, 1 or I. Send it
   * upper-cased; `normaliseSchoolCode` in `utils/validation.js` is what does
   * that, and the server folds it again regardless.
   *
   * **The reply nests the school one level down**, and getting that wrong is
   * how this shipped broken the first time: the controller answers
   * `ok(res, { school })`, so once `apiClient` unwraps the envelope the caller
   * still holds `{ school: {…} }` rather than the school. Handing that straight to
   * the form made every field `undefined` — the card showed a lone separator dot
   * where the name goes, and the grade selector had no school type to build
   * itself from, so it offered nothing. Unwrapped here, once.
   *
   * @param {string} schoolCode
   * @returns {Promise<{ name: string, schoolType: 'SD'|'SMP'|'SMA'|'SMK', city: string|null }|null>}
   */
  async lookupSchool(schoolCode) {
    const answer = await api.post('/memberships/lookup', { schoolCode });
    return answer?.school ?? null;
  },

  /**
   * Ask to be added to that school.
   *
   * `roles` is an array because one person can be two things at once — a
   * teacher whose own child attends the same school is the case the backend
   * names. Every role named must bring its own payload and **only** its own: a
   * payload for a role that was not asked for is refused rather than ignored,
   * the same strictness the school registration applies to a duration an SMA
   * may not choose.
   *
   * PRINCIPAL is not requestable. The first one is created by the platform
   * admin who approves the school registration, and a second is a later
   * feature, not something a stranger asks for.
   *
   * A student names a **grade**, never a class. The homeroom teacher picks the
   * class when they release the request — which is what stops a leaked School
   * Code from exposing a class list, and lets a school take requests before it
   * has created any class at all.
   *
   * Nothing comes back to act on: the request now exists as a PENDING
   * membership, and `GET /api/users/me` is where its status lives from here.
   *
   * @param {{
   *   schoolCode: string,
   *   roles: Array<'TEACHER'|'STUDENT'|'GUARDIAN'>,
   *   teacher?: { nip?: string, nuptk?: string },
   *   student?: { nisn: string, birthDate: string, gradeLevel: number },
   *   guardian?: { childNisn: string, childFullName: string, relationship: string },
   * }} body
   */
  async requestJoin(body) {
    return api.post('/memberships/requests', body);
  },

  /**
   * Add a role to the membership this person already holds.
   *
   * The one route under `/api/memberships` whose caller **does** hold a
   * membership: it sits behind `requireActiveMembership` as well, so the token
   * must already name the school. No School Code — the school is the one in the
   * token.
   *
   * TEACHER with a NIP or a NUPTK, or GUARDIAN with the child's NISN, name and
   * the relationship — one role per call from this app.
   *
   * **A Principal's TEACHER comes back ACTIVE at once; anybody else's PENDING.**
   * And either way the access token does not know: `requireRole` reads the roles
   * in the token (shared/auth.js:133), which were fixed when it was minted. The
   * caller trades the token in when the role came back ACTIVE — see AddRoleForm.
   *
   * The reply is a **third** membership shape, neither sign-in's nor
   * `/users/me`'s: `{ id, status, roles: [{ role, status, rejectionReason }] }`,
   * with no school and no profiles. Unwrapped here, and read only for the status
   * of the role just asked for.
   *
   * @param {{ roles: Array<'TEACHER'|'GUARDIAN'>, teacher?: { nip?: string, nuptk?: string }, guardian?: { childNisn: string, childFullName: string, relationship: string } }} body
   * @returns {Promise<{ id: string, status: string, roles: Array<{ role: string, status: string, rejectionReason: string|null }> }|null>}
   */
  async addRoles(body) {
    const answer = await api.post('/memberships/me/roles', body);
    return answer?.membership ?? null;
  },

  /**
   * Take a whole join request back while nobody has decided it.
   *
   * `requireAuth` only — the applicant holds no school yet. The membership
   * becomes CANCELLED, its PENDING roles with it, and nothing counts against the
   * retry limit, so the person is free to ask any school at once.
   *
   * 404 — nothing is waiting (withdrawn in another tab, or never sent).
   * 409 — a reviewer decided it in the same moment; the reviewer won.
   *
   * @returns {Promise<{ id: string, status: 'CANCELLED', school: { name: string } }|null>}
   */
  async cancelJoinRequest() {
    const answer = await api.post('/memberships/requests/cancel');
    return answer?.membership ?? null;
  },

  /**
   * Take back one role asked for through `addRoles`. The membership stays ACTIVE.
   *
   * TEACHER or GUARDIAN only (the backend's `roleParams`); cancelling GUARDIAN
   * also withdraws the child link waiting with it. Same 404 and 409 as above.
   * The reply is `addRoles`'s thin shape again — call `refreshMe()` rather than
   * caching it.
   *
   * @param {'TEACHER'|'GUARDIAN'} role
   */
  async cancelRole(role) {
    const answer = await api.post(`/memberships/me/roles/${encodeURIComponent(role)}/cancel`);
    return answer?.membership ?? null;
  },

  /**
   * Claim a further child, for a member whose GUARDIAN role is already ACTIVE.
   *
   * The same three fields a GUARDIAN request carries (`guardianPayload`).
   * ACTIVE at once when the claimant is the child's own homeroom teacher;
   * otherwise PENDING, for that teacher, through /join-requests. 201.
   *
   * 400 — the details match no child placed in a class here (one sentence for
   * every reason, on purpose). 409 — the GUARDIAN role is not ACTIVE yet, or
   * that child is already linked or waiting.
   *
   * @param {{ childNisn: string, childFullName: string, relationship: string }} body
   * @returns {Promise<{ id: string, status: string, relationship: string, rejectionReason: string|null, student: { fullName: string } }|null>}
   */
  async linkChild(body) {
    const answer = await api.post('/memberships/me/children', body);
    return answer?.link ?? null;
  },

  /**
   * Take back a child link still waiting. 404 — not this member's, or already
   * decided; 409 — the GUARDIAN role itself is still waiting (cancel that instead).
   *
   * @param {string} linkId
   */
  async cancelLink(linkId) {
    const answer = await api.post(`/memberships/me/children/${encodeURIComponent(linkId)}/cancel`);
    return answer?.link ?? null;
  },

  /**
   * Leave the school this person belongs to.
   *
   * `requireActiveMembership`. The membership becomes LEFT, every role row stays
   * as history, and waiting roles are cancelled. **Refresh tokens are not
   * revoked**, so the caller trades the token in afterwards — the one it holds
   * still names the school.
   *
   * 409 — a Principal (a school is not left without one), or a homeroom teacher
   * of a class in an ACTIVE year, with `details.classes` naming them.
   *
   * @returns {Promise<{ id: string, status: 'LEFT' }|null>}
   */
  async leaveSchool() {
    const answer = await api.post('/memberships/me/leave');
    return answer?.membership ?? null;
  },
};

export default membershipService;
