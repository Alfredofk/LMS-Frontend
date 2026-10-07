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

/**
 * `answer` with one meeting's `content` count replaced - the same object when it
 * already says so, so a page setting it does not render for nothing.
 */
export function withMeetingMaterials(answer, classSubjectId, sessionId, content) {
  const list = answer?.sessionsById?.[classSubjectId];
  const session = Array.isArray(list) ? list.find((item) => item.id === sessionId) : null;
  if (!session) return answer;
  if (session.content?.published === content.published && session.content?.completed === content.completed) return answer;
  return {
    ...answer,
    sessionsById: {
      ...answer.sessionsById,
      [classSubjectId]: list.map((item) => (item.id === sessionId ? { ...item, content } : item)),
    },
  };
}

/*
  A meeting's material count as the student's own page last saw it (request #9),
  written into what is kept, so a tick earned on a meeting is still there when the
  student goes back to the list and in again within the minute.
*/
export function noteMeetingMaterials(membershipId, classSubjectId, sessionId, content) {
  if (!cached || cached.membershipId !== membershipId) return;
  cached = {
    ...cached,
    promise: cached.promise.then((answer) => withMeetingMaterials(answer, classSubjectId, sessionId, content)),
  };
}
