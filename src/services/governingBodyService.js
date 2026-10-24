/**
 * The backend's /api/governing-body contract (backend b5cfffd, governing-body ticket
 * 03), thin over apiClient: the seat's own read. The applicant's registration and
 * the Platform Admin's queue come later.
 */

import { api } from './apiClient';

export const governingBodyService = {
  /**
   * The Governing Body this sign-in's seat is for (`GET /api/governing-body`):
   * `{ id, kind, name, skNumber, address: { street, village, district, city,
   * province, postalCode }, code, subdomain, deactivatedAt, deactivationReason,
   * createdAt }`.
   *
   * @throws {ApiError} FORBIDDEN when the seat has ended or the body is switched off
   */
  async own() {
    const answer = await api.get('/governing-body');
    return answer?.governingBody ?? null;
  },

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
};

export default governingBodyService;
