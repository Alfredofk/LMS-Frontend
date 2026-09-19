/**
 * The backend's own field rules, restated for the browser.
 *
 * Every rule here mirrors LMS-Backend/src/modules/auth/auth.schema.js line for
 * line, including the wording. That is the point: a form that passes here and is
 * then rejected by the server teaches people that the messages lie. When those
 * schemas change, this file changes with them.
 *
 * None of this is a security measure — the server validates regardless. It only
 * spares a round-trip and says why sooner.
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
  [/[A-Z]/, 'Password must contain an uppercase letter'],
  [/[a-z]/, 'Password must contain a lowercase letter'],
  [/[0-9]/, 'Password must contain a number'],
  [/[^A-Za-z0-9\s]/, 'Password must contain a symbol'],
];

/**
 * @returns {string|null} the first failure, or null when the password is fine
 */
export function validatePassword(value) {
  if (!value) return 'Password is required.';
  if (value.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters`;

  for (const [pattern, message] of PASSWORD_CHECKS) {
    if (!pattern.test(value)) return message;
  }

  if (byteLength(value) > MAX_PASSWORD_BYTES) {
    return `Password must be at most ${MAX_PASSWORD_BYTES} bytes`;
  }

  return null;
}

/** Every rule the password must satisfy, with whether `value` satisfies it yet. */
export function passwordChecklist(value = '') {
  return [
    { label: `At least ${MIN_PASSWORD} characters`, met: value.length >= MIN_PASSWORD },
    ...PASSWORD_CHECKS.map(([pattern, message]) => ({
      label: message.replace('Password must contain ', 'Contains '),
      met: pattern.test(value),
    })),
  ];
}

export function validateEmail(value) {
  if (!value.trim()) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address';
  if (value.length > MAX_EMAIL) return 'Enter a valid email address';
  return null;
}

export function validateFullName(value) {
  const trimmed = value.trim();
  if (!trimmed) return 'Full name is required.';
  if (trimmed.length < MIN_FULL_NAME) return 'Full name is too short';
  if (trimmed.length > MAX_FULL_NAME) return 'Full name is too long';
  return null;
}

/**
 * Turn an ApiError's `details` into { field: message }.
 *
 * The backend's zod middleware sends an array of { path, message, code }, where
 * path is dotted and its first segment is the field. Anything that does not name
 * a field this form owns is dropped — the caller still has err.message for that.
 */
export function fieldErrorsFrom(details, ownedFields) {
  if (!Array.isArray(details)) return {};

  return details.reduce((acc, issue) => {
    const field = String(issue?.path ?? '').split('.')[0];
    if (field && ownedFields.includes(field) && !acc[field]) acc[field] = issue.message;
    return acc;
  }, {});
}
