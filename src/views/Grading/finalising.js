import { shortWhen } from '../TeacherAssessment/teacherAssessment';

/*
  Finalising a semester's grades (backend eadf680, grading-and-report-card ticket 04;
  owner 2026-10-18). The Principal starts it (OPEN -> FINALIZING) on "Finalisasi Nilai",
  each slot's answering teacher finalises the slot from the top of its "Nilai" tab
  once nothing blocks it, and the Principal and Vice Principals read the readiness
  board. Pure: the screens are FinalisingCard and FinalisingPage.

  A blocker comes from the server with its English `text` beside its fields; the
  screens say it from the fields instead (blockerView), in the reader's language:
  - SESSIONS_NEED_COMPLETION { sessions }
  - ASSESSMENT { assessment: { id, type, title, mode }, inProgress, waitingForMarking,
    waitingForRelease, open: { students, until } | null }
  - POOLED { assessment, class: { id, name }, students: [{ fullName }] } - an earlier
    class's assessment still waiting on a student this slot reports
  - NO_TEACHER (the board only)
*/

/** The slot's semester status as the grade read carries it: OPEN, FINALIZING or CLOSED. */
export const semesterStatusOf = (grades) => grades?.classSubject?.semester?.status ?? null;

/** Whether the teacher's card shows (owner): while the semester is being finalised, or once the slot is finalised. */
export const finalisingShown = (grades) => Boolean(grades && !grades.failed && (grades.finalised || semesterStatusOf(grades) === 'FINALIZING'));

/** Whether "Finalkan" may be pressed: being finalised, not finalised yet, nothing blocking. */
export const canFinalise = (grades) =>
  semesterStatusOf(grades) === 'FINALIZING' && !grades?.finalised && (grades?.blockers ?? []).length === 0;

/** Whether "Batalkan finalisasi" is offered: finalised, and the semester not closed. */
export const canUnfinalise = (grades) => Boolean(grades?.finalised) && semesterStatusOf(grades) !== 'CLOSED';

const ASSESSMENT_PARTS = [
  ['waitingForMarking', 'grading.fin.part.marking'],
  ['waitingForRelease', 'grading.fin.part.release'],
  ['inProgress', 'grading.fin.part.inProgress'],
];

/**
 * One blocker as a screen says it: `{ kind, key, vars, parts, link }`. `key` and
 * `vars` are the line's start; `parts` - an assessment's - `[{ key, n, until? }]`
 * joined after it, `until` an instant the screen formats in the school's zone.
 * `link` is where the teacher clears it: `{ to: 'sessions' }`, `{ to: 'assessment',
 * assessmentId }`, or null (another class's, or no teacher).
 */
export function blockerView(blocker) {
  if (blocker?.kind === 'SESSIONS_NEED_COMPLETION') {
    return { kind: blocker.kind, key: 'grading.fin.blocker.sessions', vars: { n: blocker.sessions }, parts: [], link: { to: 'sessions' } };
  }
  if (blocker?.kind === 'NO_TEACHER') return { kind: blocker.kind, key: 'grading.fin.blocker.noTeacher', vars: {}, parts: [], link: null };
  const assessment = blocker?.assessment ?? {};
  const named = { type: assessment.type, title: assessment.title ?? '' };
  if (blocker?.kind === 'POOLED') {
    const names = (blocker.students ?? []).map((student) => student.fullName).filter(Boolean);
    return {
      kind: blocker.kind,
      key: 'grading.fin.blocker.pooled',
      vars: { ...named, className: blocker.class?.name ?? '', names: names.join(', ') },
      parts: [],
      link: null,
    };
  }
  if (blocker?.kind === 'ASSESSMENT') {
    const parts = ASSESSMENT_PARTS.filter(([field]) => blocker[field] > 0).map(([field, key]) => ({ key, n: blocker[field] }));
    if (blocker.open) {
      parts.push({
        key: assessment.mode === 'OFFLINE' ? 'grading.fin.part.noMark' : 'grading.fin.part.mayStart',
        n: blocker.open.students,
        until: blocker.open.until,
      });
    }
    return { kind: blocker.kind, key: 'grading.fin.blocker.assessment', vars: named, parts, link: assessment.id ? { to: 'assessment', assessmentId: assessment.id } : null };
  }
  return { kind: blocker?.kind ?? 'UNKNOWN', key: null, vars: { text: blocker?.text ?? '' }, parts: [], link: null };
}

/** One blocker in the reader's words: its start, then its parts after a colon. */
export function blockerText(view, t, zone, lang) {
  if (!view.key) return view.vars.text;
  const start = t(view.key, { ...view.vars, type: view.vars.type ? t(`tasm.type.${view.vars.type}`) : '' });
  if (!view.parts.length) return start;
  const parts = view.parts.map((part) => t(part.key, { n: part.n, until: part.until ? shortWhen(part.until, zone, lang) : '' }));
  return `${start}: ${parts.join(', ')}`;
}

/**
 * The readiness board by class (owner: a card per class), in the board's class order:
 * `[{ class, homeroomTeacher, slots, notes }]`, `notes` the class's `{ students,
 * missing }` or null. A class with notes and no slot is kept: its notes still count.
 */
export function boardByClass(readiness) {
  const out = new Map();
  const entryOf = (cls) => {
    if (!out.has(cls.id)) out.set(cls.id, { class: cls, homeroomTeacher: null, slots: [], notes: null });
    return out.get(cls.id);
  };
  for (const slot of readiness?.slots ?? []) entryOf(slot.class).slots.push(slot);
  for (const row of readiness?.notes ?? []) {
    const entry = entryOf(row.class);
    entry.homeroomTeacher = row.homeroomTeacher;
    entry.notes = { students: row.students, missing: row.missing ?? [] };
  }
  return [...out.values()].sort((a, b) => String(a.class.name).localeCompare(String(b.class.name)));
}

/** What a slot's row says on the board: 'FINALISED', 'NO_TEACHER', 'BLOCKED' or 'READY'. */
export function slotStateOf(slot) {
  if (slot?.finalised) return 'FINALISED';
  if (!slot?.teacher) return 'NO_TEACHER';
  return (slot?.blockers ?? []).length ? 'BLOCKED' : 'READY';
}

/** Whether the Principal may stop finalising now: no slot finalised (the server's 409 otherwise). */
export const canStopFinalising = (readiness) => (readiness?.counts?.finalised ?? 0) === 0;
