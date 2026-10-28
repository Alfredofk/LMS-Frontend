import { academicsService } from '../../services/academicsService';
import { assessmentService } from '../../services/assessmentService';
import { liveAssignments, openSemesterIds } from '../Dashboard/teacherHome';
import { forgetTeachingDashboard, readTeachingDashboard } from '../Dashboard/teachingDashboard';

/*
  What waits on the teacher's marking (owner, 2026-10-10): the dashboard's "Untuk
  diperiksa" card and "Perlu dinilai" group, and the number beside "Kelas Saya" in
  the sidebar. Two reads, each kept a minute per membership and shared:

  - readMarkingQueue: `GET /dashboard/teaching`'s queue (backend 27400b4, owner
    2026-10-27), through readTeachingDashboard, whose one answer the dashboard's
    other cards share. One request where there used to be one results read per
    assessment published and opened; the counts are the same, the server's own
    standingsOf. The sidebar reads only this.
  - readTeachingLists: every assessment of the slots taught now, one
    `GET /assessments/class-subjects/:id` per live assignment (`?mine=true` + the
    years). The dashboard card's open / upcoming / draft groups and the teacher's
    exam days need them; the queue carries none of that.

  A change made here (marks saved, a release) calls `forgetMarkingQueue()`, which
  drops both. A list that fails is left out; all of them failing fails the read.
*/

const KEEP_MS = 60 * 1000;
const cached = { lists: null };

/** The read kept under `slot` for this membership, or a fresh one. */
function kept(slot, membershipId, fresh, read) {
  const held = cached[slot];
  if (!fresh && held?.membershipId === membershipId && Date.now() - held.at < KEEP_MS) return held.promise;

  const promise = read();
  cached[slot] = { membershipId, at: Date.now(), promise };
  promise.catch(() => {
    if (cached[slot]?.promise === promise) cached[slot] = null;
  });
  return promise;
}

/**
 * `{ waitingById, marking, release, releasable }` from the queue's entries: per
 * assessment id `{ marking, release, since, releasableAt }`, the totals, and how
 * many of the releases may be pressed now (`releasableAt` null).
 *
 * @param queue  `GET /dashboard/teaching`'s `queue`
 */
export function markingQueueOf(queue) {
  const waitingById = {};
  let marking = 0;
  let release = 0;
  let releasable = 0;
  for (const entry of queue ?? []) {
    const id = entry.assessment?.id;
    if (!id) continue;
    const m = entry.marking ?? 0;
    const r = entry.release ?? 0;
    waitingById[id] = { marking: m, release: r, since: entry.oldestWaitingSince ?? null, releasableAt: entry.releasableAt ?? null };
    marking += m;
    release += r;
    if (!entry.releasableAt) releasable += r;
  }
  return { waitingById, marking, release, releasable };
}

/**
 * How many assessments of one slot wait on its teacher - to mark or to release -
 * for the amber count on the subject page's "Penilaian" tab (owner, 2026-10-28,
 * the reviewed mockup). The queue holds only what waits, one entry per assessment.
 *
 * @param queue  `GET /dashboard/teaching`'s `queue`
 */
export const waitingInSlot = (queue, classSubjectId) =>
  (queue ?? []).filter((entry) => entry.classSubject?.id === classSubjectId && (entry.marking ?? 0) + (entry.release ?? 0) > 0).length;

export function readMarkingQueue(membershipId, { fresh = false } = {}) {
  return readTeachingDashboard(membershipId, { fresh }).then((answer) => markingQueueOf(answer?.queue));
}

/** `[{ row, assessments }]`, one per assignment taught now whose list answered. */
export function readTeachingLists(membershipId, { fresh = false } = {}) {
  return kept('lists', membershipId, fresh, async () => {
    const [rows, years] = await Promise.all([academicsService.myClassSubjects(), academicsService.academicYears()]);
    const live = liveAssignments(rows, openSemesterIds(years));
    const settled = await Promise.allSettled(live.map((row) => assessmentService.listFor(row.id).then((assessments) => ({ row, assessments }))));
    const lists = settled.filter((item) => item.status === 'fulfilled').map((item) => item.value);
    if (live.length > 0 && lists.length === 0) throw new Error('No assessment list could be read');
    return lists;
  });
}

/** The next reads are fresh: after marks are saved or scores released. */
export function forgetMarkingQueue() {
  forgetTeachingDashboard();
  cached.lists = null;
}
