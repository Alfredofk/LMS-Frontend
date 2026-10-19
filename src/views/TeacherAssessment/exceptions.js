/*
  A student's make-up and remedial (backend 1e6c749, assessment ticket 05; owner
  2026-10-11). Pure: the screens are ExceptionDialog and ResultsTab.

  - One live exception per student and ONLINE assessment, set by its answering
    teacher for a student placed in the class now, once published (not cancelled).
  - A make-up (susulan): the student's own window in place of the class's, inside
    the semester and closing after now; late counts from its close.
  - Extra attempts, 0 to 20, added to maxAttempts - or, under a remedial, the only
    attempts that count (at least one).
  - A remedial only once the class's window has closed, with nothing of the
    student's in progress (the server checks the second) - and so always with its
    own window (backend 52c31db, owner 2026-10-19: the class's has closed, so
    without one no attempt could start; 400 otherwise).
  - The whole of it is sent each time (exceptionBody, strict), a change with the
    updatedAt it read. Removed only while unused (`used`).
*/

import { emptyWindow, instantOf, partsOf, windowErrors } from './teacherAssessment';

export const MAX_EXTRA_ATTEMPTS = 20;

/** Whether the answering teacher may set one for this student here: never on a LATIHAN (backend 026e4f9, 409), which takes more attempts instead. */
export function canSetException(assessment, student, manages) {
  if (!manages || !assessment || !student) return false;
  if (assessment.type === 'LATIHAN') return false;
  return assessment.mode === 'ONLINE' && assessment.status === 'PUBLISHED' && Boolean(student.placedNow);
}

/** Whether a remedial may be given now: the class's window has closed. */
export const remedialOpen = (assessment, now = new Date()) => Boolean(assessment?.closesAt) && now >= new Date(assessment.closesAt);

/** The form, from an exception (`GET /:id/exceptions` row or the results' `exception`) or none. */
export function exceptionFormFrom(exception, zone) {
  if (!exception) return { makeUp: false, window: emptyWindow(), extraAttempts: '0', remedial: false };
  const makeUp = exception.makeUp ?? null;
  const opens = makeUp ? partsOf(makeUp.opensAt, zone) : { date: '', time: '' };
  const closes = makeUp ? partsOf(makeUp.closesAt, zone) : { date: '', time: '' };
  return {
    makeUp: Boolean(makeUp),
    window: { opensDate: opens.date, opensTime: opens.time, closesDate: closes.date, closesTime: closes.time },
    extraAttempts: String(exception.extraAttempts ?? 0),
    remedial: Boolean(exception.remedial),
  };
}

const extraOf = (typed) => {
  const trimmed = String(typed ?? '').trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
};

/**
 * Keys `{ opens?, closes?, extraAttempts?, form? }`: the window as an assessment's
 * (both ends, in order, inside the semester `span`) and closing after now; extra
 * attempts a whole 0-20, at least one under a remedial; a remedial only once the
 * class's window has closed, and with its own window; and something given - a
 * window or extra attempts.
 */
export function exceptionErrors(form, { zone, span = null, assessment = null, now = new Date() } = {}) {
  const errors = {};
  if (form.makeUp) {
    Object.assign(errors, windowErrors(form.window, { zone, spans: span ? [span] : [] }));
    const closes = instantOf(form.window.closesDate, form.window.closesTime, zone);
    if (!errors.closes && closes && new Date(closes) <= now) errors.closes = 'tasm.exc.error.closesPast';
  }
  const extra = extraOf(form.extraAttempts);
  if (Number.isNaN(extra) || extra > MAX_EXTRA_ATTEMPTS) errors.extraAttempts = 'tasm.exc.error.extra';
  else if (form.remedial && extra < 1) errors.extraAttempts = 'tasm.exc.error.remedialExtra';
  if (form.remedial && assessment && !remedialOpen(assessment, now)) errors.form = 'tasm.exc.error.remedialOpen';
  else if (form.remedial && !form.makeUp) errors.form = 'tasm.exc.error.remedialWindow';
  else if (!form.makeUp && extra === 0) errors.form = 'tasm.exc.error.empty';
  return errors;
}

/** PUT's body: `{ makeUp, extraAttempts, remedial }`, and the updatedAt read when changing one. */
export function exceptionBody(form, zone, saved = null) {
  const body = {
    makeUp: form.makeUp
      ? { opensAt: instantOf(form.window.opensDate, form.window.opensTime, zone), closesAt: instantOf(form.window.closesDate, form.window.closesTime, zone) }
      : null,
    extraAttempts: extraOf(form.extraAttempts),
    remedial: Boolean(form.remedial),
  };
  if (saved?.updatedAt) body.updatedAt = saved.updatedAt;
  return body;
}

/** Whether the form differs from what is saved (a new one always does once anything is given). */
export function exceptionChanged(form, saved, zone) {
  if (!saved) return form.makeUp || extraOf(form.extraAttempts) !== 0 || form.remedial;
  const was = exceptionFormFrom(saved, zone);
  if (form.makeUp !== was.makeUp || form.remedial !== was.remedial) return true;
  if (extraOf(form.extraAttempts) !== extraOf(was.extraAttempts)) return true;
  return form.makeUp && ['opensDate', 'opensTime', 'closesDate', 'closesTime'].some((key) => form.window[key] !== was.window[key]);
}

/**
 * What a results row says of an exception, as `{ key, vars }` parts in order:
 * the make-up window, then the attempts - "+2 percobaan", or under a remedial
 * "Remedial, 1 percobaan" (its attempts are the only ones). The caller formats
 * `opens`/`closes` (instants) in the school's zone.
 */
export function exceptionFacts(exception) {
  if (!exception) return [];
  const facts = [];
  if (exception.makeUp) facts.push({ key: 'tasm.exc.fact.makeUp', vars: { opens: exception.makeUp.opensAt, closes: exception.makeUp.closesAt } });
  if (exception.remedial) facts.push({ key: 'tasm.exc.fact.remedial', vars: { n: exception.extraAttempts } });
  else if (exception.extraAttempts > 0) facts.push({ key: 'tasm.exc.fact.extra', vars: { n: exception.extraAttempts } });
  return facts;
}
