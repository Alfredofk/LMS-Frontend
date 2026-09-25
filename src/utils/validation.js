/**
 * The backend's own field rules, restated for the browser.
 *
 * The rules mirror the backend's own zod: `modules/auth/auth.schema.js` for the
 * account fields, `modules/school/school.schema.js` for founding a school, and
 * `modules/membership/membership.schema.js` for joining one, and
 * `modules/academics/academics.schema.js` for the school's calendar and classes. Every validator here
 * now mirrors something — the last two that did not were the join fields, and
 * ticket 05 gave them rules to mirror.
 *
 * The *rules* are what must match, not the wording: these functions return
 * translation keys rather than sentences, so the same rule can be read in
 * Indonesian or English while still rejecting exactly what the server rejects.
 *
 * None of this is a security measure — the server validates regardless. It only
 * spares a round-trip and says why sooner. If a check here ever disagrees with
 * the server's, the server wins and somebody learns that our messages lie, so
 * when those schemas change this file changes with them.
 *
 * Every validator returns `null` when the value is fine, or `{ key, vars? }` for
 * the caller to run through `t()`.
 */

import { SCHOOL_TYPES, maxGradeFor } from '../constants/schoolTypes.js';

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD_BYTES = 72;
const MAX_EMAIL = 254;
const MIN_FULL_NAME = 2;
const MAX_FULL_NAME = 120;

/*
  bcrypt hashes at most 72 bytes and silently discards the rest, so the cap is on
  bytes, not characters — a password written in Indonesian may well carry
  multi-byte characters, and 72 of those are not 72 bytes.
*/
const byteLength = (value) => new TextEncoder().encode(value).length;

/*
  All four classes are required, not three of four. A symbol is anything that is
  not a letter, not a digit and not whitespace: were whitespace allowed to count,
  a trailing space — invisible, and usually a typo — would satisfy the rule on
  its own.
*/
const PASSWORD_CHECKS = [
  [/[A-Z]/, 'upper'],
  [/[a-z]/, 'lower'],
  [/[0-9]/, 'digit'],
  [/[^A-Za-z0-9\s]/, 'symbol'],
];

/**
 * @returns {null | { key: string, vars?: object }} the first failure
 */
export function validatePassword(value) {
  if (!value) return { key: 'validation.password.required' };
  if (value.length < MIN_PASSWORD) {
    return { key: 'validation.password.min', vars: { min: MIN_PASSWORD } };
  }

  for (const [pattern, name] of PASSWORD_CHECKS) {
    if (!pattern.test(value)) return { key: `validation.password.${name}` };
  }

  if (byteLength(value) > MAX_PASSWORD_BYTES) {
    return { key: 'validation.password.maxBytes', vars: { max: MAX_PASSWORD_BYTES } };
  }

  return null;
}

/** Every rule the password must satisfy, with whether `value` satisfies it yet. */
export function passwordChecklist(value = '') {
  return [
    {
      key: 'validation.rule.min',
      vars: { min: MIN_PASSWORD },
      met: value.length >= MIN_PASSWORD,
    },
    ...PASSWORD_CHECKS.map(([pattern, name]) => ({
      key: `validation.rule.${name}`,
      met: pattern.test(value),
    })),
  ];
}

