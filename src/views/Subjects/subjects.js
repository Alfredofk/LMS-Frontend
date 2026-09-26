/*
  Subjects and teaching assignments (ticket 08) — what the Principal's page
  decides, apart from its markup so it can be tested.
*/

/* The page's three tabs. */
export const SUBJECT_TABS = ['BOARD', 'PENDING', 'CATALOG'];

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
