import { timeRange } from '../Subjects/timetable.js';

/*
  "Kelas Saya" for a student (owner, 2026-10-04) - what the page decides, apart
  from its markup so it can be tested.

  - `GET /academics/me/class-subjects` (backend 1bd81ab): the student's subjects,
    `{ id, class: { id, name }, subject: { id, code, name }, semester: { id,
    ordinal, academicYear }, teacher: { fullName }, current, ended }`. No semester
    dates. Since 4bdd397 (request #11) from every class they sat in here, not just
    the current one: `current` false for an earlier class (read only, nothing
    tracked, its meetings only those begun before they left), `ended` true for an
    assignment that ended - its successor is a row of its own. A teacher's rows
    (TeacherCourses) carry neither key, so the helpers here read `current !== false`.
  - `GET /sessions/class-subjects/:id/sessions` per subject: every meeting by
    number, the timetable's sessionView (`local` in the school's zone, `status`,
    `cancelReason`, `completedAt`, `topic`).
  - `GET /attendance/me?classSubjectId=` on a subject's page: the student's own
    rows (views/Attendance/attendance.js).
*/

/*
  A number cancelled because the timetable stopped reaching it keeps a stale date,
  so no calendar shows it (sessions.service.js SHOWN_ON_CALENDAR). One cancelled
  for a holiday, as not held or as its subject stopped is shown, cancelled.
*/
export const shownSessions = (sessions) =>
  (sessions ?? []).filter((session) => session.status === 'SCHEDULED' || session.cancelReason !== 'SCHEDULE_CHANGED');

/** A row of the class the student sits in now (a teacher's rows count as theirs). */
export const isCurrentClass = (entry) => entry?.current !== false;

/**
 * What "Kelas Saya" lists (owner, 2026-10-07): every row, but an ended assignment
 * only when it has meetings to read - one replaced before it ever met would be a
 * second, empty card beside its successor. One whose meetings could not be read is
 * kept, so nothing vanishes on a failed read.
 */
export function listedClassSubjects(classSubjects, sessionsById) {
  return (classSubjects ?? []).filter((entry) => {
    if (!entry.ended) return true;
    const sessions = sessionsById?.[entry.id];
    return !Array.isArray(sessions) || shownSessions(sessions).length > 0;
  });
}

/**
 * The subjects running in the class the student sits in now: not an earlier
 * class's, not an ended assignment. What the dashboard counts (owner, 2026-10-07).
 */
export const liveClassSubjects = (classSubjects) =>
  (classSubjects ?? []).filter((entry) => isCurrentClass(entry) && !entry.ended);

/**
 * The semesters the subjects span, oldest first (year, then ordinal):
 * `[{ id, ordinal, academicYear, pastClass }]`. `pastClass` names the class when
 * every row of that semester is an earlier class's, so the dropdown can say which
 * (owner, 2026-10-07); null when the current class is in it.
 */
export function semestersOf(classSubjects) {
  const byId = new Map();
  for (const entry of classSubjects ?? []) {
    const id = entry.semester?.id;
    if (!id) continue;
    const seen = byId.get(id) ?? { ...entry.semester, current: false, pastClass: null };
    if (isCurrentClass(entry)) seen.current = true;
    else seen.pastClass ??= entry.class?.name ?? null;
    byId.set(id, seen);
  }
  return [...byId.values()]
    .map(({ current, pastClass, ...semester }) => ({ ...semester, pastClass: current ? null : pastClass }))
    .sort((a, b) => String(a.academicYear).localeCompare(String(b.academicYear)) || a.ordinal - b.ordinal);
}

/*
  The semester to open (owner, 2026-10-04). The answer carries no semester dates,
  so the meetings tell: the semester whose meetings span now; else the last one
  whose meetings have begun; else the first. Cancelled meetings count too - a
  semester whose first week fell on a holiday has still begun. Only the current
  class's semesters are candidates while it has any, so an earlier class never
  opens first.
*/
export function defaultSemesterId(rows, sessionsById, now = new Date()) {
  const own = (rows ?? []).filter(isCurrentClass);
  const classSubjects = own.length > 0 ? own : rows;
  const semesters = semestersOf(classSubjects);
  if (semesters.length === 0) return null;

  const spans = semesters.map((semester) => {
    const sessions = (classSubjects ?? [])
      .filter((entry) => entry.semester?.id === semester.id)
      .flatMap((entry) => shownSessions(sessionsById?.[entry.id]));
    if (sessions.length === 0) return { id: semester.id, first: null, last: null };
    const starts = sessions.map((session) => new Date(session.startsAt).getTime());
    const ends = sessions.map((session) => new Date(session.endsAt).getTime());
    return { id: semester.id, first: Math.min(...starts), last: Math.max(...ends) };
  });

  const at = now.getTime();
  const running = spans.find((span) => span.first !== null && span.first <= at && at <= span.last);
  if (running) return running.id;
  const begun = spans.filter((span) => span.first !== null && span.first <= at);
  if (begun.length > 0) return begun[begun.length - 1].id;
  return spans[0].id;
}

/**
 * A subject's meetings counted: `held` scheduled meetings already over, `total`
 * scheduled ones (cancelled left out), `current` the one running now, `next`
 * the first still to start. Null for a subject whose meetings could not be read.
 */
