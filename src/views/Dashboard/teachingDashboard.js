import { dashboardService } from '../../services/dashboardService';

/*
  The teacher's dashboard read, `GET /dashboard/teaching` (backend 27400b4/002298e;
  owner 2026-10-27): one answer for the marking queue (markingQueue.js), the
  "Siswa" number and the "Kelas semester ini" card. Heavy on the server, so it is
  kept a minute per membership and shared; marks saved or a release drop it
  (forgetMarkingQueue).

  Its slots are the teacher's live ClassSubjects of the current Semester, each
  `{ classSubject: { id, class: { id, name }, subject: { id, code, name } },
  studentsPlacedNow, content: { completed, possible, percent }, attendance:
  { present, counted, percent }, studentsNeedingSupport: [{ studentProfileId,
  fullName, signals: [{ type, value, threshold }] }] }` - percent null with nothing
  to count. `thresholds` are the School's, the signals' window among them.
*/

const KEEP_MS = 60 * 1000;
let cached = null;

export function readTeachingDashboard(membershipId, { fresh = false } = {}) {
  if (!fresh && cached?.membershipId === membershipId && Date.now() - cached.at < KEEP_MS) return cached.promise;

  const promise = dashboardService.teaching();
  cached = { membershipId, at: Date.now(), promise };
  promise.catch(() => {
    if (cached?.promise === promise) cached = null;
  });
  return promise;
}

/** The next read is fresh. */
export function forgetTeachingDashboard() {
  cached = null;
}

/**
 * Students needing support across the slots, each counted once however many of
 * the teacher's subjects flag them: the dashboard's "Perlu perhatian" card (owner
 * 2026-10-27, the approved teacher mockup).
 */
export function studentsNeedingSupportAcross(slots) {
  const ids = new Set();
  for (const slot of slots ?? []) for (const student of slot.studentsNeedingSupport ?? []) ids.add(student.studentProfileId);
  return ids.size;
}

/**
 * The slots in the order "Kelas semester ini" lists them: those with students
 * needing support first, then the rest with students, then those with none -
 * each group in the server's order.
 */
export function slotsForCard(slots) {
  const rank = (slot) => ((slot.studentsNeedingSupport ?? []).length > 0 ? 0 : (slot.studentsPlacedNow ?? 0) > 0 ? 1 : 2);
  return [...(slots ?? [])].map((slot, i) => ({ slot, i })).sort((a, b) => rank(a.slot) - rank(b.slot) || a.i - b.i).map(({ slot }) => slot);
}

/**
 * Students placed now across the slots, each class counted once: its subjects
 * share its roster, so two of them are the same students.
 */
export function studentsAcrossClasses(slots) {
  const byClass = new Map();
  for (const slot of slots ?? []) {
    const classId = slot.classSubject?.class?.id;
    if (!classId) continue;
    byClass.set(classId, Math.max(byClass.get(classId) ?? 0, slot.studentsPlacedNow ?? 0));
  }
  let total = 0;
  for (const n of byClass.values()) total += n;
  return total;
}

/*
  Each Support Signal as a sentence and the subject page's tab that shows its
  evidence (owner 2026-10-27). `value` and `threshold` are the server's; the
  absence window is the School's threshold. INACTIVE's value is null for a
  student never active in the slot. A type this app does not know is left out.
*/
const SIGNALS = {
  FREQUENT_ABSENCE: (signal, thresholds) => ({
    key: 'teacherDash.signal.absence',
    vars: { n: signal.value, days: thresholds?.absenceWindowDays ?? '-', limit: signal.threshold },
    tab: 'pertemuan',
  }),
  CONTENT_BEHIND: (signal) => ({ key: 'teacherDash.signal.contentBehind', vars: { n: signal.value, limit: signal.threshold }, tab: 'progres' }),
  NOT_SUBMITTING: (signal) => ({ key: 'teacherDash.signal.notSubmitting', vars: { n: signal.value, limit: signal.threshold }, tab: 'nilai' }),
  BELOW_KKTP: (signal) => ({ key: 'teacherDash.signal.belowKktp', vars: { n: signal.value, kktp: signal.threshold }, tab: 'nilai', number: true }),
  INACTIVE: (signal) =>
    signal.value === null || signal.value === undefined
      ? { key: 'teacherDash.signal.neverActive', vars: {}, tab: 'progres' }
      : { key: 'teacherDash.signal.inactive', vars: { n: signal.value, limit: signal.threshold }, tab: 'progres' },
};

/**
 * `{ key, vars, tab, number? }` for one signal, or null for a type not known
 * here. `number` says `vars.n` is a grade, to be written in the reader's
 * language ("61,5").
 */
export function signalView(signal, thresholds) {
  const view = SIGNALS[signal?.type];
  return view ? view(signal, thresholds) : null;
}

/** Where a signal leads: the slot's page, on the tab with its evidence. */
export const signalPath = (classSubjectId, tab) => `/teacher/courses/${classSubjectId}?tab=${tab}`;

/** A bar's width, 0-100, from a percent that may be null. */
export const barWidth = (percent) => (Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0);
