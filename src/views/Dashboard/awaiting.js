/*
  Meetings waiting for their teacher's answer (backend 7cdc46d, ticket 09) — what
  the dashboard card decides, apart from its markup so it can be tested.

  `GET /sessions/needs-completion` answers the Principal and Vice Principals the
  whole school, oldest first (sessions.service.js listNeedingCompletion): each a
  sessionView plus `classSubject: { id, class, subject, semester, teacher:
  { membershipId, fullName }, ended }` and `answeredBy: { membershipId, fullName }
  | null`.

  Since deb95e8 (teaching-and-learning 03) the list also holds meetings left on an
  ended ClassSubject. Those are answered by the successor — the teacher of the live
  ClassSubject in the same class, subject and semester — so `classSubject.teacher`
  is no longer who to ask; `answeredBy` is. With no successor yet it is null, and
  nobody can answer until a leader assigns one.
*/

/**
 * The meetings by who answers them. Those nobody can answer yet come first, as
 * one group with `answeredBy: null` — only the reader can unblock them. Then the
 * teachers, the most waiting first, then by name. Each group's meetings oldest
 * first, and the oldest one's day as `oldest` — its `local.date`, the school's own
 * calendar day. Not `startsAt`: 07:00 WITA is 23:00 UTC the day before, so a UTC
 * date would name the wrong day.
 *
 * @returns {Array<{ key: string, answeredBy: { membershipId, fullName } | null, sessions: Array, oldest: string }>}
 */
export function byAnswerer(sessions) {
  const groups = new Map();
  for (const session of sessions ?? []) {
    const answeredBy = session.answeredBy?.membershipId ? session.answeredBy : null;
    const key = answeredBy ? answeredBy.membershipId : UNANSWERED;
    if (!groups.has(key)) groups.set(key, { key, answeredBy, sessions: [] });
    groups.get(key).sessions.push(session);
  }
  return [...groups.values()]
    .map((group) => {
      const ordered = [...group.sessions].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt) || a.number - b.number);
      return { ...group, sessions: ordered, oldest: ordered[0].local.date };
    })
    .sort(
      (a, b) =>
        (a.answeredBy === null ? -1 : 0) - (b.answeredBy === null ? -1 : 0) ||
        b.sessions.length - a.sessions.length ||
        (a.answeredBy?.fullName ?? '').localeCompare(b.answeredBy?.fullName ?? '')
    );
}

/** The key of the group nobody can answer yet. Not a membership id, so never a teacher's. */
export const UNANSWERED = 'unanswered';

/**
 * The teacher of the ended assignment a meeting was left on, to say where it came
 * from — or null for a meeting of a live assignment.
 */
export function endedTeacherOf(session) {
  return session.classSubject?.ended ? session.classSubject.teacher ?? null : null;
}
