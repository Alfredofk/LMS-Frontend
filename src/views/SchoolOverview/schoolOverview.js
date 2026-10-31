/*
  The School seen whole (backend 1a1eed7, dashboard ticket 06) - what the
  Principal's and Vice Principal's overview decides, apart from its markup so it
  can be tested.

  `GET /dashboard/school?semesterId=` answers, bare:
    { semester: { id, ordinal, status, academicYear: { id, label } } | null,
      semesters: [same], current first then every CLOSED one, newest first,
      asOf: the rollup's takenAt | null, comparedWith: 'YYYY-MM-DD' | null,
      school: numbers,
      classes: [{ class: { id, name, gradeLevel }, ...numbers }],
      subjects: [{ subject: { id, code, name }, gradeLevel, ...numbers }] }
  where numbers is `{ studentsPlacedNow, attendance, content, belowKktp,
  withSignal, averageGrade }`, each but the first `{ value, change }`. Counted
  nightly (dashboard.rollup.js), never live; null where nothing was counted yet,
  never 0. Percentages are whole, the grade has one decimal, a change is the
  difference of two shown values against exactly 7 days before. A CLOSED
  Semester's grades come from the newest report cards and carry no change.

  Owner, 2026-10-28: a page of its own plus a card on the dashboard; tables (cards
  on a phone) sortable by column, grade then name first; a change in green when it
  is better and red when worse; a class opens its summary on the Classes page.
  Owner, 2026-10-31 (mockup dasbor-ringkasan.html): a row per class or subject on
  every width, ordered through one "Urutkan" choice (`SORTS`).
*/

/**
 * The columns after the name, in order. `kind` says how a value is written;
 * `better` which way a change is good (null: no change is carried).
 */
export const FIGURES = [
  { key: 'studentsPlacedNow', kind: 'count', better: null },
  { key: 'attendance', kind: 'percent', better: 'up' },
  { key: 'content', kind: 'percent', better: 'up' },
  { key: 'belowKktp', kind: 'count', better: 'down' },
  { key: 'withSignal', kind: 'count', better: 'down' },
  { key: 'averageGrade', kind: 'grade', better: 'up' },
];

/** The figures the dashboard's card shows: the Students placed are a stat card there already. */
export const CARD_FIGURES = FIGURES.filter((figure) => figure.key !== 'studentsPlacedNow');

const figureOf = (key) => FIGURES.find((figure) => figure.key === key);

/** One figure of a row (the School, a Class or a Subject): its value, or null. */
export function valueOf(row, key) {
  if (key === 'studentsPlacedNow') return row?.studentsPlacedNow ?? null;
  return row?.[key]?.value ?? null;
}

/** One figure's change, or null where none is carried. */
export const changeOf = (row, key) => (key === 'studentsPlacedNow' ? null : row?.[key]?.change ?? null);

const localeOf = (lang) => (lang === 'en' ? 'en-GB' : 'id-ID');

/** A value as written: "13%", "51,5", "2", or "-" for one nobody counted. */
export function valueText(key, value, lang) {
  if (value === null || value === undefined) return '-';
  const { kind } = figureOf(key);
  if (kind === 'percent') return `${value}%`;
  if (kind === 'grade') return value.toLocaleString(localeOf(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return String(value);
}

/** A change as written, "+3" or "-1,5"; null when there is none or it is 0. */
export function changeText(key, change, lang) {
  if (change === null || change === undefined || change === 0) return null;
  const { kind } = figureOf(key);
  const size = Math.abs(change).toLocaleString(localeOf(lang), kind === 'grade' ? { minimumFractionDigits: 1, maximumFractionDigits: 1 } : {});
  return `${change > 0 ? '+' : '-'}${size}`;
}

/** Whether a change is 'good' or 'bad' news; null when there is none. */
export function changeToneOf(key, change) {
  const { better } = figureOf(key);
  if (!better || !change) return null;
  return (change > 0) === (better === 'up') ? 'good' : 'bad';
}

/**
 * Rows ordered by a column. `key` 'name' is grade then name (the backend's own
 * order); a figure sorts by its value, an uncounted one always last, ties kept in
 * the grade-then-name order.
 *
 * @param rows  `classes` or `subjects`
 * @param sort  `{ key: 'name' | a figure's key, dir: 'asc' | 'desc' }`
 * @param nameOf  the row's name
 */
export function sortRows(rows, { key, dir }, nameOf) {
  const sign = dir === 'desc' ? -1 : 1;
  const byName = (a, b) => (a.gradeLevel ?? a.class?.gradeLevel) - (b.gradeLevel ?? b.class?.gradeLevel) || nameOf(a).localeCompare(nameOf(b));
  return [...(rows ?? [])].sort((a, b) => {
    if (key === 'name') return sign * byName(a, b);
    const x = valueOf(a, key);
    const y = valueOf(b, key);
    if (x === null || y === null) return (x === null) - (y === null) || byName(a, b);
    return sign * (x - y) || byName(a, b);
  });
}

/**
 * The orders "Urutkan" offers (owner, 2026-10-31, mockup item 8), each the way a
 * Principal looks for trouble: the lowest attendance, material and average first,
 * the most students below KKTP or with a signal first.
 */
export const SORTS = [
  { id: 'name', key: 'name', dir: 'asc' },
  { id: 'attendance', key: 'attendance', dir: 'asc' },
  { id: 'content', key: 'content', dir: 'asc' },
  { id: 'belowKktp', key: 'belowKktp', dir: 'desc' },
  { id: 'withSignal', key: 'withSignal', dir: 'desc' },
  { id: 'averageGrade', key: 'averageGrade', dir: 'asc' },
];

/** A row with nobody placed: one grey line instead of a row of 0 and -. A count never taken (null) is not empty. */
export const isEmptyRow = (row) => row?.studentsPlacedNow === 0;

/** Whether the rollup has counted anything for this Semester yet. */
export const isCounted = (answer) => Boolean(answer?.asOf);
