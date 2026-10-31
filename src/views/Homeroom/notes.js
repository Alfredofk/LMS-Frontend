/*
  The Homeroom Teacher's Notes on a class for one semester (backend 483be5a,
  grading-and-report-card ticket 03; owner 2026-10-18): a card under the attendance
  on Kelas Perwalian, one box per student placed in the class now, one save button.
  Required before the semester closes (backend eadf680), but an empty box is still no
  error here: a saved one emptied is cleared (null) when saved, and the card says so
  under the box first. Pure: the card is HomeroomNotes.
*/

/** The backend's cap (grading.schema.js `words`), counted after trimming as the server trims. */
export const NOTE_MAX = 1000;

/**
 * The students of the read, in its order (by name): `{ studentProfileId, fullName,
 * saved: { text | null, updatedAt } | null }`. `overlay` holds what this card saved
 * since that read, by student id, and wins over it.
 */
export function noteRows(read, overlay = {}) {
  return (read?.students ?? []).map((student) => ({
    studentProfileId: student.studentProfileId,
    fullName: student.fullName,
    saved: overlay[student.studentProfileId] ?? student.note ?? null,
  }));
}

const savedText = (row) => (row.saved?.text ?? '').trim();

/** What a box shows: the draft typed, else what is saved, else nothing. */
export const noteTextOf = (row, drafts) => drafts?.[row.studentProfileId] ?? row.saved?.text ?? '';

/** Whether a box differs from what is saved, compared trimmed; a cleared Note (null) reads as empty. */
export function noteChanged(row, drafts) {
  const draft = drafts?.[row.studentProfileId];
  return draft !== undefined && draft.trim() !== savedText(row);
}

/** A saved Note emptied in its box: it is cleared on save ("Akan dihapus saat disimpan"). */
export const willClear = (row, drafts) => noteChanged(row, drafts) && drafts[row.studentProfileId].trim() === '';

/** How many students have a Note with text: the count in the card's head. */
export const notedCount = (rows) => rows.filter((row) => savedText(row) !== '').length;

/** Boxes past the cap, by student id (`'tooLong'`); an empty box is never an error. */
export function noteErrors(rows, drafts) {
  const errors = {};
  for (const row of rows) {
    if (noteChanged(row, drafts) && drafts[row.studentProfileId].trim().length > NOTE_MAX) errors[row.studentProfileId] = 'tooLong';
  }
  return errors;
}

/**
 * The PUT body's rows: each changed box, its text trimmed or null to clear, with the
 * updatedAt its Note was read at (null when there was none - a cleared one keeps its
 * row, and its updatedAt).
 */
export function notesBody(rows, drafts) {
  return rows
    .filter((row) => noteChanged(row, drafts))
    .map((row) => ({
      studentProfileId: row.studentProfileId,
      text: drafts[row.studentProfileId].trim() || null,
      updatedAt: row.saved?.updatedAt ?? null,
    }));
}

/** The text tabs over the boxes (mockup catatan-kenaikan-wali.html, item 2): by what is saved, so a box being typed in stays put until saved. */
export const NOTE_TABS = ['all', 'missing', 'filled'];

/** How many rows each tab holds: `{ all, missing, filled }`. */
export function noteTabCounts(rows) {
  const filled = notedCount(rows);
  return { all: rows.length, missing: rows.length - filled, filled };
}

/** The rows a tab shows. */
export function rowsInTab(rows, tab) {
  if (tab === 'missing') return rows.filter((row) => savedText(row) === '');
  if (tab === 'filled') return rows.filter((row) => savedText(row) !== '');
  return rows;
}
