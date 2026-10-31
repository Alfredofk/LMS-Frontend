/*
  Where a semester stands against today, and how near its teaching sign-up
  deadline is (owner, 2026-10-31, mockup kelas-mapel-anggota.html items 2 and 7).

  Every date here is a calendar day: a semester's dates and its deadline are stored
  as midnight UTC (see format.js), and `today` is the school's own date,
  'YYYY-MM-DD' (useSchoolToday). Both are turned into day numbers, so no clock or
  zone enters the arithmetic.
*/

const DAY = 86400000;

/** A calendar day as a whole number of days, or null. */
export const dayNumber = (value) => {
  if (!value) return null;
  const ms = Date.parse(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(ms) ? null : Math.floor(ms / DAY);
};

/** How long until something, as words a caller translates: under a week in days, else whole weeks. */
export const spanOf = (days) => (days < 7 ? { unit: 'day', n: days } : { unit: 'week', n: Math.floor(days / 7) });

/**
 * A semester against today:
 *   { phase: 'upcoming', startsIn }           not begun; startsIn is a spanOf
 *   { phase: 'running', week, weeks, left, fraction }
 *                                             week counts from 1 on the first day; weeks
 *                                             is the whole length rounded up; left a spanOf
 *                                             to the last day (0 days on it)
 *   { phase: 'over' }                         past its last day
 * or null when a date is missing.
 */
export function semesterTimeOf(semester, today) {
  const start = dayNumber(semester?.startDate);
  const end = dayNumber(semester?.endDate);
  const now = dayNumber(today);
  if (start === null || end === null || now === null || end < start) return null;
  if (now < start) return { phase: 'upcoming', startsIn: spanOf(start - now) };
  if (now > end) return { phase: 'over' };
  const length = end - start + 1;
  return {
    phase: 'running',
    week: Math.floor((now - start) / 7) + 1,
    weeks: Math.ceil(length / 7),
    left: spanOf(end - now),
    fraction: (now - start + 1) / length,
  };
}

/** The days left before a semester's sign-up deadline closes when that is today to a week away, else null. */
export function deadlineSoonOf(semester, today) {
  const deadline = dayNumber(semester?.classSubjectRegistrationDeadline);
  const now = dayNumber(today);
  if (deadline === null || now === null) return null;
  const days = deadline - now;
  return days >= 0 && days <= 7 ? days : null;
}

/** A spanOf in words, through the caller's `t`: "7 minggu lagi", "3 hari lagi", "hari ini". */
export const spanWords = (span, t) =>
  span.unit === 'week' ? t('classes.span.week', { n: span.n }) : span.n === 0 ? t('classes.span.today') : t('classes.span.day', { n: span.n });
