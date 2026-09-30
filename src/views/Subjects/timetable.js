/*
  The weekly timetable (backend 7cdc46d, teaching-and-learning 02 and 09) — what
  the Timetable tab decides, apart from its markup so it can be tested.

  A slot is `{ dayOfWeek, start, end }`: ISO day (1 Monday … 7 Sunday) and
  'HH:mm', 24-hour, in the school's own zone — exactly what
  `PUT /sessions/class-subjects/:id/schedule` takes and `scheduleView` answers
  (sessions.schema.js, sessions.service.js slotView).
*/

/* Monday to Saturday always; Sunday only when a slot is on it (owner, 2026-09-30). */
export const WEEK_DAYS = [1, 2, 3, 4, 5, 6];
export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

/* sessions.schema.js: at least one slot, at most 30. */
export const MAX_SLOTS = 30;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * An ISO day's name from the browser, never the dictionary: 2 January 2000 was a
 * Sunday, so day 1 (Monday) is the 3rd and day 7 (Sunday) the 9th.
 */
export const dayName = (iso, lang, style = 'long') =>
  new Date(Date.UTC(2000, 0, 2 + Number(iso))).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', {
    weekday: style,
    timeZone: 'UTC',
  });

/**
 * "07:00–08:30" that never breaks across two lines: a word joiner (U+2060) on
 * each side of the dash, which a browser may otherwise wrap after — at 320px a
 * meeting's time split as "07:00–" over "08:30" (2026-09-30).
 */
export const timeRange = (start, end) => `${start}\u2060–\u2060${end}`;

export const minuteOf = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

const overlaps = (a, b) =>
  a.dayOfWeek === b.dayOfWeek && minuteOf(a.start) < minuteOf(b.end) && minuteOf(b.start) < minuteOf(a.end);

const bySlot = (a, b) => a.dayOfWeek - b.dayOfWeek || minuteOf(a.start) - minuteOf(b.start);

/** The days to draw: Monday–Saturday, plus Sunday when any slot falls on it. */
export function visibleDays(slots) {
  return (slots ?? []).some((slot) => slot.dayOfWeek === 7) ? ALL_DAYS : WEEK_DAYS;
}

/**
 * A class's week: for each day to draw, its slots in time order, each carrying
 * the board row it belongs to. `entries` is `[{ row, slots }]`.
 *
 * @returns {Array<{ day: number, items: Array<{ row, slot }> }>}
 */
export function weekOf(entries) {
  const items = (entries ?? []).flatMap(({ row, slots }) => (slots ?? []).map((slot) => ({ row, slot })));
  return visibleDays(items.map((item) => item.slot)).map((day) => ({
    day,
    items: items.filter((item) => item.slot.dayOfWeek === day).sort((a, b) => bySlot(a.slot, b.slot)),
  }));
}

/**
 * What is wrong with the slots being typed, as dictionary keys: `rows[i]` for
 * each row (by field) and `form` for the whole — the same rules as
 * sessions.schema.js, so a slot the server would refuse never leaves the browser.
 * A row that overlaps an earlier one is marked on the later one, as the server
 * marks `slots[i + 1 + offset]`.
 *
 * @param {Array<{ dayOfWeek: number|string, start: string, end: string }>} slots
 * @returns {{ form?: string, rows: Array<{ day?: string, start?: string, end?: string }> }}
 */
export function slotErrors(slots) {
  const list = slots ?? [];
  const rows = list.map(() => ({}));
  const out = { rows };
  if (list.length === 0) out.form = 'timetable.error.noSlots';
  if (list.length > MAX_SLOTS) out.form = 'timetable.error.tooMany';

  list.forEach((slot, i) => {
    const day = Number(slot.dayOfWeek);
    if (!Number.isInteger(day) || day < 1 || day > 7) rows[i].day = 'timetable.error.day';
    if (!TIME.test(slot.start ?? '')) rows[i].start = 'timetable.error.time';
    if (!TIME.test(slot.end ?? '')) rows[i].end = 'timetable.error.time';
    else if (!rows[i].start && minuteOf(slot.end) <= minuteOf(slot.start)) rows[i].end = 'timetable.error.endBeforeStart';
  });

  const clean = (i) => !rows[i].day && !rows[i].start && !rows[i].end;
  list.forEach((a, i) => {
    list.slice(i + 1).forEach((b, offset) => {
      const j = i + 1 + offset;
      if (clean(i) && clean(j) && !rows[j].end && overlaps(normal(a), normal(b))) rows[j].end = 'timetable.error.overlapSelf';
    });
  });
  return out;
}

/** Whether `slotErrors` found nothing. */
export const slotsValid = (errors) => !errors.form && errors.rows.every((row) => Object.keys(row).length === 0);

