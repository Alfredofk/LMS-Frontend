/*
  A teacher's meetings for the lesson calendar on /schedule (owner, 2026-10-03:
  the teacher's schedule looks like the student's).

  Since backend 1bd81ab a teacher reads their own days in one request,
  `GET /sessions/teaching?from=&to=` (sessions.service.js `listTeaching`, at most
  42 days): the meetings they answer for - their live assignments', and an ended
  one's in a slot they now teach. Until 2026-10-05 this file put the month
  together itself from `?mine=true` and one `/class-subjects/:id/sessions` per
  assignment (1 + N), which also missed the successor's meetings.

  Two things the route does not do, done here:
  - it keeps a closed academic year's meetings - closing a year leaves its
    assignments ACTIVE (academics.service.js closeAcademicYear) - so they are left
    out by the year's label, which every session carries (`academicYear`);
  - its rows have no student `attendance`; the calendar draws a teacher's row
    without one, so it is set to null, the shape a student's row has.
*/

/** The labels of the academic years still ACTIVE (`GET /academics/academic-years`). */
export const openYearLabels = (years) =>
  new Set((years ?? []).filter((year) => year.status === 'ACTIVE').map((year) => year.label));

/**
 * `listTeaching`'s sessions without a closed year's, each with `attendance: null`.
 * Without `openLabels` (the years could not be read) nothing is left out.
 */
export const openTeachingSessions = (sessions, openLabels = null) =>
  (sessions ?? [])
    .filter((session) => !openLabels || openLabels.has(session.academicYear))
    .map((session) => ({ ...session, attendance: null }));