export function validateEmail(value) {
  if (!value.trim()) return { key: 'validation.email.required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { key: 'validation.email.invalid' };
  if (value.length > MAX_EMAIL) return { key: 'validation.email.invalid' };
  return null;
}

export function validateFullName(value) {
  const trimmed = value.trim();
  if (!trimmed) return { key: 'validation.fullName.required' };
  if (trimmed.length < MIN_FULL_NAME) return { key: 'validation.fullName.short' };
  if (trimmed.length > MAX_FULL_NAME) return { key: 'validation.fullName.long' };
  return null;
}

/*
  Joining a school — and these no longer mirror nothing.

  Ticket 05 landed (`d7e2301`), so every rule below restates
  `LMS-Backend/src/modules/membership/membership.schema.js` line for line. The
  block that used to sit here said the opposite — that the backend had no rule for
  either field, so "you typed something" was the only honest answer. It was right
  until it was not.

  The School Code *generator* uses no 0, O, 1 or I (`school.service.js:32`) — the
  code is read aloud and typed from a WhatsApp message, and those are the four
  characters people get wrong. The *validator* is looser, here and on the server
  alike: `[A-Z2-9]` refuses 0 and 1 but accepts O and I, because A-Z includes
  them. A code containing one is well-formed, can never exist, and comes back 404
  from the lookup. The two sides agree; only the alphabet is stricter than both.
*/
const SCHOOL_CODE_LENGTH = 8;
const SCHOOL_CODE_PATTERN = /^[A-Z2-9]{8}$/;

/** Folded to upper case before anything looks at it: people type what they see. */
export const normaliseSchoolCode = (value) => String(value ?? '').trim().toUpperCase();

export function validateSchoolCode(value) {
  const code = normaliseSchoolCode(value);
  if (!code) return { key: 'validation.schoolCode.required' };
  if (!SCHOOL_CODE_PATTERN.test(code)) {
    return { key: 'validation.schoolCode.format', vars: { length: SCHOOL_CODE_LENGTH } };
  }
  return null;
}

export function validateNisn(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return { key: 'validation.nisn.required' };
  if (!/^\d{10}$/.test(trimmed)) return { key: 'validation.nisn.format' };
  return null;
}

/*
  A teacher may hold a NIP, a NUPTK, or both, so neither is required on its own.
  These two check the shape of whatever was typed; `validateTeacherIds` is what
  asks for at least one — the same two steps the backend takes, a refinement on
  top of two optional fields.

  NIP is a range, 9 to 18 digits, not one length: the post-2009 format is 18, and
  a teacher appointed before that still carries a 9-digit NIP lama. Refusing them
  would be refusing a real applicant.
*/
export function validateNip(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (!/^\d{9,18}$/.test(trimmed)) return { key: 'validation.nip.format' };
  return null;
}

export function validateNuptk(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  if (!/^\d{16}$/.test(trimmed)) return { key: 'validation.nuptk.format' };
  return null;
}

/** The pair rule: one of the two has to be there. */
export function validateTeacherIds(nip, nuptk) {
  const hasOne = String(nip ?? '').trim() || String(nuptk ?? '').trim();
  return hasOne ? null : { key: 'validation.teacherIds.required' };
}

/**
 * The whole teacher check, box by box: `{ nip, nuptk }`, each a failure or null.
 *
 * Two screens ask for these two numbers — joining a school as a teacher, and
 * adding TEACHER to a membership already held — and both must say the same
 * thing. The "give one of them" complaint lands on the NIP box, and **only
 * when neither box has a shape problem**: somebody who typed a NUPTK one digit
 * short is better told that than told they gave nothing.
 */
export function teacherIdErrors(nip, nuptk) {
  const nipFail = validateNip(nip);
  const nuptkFail = validateNuptk(nuptk);
  if (nipFail || nuptkFail) return { nip: nipFail, nuptk: nuptkFail };
  return { nip: validateTeacherIds(nip, nuptk), nuptk: null };
}

/*
  A guardian names one child, and states how they are related to them.

  The child is **named, never listed**: the applicant has to already know both
  the NISN and the full name, and that pairing is the whole out-of-band check
  the join flow leans on. Nothing here searches for a child, and the server
  returns no hint when the pair does not match — see ADR-0002.

  The NISN reuses `validateNisn`: it is the same ten-digit national student
  number, just somebody else's.

  `MIN_CHILD_NAME` is **3, not the 2 that `validateFullName` allows**, and the
  ceiling is 150 rather than 120. That is not an inconsistency to tidy away:
  the two mirror different schemas. An account name follows `auth.schema.js`,
  a child's name follows `membership.schema.js:48`. Reusing the account rule here
  would accept a two-letter name the server refuses, and refuse a long one it
  accepts — wrong at both ends.

  The messages are shared with `validateFullName` on purpose: they name the
  problem without quoting a number, so they stay true under either rule.
*/
const MIN_CHILD_NAME = 3;
const MAX_CHILD_NAME = 150;
const MIN_RELATIONSHIP = 3;
const MAX_RELATIONSHIP = 50;

export function validateChildFullName(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return { key: 'validation.fullName.required' };
  if (trimmed.length < MIN_CHILD_NAME) return { key: 'validation.fullName.short' };
  if (trimmed.length > MAX_CHILD_NAME) return { key: 'validation.fullName.long' };
  return null;
}

/*
  Free text, and deliberately so. "Ibu", "Ayah", "Wali", "Nenek", "Paman" are
  all real answers, and a fixed list would be a guess at an Indonesian family
  that the backend never makes either — `relationship` is a plain string there.
*/
export function validateRelationship(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return { key: 'validation.relationship.required' };
  if (trimmed.length < MIN_RELATIONSHIP) return { key: 'validation.relationship.short' };
  if (trimmed.length > MAX_RELATIONSHIP) return { key: 'validation.relationship.long' };
  return null;
}

/*
  The grade a student is entering, checked against the school they are entering it
  at. The backend does this with the school in hand; here the lookup has already
  told us the type, so the same rule applies before anything is sent — and the
  selector can offer only these grades in the first place.
*/
export function validateGradeLevel(value, schoolType, durationYears) {
  if (value === '' || value === null || value === undefined) {
    return { key: 'validation.gradeLevel.required' };
  }

  const type = SCHOOL_TYPES[schoolType];
  if (!type) return { key: 'validation.gradeLevel.required' };

  /* The ceiling depends on the school's length as well as its type: a four-year
     SMK runs to 13. `maxGradeFor` is the backend's isValidGrade, restated. */
  const max = maxGradeFor(schoolType, durationYears);
  const grade = Number(value);
  if (!Number.isInteger(grade) || grade < type.minGrade || grade > max) {
    return {
      key: 'validation.gradeLevel.range',
      vars: { min: type.minGrade, max },
    };
  }
  return null;
}

/*
  `z.coerce.date()` on the server takes anything Date can parse, so the only two
  rules worth restating are the ones it cannot express: it has to parse, and it
  cannot be in the future.
*/
export function validateBirthDate(value) {
  if (!value) return { key: 'validation.birthDate.required' };

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { key: 'validation.birthDate.invalid' };
  if (date > new Date()) return { key: 'validation.birthDate.future' };
  return null;
}

/*
  Founding a school.

  Every one of these restates `LMS-Backend/src/modules/school/school.schema.js`
  line for line, which is exactly what the header of this file asks for. When that
  zod changes, these change with it — and `validation.test.js` is what notices.

  (This block used to call `validateSchoolCode` and `validateNisn` "deliberately
  weak because the backend has no rule for either". That stopped being true when
  ticket 05 gave them rules, and the block above says so; this one had not caught
  up.)
*/
const MAX_SCHOOL_NAME = 150;
const MIN_SCHOOL_NAME = 3;
const MAX_CITY = 100;
const MIN_CITY = 2;
const MAX_KTP_BYTES = 2 * 1024 * 1024;

export function validateNpsn(value) {
  const trimmed = value.trim();
  if (!trimmed) return { key: 'validation.npsn.required' };
  // Exactly eight digits. Whether the number is a *real* NPSN is a platform
  // admin's judgement, made by hand — nothing here can check that.
  if (!/^\d{8}$/.test(trimmed)) return { key: 'validation.npsn.format' };
  return null;
}

export function validateSchoolName(value) {
  const trimmed = value.trim();
  if (!trimmed) return { key: 'validation.schoolName.required' };
  if (trimmed.length < MIN_SCHOOL_NAME) return { key: 'validation.schoolName.short' };
  if (trimmed.length > MAX_SCHOOL_NAME) return { key: 'validation.schoolName.long' };
  return null;
}

export function validateCity(value) {
  const trimmed = value.trim();
  if (!trimmed) return { key: 'validation.city.required' };
  if (trimmed.length < MIN_CITY) return { key: 'validation.city.short' };
  if (trimmed.length > MAX_CITY) return { key: 'validation.city.long' };
  return null;
}

/*
  Spaces and dashes are how people write phone numbers, so the server strips them
  before checking and so does this. Checking the raw string would reject
  "0812 3456 7890", which the server accepts.

  Beyond "digits, an optional leading +, 8 to 15 of them" nothing is assumed —
  operator prefixes change, and a stricter rule here would refuse a real
  applicant the server would have taken.
*/
export function validateApplicantPhone(value) {
  const cleaned = value.replace(/[\s-]/g, '').trim();
  if (!cleaned) return { key: 'validation.phone.required' };
  if (!/^\+?\d{8,15}$/.test(cleaned)) return { key: 'validation.phone.format' };
  return null;
}

/*
  Only an SMK chooses, and it must. Every other type has one legal value that the
  server fills in itself, and sending a different one is a 400 rather than a
  correction — so a form should not send the field at all for those.
*/
export function validateDurationYears(schoolType, value) {
  const spec = SCHOOL_TYPES[schoolType];
  if (!spec) return null;

  const choice = spec.allowedDurationYears;
  if (choice.length <= 1) return null;

  if (value === '' || value === undefined || value === null) {
    return { key: 'validation.duration.required' };
  }

  const years = Number(value);
  if (!Number.isInteger(years) || !choice.includes(years)) {
    return { key: 'validation.duration.invalid', vars: { choices: choice.join(' / ') } };
  }

  return null;
}

/*
  Size and type, as a courtesy — not as a guarantee.

  The server reads the type from the file's first bytes (`shared/upload.js`), so
  a PDF renamed to .png passes here and is refused there. That is the right way
  round: this check saves somebody a 2 MB upload that was never going to work,
  and claims nothing more.
*/
export function validateKtpFile(file) {
  if (!file) return { key: 'validation.ktp.required' };
  if (file.size > MAX_KTP_BYTES) return { key: 'validation.ktp.tooLarge', vars: { max: '2 MB' } };
  if (!['image/jpeg', 'image/png'].includes(file.type)) return { key: 'validation.ktp.type' };
  return null;
}

/*
  The school's calendar and its classes — academics.schema.js (ticket 07).

  Only the shape is mirrored, the same line the schema itself draws: whether a
  semester fits inside its year, whether two semesters overlap, whether a class
  name is already taken this year — those need the database, and the server's
  answer is shown when they fail.

  The label is "2026/2027": four digits, a slash, four digits, the second year
  the first plus one. A regex alone would take "2026/2030", which the server
  refuses with its own sentence; checking the sequence here says it first.
*/
const ACADEMIC_YEAR_LABEL = /^\d{4}\/\d{4}$/;
const MAX_CLASS_NAME = 50;

export function validateAcademicYearLabel(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return { key: 'validation.academicYear.required' };
  if (!ACADEMIC_YEAR_LABEL.test(trimmed)) return { key: 'validation.academicYear.format' };
  if (Number(trimmed.slice(5)) !== Number(trimmed.slice(0, 4)) + 1) {
    return { key: 'validation.academicYear.sequence' };
  }
  return null;
}

/**
 * Whether a year's dates fall in the calendar years its label names — a
 * 2028/2029 year starts in 2028 and ends in 2029.
 *
 * **The app's own rule, not the backend's**: `academicYearBody` only checks the
 * label's shape and that the end comes after the start, so "2028/2029, 18 Aug –
 * 18 Sep 2028" was accepted — and cannot be corrected afterwards: there is no
 * route to edit a year, its label is unique per school, and every semester must
 * fit inside its dates. Checked only once the label and both dates are valid;
 * answers `{ start, end }`, each a failure or null.
 */
export function yearDatesMatchLabel(label, start, end) {
  const first = Number(String(label ?? '').trim().slice(0, 4));
  const startYear = new Date(start).getUTCFullYear();
  const endYear = new Date(end).getUTCFullYear();
  return {
    start: startYear !== first ? { key: 'validation.academicYear.startYear', vars: { year: first } } : null,
    end: endYear !== first + 1 ? { key: 'validation.academicYear.endYear', vars: { year: first + 1 } } : null,
  };
}

/**
 * Whole months between two calendar days, rounded to the nearest — what the
 * confirmation before creating a year says, and what decides whether it warns.
 */
export function monthsBetween(start, end) {
  const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
  return Math.round(days / 30.44);
}

/**
 * A semester's dates against its year and the other semester — the two rules
 * `createSemester` checks (academics.service.js:200-207), restated so the
 * refusal comes before the press. Only once both dates are valid; answers
 * `{ start, end }`, each a failure or null.
 */
export function semesterFits(year, ordinal, start, end) {
  const day = (value) => new Date(String(value).slice(0, 10) + 'T00:00:00Z').getTime();
  const s = day(start);
  const e = day(end);
  const out = { start: null, end: null };
  if (s < day(year.startDate)) out.start = { key: 'validation.semester.beforeYear', vars: { label: year.label } };
  if (e > day(year.endDate)) out.end = { key: 'validation.semester.afterYear', vars: { label: year.label } };
  const other = (year.semesters ?? []).find((semester) => semester.ordinal !== ordinal);
  if (!out.start && !out.end && other && s < day(other.endDate) && e > day(other.startDate)) {
    out.end = { key: 'validation.semester.overlap', vars: { n: other.ordinal } };
  }
  return out;
}

/** An Indonesian school year runs about eleven months; outside 9–13 is worth a second look. */
export const isUsualYearLength = (months) => months >= 9 && months <= 13;

/**
 * Two dates from `<input type="date">`, the second strictly after the first —
 * `startDate < endDate` in both the year and the semester schema. Answers
 * `{ start, end }`, each a failure or null; the order complaint sits on the
 * end date, where the schema's own refine puts it (`path: ['endDate']`).
 */
export function validateDateRange(start, end) {
  const check = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return { key: 'validation.date.required' };
    if (Number.isNaN(new Date(text).getTime())) return { key: 'validation.date.invalid' };
    return null;
  };

  const startFail = check(start);
  const endFail = check(end);
  if (startFail || endFail) return { start: startFail, end: endFail };

  if (new Date(start).getTime() >= new Date(end).getTime()) {
    return { start: null, end: { key: 'validation.date.order' } };
  }
  return { start: null, end: null };
}

