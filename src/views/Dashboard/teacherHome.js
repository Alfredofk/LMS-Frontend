/*
  What the teacher's dashboard counts and lists (owner, 2026-10-05: the dashboard
  on real data, "-" where no route exists yet, as on the student's).

  - Live assignments: `GET /academics/class-subjects?mine=true` (classSubjectView),
    ACTIVE and not ended - the same rows /teacher/courses calls "taught now".
  - Meetings: `GET /sessions/teaching?from=&to=` (backend 1bd81ab, one request, at
    most 42 days): the meetings the teacher answers for, each a sessionView plus
    `classSubjectId`, `class` (name), `academicYear` (label) and `subject`. A closed
    year's are left out and each class gets its grade from the assignments
    (dayMeetings), then shown a day at a time (teachingDay).
  - Students: `GET /tracking/class-subjects/:id/progress` per live assignment, the
    only roster a subject teacher may read (`GET /academics/classes/:id` is for the
    Principal and the homeroom teacher). Its `students` include who left or moved,
    so only `placedNow` ones count.
*/

/**
 * The ids of every semester in an ACTIVE academic year (`GET /academics/academic-years`).
 * Closing a year changes only the year's status: its assignments stay ACTIVE with no
 * `endedAt` and its meetings stay SCHEDULED (academics.service.js closeAcademicYear),
 * so "taught now" has to ask the year as well.
 */
export const openSemesterIds = (years) =>
  new Set((years ?? []).filter((year) => year.status === 'ACTIVE').flatMap((year) => (year.semesters ?? []).map((s) => s.id)));

/**
 * The assignments taught now: ACTIVE, not ended, and - when `openSemesters` is
 * given - in a semester of a year still ACTIVE.
 */
export const liveAssignments = (rows, openSemesters = null) =>
  (rows ?? []).filter(
    (row) => row.status === 'ACTIVE' && !row.endedAt && (!openSemesters || openSemesters.has(row.semester?.id))
  );

/** How many different classes the live assignments are in. */
export const classCount = (live) => new Set((live ?? []).map((row) => row.class?.id).filter(Boolean)).size;

/**
 * Students placed now in any of the teacher's classes, each counted once.
 * null when any read failed: a total missing a class is a number nobody counted.
 *
 * @param progresses  one classSubjectProgress answer per live assignment, null where it failed
 */
export function uniqueStudentCount(progresses) {
  if ((progresses ?? []).some((answer) => !answer)) return null;
  const ids = new Set();
  for (const answer of progresses) {
    for (const student of answer.students ?? []) if (student.placedNow) ids.add(student.studentProfileId);
  }
  return ids.size;
}

/** The semester the live assignments are in, `{ ordinal, academicYear }`, or null. */
export const currentSemester = (live) => live?.[0]?.semester ?? null;

/** 'YYYY-MM-DD' moved by `n` days. */
export function addDays(date, n) {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + n);
  return at.toISOString().slice(0, 10);
}

/** How far ahead the dashboard reads, so a day with none can name the next: the route's 42 days. */
export const DAYS_AHEAD = 41;

/**
 * `GET /sessions/teaching`'s sessions as the day card draws them: a closed year's
 * left out (the route keeps them), and `class` as `{ name, gradeLevel }`, the grade
 * taken from the teacher's assignments - the route sends the name alone. A meeting
 * of an assignment not among `live` (an ended one the teacher answers for as its
 * successor) keeps its name and goes without a grade.
 *
 * @param sessions    the route's sessions
 * @param live        liveAssignments(...)
 * @param openLabels  labels of the ACTIVE years; null leaves nothing out
 */
export function dayMeetings(sessions, live, openLabels = null) {
  const grade = new Map((live ?? []).map((row) => [row.id, row.class?.gradeLevel ?? null]));
  return (sessions ?? [])
    .filter((session) => !openLabels || openLabels.has(session.academicYear))
    .map((session) => ({ ...session, class: { name: session.class ?? null, gradeLevel: grade.get(session.classSubjectId) ?? null } }));
}

/**
 * The teacher's day on the dashboard (owner, 2026-10-05: today only, not the week).
 *
 * Answers `{ meetings, next }`:
 * - meetings: every meeting on `today` (the school's day), soonest first, any
 *   status - one over or cancelled still says so on its row;
 * - next: when today has none, the first meeting still to come (not cancelled, not
 *   over) among those read, for the "next meeting" line; otherwise null.
 *
 * @param meetings  dayMeetings(...)
 * @param today     the school's day, YYYY-MM-DD
 */
export function teachingDay(meetings, today, now = new Date()) {
  const all = (meetings ?? []).filter((session) => session.local?.date);
  all.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  const onToday = all.filter((session) => session.local.date === today);
  const next =
    onToday.length > 0
      ? null
      : all.find((session) => session.status === 'SCHEDULED' && new Date(session.endsAt) > now) ?? null;
  return { meetings: onToday, next };
}
