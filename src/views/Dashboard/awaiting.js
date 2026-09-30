/*
  Meetings waiting for their teacher's answer (backend 7cdc46d, ticket 09) — what
  the dashboard card decides, apart from its markup so it can be tested.

  `GET /sessions/needs-completion` answers the Principal and Vice Principals the
  whole school, oldest first (sessions.service.js listNeedingCompletion): each a
  sessionView plus `classSubject: { id, class, subject, semester, teacher:
  { membershipId, fullName } }`. Only the teacher can answer, so the card groups
  by teacher: that is who the reader would go and ask.
*/

/**
 * The meetings by teacher: the most waiting first, then by name; each group's
 * meetings oldest first, and the oldest one's day as `oldest` — its `local.date`,
 * the school's own calendar day. Not `startsAt`: 07:00 WITA is 23:00 UTC the day
 * before, so a UTC date would name the wrong day.
 *
 * @returns {Array<{ teacher: { membershipId, fullName }, sessions: Array, oldest: string }>}
 */
export function byTeacher(sessions) {
  const groups = new Map();
  for (const session of sessions ?? []) {
    const teacher = session.classSubject?.teacher;
    if (!teacher?.membershipId) continue;
    if (!groups.has(teacher.membershipId)) groups.set(teacher.membershipId, { teacher, sessions: [] });
    groups.get(teacher.membershipId).sessions.push(session);
  }
  return [...groups.values()]
    .map((group) => {
      const ordered = [...group.sessions].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt) || a.number - b.number);
      return { ...group, sessions: ordered, oldest: ordered[0].local.date };
    })
    .sort((a, b) => b.sessions.length - a.sessions.length || a.teacher.fullName.localeCompare(b.teacher.fullName));
}
