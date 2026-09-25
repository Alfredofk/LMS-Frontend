/*
  Dates on this screen are calendar days, not moments.

  The forms send "2026-07-13" and `z.coerce.date()` stores midnight UTC, so the
  day is read back in UTC too. Formatting in the browser's own zone would show a
  reader west of Greenwich a school year that starts on the 12th.
*/
export const formatDay = (value, lang) =>
  value
    ? new Date(value).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : '—';

/* "2026/2027" for the July in which that year most likely starts — a hint, never a value. */
export const suggestedYearLabel = (now = new Date()) => {
  const year = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}/${year + 1}`;
};
