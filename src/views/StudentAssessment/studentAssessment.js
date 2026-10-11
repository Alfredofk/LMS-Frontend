/*
  A student answering an assessment (backend 6380e3e ticket 03, 5255842 ticket 04,
  1e6c749 ticket 05; owner 2026-10-11). Pure: the screens are StudentAssessmentPage
  (the outline) and StudentAttemptPage (answering, then reading it back).

  - The outline (GET /:id/mine) never carries a question: the student's own window
    and attempts (a make-up's or a remedial's, `exception`), what is left, whether
    they may start (`canStart`, the server's rule), their attempts and the score
    that counts.
  - Starting draws the questions in their order, kept. Answers are saved one by one
    (owner: automatically - a choice at once, typed text a moment after typing
    stops); a lost connection loses only what was not saved yet.
  - The server holds the clock: past the deadline an attempt is closed with what
    was saved. Before release no key, no points and no comment reach a student.
*/

export const MAX_SHORT_LENGTH = 200;
export const MAX_ESSAY_LENGTH = 20_000;
export const MAX_ESSAY_FILE_BYTES = 10 * 1024 * 1024;
export const ESSAY_FILE_TYPES = ['pdf', 'jpg', 'jpeg', 'png', 'docx', 'pptx'];
/** How long typing must stop before a text answer is saved. */
export const TEXT_SAVE_DELAY_MS = 1000;

/**
 * Where the outline stands, one word: CANCELLED, OFFLINE, NOT_OPEN (before its
 * window - the student's own), OPEN, or CLOSED (after it; with acceptLate the
 * server may still let one start, which `canStart` says).
 */
export function outlinePhase(assessment, now = new Date()) {
  if (!assessment) return null;
  if (assessment.status === 'CANCELLED') return 'CANCELLED';
  if (assessment.mode === 'OFFLINE') return 'OFFLINE';
  if (now < new Date(assessment.opensAt)) return 'NOT_OPEN';
  if (now < new Date(assessment.closesAt)) return 'OPEN';
  return 'CLOSED';
}

/**
 * The one word a student reads beside the title (owner, 2026-10-11): NOT_OPEN,
 * OPEN, CLOSED or CANCELLED, on their own window. The teacher's "Aktif" covers
 * both before and during the window, which told a student nothing.
 */
export function studentStateOf(assessment, now = new Date()) {
  if (assessment.status === 'CANCELLED') return 'CANCELLED';
  if (now < new Date(assessment.opensAt)) return 'NOT_OPEN';
  if (now < new Date(assessment.closesAt)) return 'OPEN';
  return 'CLOSED';
}

export const STUDENT_STATE_TONE = {
  NOT_OPEN: 'bg-slate-100 text-slate-600',
  OPEN: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-rose-50 text-rose-700',
};

/**
 * What the outline offers: `{ action: 'continue' | 'start' | null, why }`, `why` a
 * key under `sasm.why.` when nothing can be started. The server's `canStart`
 * decides; the reason is only said.
 */
export function startState(outline, now = new Date()) {
  if (!outline) return { action: null, why: null };
  if (outline.inProgressId) return { action: 'continue', why: null };
  if (outline.canStart) return { action: 'start', why: null };
  const assessment = outline.assessment;
  const phase = outlinePhase(assessment, now);
  if (phase === 'CANCELLED') return { action: null, why: 'cancelled' };
  if (phase === 'OFFLINE') return { action: null, why: 'offline' };
  if (assessment.questionCount === 0) return { action: null, why: 'noQuestions' };
  if (phase === 'NOT_OPEN') return { action: null, why: 'notOpen' };
  if (outline.attemptsLeft <= 0) return { action: null, why: 'noAttempts' };
  return { action: null, why: 'closed' };
}