/** 1 to 50 after trimming — `name: z.string().trim().min(1).max(50)`. */
export function validateClassName(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return { key: 'validation.className.required' };
  if (trimmed.length > MAX_CLASS_NAME) return { key: 'validation.className.long', vars: { max: MAX_CLASS_NAME } };
  return null;
}

/**
 * Turn an ApiError's `details` into { field: message }.
 *
 * The backend's zod middleware sends an array of { path, message, code }, where
 * path is dotted and its first segment is the field. Anything that does not name
 * a field this form owns is dropped — the caller still has the error's own
 * message for that.
 *
 * These messages stay in the server's English. They only appear when our own
 * checks passed and the server's did not, which means the two disagree — a rare
 * case, and one where the server's exact words are the more useful thing to
 * show.
 */
export function fieldErrorsFrom(details, ownedFields) {
  if (!Array.isArray(details)) return {};

  return details.reduce((acc, issue) => {
    const field = String(issue?.path ?? '').split('.')[0];
    if (field && ownedFields.includes(field) && !acc[field]) acc[field] = issue.message;
    return acc;
  }, {});
}

/**
 * The same, for a body whose fields sit one level down.
 *
 * `fieldErrorsFrom` reads the FIRST segment of a zod path, which is right for
 * the flat forms it was written for. The membership bodies are nested — an issue
 * on the NISN arrives as `student.nisn`, the "give a NIP or a NUPTK" refinement
 * as `teacher.nip`, a guardian's as `guardian.childNisn` — so here the LAST
 * segment is the one that names a box.
 *
 * The last segments stay unique across roles, which is why this works with two
 * roles in flight: a student's own number is `nisn`, a guardian's child's is
 * `childNisn`.
 */
