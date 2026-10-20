import { api } from './apiClient';

/*
  /api/grading (backend 5d42af6, grading-and-report-card ticket 01): grade
  settings; since 79b319f (ticket 02) a slot's running grades too. The report
  card is ticket 05.

  A read (grading.service.js settingsView):
  `{ weights: { value: { TUGAS, KUIS, UTS, UAS }, source },
     kktp: { value, source }, remedialRule: { value, source }, updatedAt | null }`,
  source SLOT | SCHOOL | BUILT_IN. Every write sends back the `updatedAt` it read
  (null before the first save); a stale one is 409, none on an existing row 400.
  Each answers `{ settings, message }` (grading.controller.js), unwrapped here.

  - The school's: read by its staff (Principal, Vice Principal, Teacher); set by
    the Principal or a Vice Principal (403 otherwise), audited.
  - A slot's (Class x Subject x Semester, named by any of its ClassSubjects): read
    by its answering teacher, the Principal, Vice Principals and the class's
    homeroom teacher (404 for anyone else, a student included); set or cleared by
    its answering teacher only (403), never in a CLOSED semester or a closed year
    (409).
  - A slot's grades (grading.grades.js slotGrades): read by the same staff, never
    a student (404). Computed live, stored nowhere. `{ classSubject, settings,
    students: [{ studentProfileId, fullName, placedNow, reportedHere, reportedBy:
    { id, name } | null, grade: { types: { TUGAS|KUIS|UTS|UAS: { average, weight,
    count } | null }, finalGrade: { unrounded, value } | null, didNotSubmit,
    waiting, remedialRuleMoved, pooled } | null, describedHere, description }] }` -
    `grade` only where this slot reports the student.
*/

const q = (id) => encodeURIComponent(id);

