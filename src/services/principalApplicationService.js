/**
 * Applying to be the Principal of a Governing Body's School (backend e206bd9,
 * governing-body ticket 06), the applicant's half: `/api/principal-applications`,
 * behind `requireAuth` alone, as joining is. The School is found by its code through
 * `membershipService.lookupSchool`, whose `principalWanted` says whether it takes an
 * application. The body's admins decide (their half is the seat's).
 */

import { api } from './apiClient';

export const principalApplicationService = {
  /**
   * Apply (`POST /principal-applications`, multipart: `schoolCode`, `applicantPhone`,
   * `ktp`), 201 `{ application, message }`, the application as `listMine` gives it.
   *
   * @throws {ApiError} CONFLICT for a School that takes none, a member there, a student,
   *   one already waiting there or three rejections there today; NOT_FOUND for the code;
   *   EMAIL_NOT_VERIFIED; BAD_REQUEST for the phone or the KTP (`details.field`)
   */
  async apply(formData) {
    const answer = await api.post('/principal-applications', formData);
    return answer?.application ?? null;
  },

  /**
   * The account's applications, newest first (`GET /principal-applications/mine`):
   * `{ id, status (PENDING | APPROVED | REJECTED | CANCELLED), school: { name,
   * schoolType, city }, governingBody: { name } | null, applicantPhone, requestedAt,
   * decidedAt, rejectionReason }`. The School is named, never by its id.
   */
  async listMine() {
    const answer = await api.get('/principal-applications/mine');
    return answer?.applications ?? [];
  },

  /** Take a waiting application back (`POST .../:id/cancel`); its KTP is discarded. */
  cancel: (id) => api.post(`/principal-applications/${encodeURIComponent(id)}/cancel`),
};

export default principalApplicationService;