/**
 * The three boxes that name a child, checked together — `guardianPayload`
 * (membership.schema.js:73), the same wherever a child is claimed: joining as a
 * guardian, adding GUARDIAN, claiming a further child. Answers one entry per box
 * that fails, as `{ key, vars? }`, and nothing for a box that passes.
 */
export function childErrors(values) {
  const out = {};
  const nisn = validateNisn(values?.childNisn ?? '');
  const name = validateChildFullName(values?.childFullName ?? '');
  const relationship = validateRelationship(values?.relationship ?? '');
  if (nisn) out.childNisn = nisn;
  if (name) out.childFullName = name;
  if (relationship) out.relationship = relationship;
  return out;
}

/** The payload for those three boxes, trimmed — nothing else rides along. */
export const childPayload = (values) => ({
  childNisn: String(values?.childNisn ?? '').trim(),
  childFullName: String(values?.childFullName ?? '').trim(),
  relationship: String(values?.relationship ?? '').trim(),
});

/**
 * Whether what was typed names this school — the confirmation before leaving it.
 *
 * **Not a backend rule**; the server asks for nothing before `/me/leave`. It is
 * the app's own brake on the one action here nobody can undo alone: getting back
 * in means asking to join and waiting to be released again. Case and runs of
 * spaces are forgiven, because the point is that the person read the name, not
 * that they reproduced its capital letters.
 */
export function confirmsName(typed, name) {
  const fold = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  return fold(name) !== '' && fold(typed) === fold(name);
}

export function nestedFieldErrors(details, ownedFields) {
  if (!Array.isArray(details)) return {};

  return details.reduce((acc, issue) => {
    const parts = String(issue?.path ?? '').split('.');
    const field = parts[parts.length - 1];
    if (field && ownedFields.includes(field) && !acc[field]) acc[field] = issue.message;
    return acc;
  }, {});
}
