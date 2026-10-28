import { defaultSemesterOf } from '../Subjects/subjects';
import { formatNumber } from '../TeacherAssessment/results';

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
  - since backend 4dae152 (tickets 07-10) also `school: { name, npsn, city, address,
    phone, hasLogo }`, `phase`, each subject's `types: { TUGAS, KUIS, UTS, UAS }` (the
    rounded average, null where that type has nothing that counts or weighs 0) and
    `letter`, `blankTables: { extracurricular, personality }` (printed only),
    `letterScale: [{ letter, from, to }]` and `promotion: { outcome PROMOTED | RETAINED |
    GRADUATED, nextGradeLevel | null } | null` (an even semester's). A card closed
    before then carries nulls there. The PDF of it is `GET /report-cards/:id/pdf`.
*/

/** The four types a report card averages, in the PDF's column order. */
export const REPORT_TYPES = ['TUGAS', 'KUIS', 'UTS', 'UAS'];

/**
 * Whether the card carries any type average - a card closed before backend 4dae152
 * froze none, and four columns of "-" would say nothing.
 */
export const showsTypeAverages = (subjects) =>
  (subjects ?? []).some((line) => REPORT_TYPES.some((type) => typeof line.types?.[type] === 'number'));

/** One type's average as printed: the number in the reader's language ("52,5"), or "-" where it counts for nothing. */
export const typeAverageText = (line, type, lang = 'id') => {
  const value = line?.types?.[type];
  return typeof value === 'number' ? formatNumber(value, lang) : '-';
};

const ROMAN = [
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** A grade level as a rapor writes it, in Roman numerals (1 to 13; a four-year SMK reaches XIII). */
export function romanOf(n) {
  if (!Number.isInteger(n) || n < 1) return String(n ?? '');
  let rest = n;
  let out = '';
  for (const [value, numeral] of ROMAN) {
    while (rest >= value) {
      out += numeral;
      rest -= value;
    }
  }
  return out;
}

/**
 * The promotion statement's key and grade, as the PDF says it (grading.pdf.js
 * PROMOTION_TEXTS): "Naik ke kelas XI", "Tinggal di kelas X", "Lulus". Null without one.
 */
export function promotionLineOf(card) {
  const promotion = card?.promotion;
  if (!promotion?.outcome) return null;
  const grade = promotion.nextGradeLevel === null || promotion.nextGradeLevel === undefined ? null : romanOf(promotion.nextGradeLevel);
  return { key: `rc.promotion.${promotion.outcome}`, grade };
}

/** The school's address and phone, each `{ kind, value }`, either left out when not set. */
export const letterheadParts = (school) =>
  [
    ['address', school?.address],
    ['phone', school?.phone],
  ]
    .filter(([, value]) => typeof value === 'string' && value.trim() !== '')
    .map(([kind, value]) => ({ kind, value }));

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

/**
 * One report card summed up (owner, 2026-10-28: the numbers above it, and on its
 * row in a list): the mean of its final grades to one decimal (null with none, the
 * same mean as latestAverageOf), how many subjects reach their own KKTP and how
 * many are under it (a subject with no KKTP counts in neither), out of how many,
 * and the sessions missed (sick + excused + absent).
 */
export function reportSummaryOf(card) {
  const lines = card?.subjects ?? [];
  const grades = lines.map((line) => line.finalGrade).filter((value) => typeof value === 'number');
  const judged = lines.filter((line) => typeof line.finalGrade === 'number' && typeof line.kktp === 'number');
  const below = judged.filter((line) => line.finalGrade < line.kktp).length;
  const att = card?.attendance ?? {};
  return {
    average: grades.length ? Math.round((grades.reduce((sum, value) => sum + value, 0) / grades.length) * 10) / 10 : null,
    passed: judged.length - below,
    below,
    subjects: lines.length,
    missed: (att.sick ?? 0) + (att.excused ?? 0) + (att.absent ?? 0),
  };
}
