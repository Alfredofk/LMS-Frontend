import { api, requestBlob } from './apiClient';

const REGISTRATIONS = '/admin/governing-body-registrations';
const BODIES = '/admin/governing-bodies';

/*
  The platform admin's Governing Body queue and the bodies it founded (backend
  b5cfffd, governing-body ticket 03), the counterpart of adminService for schools.

  Two routers, keyed differently, and that is the trap: the queue and its decisions
  take the **registration's** id, while correcting, switching off and restoring a
  body take the **body's** (`registration.governingBody.id`), as a school's
  subdomain change does. Every route is behind `requirePlatformAdmin`.
*/
export const adminGoverningBodyService = {
  /**
   * One page of the queue. Only the keys with a value are sent.
   *
   * @param {object} [params]
   * @param {'PENDING'|'APPROVED'|'REJECTED'|'ALL'} [params.status]
   * @param {string} [params.q]       name, SK number, city, applicant's name or email
   * @param {'FOUNDATION'|'ASSOCIATION'|'GOVERNMENT'} [params.kind]
   * @param {'true'|'false'} [params.deactivated]  implies APPROVED
   * @param {number} [params.limit]   max 100
   * @param {number} [params.offset]
   * @returns {Promise<{ registrations: Array<object>, total: number,
   *   counts: Record<string, number>, page: { limit, offset, returned } }>}
   */
  list: (params = {}) => {
    const query = { status: 'PENDING' };
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') query[key] = value;
    }
    return api.get(REGISTRATIONS, { query });
  },

  /** The applicant's KTP (JPG or PNG), as bytes; 404 once decided - both files are discarded then. */
  ktp: (id) => requestBlob(`${REGISTRATIONS}/${id}/ktp`),

  /** The proof of office (PDF, JPG or PNG), as bytes; 404 once decided. */
  proof: (id) => requestBlob(`${REGISTRATIONS}/${id}/proof`),

  /**
   * Found the body: its code, its subdomain and the applicant's ACTIVE admin seat,
   * in one transaction. `{ registration, message }`, the registration carrying
   * `governingBody`.
   *
   * @throws {ApiError} CONFLICT when decided already, the applicant is gone or a
   *   student, or the SK number is held since
   */
  approve: (id) => api.post(`${REGISTRATIONS}/${id}/approve`),

  /** A reason of 3-500 is required (`assertRejectionReason`). `{ registration, message }`. */
  reject: (id, reason) => api.post(`${REGISTRATIONS}/${id}/reject`, { reason }),

  /**
   * Correct a body's name, kind or SK number - only what changed; `skNumber: null`
   * removes it. The kind and the number must agree. `{ governingBody, message }`.
   *
   * @throws {ApiError} BAD_REQUEST when they disagree, CONFLICT for an SK number held
   *   elsewhere or a body changed meanwhile
   */
  update: (bodyId, patch) => api.patch(`${BODIES}/${encodeURIComponent(bodyId)}`, patch),

  /**
   * Switch a body off: its admins' sign-ins end, its schools keep running, nothing is
   * deleted. A reason of 3-500 is required. `{ governingBody, message }`.
   */
  deactivate: (bodyId, reason) => api.post(`${BODIES}/${encodeURIComponent(bodyId)}/deactivate`, { reason }),

  /** The way back; the note is optional. Its admins sign in again. `{ governingBody, message }`. */
  reactivate: (bodyId, reason) => api.post(`${BODIES}/${encodeURIComponent(bodyId)}/reactivate`, reason ? { reason } : {}),
};

export default adminGoverningBodyService;
