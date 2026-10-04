import { academicsService } from '../../services/academicsService';
import { sessionsService } from '../../services/sessionsService';

/*
  The student's subjects and every subject's meetings, read together (1 + N
  requests): the cards show progress and the next meeting, and the meetings say
  which semester is on (myClasses.js). Kept for a minute, so going from the list
  to a subject and back does not read it all again - per membership, so another
  account signed in on this tab within the minute reads its own. A subject whose meetings fail
  keeps `null` there; the page shows it without progress.
*/

const KEEP_MS = 60 * 1000;
let cached = null;

export function readMyClasses(membershipId, { fresh = false } = {}) {
  if (!fresh && cached?.membershipId === membershipId && Date.now() - cached.at < KEEP_MS) return cached.promise;

  const promise = (async () => {
    const classSubjects = await academicsService.ownClassSubjects();
    const lists = await Promise.all(
      classSubjects.map((entry) =>
        sessionsService
          .sessions(entry.id)
          .then((list) => [entry.id, list])
          .catch(() => [entry.id, null])
      )
    );
    return { classSubjects, sessionsById: Object.fromEntries(lists) };
  })();

  cached = { membershipId, at: Date.now(), promise };
  promise.catch(() => {
    if (cached?.promise === promise) cached = null;
  });
  return promise;
}
