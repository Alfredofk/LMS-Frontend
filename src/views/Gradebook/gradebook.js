import { formatNumber } from '../TeacherAssessment/results';

/*
  A class subject's gradebook (owner, 2026-10-10; a tab of the subject's page
  since 2026-10-11): its students down the side and its published assessments across, each cell the
  score that counts - or a short word for why there is none. Pure: the screen is GradebookTable.

  The final grade on the right (owner, 2026-10-18) is the backend's, never
  worked out here: GET /grading/class-subjects/:id/grades (backend 79b319f,
  ticket 02), computed live with the slot's weights, KKTP and the school's
  remedial rule. It is a running grade - "did not submit" counts 0, what waits
  counts nothing yet - so the opened row says how many of each.

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

/** The four types in the order the grade read lists them (grading.compute.js TYPES). */
export const GRADE_TYPES = ['TUGAS', 'KUIS', 'UTS', 'UAS'];

/**
 * One student's final-grade cell, from their row of the grade read: null with
 * no row (the read failed, or does not list them); `{ reportedBy }` - a class
 * name, or null - when another class's slot reports them (they moved on);
 * else `{ value, unrounded, types, didNotSubmit, waiting, remedialRuleMoved,
 * pooled }`, value null while nothing weighted counts yet.
 */
export function finalOf(student) {
  if (!student) return null;
  if (!student.reportedHere) return { reportedBy: student.reportedBy?.name ?? null };
  const grade = student.grade ?? {};
  return {
    value: grade.finalGrade?.value ?? null,
    unrounded: grade.finalGrade?.unrounded ?? null,
    types: grade.types ?? {},
    didNotSubmit: grade.didNotSubmit ?? 0,
    waiting: grade.waiting ?? 0,
    remedialRuleMoved: grade.remedialRuleMoved ?? 0,
    pooled: grade.pooled ?? 0,
  };
}

/** The counts said in a student's details (`gradebook.final.note.*`). */
export const FINAL_NOTES = ['waiting', 'didNotSubmit', 'remedialRuleMoved', 'pooled'];

/** Every count above 0, `[{ key, n }]`, shown in a student's opened row (owner, 2026-10-18). */
const countsOf = (keys) => (final) => keys.filter((key) => final?.[key] > 0).map((key) => ({ key, n: final[key] }));
export const finalNotes = countsOf(FINAL_NOTES);

/**
 * The rows: the recap's students, by name, each with a cell per column - looked
 * up by assessment id, since the recap also holds the cancelled ones - and
 * their final grade from the grade read (`final`, see finalOf; null for all
 * when `grades` is null).
 */
export function gradebookRows(columns, recap, grades = null) {
  const gradeById = new Map((grades?.students ?? []).map((student) => [student.studentProfileId, student]));
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
        final: finalOf(gradeById.get(student.studentProfileId)),
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
 * @param words        (key) => the cell word, already translated
 * @param finalHeader  the final grade's column header; none, no column. Its
 *                     cells hold the whole number, "-" where there is none.
 */
export function gradebookCsv(columns, rows, { lang, nameHeader, columnHeader, words, finalHeader = null }) {
  const sep = lang === 'en' ? ',' : ';';
  const head = [nameHeader, ...columns.map((column) => columnHeader(column.assessment)), ...(finalHeader ? [finalHeader] : [])];
  const body = rows.map((row) => [
    row.fullName ?? '',
    ...row.cells.map((cell) => ('score' in cell ? formatNumber(cell.score, lang) : words(cell.word))),
    ...(finalHeader ? [formatNumber(row.final?.value ?? null, lang)] : []),
  ]);
  return String.fromCharCode(0xfeff) + [head, ...body].map((line) => line.map((value) => quote(value, sep)).join(sep)).join('\r\n') + '\r\n';
}

/**
 * Whether a cell's score is under the KKTP that applies to the class subject
 * (grade settings, backend 5d42af6) - marked in the table, not in the CSV. The
 * score as it counts, raw: the remedial rule is applied only in the Final Grade.
 * No KKTP read (null) marks nothing. The final grade is marked the same way,
 * as `{ score: final.value }`.
 */
export const belowKktp = (cell, kktp) => typeof kktp === 'number' && typeof cell?.score === 'number' && cell.score < kktp;

/**
 * What one student's row says under the name (owner, 2026-10-28: a row per
 * student instead of the table): how many scores count, then how many cells
 * carry each word, in a fixed order, only those above 0: `[{ key, n }]`, the
 * first `scores`, the rest a cell word (`gradebook.count.*`).
 */
export const COUNT_ORDER = ['DID_NOT_SUBMIT', 'WAITING_FOR_MARKING', 'WAITING_FOR_RELEASE', 'IN_PROGRESS', 'NOT_STARTED', 'RELEASED', 'notOpen'];
export function rowCounts(row) {
  const cells = row?.cells ?? [];
  const scores = cells.filter((cell) => 'score' in cell).length;
  const words = COUNT_ORDER.map((key) => ({ key, n: cells.filter((cell) => cell.word === key).length })).filter(({ n }) => n > 0);
  return [{ key: 'scores', n: scores }, ...words];
}

/**
 * The three numbers above the rows: the mean of the final grades there are
 * (one decimal, null with none), how many of those are under the KKTP (null
 * without a KKTP), out of how many, and how many cells read "did not submit".
 */
export function gradebookSummary(rows, kktp) {
  const finals = (rows ?? []).map((row) => row.final?.value).filter((value) => typeof value === 'number');
  const average = finals.length ? Math.round((finals.reduce((sum, value) => sum + value, 0) / finals.length) * 10) / 10 : null;
  const below = typeof kktp === 'number' ? finals.filter((value) => value < kktp).length : null;
  const didNotSubmit = (rows ?? []).reduce((sum, row) => sum + (row.cells ?? []).filter((cell) => cell.word === 'DID_NOT_SUBMIT').length, 0);
  return { average, below, graded: finals.length, didNotSubmit };
}
