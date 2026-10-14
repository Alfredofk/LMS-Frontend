/*
  Grade settings (backend 5d42af6, grading-and-report-card ticket 01; owner
  2026-10-14): the four Grade Weights, the KKTP and the Remedial Rule every Final
  Grade will be computed with. Pure: the screens are SchoolGradeSettingsCard
  (Settings, the Principal and Vice Principals) and SlotGradeSettings (a subject's
  "Nilai" tab; read only in GradebookReader).

  A read (grading.service.js settingsView) answers each setting with where it
  comes from - the first level that has one of its own:
    `{ weights: { value: { TUGAS, KUIS, UTS, UAS }, source },
       kktp: { value, source }, remedialRule: { value, source }, updatedAt | null }`
  source SLOT | SCHOOL | BUILT_IN (25/25/25/25, 75, CAP_AT_KKTP). The Remedial Rule
  is the school's only. `updatedAt` is that level's own row, null before its first
  save - and a write sends it back (null then), or gets 409.

  The rules restated from grading.schema.js: each weight and the KKTP a whole
  number 0-100, the four weights summing to 100, sent all four at once.
  No Final Grade is computed here: that is ticket 02's, on the server.
*/

export const GRADE_TYPES = ['TUGAS', 'KUIS', 'UTS', 'UAS'];
export const REMEDIAL_RULES = ['CAP_AT_KKTP', 'HIGHEST', 'AVERAGE'];

/** A box's text as a whole number 0-100, or null when it is not one. */
export function parseWhole(text) {
  const trimmed = String(text ?? '').trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value <= 100 ? value : null;
}

/** The four weights as the form holds them: text per type. */
export const weightsText = (weights) => Object.fromEntries(GRADE_TYPES.map((type) => [type, String(weights?.[type] ?? '')]));

/** The sum of the boxes that hold a whole number (for the live "Jumlah" line). */
export const weightsSum = (texts) => GRADE_TYPES.reduce((sum, type) => sum + (parseWhole(texts[type]) ?? 0), 0);

/**
 * What is wrong with the four boxes: `{ TUGAS?, KUIS?, UTS?, UAS?, sum? }`, each a
 * dictionary key, or `{}`. The sum is said only once every box holds a number.
 */
export function weightErrors(texts) {
  const errors = {};
  for (const type of GRADE_TYPES) if (parseWhole(texts[type]) === null) errors[type] = 'grading.error.weight';
  if (Object.keys(errors).length === 0 && weightsSum(texts) !== 100) errors.sum = 'grading.error.sum';
  return errors;
}

/** The KKTP box: a dictionary key, or null. */
export const kktpError = (text) => (parseWhole(text) === null ? 'grading.error.kktp' : null);

/** The four boxes as numbers, once weightErrors says nothing. */
export const weightsOf = (texts) => Object.fromEntries(GRADE_TYPES.map((type) => [type, parseWhole(texts[type])]));

const sameWeights = (a, b) => Boolean(a && b) && GRADE_TYPES.every((type) => a[type] === b[type]);

/** "25/25/25/25", in the order every message lists them. */
export const weightsLine = (weights) => GRADE_TYPES.map((type) => weights?.[type] ?? '-').join('/');

// ---------------------------------------------------------------------------
// The school's
// ---------------------------------------------------------------------------

/** The school form, filled from a read. */
export const schoolDraftOf = (settings) => ({
  weights: weightsText(settings?.weights?.value),
  kktp: String(settings?.kktp?.value ?? ''),
  remedialRule: settings?.remedialRule?.value ?? 'CAP_AT_KKTP',
});

/** `{ weights?, kktp?, sum? }` - keys, or `{}`. */
export function schoolDraftErrors(draft) {
  const errors = {};
  const weights = weightErrors(draft.weights);
  if (Object.keys(weights).length) errors.weights = weights;
  const kktp = kktpError(draft.kktp);
  if (kktp) errors.kktp = kktp;
  return errors;
}

/**
 * The PUT body for the school: only what differs from the read, with the
 * updatedAt it was read at - or null when nothing differs. A built-in value left
 * as it is counts as unchanged, so it stays "not set by the school" (the server
 * would otherwise store the same number as the school's own).
 */
export function schoolBody(settings, draft) {
  const body = {};
  const weights = weightsOf(draft.weights);
  if (!sameWeights(weights, settings.weights.value)) body.weights = weights;
  const kktp = parseWhole(draft.kktp);
  if (kktp !== settings.kktp.value) body.kktp = kktp;
  if (draft.remedialRule !== settings.remedialRule.value) body.remedialRule = draft.remedialRule;
  if (Object.keys(body).length === 0) return null;
  return { ...body, updatedAt: settings.updatedAt ?? null };
}

// ---------------------------------------------------------------------------
// A slot's (Class x Subject x Semester)
// ---------------------------------------------------------------------------

/**
 * The slot form, filled from the slot's read: for the weights and the KKTP apart,
 * whether the slot has its own (`own`) and the boxes - its own values, or the ones
 * that apply now as a starting point.
 */
export const slotDraftOf = (settings) => ({
  ownWeights: settings?.weights?.source === 'SLOT',
  weights: weightsText(settings?.weights?.value),
  ownKktp: settings?.kktp?.source === 'SLOT',
  kktp: String(settings?.kktp?.value ?? ''),
});

/** `{ weights?, kktp? }` - only the parts the slot sets itself are checked. */
export function slotDraftErrors(draft) {
  const errors = {};
  if (draft.ownWeights) {
    const weights = weightErrors(draft.weights);
    if (Object.keys(weights).length) errors.weights = weights;
  }
  if (draft.ownKktp) {
    const kktp = kktpError(draft.kktp);
    if (kktp) errors.kktp = kktp;
  }
  return errors;
}

/**
 * What saving the slot form sends, or null when nothing changes:
 * - `{ method: 'DELETE', body: { updatedAt } }` when both parts go back to the
 *   school's and the slot had something of its own (the clear route);
 * - `{ method: 'PUT', body }` otherwise: `weights` (four numbers, or null for the
 *   school's) and `kktp` (a number, or null) only where they change, and the
 *   updatedAt read.
 */
export function slotChange(settings, draft) {
  const hadWeights = settings.weights.source === 'SLOT';
  const hadKktp = settings.kktp.source === 'SLOT';
  const updatedAt = settings.updatedAt ?? null;

  if (!draft.ownWeights && !draft.ownKktp) {
    return hadWeights || hadKktp ? { method: 'DELETE', body: { updatedAt } } : null;
  }

  const body = {};
  if (draft.ownWeights) {
    const weights = weightsOf(draft.weights);
    if (!hadWeights || !sameWeights(weights, settings.weights.value)) body.weights = weights;
  } else if (hadWeights) {
    body.weights = null;
  }
  if (draft.ownKktp) {
    const kktp = parseWhole(draft.kktp);
    if (!hadKktp || kktp !== settings.kktp.value) body.kktp = kktp;
  } else if (hadKktp) {
    body.kktp = null;
  }
  if (Object.keys(body).length === 0) return null;
  return { method: 'PUT', body: { ...body, updatedAt } };
}
