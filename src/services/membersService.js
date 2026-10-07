import { api } from './apiClient';

/**
 * The school's people, and taking one of them out — backend `7a91eaf`.
 *
 * `/api/members` sits behind `requireActiveMembership` and
 * `requireRole('PRINCIPAL','TEACHER')`, and the service narrows further:
 *
 *   list    the Principal or a Vice Principal (403 for a teacher)
 *   remove, handover, appoint/revoke a Vice Principal — the Principal only
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
   * One member, for the Principal and the Vice Principals — backend `c0a4f18`
   * (ticket 22). ACTIVE or LEFT only; anything else is 404, and anybody else 403.
   * The class carries no homeroom teacher and no placement date.
   *
   * @param {string} membershipId
   * @returns {Promise<{ membershipId: string, status: 'ACTIVE'|'LEFT', fullName: string,
   *   email: string|null, phone: string|null, roles: string[], nisn: string|null,
   *   nip: string|null, nuptk: string|null, joinedAt: string|null, endedAt: string|null,
   *   endReason: string|null,
   *   student: null | { studentProfileId: string, birthDate: string|null,
   *     class: Placement|null, lastClass: Placement|null, where Placement = { id, name, gradeLevel,
   *       academicYear, homeroomTeacher: { membershipId, fullName }|null, placedAt } (ccba4e0),
   *     guardians: Array<{ membershipId, fullName, email, phone, relationship }>,
   *     attendance: null | { academicYear: string, semesters: Array<{ semesterId, ordinal, counted,
   *       present, sick, excused, absent, late, outsideSchool }> } } }|null>}
   */
  async get(membershipId) {
    const answer = await api.get(`/members/${membershipId}`);
    return answer?.member ?? null;
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

  /**
   * The Principal hands the school to an active teacher here — backend `1416e24`.
   * At once, with no approval: the successor takes over at their next sign-in.
   * `stay` keeps the caller as a teacher (the TEACHER role is given, with a NIP
   * or NUPTK, if they did not hold it); leaving ends their membership, refused
   * while they are homeroom of a class in an active year (`details.classes`).
   *
   * @param {string} membershipId the successor
   * @param {{ stay: boolean, teacher?: { nip?: string, nuptk?: string } }} body
   * @returns {Promise<{ principal: { membershipId: string, fullName: string }, you: { status: 'ACTIVE'|'LEFT' } }>}
   */
  async handover(membershipId, body) {
    return api.post(`/members/${membershipId}/handover`, body);
  },

  /**
   * The Principal appoints an active teacher Vice Principal — backend `89a5666`
   * (ticket 19). 409 for the Principal or somebody already one, 400 for anybody
   * not an active teacher. It takes effect at the appointee's next token.
   *
   * @param {string} membershipId
   * @returns {Promise<{ membershipId: string, fullName: string, role: 'VICE_PRINCIPAL', status: 'ACTIVE' }|null>}
   */
  async appointVicePrincipal(membershipId) {
    const answer = await api.post(`/members/${encodeURIComponent(membershipId)}/vice-principal`);
    return answer?.member ?? null;
  },

  /**
   * Revoking it ENDs the role; the person stays a teacher. 404 when they are no
   * Vice Principal here, 409 when revoked a moment ago elsewhere.
   *
   * @param {string} membershipId
   * @returns {Promise<{ membershipId: string, role: 'VICE_PRINCIPAL', status: 'ENDED' }|null>}
   */
  async revokeVicePrincipal(membershipId) {
    const answer = await api.post(`/members/${encodeURIComponent(membershipId)}/vice-principal/revoke`);
    return answer?.member ?? null;
  },
};

export default membersService;
