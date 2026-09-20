/**
 * Turn an ApiError into a sentence in the reader's language.
 *
 * The backend speaks English only. Every failure it sends carries a
 * machine-readable `code` beside the prose, and this app has branched on that
 * code from the start — which is exactly what makes translating possible now:
 * the codes are stable, the prose is not.
 *
 * A code with no entry here falls back to the server's own words rather than to
 * silence. English in one place beats a blank where the reason should be.
 *
 * One code cannot carry one sentence, though. UNAUTHORIZED on a sign-in means
 * the password was wrong; on any later call it means the session has run out,
 * and telling somebody their password is wrong when they never typed one is
 * worse than saying nothing. So the default here is the one that is true
 * everywhere, and the screens that know better say so with `overrides`.
 */
const BY_CODE = {
  UNAUTHORIZED: 'error.unauthorized',
  EMAIL_NOT_VERIFIED: 'error.emailNotVerified',
  CONFLICT: 'error.conflict',
  BAD_REQUEST: 'error.badRequest',
  NOT_FOUND: 'error.notFound',
  INVALID_RESPONSE: 'error.unreachable',
  UNKNOWN_ERROR: 'error.unknown',
};

/**
 * @param {{ code?: string, message?: string }} err
 * @param {(key: string) => string} t
 * @param {Record<string, string>} [overrides]  code → key, for this call site only
 */
export function apiErrorMessage(err, t, overrides) {
  const key = overrides?.[err?.code] ?? BY_CODE[err?.code];
  if (key) return t(key);
  return err?.message || t('error.unknown');
}

/*
  School registration: one code, four meanings — and the one place this app
  reads the server's prose.

  `POST /school-registrations` answers CONFLICT for four unrelated things: you
  already have a registration under review, you already belong to a school, that
  NPSN is taken, or you have submitted too often today. Only the last is
  distinguishable without touching the words — it is the only one carrying
  `details.attempts`.

  Branching on prose is what `apiClient` tells callers never to do, and the rule
  is right: prose is the part that gets reworded. It is broken here on purpose,
  because the alternative is worse. The generic `error.conflict` says "an account
  with this email already exists" — the registration meaning, wrong for all four
  — and falling through to `err.message` would put a lone English sentence in the
  middle of an Indonesian form.

  The match is on a stable prefix of a string literal in
  `school.service.js:169,171,186`, and an unrecognised sentence lands on
  `reg.conflict.other`. So if those words change, this degrades to a vaguer
  sentence rather than breaking.

  The real fix belongs upstream: four conflicts deserve four codes. Delete this
  the day they get them.
*/
const CONFLICT_BY_MESSAGE = [
  ['already have a school registration', 'reg.conflict.pending'],
  ['already belong to a school', 'reg.conflict.member'],
  ['NPSN is already registered', 'reg.conflict.npsn'],
];

/**
 * @param {{ code?: string, message?: string, details?: object }} err
 * @param {(key: string, vars?: object) => string} t
 */
export function registrationErrorMessage(err, t) {
  if (err?.code !== 'CONFLICT') return apiErrorMessage(err, t);

  // The only conflict that identifies itself without prose.
  if (err.details && !Array.isArray(err.details) && err.details.attempts !== undefined) {
    return t('reg.conflict.tooMany', {
      attempts: err.details.attempts,
      hours: err.details.windowHours ?? 24,
    });
  }

  const message = err.message ?? '';
  const hit = CONFLICT_BY_MESSAGE.find(([needle]) => message.includes(needle));
  return t(hit ? hit[1] : 'reg.conflict.other');
}

export default apiErrorMessage;