export function progressOf(sessions, now = new Date()) {
  if (!Array.isArray(sessions)) return null;
  const scheduled = shownSessions(sessions)
    .filter((session) => session.status === 'SCHEDULED')
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const at = now.getTime();
  const held = scheduled.filter((session) => new Date(session.endsAt).getTime() < at).length;
  const current =
    scheduled.find((session) => new Date(session.startsAt).getTime() <= at && at <= new Date(session.endsAt).getTime()) ??
    null;
  const next = scheduled.find((session) => new Date(session.startsAt).getTime() > at) ?? null;
  return { held, total: scheduled.length, current, next };
}

/** Subjects matching the navbar search (`?q=`): code, name or teacher, any case. */
export function matchesSearch(entry, query) {
  const q = String(query ?? '').trim().toLocaleLowerCase();
  if (!q) return true;
  return [entry.subject?.code, entry.subject?.name, entry.teacher?.fullName].some((value) =>
    String(value ?? '').toLocaleLowerCase().includes(q)
  );
}

/*
  What a meeting row says about the student, from their own attendance row:
  - cancelled: the timetable's reason (`timetable.session.cancelled.*`);
  - not begun: scheduled;
  - begun, a row: its status, final once the teacher confirmed, else waiting;
  - begun, no row: before confirmation nobody but a check-in has one, so waiting;
    after it every student has one, so a missing row is not expected - waiting.
  Answers `{ key, status? , final }`.
*/
export function meetingState(session, attendance, now = new Date()) {
  if (session.status === 'CANCELLED') {
    return { key: `timetable.session.cancelled.${session.cancelReason ?? 'OTHER'}`, final: true };
  }
  if (new Date(session.startsAt).getTime() > now.getTime()) return { key: 'timetable.session.scheduled', final: false };
  if (attendance) {
    const final = Boolean(attendance.session?.confirmed);
    return { key: `att.status.${attendance.status}`, status: attendance.status, final };
  }
  return { key: 'att.pending', final: false };
}

/**
 * When a meeting is, in the school's own day and clock: "Sen, 14 Okt, 07:30".
 * The day comes from `local.date` read as UTC, so the browser's zone never moves
 * it; `withEnd` adds the end ("07:30-09:00"). A meeting in another year than
 * `now` names its year ("Sel, 22 Agu 2028, 07:00") - without it a meeting two
 * years ahead read as one already past (owner, 2026-10-04).
 */
export function meetingWhen(session, lang = 'id', { withEnd = false, weekday = 'short', now = new Date() } = {}) {
  const local = session?.local;
  if (!local?.date) return '';
  const otherYear = Number(local.date.slice(0, 4)) !== now.getFullYear();
  const day = new Date(`${local.date}T00:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', {
    weekday,
    day: 'numeric',
    month: 'short',
    ...(otherYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
  const time = withEnd && local.end ? timeRange(local.start, local.end) : local.start;
  return `${day}, ${time}`;
}

/**
 * The meeting a subject's page opens on: the one running now, else the next to
 * start, else the last one (everything over). Cancelled ones are passed over
 * unless they are all there is. Null with no meetings.
 */
export function defaultMeetingId(sessions, now = new Date()) {
  const list = shownSessions(sessions).sort((a, b) => a.number - b.number);
  if (list.length === 0) return null;
  const progress = progressOf(list, now);
  const pick = progress.current ?? progress.next;
  if (pick) return pick.id;
  const held = list.filter((session) => session.status === 'SCHEDULED');
  return (held[held.length - 1] ?? list[list.length - 1]).id;
}

/*
  The row of meeting tabs (owner, 2026-10-04, after BINUSMAYA's "Session 5 ...
  Session 12 · 4 more"): `size` tabs around the chosen meeting - it sits
  second-to-last when it can, so what comes next is in view too - and the rest
  behind "N more". Answers { shown, rest } in meeting order.
*/
export function meetingWindow(sessions, selectedId, size = 8) {
  const list = [...(sessions ?? [])].sort((a, b) => a.number - b.number);
  if (list.length <= size) return { shown: list, rest: [] };
  const at = Math.max(0, list.findIndex((session) => session.id === selectedId));
  const start = Math.min(Math.max(0, at - (size - 2)), list.length - size);
  const shown = list.slice(start, start + size);
  return { shown, rest: list.filter((session) => !shown.includes(session)) };
}

/**
 * The next meeting of any of the student's subjects - the first scheduled one
 * still to start - with its subject: `{ entry, session }`, or null with none.
 * For the dashboard's empty day (owner, 2026-10-04).
 */
export function nextMeetingAcross(classSubjects, sessionsById, now = new Date()) {
  let best = null;
  for (const entry of liveClassSubjects(classSubjects)) {
    const next = progressOf(sessionsById?.[entry.id], now)?.next;
    if (next && (!best || new Date(next.startsAt) < new Date(best.session.startsAt))) best = { entry, session: next };
  }
  return best;
}

/**
 * The subjects of the semester the meetings say is on (defaultSemesterId), each
 * with its meetings counted: `[{ entry, progress }]`, progress null when a
 * subject's meetings could not be read. For the dashboard.
 */
export function currentSubjects(rows, sessionsById, now = new Date()) {
  const classSubjects = liveClassSubjects(rows);
  const semesterId = defaultSemesterId(classSubjects, sessionsById, now);
  return classSubjects
    .filter((entry) => entry.semester?.id === semesterId)
    .map((entry) => ({ entry, progress: progressOf(sessionsById?.[entry.id], now) }));
}
