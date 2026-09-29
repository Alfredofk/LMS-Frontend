/*
  Pure calendar arithmetic for the holiday screens (backend 9dee2e2) — the
  national calendar on /admin/holidays and the school's on /schedule.

  Every date here is a calendar day, 'YYYY-MM-DD', the same across WIB, WITA and
  WIT — the backend's own rule. So nothing is ever turned into a local Date and
  back: days are counted in UTC, where a day is always 24 hours, and "today" is
  the reader's own calendar day, read once from their clock.

  Weeks start on Monday, as an Indonesian school timetable does.
*/

const DAY_MS = 24 * 60 * 60 * 1000;

const utc = (day) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

/** The reader's calendar day, 'YYYY-MM-DD', from their own clock. */
export function todayIso(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from, to) {
  return Math.round((utc(to) - utc(from)) / DAY_MS);
}

/** Every day from `start` to `end`, both included. A reversed range is empty. */
export function expandRange(start, end) {
  const out = [];
  for (let ms = utc(start), last = utc(end); ms <= last; ms += DAY_MS) out.push(iso(ms));
  return out;
}

/**
 * One month as weeks of seven cells, Monday first. A cell is the day
 * ('YYYY-MM-DD') or null outside the month. `month` is 0–11.
 */
export function monthGrid(year, month) {
  const first = Date.UTC(year, month, 1);
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  /* getUTCDay: 0 Sunday … 6 Saturday → Monday-first offset 0 … 6. */
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const cells = [...Array(lead).fill(null)];
  for (let d = 0; d < days; d += 1) cells.push(iso(first + d * DAY_MS));
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * The first holiday that has not ended yet, with how far off it is. Each item
 * needs `start` and `end` ('YYYY-MM-DD'); anything else rides along. Items
 * running today answer `days: 0`. Null when nothing is left this list.
 */
export function nextHoliday(items, today) {
  const upcoming = (items ?? [])
    .filter((item) => item.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start));
  const next = upcoming[0];
  if (!next) return null;
  return { ...next, days: Math.max(0, daysBetween(today, next.start)) };
}

/**
 * One shape for the three sources of `GET /holidays?year=` — national days,
 * joint leave and the school's own: `{ id, kind, name, start, end, source, … }`,
 * by date. A joint-leave day this school does not observe becomes IN_SCHOOL,
 * which is still listed but is no day off. Used by /schedule's calendar and the
 * dashboards' "next holiday" card, so the two never disagree.
 */
export function calendarItems(data) {
  if (!data) return [];
  const national = (data.national ?? []).map((entry) => ({
    ...entry,
    source: entry.kind,
    kind: entry.kind === 'JOINT_LEAVE' && !entry.observed ? 'IN_SCHOOL' : entry.kind,
    start: entry.date,
    end: entry.date,
  }));
  const school = (data.school ?? []).map((entry) => ({
    ...entry,
    source: 'SCHOOL',
    kind: 'SCHOOL',
    start: entry.startDate,
    end: entry.endDate,
  }));
  return [...national, ...school].sort((a, b) => a.start.localeCompare(b.start));
}

/** The items that are days off — everything but an unobserved joint-leave day. */
export const offDaysOf = (items) => (items ?? []).filter((item) => item.kind !== 'IN_SCHOOL');

/**
 * Days mapped to what falls on them, for painting a calendar: every day of
 * every item → the items on it, in the order given. Lets a cell show a joint
 * leave and a school holiday on the same date without either hiding the other.
 */
export function daysIndex(items) {
  const index = new Map();
  for (const item of items ?? []) {
    for (const day of expandRange(item.start, item.end)) {
      if (!index.has(day)) index.set(day, []);
      index.get(day).push(item);
    }
  }
  return index;
}
