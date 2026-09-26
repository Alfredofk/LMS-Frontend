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

  /*
    Moving a student to another class — ticket 16, backend `89d1fc1`. Between two
    homeroom teachers only; the Principal takes no part. A move as it comes back
    (`classMoveView`):

      { id, status: PENDING|ACTIVE|REJECTED|CANCELLED, reason, requestedAt,
        decidedAt, rejectionReason,
        student: { studentProfileId, fullName, nisn },
        fromClass: { id, name, gradeLevel }, toClass: { id, name, gradeLevel },
        canDecide, canCancel }

    canDecide / canCancel are the server's answer to "whose buttons are these".
  */

  /**
   * Every other class of the same academic year, for a homeroom teacher of
   * `classId`. One with no homeroom teacher is listed with `acceptsMoves: false`.
   *
   * @returns {Promise<Array<{ id, name, gradeLevel, homeroomTeacher: { membershipId, fullName }|null, acceptsMoves: boolean }>>}
   */
  async moveTargets(classId) {
    const answer = await api.get(`/academics/classes/${classId}/move-targets`);
    return answer?.classes ?? [];
  },

  /** Moves out of or into the reader's classes, every status, newest first. */
  async classMoves() {
    const answer = await api.get('/academics/class-moves');
    return answer?.classMoves ?? [];
  },

  /**
   * Asked by the homeroom teacher of the class the student sits in. Comes back
   * ACTIVE at once when the reader is homeroom of the target class too.
   *
   * @param {{ studentProfileId: string, toClassId: string, reason?: string }} body
   */
  async requestMove(body) {
    const answer = await api.post('/academics/class-moves', body);
    return answer?.classMove ?? null;
  },

  async approveMove(id) {
    const answer = await api.post(`/academics/class-moves/${id}/approve`);
    return answer?.classMove ?? null;
  },

  async rejectMove(id, reason) {
    const answer = await api.post(`/academics/class-moves/${id}/reject`, { reason });
    return answer?.classMove ?? null;
  },

  async cancelMove(id) {
    const answer = await api.post(`/academics/class-moves/${id}/cancel`);
    return answer?.classMove ?? null;
  },

  /*
    Subjects and who teaches them — ticket 08, backend `89d1fc1`.

    A subject: { id, code, name, national } — the national catalog (seeded by a
    migration) plus the school's local ones. A teaching assignment
    (`classSubjectView`):

      { id, status: PENDING|ACTIVE|REJECTED|CANCELLED, requestedAt, decidedAt,
        rejectionReason, createdViaOverride, endedAt,
        class: { id, name, gradeLevel }, subject: { id, code, name },
        semester: { id, ordinal, academicYear: '2026/2027' },
        teacher: { membershipId, fullName } }
  */

  /** National first, then the school's own, each by code. */
  async subjects() {
    const answer = await api.get('/academics/subjects');
    return answer?.subjects ?? [];
  },

  /** A local subject; the Principal's. */
  async createSubject(body) {
    const answer = await api.post('/academics/subjects', body);
    return answer?.subject ?? null;
  },

  /**
   * Every class of the semester's year with what is taught in it (PENDING and
   * ACTIVE). Not unwrapped: the answer *is* `{ semester, classes }`.
   *
   * @returns {Promise<{ semester: { id, ordinal, status, academicYear, classSubjectRegistrationDeadline },
   *   classes: Array<{ id, name, gradeLevel, homeroomTeacher, subjects: Array<{ classSubjectId, status, subject, teacher }> }> }>}
   */
  async subjectBoard(semesterId) {
    return api.get(`/academics/semesters/${semesterId}/class-subjects`);
  },

  /** The Principal: the queue (PENDING unless asked). A teacher: their own, every status. */
  async classSubjects(status) {
    const answer = await api.get('/academics/class-subjects', { query: status ? { status } : undefined });
    return answer?.classSubjects ?? [];
  },

  async approveClassSubject(id) {
    const answer = await api.post(`/academics/class-subjects/${id}/approve`);
    return answer?.classSubject ?? null;
  },

  async rejectClassSubject(id, reason) {
    const answer = await api.post(`/academics/class-subjects/${id}/reject`, { reason });
    return answer?.classSubject ?? null;
  },

  /**
   * At most 100 ids, each approved on its own. Always 200.
   *
   * @returns {Promise<{ results: Array<{ id, ok, status?, error?: { code, message } }>, summary: { approved, failed } }>}
   */
  async approveClassSubjects(ids) {
    return api.post('/academics/class-subjects/approve', { ids });
  },

  /** The Principal names the teacher: ACTIVE at once, deadline or not. */
  async assignClassSubject(body) {
    const answer = await api.post('/academics/class-subjects/override', body);
    return answer?.classSubject ?? null;
  },
};

export default academicsService;
