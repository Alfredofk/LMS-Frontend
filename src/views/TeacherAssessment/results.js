/*
  An assessment's results, marking one attempt, and releasing (backend 5255842,
  assessment ticket 04; owner 2026-10-10). Pure: the screens are ResultsTab and
  MarkingPage.

  - The results list every student of the class over the semester, and anyone with
    an attempt, each with a status, the score that counts and their attempts.
  - Marking is a draft until release: points on a SHORT (over its automatic ones)
    or an ESSAY, a comment per answer and one on the attempt. Points take at most
    two decimals, 0 to the question's points (markBody: `decimal`, assertMarkable).
  - Release records a score for each attempt closed and fully marked; an ONLINE
    one only once it has closed. After that points change only with a reason.
  - A LATIHAN (backend 026e4f9) is never released and takes comments only, no
    points: a student there is NOT_STARTED, IN_PROGRESS or DONE, with their best
    and latest attempt (`practice`); an attempt handed in is SUBMITTED, or
    WAITING_FOR_MARKING while an answered essay waits for its comment.
*/

import { isPractice } from './teacherAssessment';

export const STUDENT_STATUSES = ['NOT_STARTED', 'IN_PROGRESS', 'WAITING_FOR_MARKING', 'WAITING_FOR_RELEASE', 'RELEASED', 'DID_NOT_SUBMIT', 'DONE'];
export const ATTEMPT_STATUSES = ['IN_PROGRESS', 'WAITING_FOR_MARKING', 'WAITING_FOR_RELEASE', 'RELEASED', 'VOID', 'SUBMITTED'];

const localeOf = (lang) => (lang === 'en' ? 'en-GB' : 'id-ID');

/** A score or points in the reader's language: "85,5", "17", or "-" for none. At most two decimals. */
export function formatNumber(value, lang) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: 2 }).format(Number(value));
}

/**
 * Whether "Rilis nilai" is offered and why it waits: `{ show, enabled, why }`,
 * `why` a key. Only the answering teacher, on a published one (not cancelled);
 * an ONLINE one once it has closed (release: "release it once it has closed");
 * and only with something ready.
 */
export function releaseState(assessment, waiting, now = new Date()) {
  if (!assessment?.canManage || assessment.status !== 'PUBLISHED' || isPractice(assessment)) return { show: false, enabled: false, why: null };
  if (assessment.mode === 'ONLINE' && now < new Date(assessment.closesAt)) return { show: true, enabled: false, why: 'tasm.results.releaseAfterClose' };
  if (!waiting?.release) return { show: true, enabled: false, why: 'tasm.results.nothingToRelease' };
  return { show: true, enabled: true, why: null };
}

/** The attempts in the list's order, each with its student's name. */
const attemptsOf = (students) =>
  (students ?? []).flatMap((student) => student.attempts.map((attempt) => ({ ...attempt, fullName: student.fullName, studentProfileId: student.studentProfileId })));

/** The next attempt waiting for marking after `currentId`, in the list's order and round again; null when none. */
export function nextToMark(students, currentId) {
  const all = attemptsOf(students);
  const at = all.findIndex((attempt) => attempt.id === currentId);
  const ordered = at < 0 ? all : [...all.slice(at + 1), ...all.slice(0, at)];
  return ordered.find((attempt) => attempt.status === 'WAITING_FOR_MARKING' && attempt.id !== currentId) ?? null;
}

/** The attempt statuses the answering teacher marks or comments on: handed in, not void. */
export const MARKABLE = ['WAITING_FOR_MARKING', 'WAITING_FOR_RELEASE', 'RELEASED', 'SUBMITTED'];

/** Whether this attempt can be marked here: the answering teacher, published, closed, not void, online. */
export function canMark(view) {
  if (!view?.assessment?.canManage || view.assessment.status !== 'PUBLISHED') return false;
  if (view.submission.closedBy === 'TEACHER') return false;
  return MARKABLE.includes(view.submission.status);
}

/**
 * Whether the teacher gives points on this question: a SHORT or an ESSAY that was
 * answered - never on a LATIHAN, whose answers take comments only (backend 026e4f9:
 * any points there are a 400).
 */
export const takesPoints = (question, assessment = null) =>
  !isPractice(assessment) && (question.kind === 'SHORT' || question.kind === 'ESSAY') && question.answer !== null;

/** A comment goes only on an answer that exists (assertMarkable). */
export const takesComment = (question) => question.answer !== null;

const text = (value) => (value === null || value === undefined ? '' : String(value));

