/*
  The Homeroom Teacher's Promotion Outcomes (backend 4dae152, grading-and-report-card
  ticket 09; owner 2026-10-22): who of a class goes up a grade, stays, or graduates,
  decided once a year in Semester 2 while it is being finalised and every subject of
  the class is finalised. A card under the Notes, one choice per student, one save
  button - the Notes' pattern. Pure: the card is HomeroomPromotions.

  The read (grading.promotion.js readPromotions): `{ class: { id, name, gradeLevel },
  academicYear, semester: { id, ordinal, status }, decidable, notDecidable | null,
  waitingFor: [{ classSubjectId, subject: { id, code, name } }], choices (the advancing
  one first: PROMOTED | GRADUATED, then RETAINED), automaticOutcome, students: [{
  studentProfileId, fullName, outcome | null, automatic: boolean | null, result | null,
  updatedAt | null }] }`. `automatic` is whether every final grade of both semesters
  reaches its KKTP (null until every subject is finalised); the teacher's own outcome
  always wins over it, and null puts a student back to it. Closing Semester 2 waits for
  every student with no result.
*/

/** The value a choice holds for "follow the automatic rule" (sent as null). */
export const AUTOMATIC = '';

/** Whether the card shows at all: Semester 2 being finalised or closed - while it is open there is nothing to decide. */
export const promotionsShown = (semester) => Boolean(semester) && semester.ordinal === 2 && (semester.status === 'FINALIZING' || semester.status === 'CLOSED');

/** The year's Semester 2, or null. */
export const evenSemesterOf = (year) => (year?.semesters ?? []).find((semester) => semester.ordinal === 2) ?? null;

/** What a student's choice shows: the draft picked, else their saved outcome, else the automatic rule. */
export const choiceOf = (student, drafts) => drafts?.[student.studentProfileId] ?? student.outcome ?? AUTOMATIC;

/** Whether a choice differs from what is saved. */
export const promotionChanged = (student, drafts) => {
  const draft = drafts?.[student.studentProfileId];
  return draft !== undefined && draft !== (student.outcome ?? AUTOMATIC);
};

/**
 * What would count for a student with the choice now on screen - as the server's
 * resultOf: their own outcome, else the automatic one where every grade reaches the
 * KKTP, else null (undecided).
 */
export function resultShown(student, drafts, automaticOutcome) {
  const choice = choiceOf(student, drafts);
  if (choice !== AUTOMATIC) return choice;
  return student.automatic ? automaticOutcome : null;
}

/** How many students have a result with the choices on screen: the count in the card's head. */
export const decidedCount = (students, drafts, automaticOutcome) =>
  (students ?? []).filter((student) => resultShown(student, drafts, automaticOutcome) !== null).length;

/** The PUT body's rows: each changed choice, null for the automatic rule, with the placement's updatedAt read. */
export function promotionsBody(students, drafts) {
  return (students ?? [])
    .filter((student) => promotionChanged(student, drafts))
    .map((student) => ({
      studentProfileId: student.studentProfileId,
      outcome: drafts[student.studentProfileId] === AUTOMATIC ? null : drafts[student.studentProfileId],
      updatedAt: student.updatedAt,
    }));
}

/**
 * Why the outcomes cannot be decided now, as a key and its values, from the read's
 * own fields rather than the server's English (grading.promotion.js notDecidableOf):
 * the semester not being finalised, closed, the year closed, or subjects not
 * finalised yet (their codes). Null while decidable.
 */
export function notDecidableView(read) {
  if (!read || read.decidable) return null;
  const status = read.semester?.status;
  if (status === 'OPEN') return { key: 'homeroom.promo.notYet.open' };
  if (status === 'CLOSED') return { key: 'homeroom.promo.notYet.closed' };
  if ((read.waitingFor ?? []).length > 0) {
    return { key: 'homeroom.promo.notYet.waiting', vars: { subjects: read.waitingFor.map((row) => row.subject?.code ?? row.subject?.name).join(', ') } };
  }
  return { key: 'homeroom.promo.notYet.yearClosed', vars: { year: read.academicYear } };
}

/**
 * The summary over the list (mockup catatan-kenaikan-wali.html, item 9): how many
 * students go up (or graduate), stay, and have no result yet, with the choices on
 * screen. `advance` counts PROMOTED and GRADUATED alike - a class offers only one.
 */
export function outcomeCounts(students, drafts, automaticOutcome) {
  const out = { advance: 0, RETAINED: 0, undecided: 0 };
  for (const student of students ?? []) {
    const result = resultShown(student, drafts, automaticOutcome);
    if (result === 'RETAINED') out.RETAINED += 1;
    else if (result) out.advance += 1;
    else out.undecided += 1;
  }
  return out;
}
