import { api } from './apiClient';

/**
 * The school's time spine and its classes — ticket 07, backend `36476f3`.
 *
 * Everything sits under `/api/academics` behind `requireAuth` and
 * `requireActiveMembership`: the token's school is the only school in reach, and
 * no path carries a school id. Every **write** is the Principal's, and the
 * backend checks that against the database on each call rather than trusting
 * the token (`academics.service.js` `assertPrincipal`). Reads are open to a
 * TEACHER too, but a teacher sees only the classes they are homeroom of.
 *
 * **Every reply nests its payload one level down** — `{ academicYear }`,
 * `{ classes }`, `{ class }` — and each method here unwraps it once, so no
 * caller holds `{ class: {...} }` thinking it is the class. That is the mistake
 * `lookupSchool` shipped with; see membershipService.
 *
 * A class as it comes back (`classView` in the service):
 *
 *   { id, name, gradeLevel, phase,
 *     academicYear: { id, label, status },
 *     homeroomTeacher: { membershipId, fullName } | null,
 *     studentCount }
 *
 * and `getClass` adds `students: [{ studentProfileId, membershipId, fullName,
 * nisn, placedAt }]` — the current roster, nobody who has left.
 */
export const academicsService = {
  /**
   * Who may be named homeroom teacher: ACTIVE members holding an ACTIVE TEACHER
   * role. A Principal appears only if they also teach — which is what adding the
   * Teacher role on My Profile is for.
   *
   * @returns {Promise<Array<{ membershipId: string, fullName: string, nip: string|null, nuptk: string|null }>>}
   */
  async teachers() {
    const answer = await api.get('/academics/teachers');
    return answer?.teachers ?? [];
  },

  /**
   * Every academic year, newest first, each with its semesters (ordinal order).
   * Several may be ACTIVE at once — next year can be prepared before this one
   * closes (owner's decision, 2026-09-23).
   */
  async academicYears() {
    const answer = await api.get('/academics/academic-years');
    return answer?.academicYears ?? [];
  },

  /** @param {{ label: string, startDate: string, endDate: string }} body — label as "2026/2027" */
  async createAcademicYear(body) {
    const answer = await api.post('/academics/academic-years', body);
    return answer?.academicYear ?? null;
  },

  /** ACTIVE → CLOSED, once. A closed year stays readable and takes nothing new. */
  async closeAcademicYear(id) {
    const answer = await api.post(`/academics/academic-years/${id}/close`);
    return answer?.academicYear ?? null;
  },

  /**
   * One of the year's two halves. Answers with the **whole year**, semesters
   * included, not the semester alone.
   *
   * @param {string} academicYearId
   * @param {{ ordinal: 1|2, startDate: string, endDate: string }} body
   */
  async createSemester(academicYearId, body) {
    const answer = await api.post(`/academics/academic-years/${academicYearId}/semesters`, body);
    return answer?.academicYear ?? null;
  },

  /** @param {string} [academicYearId] narrows to one year; omitted, every year */
  async classes(academicYearId) {
    const query = academicYearId ? { academicYearId } : undefined;
    const answer = await api.get('/academics/classes', { query });
    return answer?.classes ?? [];
  },

  /** One class with its current roster. */
  async getClass(id) {
    const answer = await api.get(`/academics/classes/${id}`);
    return answer?.class ?? null;
  },

  /**
   * A class is never created without its homeroom teacher — the field is
   * required although the column is not (decision #53).
   *
   * @param {{ academicYearId: string, name: string, gradeLevel: number, homeroomTeacherMembershipId: string }} body
   */
  async createClass(body) {
    const answer = await api.post('/academics/classes', body);
    return answer?.class ?? null;
  },

  /**
   * Nothing else moves with it: the class's waiting student and guardian
   * requests land in the new teacher's queue on their next read.
   */
  async changeHomeroom(classId, homeroomTeacherMembershipId) {
    const answer = await api.patch(`/academics/classes/${classId}/homeroom`, {
      homeroomTeacherMembershipId,
    });
    return answer?.class ?? null;
  },
};

export default academicsService;
