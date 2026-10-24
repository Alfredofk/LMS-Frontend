/**
 * The backend's /api/governing-body contract (backend b5cfffd and 3d7d05a,
 * governing-body tickets 03 and 04), thin over apiClient: the seat's own read and
 * its admins, and the applicant's registration. Every admin reads the admins,
 * changes the address and phone, replaces the code and leaves unless the last; only
 * the senior admin approves, rejects and removes (403 for the rest).
 */

import { api } from './apiClient';

export const governingBodyService = {
  /**
   * The Governing Body this sign-in's seat is for (`GET /api/governing-body`):
   * `{ id, kind, name, skNumber, address: { street, village, district, city,
   * province, postalCode }, phone, code, subdomain, deactivatedAt, deactivationReason,
   * createdAt }` (`phone` since 3d7d05a, null until an admin sets it).
   *
   * @throws {ApiError} FORBIDDEN when the seat has ended or the body is switched off
   */
  async own() {
    const answer = await api.get('/governing-body');
    return answer?.governingBody ?? null;
  },

  /**
   * Change the address and the phone (`PATCH /api/governing-body`): only what changed;
   * `postalCode: null` and `phone: null` clear them. The name, kind and SK number are
   * the Platform Admin's, and refused here. `{ governingBody, message }`.
   *
   * @throws {ApiError} CONFLICT "changed meanwhile"; BAD_REQUEST for a field
   */
  async updateProfile(patch) {
    const answer = await api.patch('/governing-body', patch);
    return answer?.governingBody ?? null;
  },

  /** A new Governing Body Code; the old one stops at once (`POST .../code/rotate`). Answers the body. */
  async rotateCode() {
    const answer = await api.post('/governing-body/code/rotate');
    return answer?.governingBody ?? null;
  },

  /**
   * The sitting admins, the senior first, and the applications waiting, oldest first
   * (`GET .../admins`): `{ admins: [{ id, user: { id, fullName, email }, approvedAt,
   * senior, you }], applications: [{ id, status, user, requestedAt, approvedAt,
   * rejectionReason }], youAreSenior }`. Ids are the seats'.
   */
  admins: () => api.get('/governing-body/admins'),

  /** The senior's approval of an application. `{ application, message }`. */
  approveApplication: (seatId) => api.post(`/governing-body/admins/${encodeURIComponent(seatId)}/approve`),

  /** The senior's rejection; a reason of 3-500, shown to the applicant. `{ application, message }`. */
  rejectApplication: (seatId, reason) => api.post(`/governing-body/admins/${encodeURIComponent(seatId)}/reject`, { reason }),

  /** The senior removing another admin, with a reason of 3-500 they will read. `{ seat, message }`. */
  removeAdmin: (seatId, reason) => api.post(`/governing-body/admins/${encodeURIComponent(seatId)}/remove`, { reason }),

  /**
   * Leave the body (`POST .../leave`). `{ seat, message }`.
   *
   * @throws {ApiError} CONFLICT for the last admin
   */
  leave: () => api.post('/governing-body/leave'),

  /**
   * Register a yayasan, perkumpulan or dinas (`POST /api/governing-body-registrations`),
   * multipart: `kind, name, skNumber?, street, village, district, city, province,
   * postalCode?, applicantPhone` and the files `ktp` and `proof`. 201 `{ registration,
   * message }`. Any signed-in account but a student; one waiting per applicant, five a day.
   *
   * @throws {ApiError} CONFLICT for one already waiting, a student, an SK number taken or
   *   too many today; EMAIL_NOT_VERIFIED; BAD_REQUEST for a field or a file
   */
  async submitRegistration(formData) {
    return api.post('/governing-body-registrations', formData);
  },

  /**
   * This account's own registrations, newest first (`GET .../mine`): each `{ id, kind,
   * name, skNumber, address, applicantPhone, status, rejectionReason, reviewedAt,
   * createdAt, governingBody: { id, name, code, subdomain } | null }`.
   */
  async listMine() {
    const answer = await api.get('/governing-body-registrations/mine');
    return answer?.registrations ?? [];
  },

  /**
   * What a Governing Body Code locates (`POST /governing-body-applications/lookup`):
   * `{ name, kind }` and nothing else. Shares the School Code's budget for wrong codes.
   *
   * @throws {ApiError} NOT_FOUND for an unknown or switched-off body (one answer);
   *   CONFLICT for a student; EMAIL_NOT_VERIFIED; TOO_MANY_REQUESTS
   */
  async lookup(code) {
    const answer = await api.post('/governing-body-applications/lookup', { code });
    return answer?.governingBody ?? null;
  },

  /**
   * Ask to be an admin through the code (`POST .../admins`), 201 `{ seat, message }`,
   * the seat as `listMySeats` gives it. The senior admin decides.
   *
   * @throws {ApiError} CONFLICT for one waiting or held there, a student, or three
   *   rejections there today; NOT_FOUND for the code
   */
  async apply(code) {
    const answer = await api.post('/governing-body-applications/admins', { code });
    return answer?.seat ?? null;
  },

  /**
   * Every seat of this account, newest first (`GET .../mine`): `{ id, status
   * (PENDING | ACTIVE | REJECTED | CANCELLED | LEFT), requestedAt, approvedAt, endedAt,
   * rejectionReason, endReason, governingBody: { name, kind } }`.
   */
  async listMySeats() {
    const answer = await api.get('/governing-body-applications/mine');
    return answer?.seats ?? [];
  },

  /** Take a waiting application back (`POST .../admins/:id/cancel`); never counts against the cap. */
  cancelApplication: (seatId) => api.post(`/governing-body-applications/admins/${encodeURIComponent(seatId)}/cancel`),
};

export default governingBodyService;
