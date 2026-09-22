import { api } from './apiClient';

/**
 * Joining a school that already exists: the applicant's half of it.
 *
 * Ticket 05, and the thing that finally makes a dashboard reachable by an
 * ordinary account. Founding a school (`schoolService`) creates the first
 * PRINCIPAL; this is how everybody else gets in.
 *
 * Both routes sit under `/api/memberships` behind `requireAuth` and **nothing
 * else** — deliberately, because the caller is precisely somebody who holds no
 * membership yet. The reviewer's side lives at `/api/membership-requests` and
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
};

export default membershipService;
