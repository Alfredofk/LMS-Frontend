/*
  A teacher's meetings for the lesson calendar on /schedule (owner, 2026-10-03:
  the teacher's schedule looks like the student's).

  The backend has no `/sessions/mine` for a teacher (it answers a STUDENT only),
  so the month is put together here from two reads the teacher may make:

  - `GET /academics/class-subjects?mine=true`: their own teaching assignments
    (classSubjectView, academics.service.js). `mine=true` matters: without it a
    Principal or Vice Principal who also teaches is answered with the school's
    queue instead.
  - `GET /sessions/class-subjects/:id/sessions` for each ACTIVE one: every
    meeting of it (sessionView, sessions.service.js), whole semester at once.

  An assignment that was ended keeps status ACTIVE with `endedAt`; its meetings
  from then on went to the successor, so only the ones that began before it ended
  are this teacher's.

  The rows take the shape the calendar already draws for a student
  (`GET /sessions/mine`): sessionView plus `classSubjectId`, `subject`, and
  `class` as a name; `attendance` is null, since a teacher has none of their own.
*/

/** The assignments whose meetings belong on a teacher's calendar. */
export const teachingAssignments = (classSubjects) => (classSubjects ?? []).filter((entry) => entry.status === 'ACTIVE');

/**
 * Every meeting of these assignments on a local day from `from` to `to`
 * (inclusive, YYYY-MM-DD), oldest first.
 *
 * @param assignments  classSubjectView[] (already filtered by teachingAssignments)
 * @param sessionsById { [classSubjectId]: sessionView[] }
 */
export function teacherSessionsIn(assignments, sessionsById, from, to) {
  const out = [];
  for (const assignment of assignments ?? []) {
    const endedAt = assignment.endedAt ? new Date(assignment.endedAt) : null;
    for (const session of sessionsById?.[assignment.id] ?? []) {
      const day = session.local?.date;
      if (!day || day < from || day > to) continue;
      if (endedAt && new Date(session.startsAt) >= endedAt) continue;
      out.push({
        ...session,
        classSubjectId: assignment.id,
        subject: { code: assignment.subject?.code, name: assignment.subject?.name },
        class: assignment.class?.name ?? null,
        attendance: null,
      });
    }
  }
  return out.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}
