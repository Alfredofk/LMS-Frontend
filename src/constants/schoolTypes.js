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
export const SCHOOL_TYPES = {
  SD: { defaultDurationYears: 6, allowedDurationYears: [6] },
  SMP: { defaultDurationYears: 3, allowedDurationYears: [3] },
  SMA: { defaultDurationYears: 3, allowedDurationYears: [3] },
  SMK: { defaultDurationYears: 3, allowedDurationYears: [3, 4] },
};

/** In the order a dropdown should offer them: youngest school first. */
export const SCHOOL_TYPE_NAMES = ['SD', 'SMP', 'SMA', 'SMK'];

/** True when this type lets the applicant choose, i.e. only SMK. */
export const choosesDuration = (schoolType) =>
  (SCHOOL_TYPES[schoolType]?.allowedDurationYears.length ?? 0) > 1;

export default SCHOOL_TYPES;
