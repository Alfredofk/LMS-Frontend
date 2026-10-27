/*
  The school's Support Signal thresholds (backend 002298e, dashboard ticket 02;
  owner 2026-10-27): the numbers that decide when a student is flagged as needing
  support on a teacher's dashboard. `GET /dashboard/signal-settings` answers each
  `{ value, source }` (source SCHOOL or BUILT_IN) and `updatedAt` (null before
  the first save). `PUT` takes any of them, null putting one back to the built-in
  value, with the updatedAt read; a stale one is 409.

  BUILT_IN and BOUNDS are dashboard.settings.js's BUILT_IN and dashboard.schema.js's
  threshold() bounds, restated: the read does not say what a value set by the
  school would go back to.
*/

export const BUILT_IN = {
  absenceCount: 3,
  absenceWindowDays: 14,
  contentBehindPercent: 50,
  contentBehindMinPublished: 4,
  notSubmittedCount: 2,
  inactiveDays: 7,
};

export const BOUNDS = {
  absenceCount: [1, 30],
  absenceWindowDays: [1, 60],
  contentBehindPercent: [1, 100],
  contentBehindMinPublished: [1, 50],
  notSubmittedCount: [1, 20],
  inactiveDays: [1, 60],
};

export const THRESHOLD_KEYS = Object.keys(BUILT_IN);

/** The form's draft from a read: per key `{ text, reset }`, reset false. */
export const signalDraftOf = (settings) =>
  Object.fromEntries(THRESHOLD_KEYS.map((key) => [key, { text: String(settings?.[key]?.value ?? ''), reset: false }]));

/** A key typed into: what was typed, no longer going back. */
export const typed = (draft, key, text) => ({ ...draft, [key]: { text, reset: false } });

/** "Pakai bawaan": the box shows the built-in value and goes back to it on save. */
export const backToBuiltIn = (draft, key) => ({ ...draft, [key]: { text: String(BUILT_IN[key]), reset: true } });

/** A whole number within its bounds, or null. */
function wholeIn(text, [min, max]) {
  const trimmed = String(text ?? '').trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= min && value <= max ? value : null;
}

/** Per key `{ key, vars }` for a box the server would refuse; a key going back is not checked. */
export function signalDraftErrors(draft) {
  const errors = {};
  for (const key of THRESHOLD_KEYS) {
    const field = draft?.[key];
    if (!field || field.reset) continue;
    if (wholeIn(field.text, BOUNDS[key]) === null) {
      errors[key] = { key: 'signal.error.range', vars: { min: BOUNDS[key][0], max: BOUNDS[key][1] } };
    }
  }
  return errors;
}

/**
 * The PUT body: only what changed - a number, or null for a school value going
 * back - and the updatedAt read. Null when nothing changes. Typing the value
 * that already applies changes nothing, even the built-in one.
 */
export function signalBody(settings, draft) {
  const body = {};
  for (const key of THRESHOLD_KEYS) {
    const field = draft?.[key];
    const saved = settings?.[key];
    if (!field || !saved) continue;
    if (field.reset) {
      if (saved.source === 'SCHOOL') body[key] = null;
      continue;
    }
    const value = wholeIn(field.text, BOUNDS[key]);
    if (value !== null && value !== saved.value) body[key] = value;
  }
  if (Object.keys(body).length === 0) return null;
  return { ...body, updatedAt: settings.updatedAt ?? null };
}
