/*
  A student's own learning progress (owner, 2026-10-04), from
  `GET /tracking/me/progress` (backend 0dd8b44/39fda6c, teaching-and-learning
  ticket 06): `{ class, classSubjects: [{ classSubjectId, subject: { code, name },
  semester: { id, ordinal }, contents: { published, opened, completed },
  attendance: { counted, present, sick, excused, absent, late, outsideSchool },
  lastActivityAt }] }` - one row per subject of the class the student sits in now,
  over its whole slot.

  - Opened is any progress at all; completed is the server's rule per type (a text
    read to the end, a link followed, a video watched far enough, a file fetched).
  - The student's own row only: no peer, no average, no rank (tracking.service.js,
    spec invariant 7). So nothing here compares.
*/

/** One subject's row, by its classSubjectId; null when the answer has none. */
export function progressFor(progress, classSubjectId) {
  return progress?.classSubjects?.find((row) => row.classSubjectId === classSubjectId) ?? null;
}

/** A whole percentage of `part` in `whole`, or null when there is nothing to count. */
export const rateOf = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : null);

/*
  The rows added up, for the dashboard's board: materials opened and completed out
  of those published, and the latest activity. `onlyIds`, when given, keeps the
  subjects named (the semester on now); an empty list keeps none.
*/
export function progressTotals(progress, onlyIds = null) {
  const keep = onlyIds ? new Set(onlyIds) : null;
  const rows = (progress?.classSubjects ?? []).filter((row) => !keep || keep.has(row.classSubjectId));
  const out = { subjects: rows.length, published: 0, opened: 0, completed: 0, lastActivityAt: null };
  for (const row of rows) {
    out.published += row.contents?.published ?? 0;
    out.opened += row.contents?.opened ?? 0;
    out.completed += row.contents?.completed ?? 0;
    const at = row.lastActivityAt ? new Date(row.lastActivityAt) : null;
    if (at && !Number.isNaN(at.getTime()) && (!out.lastActivityAt || at > out.lastActivityAt)) out.lastActivityAt = at;
  }
  out.openedRate = rateOf(out.opened, out.published);
  out.completedRate = rateOf(out.completed, out.published);
  return out;
}
