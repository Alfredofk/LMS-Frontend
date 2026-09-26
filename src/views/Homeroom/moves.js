/*
  Class moves (ticket 16) — the decisions the homeroom page makes about them,
  kept apart from the markup so they can be tested.

  Nothing here decides who may act: `canDecide` and `canCancel` come from the
  server (classMoveView), which reads Class.homeroomTeacherMembershipId at the
  moment of asking. These only sort what it answered.
*/

/* Every status a move can have — the badge and its dictionary entry. */
export const MOVE_STATUSES = ['PENDING', 'ACTIVE', 'REJECTED', 'CANCELLED'];

/* The two tabs of the section. */
export const MOVE_TABS = ['PENDING', 'HISTORY'];

/**
 * @param {Array} moves as GET /academics/class-moves answers them
 * @returns {{ decide: Array, waiting: Array, history: Array }}
 *   decide  — waiting for this reader to accept or reject (incoming);
 *   waiting — sent by this reader, waiting for the other class (outgoing);
 *   history — decided or withdrawn, newest first as the server sent them.
 */
export function splitMoves(moves) {
  const out = { decide: [], waiting: [], history: [] };
  for (const move of moves ?? []) {
    if (move.status !== 'PENDING') out.history.push(move);
    else if (move.canDecide) out.decide.push(move);
    else if (move.canCancel) out.waiting.push(move);
  }
  return out;
}

/**
 * The move still waiting for each student, so a roster can say "waiting to move
 * to …" instead of offering a second move the server would refuse (409).
 *
 * @returns {Map<string, object>} studentProfileId → move
 */
export function pendingMoveByStudent(moves) {
  const map = new Map();
  for (const move of moves ?? []) {
    if (move.status === 'PENDING') map.set(move.student.studentProfileId, move);
  }
  return map;
}

/**
 * Move targets grouped by grade, lowest first, classes by name within.
 *
 * @returns {Array<{ grade: number, classes: Array }>}
 */
export function groupTargets(targets) {
  const byGrade = new Map();
  for (const target of targets ?? []) {
    if (!byGrade.has(target.gradeLevel)) byGrade.set(target.gradeLevel, []);
    byGrade.get(target.gradeLevel).push(target);
  }
  return [...byGrade.entries()]
    .sort(([a], [b]) => a - b)
    .map(([grade, classes]) => ({
      grade,
      classes: [...classes].sort((a, b) => a.name.localeCompare(b.name, 'id')),
    }));
}

/** Whether a move changes the student's grade — allowed, and said out loud. */
export const changesGrade = (move) =>
  Boolean(move?.fromClass && move?.toClass) && move.fromClass.gradeLevel !== move.toClass.gradeLevel;
