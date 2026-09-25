import { api } from './apiClient';

/**
 * The school's people, and taking one of them out — backend `7a91eaf`.
 *
 * `/api/members` sits behind `requireActiveMembership` and
 * `requireRole('PRINCIPAL','TEACHER')`, and the service narrows further:
 *
 *   list    the Principal only (403 for a teacher)
 *   remove  the Principal, anyone but a Principal; a homeroom teacher, only a
 *           student placed in one of their classes. Everyone else — and
 *           anyone at another school — gets the same 404.
 *
 * **Removal is revocation, not deletion.** The membership becomes `LEFT` with
 * `endedAt` and the reason, its role rows stay as history, the student's class
 * placement ends, and their records stay with the school. They may ask any
 * school again afterwards. The reason is required (3–500 characters) because
 * the person removed is shown it.
 *
 * A member who is homeroom teacher of a class in an ACTIVE year cannot be
 * removed until the Principal hands the class on: 409, with the classes named in
 * `details.classes`.
 */
export const membersService = {
  /**
   * The people here now (`ACTIVE`), or the people who were (`LEFT`, with
   * `endedAt` and `endReason`). `role` narrows to members holding that role
   * ACTIVE; omitted, everybody.
   *
   * @param {{ status?: 'ACTIVE'|'LEFT', role?: 'PRINCIPAL'|'TEACHER'|'STUDENT'|'GUARDIAN' }} [params]
   * @returns {Promise<Array<{ membershipId: string, status: string, fullName: string,
   *   roles: string[], nisn: string|null, nip: string|null, nuptk: string|null,
   *   joinedAt: string|null, endedAt: string|null, endReason: string|null }>>}
   */
  async list({ status = 'ACTIVE', role } = {}) {
    const query = { status };
    if (role) query.role = role;
    const answer = await api.get('/members', { query });
    return answer?.members ?? [];
  },

  /**
   * @param {string} membershipId
   * @param {string} reason 3–500 characters, trimmed by the server
   * @returns {Promise<{ id: string, status: 'LEFT', endReason: string }|null>}
   */
  async remove(membershipId, reason) {
    const answer = await api.post(`/members/${membershipId}/remove`, { reason });
    return answer?.membership ?? null;
  },
};

export default membersService;
