/*
  A student's lesson calendar on /schedule (owner, 2026-10-03) — what it decides,
  apart from its markup so it can be tested.

  One month at a time from `GET /sessions/mine?from=&to=` (backend 2a281e7): a
  month is at most 31 days, inside the server's 42. Each session carries
  `local.date` in the school's zone, so days are grouped on that and never on a
  Date built in the device's zone. The grid itself is utils/holidays.js
  `monthGrid`, Monday first, the same as the holiday calendar above it.
*/

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
export function agendaOf({ year, month }, start, days, holidays) {
  const { to } = monthRange(year, month);
  const dates = new Set();
  for (const date of days?.keys() ?? []) if (date >= start && date <= to) dates.add(date);
  for (const date of holidays?.keys() ?? []) if (date >= start && date <= to) dates.add(date);
  return [...dates].sort().map((date) => ({
    date,
    holidays: holidays?.get(date) ?? [],
    sessions: days?.get(date) ?? [],
  }));
}
