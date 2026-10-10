import { academicsService } from '../../services/academicsService';
import { assessmentService } from '../../services/assessmentService';
import { liveAssignments, openSemesterIds } from '../Dashboard/teacherHome';

/*
  What waits on the teacher's marking (owner, 2026-10-10): the dashboard's "Untuk
  diperiksa" card and "Perlu dinilai" group, and the number beside "Kelas Saya" in
  the sidebar. The backend has no route for it, so it is counted here:

    ?mine=true + the years -> the assignments taught now (liveAssignments)
    one GET /assessments/class-subjects/:id per assignment
    one GET /assessments/:id/submissions per assessment published and opened
      (one not opened yet has nothing in it) -> its `waiting`

  Read once a minute at most, per membership, and shared: the dashboard and the
  sidebar ask the same promise. A change made here (marks saved, a release) calls
  `forgetMarkingQueue()`. A results read that fails leaves that assessment out;
  the lists and the assignments failing make the whole read fail.
*/

const KEEP_MS = 60 * 1000;
let cached = null;

/**
 * The assessments whose results are read: published and already opened - or
 * OFFLINE, whose marks the teacher may enter and release before its window
 * (measured 2026-10-10: a mark of 90 released on a paper opening two days later).
 */
export const queueCandidates = (assessments, now = new Date()) =>
  (assessments ?? []).filter(
    (assessment) => assessment.status === 'PUBLISHED' && (assessment.mode === 'OFFLINE' || new Date(assessment.opensAt) <= now)
  );

/**
 * `{ lists, waitingById, marking, release }` from the lists and the results read:
 * per assessment id `{ marking, release }` where anything waits, and the totals.
 *
 * @param lists    [{ row, assessments }] - one per assignment taught now
 * @param results  [{ id, waiting }] - one per results read that answered
 */
export function markingQueueOf(lists, results) {
  const waitingById = {};
  let marking = 0;
  let release = 0;
  for (const { id, waiting } of results ?? []) {
    const m = waiting?.marking ?? 0;
    const r = waiting?.release ?? 0;
    if (m + r === 0) continue;
    waitingById[id] = { marking: m, release: r };
    marking += m;
    release += r;
  }
  return { lists: lists ?? [], waitingById, marking, release };
}

export function readMarkingQueue(membershipId, { fresh = false, now = () => new Date() } = {}) {
  if (!fresh && cached?.membershipId === membershipId && Date.now() - cached.at < KEEP_MS) return cached.promise;

  const promise = (async () => {
    const [rows, years] = await Promise.all([academicsService.myClassSubjects(), academicsService.academicYears()]);
    const live = liveAssignments(rows, openSemesterIds(years));
    const settled = await Promise.allSettled(live.map((row) => assessmentService.listFor(row.id).then((assessments) => ({ row, assessments }))));
    const lists = settled.filter((item) => item.status === 'fulfilled').map((item) => item.value);
    if (live.length > 0 && lists.length === 0) throw new Error('No assessment list could be read');
    const at = now();
    const seen = new Set();
    const candidates = lists.flatMap(({ assessments }) => queueCandidates(assessments, at)).filter((assessment) => !seen.has(assessment.id) && seen.add(assessment.id));
    const results = await Promise.all(
      candidates.map((assessment) =>
        assessmentService
          .results(assessment.id)
          .then((answer) => ({ id: assessment.id, waiting: answer?.waiting }))
          .catch(() => null)
      )
    );
    return markingQueueOf(lists, results.filter(Boolean));
  })();

  cached = { membershipId, at: Date.now(), promise };
  promise.catch(() => {
    if (cached?.promise === promise) cached = null;
  });
  return promise;
}

/** The next read is fresh: after marks are saved or scores released. */
export function forgetMarkingQueue() {
  cached = null;
}
