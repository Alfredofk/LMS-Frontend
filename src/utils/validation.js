/**
 * The backend's own field rules, restated for the browser.
 *
 * Every rule here mirrors LMS-Backend/src/modules/auth/auth.schema.js. The
 * *rules* are what must match, not the wording: these functions return
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
  School Code and NISN — the two fields of the join request.

  Unlike everything above, these mirror **nothing**. `prisma/schema.prisma:231`
  and `:316` declare `schoolCode` and `nisn` as a bare `String` and `TEXT`, with
  no length and no format, and there is no zod schema for either anywhere in the
  backend: the join endpoint is not written yet. A grep for both names across
  `LMS-Backend/src` finds nothing at all.

  So the only honest rules are "you typed something" and a ceiling that stops a
  pasted paragraph. Not digits-only, not ten digits, not any prefix — a NISN is
  conventionally ten digits, but convention is not the server's rule, and this
  file's own header says what happens when the two disagree: the server wins and
  our messages turn out to be lies.

  Revisit when ticket 05 lands.
*/
const MAX_JOIN_FIELD = 64;

export function validateSchoolCode(value) {
  const trimmed = value.trim();
  if (!trimmed) return { key: 'validation.schoolCode.required' };
  if (trimmed.length > MAX_JOIN_FIELD) return { key: 'validation.schoolCode.long' };
  return null;
}

export function validateNisn(value) {
  const trimmed = value.trim();
  if (!trimmed) return { key: 'validation.nisn.required' };
  if (trimmed.length > MAX_JOIN_FIELD) return { key: 'validation.nisn.long' };
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
