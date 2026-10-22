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
  - NO_GRADE { students: [{ studentProfileId, fullName }] } (backend 3a22f90, ticket
    05) - students who get a report card and have no grade here yet; the teacher
    gives them a mark, so it leads to the assessments tab
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
 * assessmentId }`, `{ to: 'assessments' }` (the tab), or null (another class's, or no teacher).
 */
export function blockerView(blocker) {
  if (blocker?.kind === 'SESSIONS_NEED_COMPLETION') {
    return { kind: blocker.kind, key: 'grading.fin.blocker.sessions', vars: { n: blocker.sessions }, parts: [], link: { to: 'sessions' } };
  }
  if (blocker?.kind === 'NO_TEACHER') return { kind: blocker.kind, key: 'grading.fin.blocker.noTeacher', vars: {}, parts: [], link: null };
  if (blocker?.kind === 'NO_GRADE') {
    const names = (blocker.students ?? []).map((student) => student.fullName).filter(Boolean);
    return { kind: blocker.kind, key: 'grading.fin.blocker.noGrade', vars: { names: names.join(', ') }, parts: [], link: { to: 'assessments' } };
  }
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
 * missing, promotionsMissing }` or null - `promotionsMissing` the students with no
 * Promotion Outcome in Semester 2 (backend 4dae152, ticket 09), null in Semester 1. A
 * class with notes and no slot is kept: its notes still count.
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
    entry.notes = { students: row.students, missing: row.missing ?? [], promotionsMissing: row.promotionsMissing ?? null };
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

/*
  Closing a semester (backend 3a22f90, grading-and-report-card ticket 05; owner
  2026-10-20): the Principal closes a FINALIZING semester on or after its last day,
  dating its report cards from its first day to 30 days after its last
  (grading.close.js assertReportDate), once every subject is finalised with nothing
  blocking it and every note is written. The server checks it all again.
*/

const DAY_MS = 24 * 60 * 60 * 1000;

/** A semester's calendar day, 'YYYY-MM-DD', from the years list's date (midnight UTC). */
const dayOf = (value) => String(value ?? '').slice(0, 10);

/** The days a report card may carry: `{ from, to }`, the semester's first day to 30 days after its last. */
export function reportDateRange(semester) {
  const from = dayOf(semester?.startDate);
  const end = Date.parse(`${dayOf(semester?.endDate)}T00:00:00Z`);
  if (!from || Number.isNaN(end)) return null;
  return { from, to: new Date(end + 30 * DAY_MS).toISOString().slice(0, 10) };
}

/** The date the dialog opens on (owner: today), held inside the range. */
export function defaultReportDate(range, today) {
  if (!range) return '';
  if (!today || today < range.from) return range.from;
  return today > range.to ? range.to : today;
}

/** `{ key, vars }` when the chosen date cannot be sent, else null. */
export function reportDateError(value, range) {
  if (!value) return { key: 'grading.fin.close.error.dateRequired', vars: {} };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { key: 'grading.fin.close.error.dateInvalid', vars: {} };
  if (range && (value < range.from || value > range.to)) return { key: 'grading.fin.close.error.dateRange', vars: { from: range.from, to: range.to } };
  return null;
}

/**
 * What still stops "Tutup semester", from the board and the school's today, each
 * `{ key, vars }`, in the order the Principal would clear them; empty when it may be
 * pressed. A finalised subject can still be blocked (a class move since), which
 * closing reads again, so it counts too.
 */
export function closeBlocksOf(readiness, semester, today) {
  if (!readiness?.counts) return [];
  const blocks = [];
  const lastDay = dayOf(semester?.endDate);
  if (lastDay && today && today < lastDay) blocks.push({ key: 'grading.fin.close.blocked.notOver', vars: { date: lastDay } });
  const { slots = 0, finalised = 0, notesMissing = 0 } = readiness.counts;
  if (finalised < slots) blocks.push({ key: 'grading.fin.close.blocked.slots', vars: { n: slots - finalised } });
  const stuck = (readiness.slots ?? []).filter((slot) => slot.finalised && (slot.blockers ?? []).length > 0).length;
  if (stuck > 0) blocks.push({ key: 'grading.fin.close.blocked.stuck', vars: { n: stuck } });
  if (notesMissing > 0) blocks.push({ key: 'grading.fin.close.blocked.notes', vars: { n: notesMissing } });
  const promotionsMissing = readiness.counts.promotionsMissing ?? 0;
  if (promotionsMissing > 0) blocks.push({ key: 'grading.fin.close.blocked.promotions', vars: { n: promotionsMissing } });
  return blocks;
}

/** The parts of a 409 "cannot be closed yet" (`details.notFinalised / blocked / notesMissing / promotionsMissing`), as `{ key, vars }`. */
export function closeRefusalParts(details) {
  const count = (list) => (Array.isArray(list) ? list.length : 0);
  return [
    ['grading.fin.close.blocked.slots', count(details?.notFinalised)],
    ['grading.fin.close.blocked.stuck', count(details?.blocked)],
    ['grading.fin.close.blocked.notes', count(details?.notesMissing)],
    ['grading.fin.close.blocked.promotions', count(details?.promotionsMissing)],
  ]
    .filter(([, n]) => n > 0)
    .map(([key, n]) => ({ key, vars: { n } }));
}

/*
  Reopening a closed semester (backend 46c6173, ticket 06; owner 2026-10-20): the
  Principal takes it back to FINALIZING with a reason (1-500), unfinalising the
  subjects ticked - none at all to fix a note only. Named by any ClassSubject of
  each slot (the board's `classSubjectId`).
*/

export const REASON_MAX = 500;

/** `{ key, vars }` when the reason cannot be sent, else null (reopenBody's rule). */
export function reopenReasonError(reason) {
  const text = String(reason ?? '').trim();
  if (!text) return { key: 'grading.fin.reopen.error.reasonRequired', vars: {} };
  if (text.length > REASON_MAX) return { key: 'grading.fin.reopen.error.reasonLong', vars: { n: REASON_MAX } };
  return null;
}

/** The body: the reason trimmed and the ticked subjects in the board's order, each once. */
export function reopenBody(reason, ticked, readiness) {
  const order = (readiness?.slots ?? []).map((slot) => slot.classSubjectId);
  const chosen = order.filter((id) => ticked?.has(id));
  return { reason: String(reason ?? '').trim(), classSubjectIds: [...new Set(chosen)] };
}

/** "Pilih semua" for a class: every subject of it ticked, or, when all already are, none of them. */
export function toggleClass(ticked, slots) {
  const ids = (slots ?? []).map((slot) => slot.classSubjectId);
  const next = new Set(ticked);
  const all = ids.length > 0 && ids.every((id) => next.has(id));
  for (const id of ids) {
    if (all) next.delete(id);
    else next.add(id);
  }
  return next;
}