/** The form a marking view opens with: per question its points and comment as typed, and the attempt's comment. */
export function markDraftFrom(view) {
  const answers = {};
  for (const question of view?.questions ?? []) {
    answers[question.id] = { points: text(question.teacherPoints), comment: text(question.comment) };
  }
  return { answers, comment: text(view?.submission?.comment) };
}

/** Typed points as a number ("7,5" too), null for an empty box, NaN for anything else. */
export function pointsValue(typed) {
  const trimmed = String(typed ?? '').trim().replace(',', '.');
  if (!trimmed) return null;
  return /^\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : NaN;
}

const twoDecimals = (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

/**
 * Keys per question id: points 0 to the question's, at most two decimals; a
 * released ESSAY's mark changed, never cleared. Comments of at most 2,000.
 */
export function markErrors(draft, view) {
  const errors = {};
  const released = view?.submission?.status === 'RELEASED';
  for (const question of view?.questions ?? []) {
    const entry = draft.answers[question.id];
    if (!entry) continue;
    if (takesPoints(question, view.assessment)) {
      const value = pointsValue(entry.points);
      if (value === null) {
        if (released && question.kind === 'ESSAY' && question.teacherPoints !== null) errors[question.id] = 'tasm.mark.error.keepEssay';
      } else if (Number.isNaN(value) || !twoDecimals(value)) errors[question.id] = 'tasm.mark.error.points';
      else if (value > question.points) errors[question.id] = { key: 'tasm.mark.error.tooMany', vars: { n: question.points } };
    }
    if (entry.comment.trim().length > 2000) errors[`${question.id}:comment`] = 'tasm.mark.error.commentLong';
  }
  if (draft.comment.trim().length > 2000) errors.comment = 'tasm.mark.error.commentLong';
  return errors;
}

const commentOf = (typed) => typed.trim() || null;

/** Whether the teacher's points on any answer differ from the saved ones: after release, a reason is due. */
export function pointsChanged(draft, view) {
  return (view?.questions ?? []).some((question) => takesPoints(question, view.assessment) && pointsValue(draft.answers[question.id]?.points) !== question.teacherPoints);
}

/**
 * PUT's body with only what changed, or null when nothing did: `{ answers?,
 * comment?, reason? }`. The reason goes only with changed points on a released attempt.
 */
export function markBody(draft, view, reason = '') {
  const answers = [];
  for (const question of view?.questions ?? []) {
    const entry = draft.answers[question.id];
    if (!entry) continue;
    const item = { questionId: question.id };
    if (takesPoints(question, view.assessment)) {
      const value = pointsValue(entry.points);
      if (value !== question.teacherPoints) item.points = value;
    }
    if (takesComment(question) && commentOf(entry.comment) !== (question.comment ?? null)) item.comment = commentOf(entry.comment);
    if (Object.keys(item).length > 1) answers.push(item);
  }
  const body = {};
  if (answers.length) body.answers = answers;
  if (commentOf(draft.comment) !== (view?.submission?.comment ?? null)) body.comment = commentOf(draft.comment);
  if (!Object.keys(body).length) return null;
  if (view?.submission?.status === 'RELEASED' && pointsChanged(draft, view)) body.reason = String(reason).trim();
  return body;
}

/** An MCQ's options as the student chose them: `[{ id, letter, text, imageId, chosen, correct }]`. */
export function chosenOptions(question) {
  const chosen = new Set(question.answer?.optionIds ?? []);
  return (question.options ?? []).map((option, index) => ({ ...option, letter: String.fromCharCode(65 + index), chosen: chosen.has(option.id), correct: Boolean(option.correct) }));
}

// ---------------------------------------------------------------------------
// Offline marks (enterOfflineMarks; owner 2026-10-10: typed in the results tab)
// ---------------------------------------------------------------------------

export const MAX_OFFLINE_MARK = 100;

/*
  A remedial mark beside the original (backend dfa2545, assessment ticket 09; owner
  2026-10-19: a second column): a second teacher-entered attempt flagged remedial,
  which a release gives its own Score while the original's stays, and the school's
  Remedial Rule then counts. Entered once the window has closed, for a student
  placed in the class now, in its own PUT (`remedial: true`); taken back (DELETE,
  voided softly) only before its release. Only the mark, no comment.
*/

/**
 * A student's offline mark as saved: the attempt the teacher entered (closedBy
 * TEACHER, not void) - `{ submissionId, value, released, comment }` - or null.
 * `remedial` reads the remedial mark beside it instead.
 */
export function offlineSavedOf(student, remedial = false) {
  const attempt = (student?.attempts ?? []).find((item) => item.closedBy === 'TEACHER' && item.status !== 'VOID' && Boolean(item.remedial) === remedial);
  if (!attempt) return null;
  return { submissionId: attempt.id, value: attempt.mark?.value ?? null, released: Boolean(attempt.releasedAt), comment: attempt.comment ?? null };
}

/**
 * The form per student: `{ mark, comment, loadedComment }`, the comment filled
 * from the results (each attempt carries it since backend d13ded4), so saving a
 * mark never sends an empty comment over a stored one.
 */
export function offlineDraftsFrom(students, lang = 'en') {
  const drafts = {};
  for (const student of students ?? []) {
    const saved = offlineSavedOf(student);
    /* Written as the reader writes it ("85,5"); pointsValue reads either. A mark is at most 100, so no grouping. */
    const mark = saved?.value === null || saved?.value === undefined ? '' : formatNumber(saved.value, lang);
    const stored = saved?.comment ?? null;
    const remedial = offlineSavedOf(student, true);
    drafts[student.studentProfileId] = {
      mark,
      comment: stored ?? '',
      loadedComment: stored,
      remedial: remedial?.value === null || remedial?.value === undefined ? '' : formatNumber(remedial.value, lang),
    };
  }
  return drafts;
}

const commentChanged = (draft) => (String(draft.comment ?? '').trim() || null) !== (draft.loadedComment ?? null);

/** Per student whose row changed: `{ markChanged, commentChanged, value }`. */
function offlineChanges(drafts, students) {
  const changes = [];
  for (const student of students ?? []) {
    const draft = drafts[student.studentProfileId];
    if (!draft) continue;
    const saved = offlineSavedOf(student);
    const value = pointsValue(draft.mark);
    const markChanged = value !== (saved?.value ?? null);
    const comment = commentChanged(draft);
    if (markChanged || comment) changes.push({ student, draft, saved, value, markChanged, commentChanged: comment });
  }
  return changes;
}

/**
 * Keys per studentProfileId: a mark 0 to 100, two decimals at most; a saved one
 * changed, never emptied; a comment needs a mark with it. Comments of at most 2,000.
 */
export function offlineErrors(drafts, students) {
  const errors = {};
  for (const { student, draft, saved, value } of offlineChanges(drafts, students)) {
    const id = student.studentProfileId;
    if (value === null) errors[id] = saved ? 'tasm.offline.error.keep' : 'tasm.offline.error.needMark';
    else if (Number.isNaN(value) || !twoDecimals(value) || value > MAX_OFFLINE_MARK) errors[id] = 'tasm.offline.error.mark';
    if (String(draft.comment ?? '').trim().length > 2000) errors[`${id}:comment`] = 'tasm.mark.error.commentLong';
  }
  return errors;
}

/** Per student whose remedial box changed: `{ student, saved, value }`. */
function remedialChanges(drafts, students) {
  const changes = [];
  for (const student of students ?? []) {
    const draft = drafts[student.studentProfileId];
    if (!draft) continue;
    const saved = offlineSavedOf(student, true);
    const value = pointsValue(draft.remedial);
    if (value !== (saved?.value ?? null)) changes.push({ student, saved, value });
  }
  return changes;
}

/** Whether a remedial mark may be entered now: the window has closed (409 before). */
export const remedialMarksOpen = (assessment, now = new Date()) => Boolean(assessment?.closesAt) && now >= new Date(assessment.closesAt);

/** Whether a student's remedial box is offered: placed in the class now, or a remedial mark already there. */
export const takesRemedialMark = (student) => Boolean(student?.placedNow) || Boolean(offlineSavedOf(student, true));

/**
 * Keys `${id}:remedial`: a mark 0 to 100, two decimals at most; a saved one is
 * changed, never emptied - "Tarik" takes it back before release.
 */
export function remedialErrors(drafts, students) {
  const errors = {};
  for (const { student, saved, value } of remedialChanges(drafts, students)) {
    const key = `${student.studentProfileId}:remedial`;
    if (value === null) errors[key] = saved?.released ? 'tasm.offline.error.keep' : 'tasm.offline.error.keepRemedial';
    else if (Number.isNaN(value) || !twoDecimals(value) || value > MAX_OFFLINE_MARK) errors[key] = 'tasm.offline.error.mark';
  }
  return errors;
}

/** Whether a released mark is among those changed, an original or a remedial: then a reason goes with them. */
export const offlineNeedsReason = (drafts, students) =>
  offlineChanges(drafts, students).some((change) => change.markChanged && change.saved?.released) ||
  remedialChanges(drafts, students).some((change) => change.saved?.released);

/** The remedial PUT's body, `{ remedial: true, marks: [{ studentProfileId, value }], reason? }`, or null when nothing changed. */
export function remedialBody(drafts, students, reason = '') {
  const changes = remedialChanges(drafts, students);
  if (!changes.length) return null;
  const marks = changes.map(({ student, value }) => ({ studentProfileId: student.studentProfileId, value }));
  return changes.some((change) => change.saved?.released) ? { remedial: true, marks, reason: String(reason).trim() } : { remedial: true, marks };
}

/** PUT's body, `{ marks: [{ studentProfileId, value, comment? }], reason? }`, or null when nothing changed. */
export function offlineBody(drafts, students, reason = '') {
  const changes = offlineChanges(drafts, students);
  if (!changes.length) return null;
  const marks = changes.map(({ student, draft, value, commentChanged: withComment }) => ({
    studentProfileId: student.studentProfileId,
    value,
    ...(withComment ? { comment: String(draft.comment ?? '').trim() || null } : {}),
  }));
  return changes.some((change) => change.markChanged && change.saved?.released) ? { marks, reason: String(reason).trim() } : { marks };
}

/** The words a list row says of a student's attempts, newest first. */
export const attemptsNewestFirst = (attempts) => [...(attempts ?? [])].sort((a, b) => b.attempt - a.attempt);

/**
 * One attempt's integrity counts as the staff read them (backend b5db324, ticket
 * 06): null when the assessment records none (TUGAS, OFFLINE), `[]` when nothing
 * was recorded, else the counts above zero in a fixed order, as `{ key, n }`
 * under `tasm.signals.`.
 */
export const SIGNAL_KEYS = ['focusLost', 'fullscreenExited', 'copied', 'pasted'];
export function signalParts(signals) {
  if (!signals) return null;
  return SIGNAL_KEYS.filter((key) => Number(signals[key]) > 0).map((key) => ({ key, n: Number(signals[key]) }));
}

/** All of one attempt's integrity counts together; null where the assessment records none. */
export function signalTotal(signals) {
  if (!signals) return null;
  return SIGNAL_KEYS.reduce((sum, key) => sum + (Number(signals[key]) || 0), 0);
}

/** Whether any attempt of this student has something recorded. */
export const hasSignals = (student) => (student.attempts ?? []).some((attempt) => signalTotal(attempt.signals) > 0);

/** How many students have something recorded (the Hasil tab's summary, owner 2026-10-13). */
export const flaggedCount = (students) => (students ?? []).filter(hasSignals).length;

/**
 * Which of a student's attempts the Hasil list shows, newest first (owner
 * 2026-10-13: thirty students with every attempt open is too long): the newest,
 * any still waiting for marking or release - so its "Beri nilai" is never hidden -
 * and, while the "ada catatan" filter is on, any with something recorded. The rest
 * wait behind "Tampilkan N percobaan lain". `expanded` shows every one.
 */
export function shownAttempts(attempts, { expanded = false, flaggedOnly = false } = {}) {
  const all = attemptsNewestFirst(attempts);
  if (expanded) return { shown: all, hidden: 0 };
  const shown = all.filter(
    (attempt, index) =>
      index === 0 ||
      attempt.status === 'WAITING_FOR_MARKING' ||
      attempt.status === 'WAITING_FOR_RELEASE' ||
      (flaggedOnly && signalTotal(attempt.signals) > 0)
  );
  return { shown, hidden: all.length - shown.length };
}

/*
  Whether an answer was right (owner, 2026-10-18), said beside its points on the
  marking page and on a student's released attempt: from the points saved - a
  teacher's change counts - so full points are "Benar", none "Salah", some "Sebagian
  benar"; an unanswered one "Tidak dijawab". An ESSAY gets none (its points say it),
  nor does one still waiting to be marked.
*/
export const VERDICTS = ['CORRECT', 'PARTIAL', 'WRONG', 'UNANSWERED'];

/** `'CORRECT' | 'PARTIAL' | 'WRONG' | 'UNANSWERED' | null` for one question. */
export function verdictOf({ kind, points, earned, answered, waiting = false }) {
  if (kind === 'ESSAY' || waiting) return null;
  if (!answered) return 'UNANSWERED';
  if (typeof earned !== 'number' || typeof points !== 'number') return null;
  if (earned >= points) return 'CORRECT';
  if (earned <= 0) return 'WRONG';
  return 'PARTIAL';
}

/** Its colour: green, amber, red, grey. */
export const VERDICT_TONE = {
  CORRECT: 'text-emerald-700',
  PARTIAL: 'text-amber-700',
  WRONG: 'text-rose-700',
  UNANSWERED: 'text-slate-500',
};
