/*
  The homeroom teacher's view of their class's attendance (owner, 2026-10-02) —
  what HomeroomAttendance decides, apart from its markup so it can be tested.

  The subjects come from the semester's board,
  `GET /academics/semesters/:id/class-subjects` (staff, academics.service.js
  `subjectBoard`): `{ semester, classes: [{ id, name, gradeLevel, homeroomTeacher,
  subjects: [{ classSubjectId, status, subject: { id, code, name }, teacher }] }] }`.
  It lists live assignments only (`endedAt: null`), so the meetings of an ended
  or replaced one cannot be reached from here — said on the page, noted for the
  backend.
*/

/**
 * The class's subjects that can have meetings: ACTIVE ones (a PENDING request
 * never had a timetable), by subject name. Empty when the class is not on the
 * board — a class of another year, say.
 */
export function classSubjectsOf(board, classId) {
  const entry = (board?.classes ?? []).find((boardClass) => boardClass.id === classId);
  return (entry?.subjects ?? [])
    .filter((row) => row.status === 'ACTIVE')
    .sort((a, b) => a.subject.name.localeCompare(b.subject.name));
}
