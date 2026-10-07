/*
  Where a student stands on each material of a meeting (backend b0f3307; owner,
  2026-10-05: a tick per material, "in progress" for one opened and not finished,
  "x of y done" in "what to do", and a "done" badge on the meeting).

  `GET /content/sessions/:id` gives a student `progress: { firstOpenedAt,
  completedAt }` on each material, or null when never opened; staff get no
  `progress` key at all. What completes a material is the server's rule
  (tracking.record.js), so nothing here decides it: the page starts from the list
  and folds in what the tracker hears back (`mergeProgress`).
*/

/** 'done' · 'opened' · 'new' */
export function materialState(progress) {
  if (progress?.completedAt) return 'done';
  if (progress?.firstOpenedAt) return 'opened';
  return 'new';
}

/** Whether the list carries the reader's own progress: a student's does, staff's does not. */
export const isTracked = (contents) => (contents ?? []).some((item) => 'progress' in item);

/** The list's progress by material id. */
export const progressById = (contents) =>
  Object.fromEntries((contents ?? []).map((item) => [item.id, item.progress ?? null]));

/**
 * One material's progress after the server answered an event for it: opened from
 * now on if it was not, completed now if the answer says so and it was not yet.
 *
 * @param {{ firstOpenedAt?: string|null, completedAt?: string|null }|null} previous
 * @param {{ completed: boolean }} update
 * @param {string} at  ISO time of the answer
 */
export function mergeProgress(previous, update, at) {
  return {
    firstOpenedAt: previous?.firstOpenedAt ?? at,
    completedAt: previous?.completedAt ?? (update?.completed ? at : null),
  };
}

/**
 * Whether a meeting's tab gets a tick (owner, 2026-10-05; backend 4bdd397, request
 * #9): a student's session list carries `content: { published, completed }` on each
 * meeting. Ticked when at least one material is published and every one is done -
 * the same rule as the meeting's own "Materi selesai" badge. A staff list carries no
 * `content`, so nothing is ticked there.
 */
export const meetingDone = (content) => Boolean(content && content.published > 0 && content.completed >= content.published);

/** `{ done, total }` over the meeting's materials. */
export function progressSummary(contents, byId) {
  const list = contents ?? [];
  const done = list.filter((item) => materialState(byId?.[item.id]) === 'done').length;
  return { done, total: list.length };
}

/**
 * The material the meeting opens on (owner, 2026-10-05: one material at a time,
 * picked in "what to do"): the first not yet done, else the first. Decided once,
 * when the list arrives, so the page does not jump while the student finishes one.
 */
export function firstUndone(contents, byId) {
  const list = contents ?? [];
  return (list.find((item) => materialState(byId?.[item.id]) !== 'done') ?? list[0])?.id ?? null;
}
