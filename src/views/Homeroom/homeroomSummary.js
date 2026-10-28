import { signalView } from '../Dashboard/teachingDashboard';

/*
  "Ringkasan kelas" on an opened class of /teacher/homeroom (owner, 2026-10-27; the
  mockup approved that day): GET /api/dashboard/classes/:id (backend 7ee7857) shaped
  for the card. Pure, so it can be tested.

  - Three numbers that are also the filters: the Students placed now, those with a
    Support Signal, those below the KKTP in at least one Subject (the server's summary).
  - Students with a signal first, the rest in the server's order (by name).
  - Each signal as the teacher's dashboard says it (signalView), except the two the
    Class view counts differently: FREQUENT_ABSENCE is days with an absence, whatever
    the Subject, and INACTIVE spans every Subject.
*/

export const FILTERS = ['ALL', 'SIGNAL', 'BELOW'];

/** How many Subjects a Student's final grade is under the KKTP in. */
export const belowCountOf = (student) => (student?.grades ?? []).filter((grade) => grade.belowKktp).length;

/** Assessments still to be marked for a Student, across the Subjects. */
export const waitingOf = (student) => (student?.grades ?? []).reduce((sum, grade) => sum + (Number(grade.waiting) || 0), 0);

const MATCH = {
  ALL: () => true,
  SIGNAL: (student) => (student.signals ?? []).length > 0,
  BELOW: (student) => belowCountOf(student) > 0,
};

/** The Students a filter keeps, those with a signal first, the server's order kept otherwise. */
export function studentsFor(students, filter = 'ALL') {
  const match = MATCH[filter] ?? MATCH.ALL;
  const kept = (students ?? []).filter(match);
  const flagged = kept.filter((student) => (student.signals ?? []).length > 0);
  const rest = kept.filter((student) => (student.signals ?? []).length === 0);
  return [...flagged, ...rest];
}

/** Each filter's count, from the Students themselves so a tab and its list agree. */
export function filterCounts(students) {
  return Object.fromEntries(FILTERS.map((filter) => [filter, (students ?? []).filter(MATCH[filter]).length]));
}

/**
 * One signal as `{ key, vars, number? }`, or null for a type this app does not know.
 * `number` says `vars.n` is a grade, written in the reader's language.
 */
export function classSignalView(signal, thresholds) {
  if (signal?.type === 'FREQUENT_ABSENCE') {
    return { key: 'homeroom.sum.signal.absenceDays', vars: { n: signal.value, days: thresholds?.absenceWindowDays ?? '-', limit: signal.threshold } };
  }
  if (signal?.type === 'INACTIVE') {
    return signal.value === null || signal.value === undefined
      ? { key: 'homeroom.sum.signal.neverActive', vars: {} }
      : { key: 'homeroom.sum.signal.inactive', vars: { n: signal.value, limit: signal.threshold } };
  }
  const view = signalView(signal, thresholds);
  return view ? { key: view.key, vars: view.vars, number: view.number } : null;
}

/** Initials for the avatar: the first letters of the first two words. */
export const initialsOf = (name) =>
  String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
