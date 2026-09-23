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
   * One page of the queue, oldest first — a queue is worked from the front.
   *
   * **The filtering happens in the database, not in the browser.** This used to
   * take a bare status and nothing else, and the screen sifted the answer
   * itself; `school.schema.js:71-76` says why that was wrong — it works only
   * while the whole platform fits in one page of memory, and `limit` defaults to
   * 50, so past fifty rows the search quietly stopped seeing them.
   *
   * Every parameter is optional and only the ones with a value are sent, so
   * `list({ status: 'PENDING' })` still means exactly what `list('PENDING')`
   * meant.
   *
   * Two numbers come back and they are not the same number:
   *   `total`  — how many rows match the filters, for "showing 20 of 63".
   *   `counts` — per status, **unfiltered**, for the tab badges. Deliberate
   *              server-side: a badge that shrinks while somebody types stops
   *              answering the question they opened the page to ask.
   *
   * @param {object} [params]
   * @param {'PENDING'|'APPROVED'|'REJECTED'|'ALL'} [params.status]
   * @param {string} [params.q]            one needle, five haystacks
   * @param {string} [params.schoolType]   SD · SMP · SMA · SMK
   * @param {'true'|'false'} [params.deactivated]  strings, not booleans — a query
   *   string carries text, and the backend refuses a coerced boolean for it
   * @param {number} [params.limit]        max 100
   * @param {number} [params.offset]
   * @returns {Promise<{ registrations: Array<object>, total: number,
   *   counts: Record<string, number>, page: { limit, offset, returned } }>}
   */
  list: (params = {}) => {
    const query = { status: 'PENDING' };
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query[key] = value;
    }
    return api.get(BASE, { query });
  },

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
   * **The route exists now** (ticket 14). This block used to say it did not, and
   * that the shape below was the frontend proposing a contract rather than
   * following one. The proposal turned out to match what was built, down to the
   * path and the single `reason` field — which is luck worth not relying on twice.
   *
   * What it does on the server: sets `School.deactivatedAt` with the reason and
   * the admin who decided, then **revokes every member's refresh token**. Access
   * tokens already in flight live out their remaining minutes, so the school is
   * gone at the next refresh rather than instantly. Memberships are untouched —
   * a school that comes back should find its people still in it.
   *
   * `reason` is required: `assertRejectionReason` refuses anything under 3
   * characters after trimming, the same rule rejection uses.
   *
   * @throws {ApiError} BAD_REQUEST on a missing or too-short reason, CONFLICT if
   *   the registration is not APPROVED or the school is already switched off
   */
  deactivate: (id, reason) => api.post(`${BASE}/${id}/deactivate`, { reason }),

  /**
   * Give it back.
   *
   * Exists because a school switched off by a misclick would otherwise need the
   * database edited by hand.
   *
   * **The note is optional here, unlike every other reason field in this file** —
   * there is nobody waiting to be told why their access came back. It is recorded
   * in the audit trail when given, and the 3-character floor does not apply.
   *
   * Members still have to sign in again: their refresh tokens were revoked on the
   * way out and reactivating does not un-revoke them. That is deliberate — a
   * revoked token coming back to life is the shape of a replay, and the backend
   * treats it as theft.
   *
   * @throws {ApiError} NOT_FOUND if the registration never became a school,
   *   CONFLICT if that school is not deactivated
   */
  reactivate: (id, reason) => api.post(`${BASE}/${id}/reactivate`, reason ? { reason } : {}),
};

export default adminService;
