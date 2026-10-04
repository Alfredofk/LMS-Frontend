/*
  A student's own attendance (backend deb95e8, teaching-and-learning 03) — what the
  page decides, apart from its markup so it can be tested.

  `GET /attendance/me` answers `{ attendance }` (attendance.controller.js `mine`):
  one row per Session the student has a record for, oldest first — in every Class
  they sat in at this school since backend 87f2670 (owner, 2026-10-02), each
  Session naming its Class. Each row is attendanceView plus the attendance module's own
  sessionView (attendance.service.js):

    { id, studentProfileId, status: PRESENT|SICK|EXCUSED|ABSENT, checkedInAt,
      outsideSchool, late,
      session: { id, number, startsAt, endsAt, status, needsCompletion,
                 confirmed, completedAt, class, subject: { code, name } } }

  A row exists once the student checked in (PRESENT, not yet final) or once the
  teacher confirmed (everyone else ABSENT, any status the teacher set). So a
  status is final only when `session.confirmed`. The teacher's note is not here —
  `/:id/history` is staff only.

  Unlike `/sessions`, this sessionView carries no `local` date: the school's day
  and clock are worked out here from `startsAt`, the way `utcToLocal` does on the
  server (shared/timeZone.js) — a fixed offset per zone, since Indonesia keeps no
  daylight saving.
*/

export const STATUSES = ['PRESENT', 'SICK', 'EXCUSED', 'ABSENT'];

/* A status's colours: a tile's tint and text, and a dot or bar segment (owner, 2026-10-04: Izin sky, Sakit amber). */
export const STATUS_TILE = {
  PRESENT: 'bg-emerald-50 text-emerald-700',
  SICK: 'bg-amber-50 text-amber-700',
  EXCUSED: 'bg-sky-50 text-sky-700',
  ABSENT: 'bg-rose-50 text-rose-700',
};
export const STATUS_DOT = {
  PRESENT: 'bg-emerald-500',
  SICK: 'bg-amber-400',
  EXCUSED: 'bg-sky-500',
  ABSENT: 'bg-rose-500',
};

const OFFSET_HOURS = { WIB: 7, WITA: 8, WIT: 9 };
const HOUR = 60 * 60 * 1000;

/**
 * An instant in the school's own zone: `{ date: 'YYYY-MM-DD', time: 'HH:mm',
 * dayOfWeek: 1 (Monday) … 7 }`, as shared/timeZone.js `utcToLocal` answers. With no
 * zone known it falls back to the device's own clock — never reached while a row
 * exists, since a timetable cannot be set without one.
 */
export function localOf(instant, zone) {
  const at = new Date(instant);
  if (Number.isNaN(at.getTime())) return null;
  const hours = OFFSET_HOURS[zone];
  const shifted = hours === undefined ? new Date(at.getTime() - at.getTimezoneOffset() * 60000) : new Date(at.getTime() + hours * HOUR);
  const iso = shifted.toISOString();
  const day = shifted.getUTCDay();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16), dayOfWeek: day === 0 ? 7 : day };
}

/* A row whose Session was cancelled after the fact is shown but never counted. */
const counts = (row) => row.session?.status === 'SCHEDULED';

/**
 * The numbers over some rows. Status counts and the rate are over confirmed rows
 * only (owner, 2026-10-02): a check-in the teacher has not confirmed may still
 * change. `rate` is a whole percentage of PRESENT among them, or null with none.
 * `late` and `outside` count the student's check-ins, confirmed or not.
 */
export function summarize(rows) {
  const out = { confirmed: 0, pending: 0, PRESENT: 0, SICK: 0, EXCUSED: 0, ABSENT: 0, late: 0, outside: 0, rate: null };
  for (const row of rows ?? []) {
    if (!counts(row)) continue;
    if (row.late) out.late += 1;
    if (row.outsideSchool) out.outside += 1;
    if (!row.session.confirmed) {
      out.pending += 1;
      continue;
    }
    out.confirmed += 1;
    if (row.status in out) out[row.status] += 1;
  }
  if (out.confirmed > 0) out.rate = Math.round((out.PRESENT / out.confirmed) * 100);
  return out;
}

/*
  A subject as taught in one Class (owner, 2026-10-03): Matematika in X IPS and
  in XI IPS are two teachers and two sets of meetings, so they are counted apart.
  The row names its Class by name only (no id), so one name reused across years
  — a repeated grade — would share a group.
*/
export const groupKey = (row) => `${row.session?.subject?.code ?? ''}@${row.session?.class ?? ''}`;

/** Each subject in each Class with its own numbers, by subject name then Class. */
export function bySubject(rows) {
  const groups = new Map();
  for (const row of rows ?? []) {
    const subject = row.session?.subject;
    if (!subject?.code) continue;
    const key = groupKey(row);
    if (!groups.has(key)) groups.set(key, { key, subject, className: row.session.class ?? '', rows: [] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()]
    .map(({ rows: list, ...group }) => ({ ...group, ...summarize(list) }))
    .sort((a, b) => a.subject.name.localeCompare(b.subject.name) || a.className.localeCompare(b.className));
}

/** The history, newest Session first, narrowed to one group (`groupKey`) when given. */
export function historyOf(rows, key = '') {
  return (rows ?? [])
    .filter((row) => !key || groupKey(row) === key)
    .sort((a, b) => new Date(b.session.startsAt) - new Date(a.session.startsAt) || b.session.number - a.session.number);
}

/**
 * A Session's roster by status (`GET /attendance/sessions/:id`, rosterView):
 * each status counted, and `unmarked` for a student with no record yet — before
 * confirmation, everyone who has not checked in.
 */
export function rosterCounts(students) {
  const out = { PRESENT: 0, SICK: 0, EXCUSED: 0, ABSENT: 0, unmarked: 0 };
  for (const student of students ?? []) {
    if (student.status in out && student.status !== 'unmarked') out[student.status] += 1;
    else out.unmarked += 1;
  }
  return out;
}

/**
 * One semester of a student's summary (`GET /members/:id`, attendanceSummary):
 * the share present among the meetings counted - confirmed ones only, as
 * `summarize` counts - or null with none counted yet.
 */
export const semesterRate = (semester) =>
  semester?.counted > 0 ? Math.round((semester.present / semester.counted) * 100) : null;

/**
 * The student dashboard's attendance card (owner, 2026-10-02), from rows or a
 * failed read: `{ value, lines: [{ key, vars }] }`. The rate over confirmed
 * meetings, or "—" with none confirmed yet; never a 0 nobody counted.
 */
export function attendanceStat(rows, failed = false) {
  if (failed) return { value: '-', lines: [{ key: 'dash.att.failed' }] };
  if (rows === null || rows === undefined) return { value: '…', lines: [] };
  const s = summarize(rows);
  const lines = [];
  if (s.confirmed > 0) lines.push({ key: 'dash.att.of', vars: { present: s.PRESENT, n: s.confirmed } });
  if (s.pending > 0) lines.push({ key: 'att.pendingCount', vars: { n: s.pending } });
  if (lines.length === 0) lines.push({ key: 'dash.att.none' });
  return { value: s.rate === null ? '-' : `${s.rate}%`, lines };
}