export const gradingService = {
  async schoolSettings() {
    const answer = await api.get('/grading/settings');
    return answer?.settings ?? null;
  },

  /** `{ weights?, kktp?, remedialRule?, updatedAt }` - at least one change. */
  async setSchoolSettings(body) {
    const answer = await api.put('/grading/settings', body);
    return answer?.settings ?? null;
  },

  async slotSettings(classSubjectId) {
    const answer = await api.get(`/grading/class-subjects/${q(classSubjectId)}/settings`);
    return answer?.settings ?? null;
  },

  /** `{ weights?: {...} | null, kktp?: number | null, updatedAt }` - null puts that one back to the school's. */
  async setSlotSettings(classSubjectId, body) {
    const answer = await api.put(`/grading/class-subjects/${q(classSubjectId)}/settings`, body);
    return answer?.settings ?? null;
  },

  /** The slot's running grades, unwrapped as the backend answers them (no envelope key). */
  async slotGrades(classSubjectId) {
    return api.get(`/grading/class-subjects/${q(classSubjectId)}/grades`);
  },

  /**
   * The Answering Teacher's Descriptions (backend 483be5a, ticket 03), many at once,
   * all or none: `[{ studentProfileId, text (1-1000, never emptied), updatedAt | null }]`,
   * each row the updatedAt it read. Answers the rows as they now are (`{ descriptions,
   * message }`, unwrapped). A stale row is 409 naming whose (`details.studentProfileIds`);
   * a student the slot does not describe is 400, the same way.
   */
  async writeDescriptions(classSubjectId, descriptions) {
    const answer = await api.put(`/grading/class-subjects/${q(classSubjectId)}/descriptions`, { descriptions });
    return answer?.descriptions ?? [];
  },

  /**
   * A Class's Homeroom Notes for one Semester of its year (backend 483be5a, ticket 03),
   * read by its Homeroom Teacher, the Principal and the Vice Principals (404 for anyone
   * else): `{ class, academicYear, semester: { id, ordinal, status }, students: [{
   * studentProfileId, fullName, note: { text | null, updatedAt } | null }] }` - the
   * students placed there now, by name. Bare, no envelope key.
   */
  async notes(classId, semesterId) {
    return api.get(`/grading/classes/${q(classId)}/semesters/${q(semesterId)}/notes`);
  },

  /**
   * The Homeroom Teacher writes Notes, many at once, all or none: `[{ studentProfileId,
   * text (<= 1000) | null, updatedAt | null }]` - null or empty clears one. 403 for a
   * leader, 409 for a stale row (naming whose) or a closed semester or year, 400 for a
   * student not placed there now. Answers the rows as they now are.
   */
  async writeNotes(classId, semesterId, notes) {
    const answer = await api.put(`/grading/classes/${q(classId)}/semesters/${q(semesterId)}/notes`, { notes });
    return answer?.notes ?? [];
  },

  /*
    Finalising (backend eadf680, ticket 04). The Principal moves a semester OPEN ->
    FINALIZING and back (a Vice Principal is told no); answers `{ semester: { id,
    ordinal, status, academicYear }, message }`, unwrapped to the semester. Stopping is
    refused (409, `details.finalised`) while any slot is finalised.
  */
  async startFinalising(semesterId) {
    const answer = await api.post(`/grading/semesters/${q(semesterId)}/start-finalising`);
    return answer?.semester ?? null;
  },

  async stopFinalising(semesterId) {
    const answer = await api.post(`/grading/semesters/${q(semesterId)}/stop-finalising`);
    return answer?.semester ?? null;
  },

  /**
   * The readiness board, for the Principal and the Vice Principals (a Teacher 403):
   * `{ semester, counts: { slots, finalised, notesMissing }, slots: [{ classSubjectId,
   * class, subject, teacher | null, finalised | null, blockers }], notes: [{ class,
   * homeroomTeacher | null, students, missing: [{ studentProfileId, fullName }] }] }`.
   * Bare, no envelope key. Computed live, one slot at a time: not cheap.
   */
  async readiness(semesterId) {
    return api.get(`/grading/semesters/${q(semesterId)}/readiness`);
  },

  /**
   * The answering teacher finalises the slot (only while its semester is FINALIZING),
   * or undoes it (until CLOSED). A blocked one is 409 with `details.blockers`. Answers
   * the slot's grades, as slotGrades reads them.
   */
  async finalise(classSubjectId) {
    const answer = await api.post(`/grading/class-subjects/${q(classSubjectId)}/finalise`);
    return answer?.grades ?? null;
  },

  async unfinalise(classSubjectId) {
    const answer = await api.post(`/grading/class-subjects/${q(classSubjectId)}/unfinalise`);
    return answer?.grades ?? null;
  },

  /**
   * The Principal closes a FINALIZING semester (backend 3a22f90, ticket 05; a Vice
   * Principal is told no, 403), on or after its last day, dating its report cards
   * 'YYYY-MM-DD' from its first day to 30 days after its last (400 otherwise). Every
   * report card is written in the same step, which may take up to a minute (503
   * TIMEOUT past it, nothing saved). 409 while a subject is not finalised, one is
   * blocked or a note is missing, `details: { notFinalised, blocked, notesMissing }`.
   * Answers `{ semester, reportDate, version, reportCards (how many), message }`, bare.
   */
  async closeSemester(semesterId, reportDate) {
    return api.post(`/grading/semesters/${q(semesterId)}/close`, { reportDate });
  },

  /**
   * The Principal takes a CLOSED semester back to FINALIZING (backend 46c6173, ticket 06;
   * a Vice Principal 403), with a reason (1-500) and the slots unfinalised at once, named
   * by any ClassSubject of each (none: a note only). 409 for a semester not closed or a
   * closed year, 400 for an id not of its slots. Its report cards stay; the next close
   * writes the next version. Answers `{ semester, unfinalised: [slotRef], message }`, bare.
   */
  async reopenSemester(semesterId, body) {
    return api.post(`/grading/semesters/${q(semesterId)}/reopen`, body);
  },

  /*
    Report cards (backend 3a22f90 / 46c6173, tickets 05-06), frozen at close. A student
    reads their own, the newest of each semester, latest semester first; one card is
    read by its student (the newest only), the homeroom teacher of its class and the
    leaders, whose read names every `versions` they may open; a class's for a semester
    by the same staff, the newest of each student closed in it, by name. Anyone else
    404. Shapes in views/ReportCards/reportCards.js.
  */
  async myReportCards() {
    const answer = await api.get('/grading/report-cards/mine');
    return answer?.reportCards ?? [];
  },

  async reportCard(reportCardId) {
    const answer = await api.get(`/grading/report-cards/${q(reportCardId)}`);
    return answer?.reportCard ?? null;
  },

  /** `{ class, academicYear, semester: { id, ordinal, status }, reportCards }`, bare. */
  async classReportCards(classId, semesterId) {
    return api.get(`/grading/classes/${q(classId)}/semesters/${q(semesterId)}/report-cards`);
  },

  /** Back to the school's settings, all of them. */
  async clearSlotSettings(classSubjectId, updatedAt) {
    const answer = await api.del(`/grading/class-subjects/${q(classSubjectId)}/settings`, { body: { updatedAt: updatedAt ?? null } });
    return answer?.settings ?? null;
  },
};

export default gradingService;
