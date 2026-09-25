import { api } from './apiClient';

/**
 * Founding a school: the applicant's half of it.
 *
 * `POST /api/school-registrations` and `GET /api/school-registrations/mine` are
 * the only two routes an ordinary account can reach. The five under
 * `/api/admin/school-registrations` are gated on a `PlatformAdmin` row, which
 * nothing in the backend can create — no route, no service, and `prisma/seed.js`
 * is not on disk despite `package.json` naming it. Until somebody inserts that
 * row by hand, every registration stays PENDING and there is no admin screen
 * worth building.
 *
 * Approval is worth understanding from here, because it is the only code path in
 * the whole backend that creates a `School`, a `SchoolMembership` and a
 * `MembershipRole` — so it is the only way an ordinary account has ever been
 * able to reach a dashboard. It also leaves the applicant's access token behind:
 * that token still carries `schoolId: null`, and nothing updates it. Whoever
 * notices the APPROVED status must call `authService.refresh()` before routing
 * anywhere tenant-scoped, or the person is locked out of the school they just
 * founded.
 */
export const schoolService = {
  /**
   * Submit a registration. Requires a signed-in, email-verified account.
   *
   * The body is **multipart**, not JSON, because the KTP photo travels with it —
   * there is no separate upload endpoint. `apiClient` passes a FormData through
   * untouched and lets the browser write the Content-Type; see the note there.
   *
   * @param {FormData} formData  npsn · schoolName · schoolType · city ·
   *   applicantPhone · durationYears (SMK only) · ktp (File)
   * @returns {Promise<{ registration: object, message: string }>}
   */
  async submitRegistration(formData) {
    return api.post('/school-registrations', formData);
  },

  /**
   * Every registration this account has submitted, newest first.
   *
   * The only status surface there is: no email, no webhook. `status` is
   * `PENDING` | `APPROVED` | `REJECTED`, `rejectionReason` is filled on a
   * rejection, and `school` — carrying the generated `schoolCode` — is non-null
   * exactly when approved.
   *
   * @returns {Promise<{ registrations: Array<object> }>}
   */
  async listMyRegistrations() {
    return api.get('/school-registrations/mine');
  },

  /**
   * Replace the School Code — for when it has spread further than it should.
   *
   * A different namespace from everything above: `/api/school` (backend
   * `60ea459`), for the school's own people rather than its founder's paperwork.
   * No id in the path — the school is the one the caller's token names — and
   * PRINCIPAL only, re-checked against the database rather than the token.
   *
   * The old code stops resolving at once. Requests already PENDING are untouched:
   * they name the school by id, and the code only located it.
   *
   * The controller answers `{ school, message }` (`school.controller.js`
   * `rotateCode`), so this unwraps one level — the same shape `lookupSchool` had
   * to learn to unwrap the hard way.
   *
   * @returns {Promise<{ id: string, name: string, schoolCode: string,
   *   deactivatedAt: string|null, deactivationReason: string|null }>}
   * @throws {ApiError} FORBIDDEN when the caller is not the Principal,
   *   NOT_FOUND when the school is switched off
   */
  async rotateCode() {
    const answer = await api.post('/school/code/rotate');
    return answer?.school ?? null;
  },
};

export default schoolService;
