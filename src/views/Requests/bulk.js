import { ROLES, releasableInPov, releasableLinksInPov } from '../../constants/roles';

/*
  Releasing several join requests at once — the pure half.

  `POST /membership-requests/approve` takes `{ ids (≤ 50), classId? }` and
  approves each id in its own transaction (membership.service.js bulkApprove),
  so one refusal never costs the others. It takes **one** class for the whole
  call. A homeroom teacher may hold classes at more than one grade, so the
  owner's choice (2026-09-24) is one class per grade: the requests are grouped,
  each student group gets its class, and one call goes out per group — chunked,
  because the backend stops at fifty.
*/

export const MAX_PER_CALL = 50;

/* The classes a reader may place a student of `grade` in: their own (a
   Principal is answered with every class, so the homeroom test matters), at
   that grade, in an ACTIVE year. `closedOnly` says the reader has classes at
   that grade but every one is in a closed year. */
export const classesFor = (classes, membershipId, grade) => {
  const mine = (classes ?? []).filter(
    (entry) => entry.homeroomTeacher?.membershipId === membershipId && entry.gradeLevel === grade
  );
  return {
    open: mine
      .filter((entry) => entry.academicYear?.status === 'ACTIVE')
      .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    closedOnly: mine.length > 0 && mine.every((entry) => entry.academicYear?.status !== 'ACTIVE'),
  };
};

/** Whether this desk can decide something on the request — the only rows a box is offered on. */
export const isBulkable = (request, activeRole) =>
  releasableInPov(request, activeRole).length > 0 || releasableLinksInPov(request, activeRole).length > 0;

/** Whether releasing it from this desk places a student, and so needs a class. */
export const needsClass = (request, activeRole) =>
  releasableInPov(request, activeRole).some((entry) => entry.role === ROLES.STUDENT);

/*
  The selected requests, split by what their call needs: those that need no
  class (teachers, a guardian's further child) in one group, students grouped
  by the grade they asked for. Grades lowest first, ids in the order given.
*/
export function groupForApproval(requests, activeRole) {
  const noClass = [];
  const byGrade = new Map();
  for (const request of requests ?? []) {
    if (!isBulkable(request, activeRole)) continue;
    if (needsClass(request, activeRole)) {
      const grade = request.student?.gradeLevel ?? null;
      if (!byGrade.has(grade)) byGrade.set(grade, []);
      byGrade.get(grade).push(request.id);
    } else {
      noClass.push(request.id);
    }
  }
  const grades = [...byGrade.keys()].sort((a, b) => (a ?? 0) - (b ?? 0));
  return { noClass, students: grades.map((grade) => ({ grade, ids: byGrade.get(grade) })) };
}

/** `ids` in pieces the backend will take. */
export function chunk(ids, size = MAX_PER_CALL) {
  const out = [];
  for (let i = 0; i < (ids ?? []).length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/*
  The calls to make, in order: the no-class group, then one per student grade
  with the class chosen for it. A grade with no class chosen is left out rather
  than sent without one — the backend would refuse every id in it with 400.
*/
export function planCalls({ noClass, students }, classByGrade) {
  const calls = chunk(noClass).map((ids) => ({ ids, classId: undefined }));
  for (const { grade, ids } of students) {
    const classId = classByGrade?.[grade];
    if (!classId) continue;
    for (const piece of chunk(ids)) calls.push({ ids: piece, classId });
  }
  return calls;
}

/** Every call's `results` together: how many went through, and which did not. */
export function summarise(resultLists) {
  const all = (resultLists ?? []).flat();
  const failed = all.filter((entry) => !entry.ok);
  return { released: all.length - failed.length, failed };
}
