import { academicsService } from '../../services/academicsService';
import { sessionsService } from '../../services/sessionsService';

/*
  A teacher's own requests (`?mine=true`) and, for every one they teach now, its
  meetings (1 + N) - the cards show progress and what is still unconfirmed. Kept
  for a minute per membership, as readMyClasses keeps a student's, so going to a
  subject and back does not read it all again; `fresh` after a change. A subject
  whose meetings fail keeps `null` there and shows without progress.
*/

const KEEP_MS = 60 * 1000;
let cached = null;

export function readMyTeaching(membershipId, { fresh = false } = {}) {
  if (!fresh && cached?.membershipId === membershipId && Date.now() - cached.at < KEEP_MS) return cached.promise;

  const promise = (async () => {
    const rows = await academicsService.myClassSubjects();
    const live = rows.filter((row) => row.status === 'ACTIVE' && !row.endedAt);
    const lists = await Promise.all(
      live.map((row) =>
        sessionsService
          .sessions(row.id)
          .then((list) => [row.id, list])
          .catch(() => [row.id, null])
      )
    );
    return { rows, sessionsById: Object.fromEntries(lists) };
  })();

  cached = { membershipId, at: Date.now(), promise };
  promise.catch(() => {
    if (cached?.promise === promise) cached = null;
  });
  return promise;
}

/** Drops the cache, so the next read is fresh (after asking, withdrawing, confirming). */
export function forgetMyTeaching() {
  cached = null;
}
