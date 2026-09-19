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

export default apiErrorMessage;
