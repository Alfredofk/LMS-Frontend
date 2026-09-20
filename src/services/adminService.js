import { api, requestBlob } from './apiClient';

const BASE = '/admin/school-registrations';

/*
  The platform admin's queue of school registrations.

  This is the most consequential endpoint group in the backend. Approving one is
  the **only** code path anywhere that creates a School, a SchoolMembership and
  an ACTIVE PRINCIPAL MembershipRole — all three in one transaction. Until an
  approval happens, no real account can reach any signed-in screen, which is why
  the dev sign-in buttons exist.

  Every route here sits behind `requirePlatformAdmin`, which reads the
  PlatformAdmin table on **every** request rather than trusting a token claim —
  so revoking an admin takes effect immediately, and a caller who is not one
  gets 403 FORBIDDEN with the message 'Platform admin only'.
*/
export const adminService = {
  /**
   * The queue for one status, oldest first — a queue is worked from the front.
   * @param {'PENDING'|'APPROVED'|'REJECTED'} status
   */
  list: (status = 'PENDING') => api.get(BASE, { query: { status } }),

  get: (id) => api.get(`${BASE}/${id}`),

  /**
   * The applicant's KTP photograph, as bytes.
   *
   * Answers 404 once the registration has been decided: both approve and reject
   * delete the file, which UU PDP 27/2022 requires and `schema.prisma` records.
   * That 404 is the normal end of this document's life, not a failure.
   *
   * The caller must revoke whatever object URL it builds from this.
   */
  ktp: (id) => requestBlob(`${BASE}/${id}/ktp`),

  /** @throws {ApiError} CONFLICT if another admin decided it first */
  approve: (id) => api.post(`${BASE}/${id}/approve`),

  /**
   * `reason` is required despite the zod schema marking it optional:
   * `assertRejectionReason` rejects anything under 3 characters after trimming.
   * The rule is right — a rejection with no reason leaves the applicant unable
   * to tell whether to fix something and try again, or stop asking.
   *
   * @throws {ApiError} BAD_REQUEST on a missing or too-short reason,
   *   CONFLICT if it was already decided
   */
  reject: (id, reason) => api.post(`${BASE}/${id}/reject`, { reason }),

  /**
   * Withdraw a school's access, keeping its data.
   *
   * **Deactivate, never delete, and the wording is the point.** `School` has
   * thirteen relations and every one of them cascades — a delete would take the
   * whole academic history with it, including the ApprovalAudit rows that are
   * supposed to record that this ever happened. A year of somebody's grades is
   * not the platform admin's to erase with one button.
   *
   * It covers two situations the screen cannot tell apart, and deliberately so:
   * a school approved by mistake, and one that has stopped using EduForID. The
   * difference is whether anybody has joined yet, and `adminView` carries no
   * member or class count, so only the backend can know. Deactivation is the
   * honest answer in both — safe for an empty school, correct for a full one.
   *
   * **This route does not exist yet**, and the shape here is the frontend
   * proposing one rather than following one — `docs/api-contract.md` §13 has
   * the reasoning and the decisions still open. Today it answers 404, and the
   * screen says so instead of claiming anything happened.
   *
   * @throws {ApiError} 404 while the route is unwritten, CONFLICT once it
   *   exists and the school is past the point of being taken back
   */
  deactivate: (id, reason) => api.post(`${BASE}/${id}/deactivate`, { reason }),
};

export default adminService;
