/*
  Marking per teacher (backend 0eefba2, dashboard ticket 04) - what the Principal's
  and Vice Principal's dashboard card decides, apart from its markup so it can be
  tested.

  `GET /dashboard/marking-by-teacher` answers, bare:
    { teachers: [{ membershipId, fullName, marking, release }],
      unanswered: { marking, release } }
  Every teacher answering for a slot of an ACTIVE year is listed, zeros included, by
  name; each pair is the sum of that teacher's own queue on /dashboard/teaching.
  `unanswered` is what waits in a slot nobody answers for now (its teacher left or
  the assignment ended, no successor yet): the School's, not a teacher's.

  The card (owner, 2026-10-28): only teachers with something waiting, the most to
  mark first; the rest as one count. Five rows, the others opened in place.
*/

/** How many teachers show before "Lihat semua". */
export const FIRST_ROWS = 5;

const waits = (entry) => (entry?.marking ?? 0) + (entry?.release ?? 0) > 0;

/**
 * The answer as the card shows it: the teachers with something waiting, the most
 * to mark first, then the most to release, then by name; how many have nothing;
 * the totals across all of them; and the unanswered pair, or null when nothing
 * waits there.
 *
 * @returns {{ waiting: Array, idle: number, teachers: number, totals: { marking: number, release: number }, unanswered: { marking: number, release: number } | null }}
 */
export function markingSummaryOf(answer) {
  const teachers = answer?.teachers ?? [];
  const waiting = teachers
    .filter(waits)
    .sort((a, b) => b.marking - a.marking || b.release - a.release || a.fullName.localeCompare(b.fullName));
  const unanswered = waits(answer?.unanswered) ? answer.unanswered : null;
  const sum = (key) => teachers.reduce((total, entry) => total + entry[key], 0) + (unanswered?.[key] ?? 0);
  return {
    waiting,
    idle: teachers.length - waiting.length,
    teachers: teachers.length,
    totals: { marking: sum('marking'), release: sum('release') },
    unanswered,
  };
}
