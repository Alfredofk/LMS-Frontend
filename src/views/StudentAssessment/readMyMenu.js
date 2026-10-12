import { assessmentService } from '../../services/assessmentService';

/*
  A student's menu of assessments for one semester (GET /assessments/mine, backend
  113ae37), kept a minute per membership and semester: /assessment, "Kelas Saya"
  and a subject's "Penilaian" tab all read it, and going from one to the next does
  not read it again. `semesterId` null asks for the server's default, kept apart
  from the semester it turns out to be. A failed read is not kept.
*/

const KEEP_MS = 60 * 1000;
const cache = new Map();

export function readMyMenu(membershipId, semesterId = null, { fresh = false } = {}) {
  const key = `${membershipId}|${semesterId ?? ''}`;
  const kept = cache.get(key);
  if (!fresh && kept && Date.now() - kept.at < KEEP_MS) return kept.promise;

  const promise = assessmentService.menu(semesterId);
  cache.set(key, { at: Date.now(), promise });
  promise.catch(() => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
  });
  return promise;
}

/** Forget what is kept, so the next read asks again (after an attempt is started or handed in). */
export function forgetMyMenu() {
  cache.clear();
}
