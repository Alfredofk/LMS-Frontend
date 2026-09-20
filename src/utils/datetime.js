/**
 * "2 jam lalu" / "2h ago", in the reader's language.
 *
 * This lived inside Navbar as `formatTimeAgo`, reading `t` from its closure.
 * The sample dashboards need the same phrase, and a second copy of a
 * five-branch time ladder is how the two quietly drift apart — one gaining a
 * "yesterday" case the other never gets.
 *
 * `t` is passed in rather than taken from `useT()` so this stays a plain
 * function: the sample data factories are not components and cannot call hooks.
 *
 * @param {(key: string, vars?: object) => string} t
 * @param {string|Date} when  an ISO string or a Date
 * @returns {string} empty string if `when` cannot be read as a date
 */
export function timeAgo(t, when) {
  const then = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(then.getTime())) return '';

  const minutes = Math.floor((Date.now() - then.getTime()) / 60000);

  if (minutes < 1) return t('shell.time.justNow');
  if (minutes < 60) return t('shell.time.minutes', { n: minutes });

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('shell.time.hours', { n: hours });

  return t('shell.time.days', { n: Math.floor(hours / 24) });
}

export default timeAgo;
