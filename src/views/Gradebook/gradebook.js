import { formatNumber } from '../TeacherAssessment/results';

/*
  A class subject's gradebook (owner, 2026-10-10; a tab of the subject's page
  since 2026-10-11): its students down the side and its published assessments across, each cell the
  score that counts - or a short word for why there is none. No average: the
  backend computes no Final Grade yet (weights and KKTP exist since 5d42af6;
  the grade is ticket 02), and a number made up here would read as one. Pure: the screen is GradebookTable.

  Read in one request since 2026-10-13: GET /assessments/class-subjects/:id/recap
  (backend 113ae37), whose cells say whether only a remedial reached the score
  (`countedFromRemedial`, 96d2109 - request #19). It used to be one results read
  per assessment, with the remedial worked out here from the attempts.
*/

/**
 * The columns: published assessments, earliest to open first - the recap's
 * cancelled ones are left out (owner's choice). `opened` says whether its cells
 * mean anything yet: once its window opened, or always for an OFFLINE one, whose
 * marks may be entered and released before it.
 */
export function gradebookColumns(assessments, now = new Date()) {
  return (assessments ?? [])
    .filter((assessment) => assessment.status === 'PUBLISHED')
    .slice()
    .sort((a, b) => new Date(a.opensAt) - new Date(b.opensAt))
    .map((assessment) => ({ assessment, opened: assessment.mode === 'OFFLINE' || new Date(assessment.opensAt) <= now }));
}

/**
 * What one cell says: `{ score, remedial }` when a score counts, else `{ word }` -
 * a key under `gradebook.cell.` - or `{ word: 'notOpen' }` before it opens. A
 * recap cell with no status (the student is not in that assessment's results)
 * reads as not started.
 */
export function cellOf(column, cell) {
  if (!column.opened) return { word: 'notOpen' };
  if (cell?.countedScore !== null && cell?.countedScore !== undefined) return { score: cell.countedScore, remedial: Boolean(cell.countedFromRemedial) };
  return { word: cell?.status ?? 'NOT_STARTED' };
}

/**
 * The rows: the recap's students, by name, each with a cell per column - looked
 * up by assessment id, since the recap also holds the cancelled ones.
 */
export function gradebookRows(columns, recap) {
  return (recap?.students ?? [])
    .slice()
    .sort((a, b) => String(a.fullName ?? '').localeCompare(String(b.fullName ?? '')))
    .map((student) => {
      const cellById = new Map((student.cells ?? []).map((cell) => [cell.assessmentId, cell]));
      return {
        studentProfileId: student.studentProfileId,
        fullName: student.fullName,
        placedNow: student.placedNow !== false,
        cells: columns.map((column) => cellOf(column, cellById.get(column.assessment.id))),
      };
    });
}

/* Quoted only when it holds the separator, a quote or a line break: a quoted "87,5" is still a number to Excel, but plain is plainer. */
const quote = (value, sep) => {
  const text = String(value ?? '');
  return text.includes(sep) || /["\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * The table as CSV, for a spreadsheet in the reader's language: Indonesian
 * writes "87,5" and separates with ";" (what Excel set to Indonesian opens),
 * English "87.5" and ",". A BOM leads, so Excel reads the names as UTF-8.
 *
 * @param words  (key) => the cell word, already translated
 */
export function gradebookCsv(columns, rows, { lang, nameHeader, columnHeader, words }) {
  const sep = lang === 'en' ? ',' : ';';
  const head = [nameHeader, ...columns.map((column) => columnHeader(column.assessment))];
  const body = rows.map((row) => [row.fullName ?? '', ...row.cells.map((cell) => ('score' in cell ? formatNumber(cell.score, lang) : words(cell.word)))]);
  return String.fromCharCode(0xfeff) + [head, ...body].map((line) => line.map((value) => quote(value, sep)).join(sep)).join('\r\n') + '\r\n';
}

/**
 * Whether a cell's score is under the KKTP that applies to the class subject
 * (grade settings, backend 5d42af6) - marked in the table, not in the CSV. The
 * score as it counts, raw: the remedial rule is applied only in the Final Grade.
 * No KKTP read (null) marks nothing.
 */
export const belowKktp = (cell, kktp) => typeof kktp === 'number' && typeof cell?.score === 'number' && cell.score < kktp;
