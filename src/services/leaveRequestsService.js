import { api, requestBlob } from './apiClient';

/**
 * The Principal's side of leaving — `/api/leave-requests` (backend `75e2fdd`,
 * ticket 17).
 *
 * A teacher or a student does not leave on their own any more: they send a
 * resignation letter and a reason (`membershipService.submitLeaveRequest`), and
 * the Principal decides here. Every route sits behind requireActiveMembership
 * and PRINCIPAL, re-read from the database in the service.
 *
 * A request, as the Principal sees it (`leaveView`):
 *   { id, status, reason, requestedAt, decidedAt, rejectionReason,
 *     member: { membershipId, status, fullName, email, roles[], nisn,
 *               currentClass: { id, name } | null, nip, nuptk } }
 *
 * Approving ends the membership in the same transaction, with the request's
 * reason as its endReason; a homeroom teacher of a class in an active year is
 * refused with `details.classes`, as removal is. Rejecting needs a reason of
 * 3–500 characters, which the member reads.
 */
const BASE = '/leave-requests';

export const leaveRequestsService = {
  /** @param {'PENDING'|'ACTIVE'|'REJECTED'|'CANCELLED'} [status] PENDING when omitted */
  async list(status = 'PENDING') {
    const answer = await api.get(BASE, { query: { status } });
    return answer?.leaveRequests ?? [];
  },

  /** The letter itself — PDF, JPG or PNG — as a Blob; not the JSON envelope. */
  letter: (id) => requestBlob(`${BASE}/${encodeURIComponent(id)}/letter`),

  async approve(id) {
    const answer = await api.post(`${BASE}/${encodeURIComponent(id)}/approve`);
    return answer?.leaveRequest ?? null;
  },

  async reject(id, reason) {
    const answer = await api.post(`${BASE}/${encodeURIComponent(id)}/reject`, { reason });
    return answer?.leaveRequest ?? null;
  },
};

export default leaveRequestsService;