/** A submission's state for its row: IN_PROGRESS, VOID, RELEASED, or WAITING (handed in, not released). */
export function attemptState(submission) {
  if (submission.status === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (submission.status === 'VOID') return 'VOID';
  return submission.released ? 'RELEASED' : 'WAITING';
}

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------

/** The form's value for a question from what was saved: optionIds, a boolean or null, or text. */
export function draftOf(question) {
  const answer = question.answer;
  if (question.kind === 'MCQ') return answer?.optionIds ?? [];
  if (question.kind === 'TF') return answer?.value ?? null;
  return answer?.text ?? '';
}

/** Whether a question counts as answered: something chosen or typed, or an essay's file. */
export function isAnswered(question, draft = draftOf(question)) {
  if (question.kind === 'MCQ') return draft.length > 0;
  if (question.kind === 'TF') return draft !== null;
  if (question.kind === 'ESSAY') return String(draft).trim() !== '' || Boolean(question.answer?.file);
  return String(draft).trim() !== '';
}

/** A choice clicked: SINGLE takes one (a second click leaves it), the others toggle. */
export function choose(question, optionIds, optionId) {
  if (question.mcqScoring === 'SINGLE') return [optionId];
  return optionIds.includes(optionId) ? optionIds.filter((id) => id !== optionId) : [...optionIds, optionId];
}

/** PUT's body for a draft: the one field its kind takes; empty text is null (cleared). */
export function answerBody(question, draft) {
  if (question.kind === 'MCQ') return { optionIds: draft };
  if (question.kind === 'TF') return { value: draft };
  const text = String(draft ?? '');
  return { text: text.trim() === '' ? null : text };
}

/** Whether the draft differs from what the server last saved. */
export function draftChanged(question, draft) {
  const saved = draftOf(question);
  if (question.kind === 'MCQ') return saved.length !== draft.length || saved.some((id) => !draft.includes(id));
  if (question.kind === 'TF') return saved !== draft;
  return (String(saved).trim() === '' ? null : saved) !== (String(draft).trim() === '' ? null : draft);
}

/** A key under `sasm.error.` when the draft would be refused, else null. */
export function draftError(question, draft) {
  if (question.kind === 'SHORT' && String(draft).length > MAX_SHORT_LENGTH) return 'shortLong';
  if (question.kind === 'ESSAY' && String(draft).length > MAX_ESSAY_LENGTH) return 'essayLong';
  return null;
}

/** A key under `sasm.error.` when an essay's file would be refused, else null (the server checks the bytes too). */
export function essayFileError(file) {
  if (!file) return null;
  const extension = String(file.name ?? '').split('.').pop().toLowerCase();
  if (!ESSAY_FILE_TYPES.includes(extension)) return 'fileType';
  if (file.size > MAX_ESSAY_FILE_BYTES) return 'fileSize';
  return null;
}

/** How many of the questions are answered, with the drafts on the page. */
export const answeredCount = (questions, drafts) => questions.filter((question) => isAnswered(question, drafts[question.id] ?? draftOf(question))).length;

// ---------------------------------------------------------------------------
// The clock
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Milliseconds to the deadline, never below 0. */
export const remainingMs = (deadlineAt, now = new Date()) => Math.max(0, new Date(deadlineAt) - now);

/** "45:07" or "1:02:09" - shown once less than a day is left (a farther deadline is said as a date). */
export function clockText(ms) {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const two = (n) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

/** Whether the deadline is near enough to count down (under a day). */
export const countsDown = (deadlineAt, now = new Date()) => remainingMs(deadlineAt, now) < DAY_MS;

// ---------------------------------------------------------------------------
// Reading it back
// ---------------------------------------------------------------------------

/**
 * A released question's key in words, as `{ kind, ... }`: MCQ the letters of the
 * correct options in the order shown, TF the value, SHORT the accepted answers.
 * null when the teacher shows no key, or for an ESSAY.
 */
export function keyOf(question) {
  if (!question.key) return null;
  if (question.kind === 'MCQ') {
    const letters = (question.options ?? [])
      .map((option, index) => (question.key.correctOptionIds?.includes(option.id) ? String.fromCharCode(65 + index) : null))
      .filter(Boolean);
    return { kind: 'MCQ', letters };
  }
  if (question.kind === 'TF') return { kind: 'TF', value: question.key.value };
  if (question.kind === 'SHORT') return { kind: 'SHORT', accepted: question.key.accepted ?? [] };
  return null;
}

/** Letters for a question's options as shown: [{ ...option, letter }]. */
export const lettered = (options) => (options ?? []).map((option, index) => ({ ...option, letter: String.fromCharCode(65 + index) }));
