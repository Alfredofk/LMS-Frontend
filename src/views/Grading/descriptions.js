/*
  The report card's Descriptions of a slot (backend 483be5a, grading-and-report-card
  ticket 03; owner 2026-10-18): a card under the gradebook on the "Nilai" tab, one
  box per student the slot describes, saved with one button. Pure: the card is
  SlotDescriptions.

  What the server holds comes with the grade read (GET .../grades): each student's
  `describedHere` and, where this slot reports them, `description: { text,
  updatedAt } | null`. Only the students it describes are listed (owner: a mover
  reported elsewhere, or one who left, is left out). Since backend eadf680 a
  Description is optional and may be cleared (owner, 2026-10-18): a saved one
  emptied says "Akan dihapus saat disimpan" and is sent as null, as a Note is.
*/

/** The backend's cap (grading.schema.js `words`), counted after trimming as the server trims. */
export const DESCRIPTION_MAX = 1000;

/**
 * The students the slot describes, in the grade read's order (by name), each with
 * its final grade (or null) and the Description saved: `{ studentProfileId,
 * fullName, finalValue, saved: { text, updatedAt } | null }`. `overlay` holds what
 * this card saved since that read, by student id, and wins over it.
 */
export function descriptionRows(grades, overlay = {}) {
  return (grades?.students ?? [])
    .filter((student) => student.describedHere)
    .map((student) => ({
      studentProfileId: student.studentProfileId,
      fullName: student.fullName,
      finalValue: student.grade?.finalGrade?.value ?? null,
      saved: overlay[student.studentProfileId] ?? student.description ?? null,
    }));
}

/** What a box shows: the draft typed, else what is saved, else nothing. */
export const textOf = (row, drafts) => drafts?.[row.studentProfileId] ?? row.saved?.text ?? '';

/** Whether a box differs from what is saved, compared trimmed as the server stores it. */
export function isChanged(row, drafts) {
  const draft = drafts?.[row.studentProfileId];
  if (draft === undefined) return false;
  return draft.trim() !== (row.saved?.text ?? '').trim();
}

/** A saved Description emptied in its box: it is cleared on save ("Akan dihapus saat disimpan"). */
export const willClear = (row, drafts) => isChanged(row, drafts) && drafts[row.studentProfileId].trim() === '';

/** How many have a Description saved: the count in the card's head. */
export const savedCount = (rows) => rows.filter((row) => (row.saved?.text ?? '').trim() !== '').length;

/** Boxes past the cap, by student id (`'tooLong'`); an empty box is never an error. */
export function descriptionErrors(rows, drafts) {
  const errors = {};
  for (const row of rows) {
    if (isChanged(row, drafts) && drafts[row.studentProfileId].trim().length > DESCRIPTION_MAX) errors[row.studentProfileId] = 'tooLong';
  }
  return errors;
}

/**
 * The PUT body's rows: each changed box, its text trimmed or null to clear, with the
 * updatedAt its Description was read at (null when there was none - a cleared one
 * keeps its row, and its updatedAt). Empty when nothing changed.
 */
export function descriptionsBody(rows, drafts) {
  return rows
    .filter((row) => isChanged(row, drafts))
    .map((row) => ({
      studentProfileId: row.studentProfileId,
      text: drafts[row.studentProfileId].trim() || null,
      updatedAt: row.saved?.updatedAt ?? null,
    }));
}

/** The drafts left after a save: the rows sent are dropped, any other typing is kept. */
export function draftsAfterSave(drafts, sent) {
  const next = { ...drafts };
  for (const row of sent) delete next[row.studentProfileId];
  return next;
}

/*
  The card opens closed (owner, 2026-10-18: 30 open boxes run to six screens), with
  "Semua / Belum diisi". "Belum diisi" keeps a row being typed in, even once it is
  saved, so a row never vanishes under the teacher's cursor.
*/
export const DESCRIPTION_FILTERS = ['all', 'missing'];

/** Rows the filter shows: all, or those with no Description saved plus any being typed in. */
export function shownRows(rows, drafts, filter = 'all', typing = new Set()) {
  if (filter !== 'missing') return rows;
  return rows.filter((row) => (row.saved?.text ?? '').trim() === '' || drafts?.[row.studentProfileId] !== undefined || typing.has(row.studentProfileId));
}
