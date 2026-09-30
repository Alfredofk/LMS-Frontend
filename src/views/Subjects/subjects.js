/*
  Subjects and teaching assignments (ticket 08) — what the Principal's page
  decides, apart from its markup so it can be tested.
*/

/* The page's four tabs — the timetable since backend 7cdc46d. */
export const SUBJECT_TABS = ['BOARD', 'SCHEDULE', 'PENDING', 'CATALOG'];

const day = (value) => String(value ?? '').slice(0, 10);

/**
 * The semester the board opens on within one year: the one whose dates hold
 * `today`, else the first OPEN one, else the first. Null for a year with none.
 */
export function defaultSemesterOf(year, today) {
  const semesters = year?.semesters ?? [];
  const current =
    semesters.find((s) => day(s.startDate) <= today && today <= day(s.endDate)) ??
    semesters.find((s) => s.status === 'OPEN') ??
    semesters[0];
  return current?.id ?? null;
}

/**
 * Which year and semester the board opens on. **The ACTIVE year comes first even
 * with no semester yet** (newest first, as the backend lists them) — the board
 * then says to create one, rather than opening a closed year as if the active
 * one did not exist (found in real use, 2026-09-26). With no ACTIVE year, the
 * newest year that has a semester, else the newest year. Null with no year.
 *
 * @param {Array} years as GET /academics/academic-years answers
 * @param {string} today 'YYYY-MM-DD'
 * @returns {{ yearId: string, semesterId: string|null } | null}
 */
export function defaultSlot(years, today) {
  const all = years ?? [];
  const year =
    all.find((entry) => entry.status === 'ACTIVE') ??
    all.find((entry) => (entry.semesters ?? []).length > 0) ??
    all[0];
  if (!year) return null;
  return { yearId: year.id, semesterId: defaultSemesterOf(year, today) };
}

/**
 * The subjects a class can still be given this semester: the catalog minus
 * those already taught or waiting there (the slot index allows one PENDING or
 * ACTIVE per class + subject + semester).
 */
export function freeSubjects(catalog, boardClass) {
  const taken = new Set((boardClass?.subjects ?? []).map((entry) => entry.subject.id));
  return (catalog ?? []).filter((subject) => !taken.has(subject.id));
}

/**
 * Whether the board can take new assignments: the year ACTIVE and the semester
 * OPEN — resolveSlot's two conflicts. The deadline binds teachers only; the
 * Principal's direct assignment ignores it.
 */
export const boardWritable = (yearStatus, semesterStatus) => yearStatus === 'ACTIVE' && semesterStatus === 'OPEN';

/** Whether teachers may still ask for this semester (assertWithinRegistrationDeadline). */
export function deadlinePassed(semester, now = new Date()) {
  const deadline = semester?.classSubjectRegistrationDeadline;
  return Boolean(deadline) && now > new Date(deadline);
}

/**
 * Whether this waiting request is the reader's own — set only for a Vice
 * Principal (`selfId`), whom the server refuses to decide their own teaching
 * (`assertNotDecidingForSelf`, academics.service.js). A Principal passes null.
 */
export const isOwnRequest = (request, selfId) => Boolean(selfId) && request?.teacher?.membershipId === selfId;

/**
 * The outcome of a bulk approval, per name: `{ approved, failed: [{ request, message }] }`,
 * in the order the requests were ticked.
 */
export function bulkOutcome(requests, results) {
  const byId = new Map((results ?? []).map((entry) => [entry.id, entry]));
  const out = { approved: 0, failed: [] };
  for (const request of requests) {
    const result = byId.get(request.id);
    if (result?.ok) out.approved += 1;
    else out.failed.push({ request, error: result?.error ?? null });
  }
  return out;
}

/*
  Ending or replacing an ACTIVE assignment while its teacher stays (backend
  85bc687, teaching-and-learning 10): `POST /academics/class-subjects/:id/end`
  and `/replace`. The board offers it only where it is writable (the same year
  and semester rule, `loadLiveAssignment`).
*/

/**
 * Whether a board row can be ended or handed on: ACTIVE — a PENDING one is the
 * queue's — and, for a Vice Principal (`selfId`), not their own
 * (`assertNotDecidingForSelf`). A Principal passes null.
 */
export const canChangeAssignment = (row, selfId) =>
  row?.status === 'ACTIVE' && !(Boolean(selfId) && row?.teacher?.membershipId === selfId);

/** The teachers a row can be handed to: anyone but its current teacher ("That teacher already teaches it"). */
export const replacementTeachers = (teachers, row) =>
  (teachers ?? []).filter((entry) => entry.membershipId !== row?.teacher?.membershipId);

/**
 * What is missing before the change can be sent, as dictionary keys by field;
 * empty when nothing is. `mode` is 'REPLACE' or 'END'; `subjectStops` stays null
 * until chosen — the backend has no default for it, on purpose (owner,
 * 2026-09-29), and neither does this. The reason is the rejection rule, 3–500.
 *
 * @returns {{ mode?: string, teacher?: string, subjectStops?: string, reason?: string }}
 */
export function changeErrors({ mode, teacherId, subjectStops, reason }) {
  const errors = {};
  if (mode !== 'REPLACE' && mode !== 'END') errors.mode = 'subjects.change.modeRequired';
  if (mode === 'REPLACE' && !teacherId) errors.teacher = 'subjects.assign.teacherRequired';
  if (mode === 'END' && typeof subjectStops !== 'boolean') errors.subjectStops = 'subjects.change.stopsRequired';
  const trimmed = String(reason ?? '').trim();
  if (trimmed.length < 3) errors.reason = 'validation.leaveReason.short';
  else if (trimmed.length > 500) errors.reason = 'validation.leaveReason.long';
  return errors;
}