/** A form row as the API takes it: the day a number, trimmed times, ordered by day and time. */
export const normal = (slot) => ({ dayOfWeek: Number(slot.dayOfWeek), start: slot.start, end: slot.end });
export const payloadOf = (slots) => (slots ?? []).map(normal).sort(bySlot);

/**
 * The first clash between the slots being set and another subject's in the same
 * class — the half of `assertNoClash` this page can see, since it holds every
 * timetable of the class. A clash with the same teacher in another class needs
 * the whole school and stays the server's 409.
 *
 * @param {Array} slots the slots being set (API shape)
 * @param {Array<{ row, slots }>} others the class's other subjects
 * @returns {{ mine, theirs, row } | null}
 */
export function classClash(slots, others) {
  for (const other of others ?? []) {
    for (const theirs of other.slots ?? []) {
      const mine = (slots ?? []).find((slot) => overlaps(slot, theirs));
      if (mine) return { mine, theirs, row: other.row };
    }
  }
  return null;
}

const DAY_NUMBER = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };
const SLOT = '(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) (\\d\\d:\\d\\d)-(\\d\\d:\\d\\d)';
const CLASH = new RegExp(
  `^${SLOT} clashes: (?:this teacher already teaches (.+) in (.+)|(.+) already has (.+)) at ${SLOT}$`
);
const slotFrom = (day, start, end) => ({ dayOfWeek: DAY_NUMBER[day], start, end });

/**
 * The server's clash sentence taken apart (sessions.service.js assertNoClash):
 * "Monday 07:00-08:30 clashes: this teacher already teaches Fisika in XI IPA at
 * Monday 07:30-09:00", or "… clashes: XI IPS already has Ekonomi at …". Null when
 * the sentence is not that one — the caller then shows it as it came.
 *
 * @returns {{ kind: 'teacher'|'class', mine, theirs, subject: string, className: string } | null}
 */
export function parseClash(message) {
  const hit = CLASH.exec(String(message ?? ''));
  if (!hit) return null;
  const [, d1, s1, e1, teacherSubject, teacherClass, sameClass, classSubject, d2, s2, e2] = hit;
  return teacherSubject
    ? { kind: 'teacher', mine: slotFrom(d1, s1, e1), theirs: slotFrom(d2, s2, e2), subject: teacherSubject, className: teacherClass }
    : { kind: 'class', mine: slotFrom(d1, s1, e1), theirs: slotFrom(d2, s2, e2), subject: classSubject, className: sameClass };
}

/**
 * Where the Semester stands for a timetable change, from `scheduleView`:
 * `replansFrom` is the Semester's first day before it starts and the school's
 * tomorrow after, so a date other than the first day means it has started. The
 * first timetable of a ClassSubject — no slots, no Session ever — plans the whole
 * Semester even after the start, and what lands before tomorrow then waits for
 * its teacher (ticket 09).
 *
 * @param {{ replansFrom: string|null, slots: Array, sessions: { scheduled, cancelled } }} schedule
 * @param {{ startDate: string }} semester
 * @returns {'NO_ZONE'|'BEFORE_START'|'FIRST_AFTER_START'|'AFTER_START'}
 */
export function changeStage(schedule, semester) {
  if (!schedule?.replansFrom) return 'NO_ZONE';
  const started = schedule.replansFrom !== String(semester?.startDate ?? '').slice(0, 10);
  if (!started) return 'BEFORE_START';
  const firstTime =
    (schedule.slots ?? []).length === 0 && (schedule.sessions?.scheduled ?? 0) + (schedule.sessions?.cancelled ?? 0) === 0;
  return firstTime ? 'FIRST_AFTER_START' : 'AFTER_START';
}

/**
 * One Session's state as a dictionary key (sessionView): cancelled by its
 * reason; waiting for its teacher's answer; answered as held; or simply
 * scheduled — ahead, or already behind `now`.
 */
export function sessionState(session, now = new Date()) {
  if (session.status === 'CANCELLED') return `timetable.session.cancelled.${session.cancelReason ?? 'OTHER'}`;
  if (session.needsCompletion && !session.completedAt) return 'timetable.session.needsCompletion';
  if (session.completedAt) return 'timetable.session.completed';
  return new Date(session.endsAt) < now ? 'timetable.session.past' : 'timetable.session.scheduled';
}

/* Every key sessionState can answer — the i18n test expands them. */
export const SESSION_STATE_KEYS = [
  'timetable.session.cancelled.HOLIDAY',
  'timetable.session.cancelled.SCHEDULE_CHANGED',
  'timetable.session.cancelled.NOT_HELD',
  'timetable.session.cancelled.ASSIGNMENT_ENDED',
  'timetable.session.cancelled.OTHER',
  'timetable.session.needsCompletion',
  'timetable.session.completed',
  'timetable.session.past',
  'timetable.session.scheduled',
];
