/*
  A student's lesson calendar on /schedule (owner, 2026-10-03) — what it decides,
  apart from its markup so it can be tested.

  One month at a time from `GET /sessions/mine?from=&to=` (backend 2a281e7): a
  month is at most 31 days, inside the server's 42. Each session carries
  `local.date` in the school's zone, so days are grouped on that and never on a
  Date built in the device's zone. The grid itself is utils/holidays.js
  `monthGrid`, Monday first, the same as the holiday calendar above it.
*/

import { localOf } from '../Attendance/attendance';

const pad = (n) => String(n).padStart(2, '0');

/** First and last day of a month (`month` 0–11), 'YYYY-MM-DD'. */
export function monthRange(year, month) {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return { from: `${year}-${pad(month + 1)}-01`, to: `${year}-${pad(month + 1)}-${pad(last)}` };
}

/** `{ year, month }` moved by `delta` months. */
export function shiftMonth({ year, month }, delta) {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** `{ year, month }` of a 'YYYY-MM-DD'. */
export const monthOf = (isoDate) => ({ year: Number(isoDate.slice(0, 4)), month: Number(isoDate.slice(5, 7)) - 1 });

/** The sessions by their day in the school's zone, each day in start order. */
export function byDay(sessions) {
  const days = new Map();
  for (const session of sessions ?? []) {
    const date = session.local?.date;
    if (!date) continue;
    if (!days.has(date)) days.set(date, []);
    days.get(date).push(session);
  }
  for (const list of days.values()) {
    list.sort((a, b) => a.local.start.localeCompare(b.local.start) || a.number - b.number);
  }
  return days;
}

/** What a day's cell marks: meetings that run, and meetings cancelled. */
export function dayMarks(list) {
  const out = { held: 0, cancelled: 0 };
  for (const session of list ?? []) {
    if (session.status === 'SCHEDULED') out.held += 1;
    else out.cancelled += 1;
  }
  return out;
}

/*
  The month as an agenda (owner, 2026-10-03, after BINUSMAYA's "My Schedule"):
  lessons and holidays together, by day, from a start day to the month's end.
*/

/**
 * Where the list starts: a day the reader picked, else today when it falls in
 * the month, else the first of the month.
 */
export function agendaStart({ year, month }, today, picked = null) {
  const { from, to } = monthRange(year, month);
  if (picked && picked >= from && picked <= to) return picked;
  if (today >= from && today <= to) return today;
  return from;
}

/**
 * The days from `start` to the month's end that hold something, in order:
 * `[{ date, holidays, sessions }]`. `days` is `byDay(sessions)`; `holidays` is
 * utils/holidays.js `daysIndex(items)` — both keyed 'YYYY-MM-DD'.
 */
export function agendaOf({ year, month }, start, days, holidays, exams = null) {
  const { to } = monthRange(year, month);
  const dates = new Set();
  for (const date of days?.keys() ?? []) if (date >= start && date <= to) dates.add(date);
  for (const date of holidays?.keys() ?? []) if (date >= start && date <= to) dates.add(date);
  for (const date of exams?.keys() ?? []) if (date >= start && date <= to) dates.add(date);
  return [...dates].sort().map((date) => ({
    date,
    holidays: holidays?.get(date) ?? [],
    sessions: days?.get(date) ?? [],
    exams: exams?.get(date) ?? [],
  }));
}

/*
  A student's exams on the calendar (owner 2026-10-18): during an Exam Week there
  is no teaching, so what the days hold is the UTS and UAS to sit. Read from the
  student's menu (`GET /assessments/mine`, readMyMenu), one semester at a time.
  Published ones only reach the menu; a cancelled one is left out here. Each is
  shown on every day of its window, in the school's zone (owner: "setiap hari
  jendelanya"), saying when it opens and closes on that day.
*/

const EXAM_TYPES = new Set(['UTS', 'UAS']);

/** The day after a 'YYYY-MM-DD'. */
const nextDay = (date) => new Date(Date.parse(`${date}T00:00:00Z`) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * The menu's UTS and UAS by day: `Map<'YYYY-MM-DD', [{ entry, from, to }]>`.
 * `from` is the opening time on its first day ('00:00' on the others), `to` the
 * closing time on its last ('24:00' on the others, and when it closes at midnight).
 * Each day in opening order.
 */
export function examsByDay(classes, zone) {
  const days = new Map();
  for (const group of classes ?? []) {
    for (const entry of group.assessments ?? []) {
      const { assessment } = entry;
      if (!EXAM_TYPES.has(assessment?.type) || assessment.status === 'CANCELLED') continue;
      const opens = localOf(assessment.opensAt, zone);
      const closes = localOf(assessment.closesAt, zone);
      if (!opens || !closes) continue;
      /* Closing at 00:00 ends the day before. */
      const atMidnight = closes.time === '00:00';
      const lastDay = atMidnight ? localOf(new Date(assessment.closesAt).getTime() - 1, zone).date : closes.date;
      for (let date = opens.date; date <= lastDay; date = nextDay(date)) {
        if (!days.has(date)) days.set(date, []);
        days.get(date).push({
          entry,
          from: date === opens.date ? opens.time : '00:00',
          to: date === lastDay && !atMidnight ? closes.time : '24:00',
        });
      }
    }
  }
  for (const list of days.values()) {
    list.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
  }
  return days;
}

/**
 * A teacher's published assessments in `examsByDay`'s shape (owner 2026-10-18): the
 * marking queue's lists (`[{ row, assessments }]`, one per subject taught now) as one
 * group, each entry `{ assessment, row }` with the row's subject and class on the
 * assessment. Drafts are left out: the calendar shows what students will sit.
 */
export function teacherExamClasses(lists) {
  const assessments = [];
  for (const { row, assessments: list } of lists ?? []) {
    for (const assessment of list ?? []) {
      if (assessment.status !== 'PUBLISHED') continue;
      assessments.push({ row, assessment: { ...assessment, classSubject: { id: row.id, subject: row.subject, class: row.class } } });
    }
  }
  return [{ assessments }];
}

/**
 * A student's meetings without those cancelled for an Exam Week: the week itself
 * says why there is no teaching, and its exams take the day.
 */
export const withoutExamWeekCancelled = (sessions) =>
  (sessions ?? []).filter((session) => !(session.status === 'CANCELLED' && session.cancelReason === 'EXAM_WEEK'));
