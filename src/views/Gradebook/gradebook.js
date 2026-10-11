import { formatNumber } from '../TeacherAssessment/results';

/*
  A class subject's gradebook (owner, 2026-10-10; a tab of the subject's page
  since 2026-10-11): its students down the side and its published assessments across, each cell the
  score that counts - or a short word for why there is none. No average: the
  backend has no weights or report-card total yet, and a number made up here
  would read as one. Pure: the screen is GradebookTable.

  Read per class subject: GET /assessments/class-subjects/:id, then one
  GET /assessments/:id/submissions per published assessment already opened (one
  not opened yet has nothing in it, so its cells say so without a read).
*/

/**
 * The columns: published assessments, earliest to open first. `opened` says
 * whether its results are worth reading: once its window opened, or always for
 * an OFFLINE one, whose marks may be entered and released before it.
 */
export function gradebookColumns(assessments, now = new Date()) {
  return (assessments ?? [])
    .filter((assessment) => assessment.status === 'PUBLISHED')
    .slice()
    .sort((a, b) => new Date(a.opensAt) - new Date(b.opensAt))
    .map((assessment) => ({ assessment, opened: assessment.mode === 'OFFLINE' || new Date(assessment.opensAt) <= now }));
}

/**
 * Whether the score that counts came from a remedial (backend 1e6c749): the
 * highest released score of an attempt not void (countedScoreOf) is reached only
 * by attempts started under a remedial. A tie with an ordinary attempt is not one -
 * the student had that score without the remedial. Only a mark: the school's
 * remedial rule (a KKTP cap, the highest, an average) is not in the backend yet.
 */
export function countedFromRemedial(entry) {
  if (entry?.countedScore === null || entry?.countedScore === undefined) return false;
  const reaching = (entry.attempts ?? []).filter(
    (attempt) => attempt.releasedAt && attempt.status !== 'VOID' && attempt.score && Number(attempt.score.value) === Number(entry.countedScore)
  );
  return reaching.length > 0 && reaching.every((attempt) => attempt.remedial);
}

/**
 * What one cell says: `{ score, remedial }` when a score counts, else `{ word }` -
 * a key under `gradebook.cell.` - or `{ word: 'failed' }` when that column's
 * results could not be read, `{ word: 'notOpen' }` before it opens.
 */
export function cellOf(column, results, studentProfileId) {
  if (!column.opened) return { word: 'notOpen' };
  if (!results) return { word: 'failed' };
  const entry = results.students?.find((student) => student.studentProfileId === studentProfileId);
  if (!entry) return { word: 'NOT_STARTED' };
  if (entry.countedScore !== null && entry.countedScore !== undefined) return { score: entry.countedScore, remedial: countedFromRemedial(entry) };
  return { word: entry.status };
}

/**
 * The rows: every student any column's results name, by name, each with
 * `placedNow` false once they left in any of them. `resultsById` holds each
 * column's results (null where the read failed).
 */
export function gradebookRows(columns, resultsById) {
  const byId = new Map();
  for (const { assessment } of columns) {
    for (const student of resultsById[assessment.id]?.students ?? []) {
      const known = byId.get(student.studentProfileId);
      byId.set(student.studentProfileId, {
        studentProfileId: student.studentProfileId,
        fullName: known?.fullName ?? student.fullName,
        placedNow: (known?.placedNow ?? true) && student.placedNow !== false,
      });
    }
  }
  return [...byId.values()]
    .sort((a, b) => String(a.fullName ?? '').localeCompare(String(b.fullName ?? '')))
    .map((student) => ({
      ...student,
      cells: columns.map((column) => cellOf(column, resultsById[column.assessment.id], student.studentProfileId)),
    }));
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
