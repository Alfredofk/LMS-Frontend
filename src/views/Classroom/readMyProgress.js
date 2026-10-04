import { trackingService } from '../../services/trackingService';

/*
  The student's own progress (`GET /tracking/me/progress`), read once and kept for
  a minute per membership, as readMyClasses keeps the subjects: the dashboard,
  "Kelas Saya" and a subject's page all show it, and moving between them should
  not read it again. See myProgress.js for the shape.
*/

const KEEP_MS = 60 * 1000;
let cached = null;

export function readMyProgress(membershipId, { fresh = false } = {}) {
  if (!fresh && cached?.membershipId === membershipId && Date.now() - cached.at < KEEP_MS) return cached.promise;

  const promise = trackingService.myProgress();
  cached = { membershipId, at: Date.now(), promise };
  promise.catch(() => {
    if (cached?.promise === promise) cached = null;
  });
  return promise;
}
