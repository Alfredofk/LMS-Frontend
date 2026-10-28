import { localOf } from '../Attendance/attendance';

/*
  The student dashboard's own counting (owner, 2026-10-27, the design kept in
  `.claude/skills/eduforid-design`). Pure: the cards are Konsistensi
  (ConsistencyCard), "Perlu dikerjakan" (TodoCard) and "Kemajuan mapel"
  (SubjectProgressCard).

  Everything here is worked out from what the dashboard already reads -
  `GET /attendance/me`, `GET /assessments/mine`, the subjects' meetings - so the
  light game on the dashboard counts nothing the backend did not record.
*/

const DAY = 24 * 60 * 60 * 1000;

/* A row whose meeting was cancelled after the fact is shown but never counted (attendance.js). */
const counts = (row) => row?.session?.status === 'SCHEDULED';

/**
 * Meetings attended in a row, newest first, until the first one that was not
 * PRESENT (owner, 2026-10-27: counted per meeting, not per day). Only meetings
 * already begun count. A meeting missed has no row until the teacher confirms
 * it, so until then the run does not break.
 */
export function streakOf(rows, now = new Date()) {
  const begun = (rows ?? [])
    .filter((row) => counts(row) && new Date(row.session.startsAt) <= now)
    .sort((a, b) => new Date(b.session.startsAt) - new Date(a.session.startsAt));
  let n = 0;
  for (const row of begun) {
    if (row.status !== 'PRESENT') break;
    n += 1;
  }
  return n;
}

/** 'YYYY-MM-DD' moved by `days`. */
const shiftDate = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);

/** The Monday of the week `today` (the school's date) falls in. */
export function mondayOf(today) {
  const day = new Date(`${today}T00:00:00Z`).getUTCDay();
  return shiftDate(today, -((day + 6) % 7));
}

/**
 * Monday to Saturday of this week, one dot each: `{ date, dayOfWeek, state }`.
 * - present: had meetings, every one PRESENT
 * - missed: had meetings, not every one PRESENT
 * - today: today, nothing settled yet
 * - none: a day gone by with no record
 * - future: still to come
 */
export function weekOf(rows, today, zone) {
  if (!today) return [];
  const monday = mondayOf(today);
  const byDate = new Map();
  for (const row of rows ?? []) {
    if (!counts(row)) continue;
    const date = localOf(row.session.startsAt, zone)?.date;
    if (!date) continue;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(row);
  }
  return [0, 1, 2, 3, 4, 5].map((offset) => {
    const date = shiftDate(monday, offset);
    const list = byDate.get(date) ?? [];
    let state;
    if (list.length > 0) state = list.every((row) => row.status === 'PRESENT') ? 'present' : 'missed';
    else if (date === today) state = 'today';
    else state = date < today ? 'none' : 'future';
    return { date, dayOfWeek: offset + 1, state };
  });
}

/* Handed in: marked, or waiting for its marks to be released (studentMenu.js). */
const HANDED_IN = new Set(['RELEASED', 'WAITING_FOR_RELEASE']);

/**
 * This week's graded ONLINE assessments - closing Monday to Sunday in the school's
 * zone - and how many were handed in: `{ done, total }`. A LATIHAN, an OFFLINE
 * paper and a cancelled one are left out, as in "Penilaian dikumpulkan".
 */
export function weekAssessmentsOf(classes, today, zone) {
  if (!today) return { done: 0, total: 0 };
  const monday = mondayOf(today);
  const sunday = shiftDate(monday, 6);
  const entries = (classes ?? []).flatMap((row) => row.assessments ?? []).filter((entry) => {
    const { assessment } = entry;
    if (assessment.mode !== 'ONLINE' || assessment.type === 'LATIHAN' || assessment.status === 'CANCELLED') return false;
    const date = localOf(assessment.closesAt, zone)?.date;
    return Boolean(date) && date >= monday && date <= sunday;
  });
  return { done: entries.filter((entry) => HANDED_IN.has(entry.status)).length, total: entries.length };
}

/**
 * How near a deadline is, for the date box: 'late' once it has closed, 'soon'
 * within 24 hours, '' otherwise.
 */
export function dueToneOf(closesAt, now = new Date()) {
  const left = new Date(closesAt).getTime() - now.getTime();
  if (left <= 0) return 'late';
  return left <= DAY ? 'soon' : '';
}

/**
 * Whole school days from `today` to the day `closesAt` falls on: 0 today, 1
 * tomorrow, negative once gone by.
 */
export function daysUntil(closesAt, today, zone) {
  const date = localOf(closesAt, zone)?.date;
  if (!date || !today) return null;
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
}

/**
 * The meeting to carry on with: the earliest one already begun whose materials are
 * not all completed - `{ session, left }` - or null when every begun meeting is
 * done (or the meetings could not be read). `content` is the meeting's
 * `{ published, completed }` for this student.
 */
export function nextToFinishOf(sessions, now = new Date()) {
  if (!Array.isArray(sessions)) return null;
  const found = sessions
    .filter(
      (session) =>
        session.status === 'SCHEDULED' &&
        new Date(session.startsAt) <= now &&
        (session.content?.published ?? 0) > (session.content?.completed ?? 0)
    )
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0];
  return found ? { session: found, left: found.content.published - found.content.completed } : null;
}
