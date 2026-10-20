import { defaultSemesterOf } from '../Subjects/subjects';

/*
  Report cards (backend 3a22f90 / 46c6173, grading-and-report-card tickets 05-06;
  owner 2026-10-20), written frozen when the Principal closes a semester and read as
  they were written. Pure: the screens are ClassReportCards (a class's, for its
  homeroom teacher and the leaders), ReportCardPage (one) and MyReportCardsPage (a
  student's own).

  A report card (grading.reportCards.js reportCardView):
  `{ id, version, reportDate 'YYYY-MM-DD', writtenAt, school: { name }, academicYear,
     semester: { id, ordinal }, student: { studentProfileId, fullName, nisn },
     class: { id, name }, homeroomTeacher: { fullName, nip } | null,
     principal: { fullName, nip }, subjects: [{ subject: { id, code, name },
     finalGrade, kktp, description }], attendance: { sick, excused, absent }, note }`
  - a staff read adds `versions: [{ id, version, reportDate, writtenAt }]`, oldest
    first; a student reads only the newest and gets no `versions`.
*/

/** Which semester the class card opens on: the newest closed one, else the one running today. */
export function defaultReportSemesterOf(year, today) {
  const closed = (year?.semesters ?? []).filter((semester) => semester.status === 'CLOSED').sort((a, b) => b.ordinal - a.ordinal);
  return closed[0]?.id ?? defaultSemesterOf(year, today);
}

/** The newest version among a staff read's `versions`, or null for a student's read. */
export const newestVersionOf = (card) => (card?.versions?.length ? card.versions[card.versions.length - 1] : null);

/** Whether this is an older version than the newest the reader may open. */
export const isOlderVersion = (card) => {
  const newest = newestVersionOf(card);
  return Boolean(newest && newest.version > card.version);
};

/** Whether to offer the version choice: a staff read holding more than one. */
export const hasVersionChoice = (card) => (card?.versions?.length ?? 0) > 1;

/** The KKTP to name under the table when every subject shares one (owner: a line, not a column), else null. */
export function sharedKktpOf(subjects) {
  const values = [...new Set((subjects ?? []).map((line) => line.kktp))];
  return values.length === 1 && values[0] !== null && values[0] !== undefined ? values[0] : null;
}

/**
 * Where the report card page leads back to, from the state the opener passed
 * (`{ back: { to, state } }`), else the reader's own list or home.
 */
export function backOf(locationState, fallback) {
  const back = locationState?.back;
  return back?.to ? { to: back.to, state: back.state ?? null } : { to: fallback, state: null };
}

/**
 * The student dashboard's "Rata-rata Nilai" (owner, 2026-10-20): the mean of the final
 * grades on the newest report card - the first of `GET /report-cards/mine`, which lists
 * the latest semester first - to one decimal. `{ card, average }`, or null with no card
 * or none with a subject.
 */
export function latestAverageOf(reportCards) {
  const card = reportCards?.[0];
  const grades = (card?.subjects ?? []).map((line) => line.finalGrade).filter((value) => typeof value === 'number');
  if (!card || grades.length === 0) return null;
  const mean = grades.reduce((sum, value) => sum + value, 0) / grades.length;
  return { card, average: Math.round(mean * 10) / 10 };
}
