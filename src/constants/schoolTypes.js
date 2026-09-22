/**
 * The four school types the backend recognises, and how long each one runs.
 *
 * Mirrors `LMS-Backend/src/shared/schoolType.js` — the `SCHOOL_TYPES` table
 * there is authoritative, and `school.schema.js` validates against it. If the
 * two ever disagree the server wins and this file is the one that is wrong.
 *
 * `SMK` is the only genuinely varying one: most run three years, some programs
 * run four, and the registration form must ask. Every other type has exactly one
 * legal value, which the server fills in itself — sending a different one is a
 * 400, not a silent correction, so the form must not send the field at all.
 *
 * These four names are the backend's `SchoolType` enum. They are proper nouns of
 * the Indonesian system and are never translated, like NISN and NPSN.
 */
/*
  `minGrade`/`maxGrade` are the other half of the source table, copied across
  when joining a school landed: a student states the grade they are entering,
  and the backend checks it against the school it belongs to — grade 7 is not a
  thing at an SD (membership.service.js, via shared/schoolType.js).

  These are national curriculum facts, not a school preference, which is why
  the source hardcodes them and why copying them here is safe. A lookup tells
  us the school type, so the form can offer only the grades that exist there
  rather than letting somebody pick one and learn from a 400.
*/
export const SCHOOL_TYPES = {
  SD: { minGrade: 1, maxGrade: 6, defaultDurationYears: 6, allowedDurationYears: [6] },
  SMP: { minGrade: 7, maxGrade: 9, defaultDurationYears: 3, allowedDurationYears: [3] },
  SMA: { minGrade: 10, maxGrade: 12, defaultDurationYears: 3, allowedDurationYears: [3] },
  SMK: { minGrade: 10, maxGrade: 12, defaultDurationYears: 3, allowedDurationYears: [3, 4] },
};

/** In the order a dropdown should offer them: youngest school first. */
export const SCHOOL_TYPE_NAMES = ['SD', 'SMP', 'SMA', 'SMK'];

/** True when this type lets the applicant choose, i.e. only SMK. */
export const choosesDuration = (schoolType) =>
  (SCHOOL_TYPES[schoolType]?.allowedDurationYears.length ?? 0) > 1;

/**
 * Every grade this school type actually has, ascending — [1..6] for an SD,
 * [10, 11, 12] for an SMA. Empty for an unknown type, which is what a grade
 * selector should render as "nothing to choose" rather than 1 to 12.
 */
export const gradesFor = (schoolType) => {
  const type = SCHOOL_TYPES[schoolType];
  if (!type) return [];
  return Array.from(
    { length: type.maxGrade - type.minGrade + 1 },
    (_, i) => type.minGrade + i
  );
};

export default SCHOOL_TYPES;
