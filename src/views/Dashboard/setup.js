/*
  "Getting the school ready" — the checklist on the Principal's dashboard
  (owner, 2026-09-26). Everything a school needs before its students can be
  taught sits on four pages, in an order nobody is told: an academic year, its
  semesters, teachers, classes (each needs a homeroom teacher), who teaches
  which subject, and students placed in classes. Miss one step and the next
  page just looks empty. This works out, from what the backend already answers,
  which steps are done, which is next, and which cannot start yet.

  Pure, so it is tested (setup.test.js). Each input may be null when its request
  failed; a step that needs it is then 'unknown' and counted neither way.
*/

/* The steps, in the order they depend on each other. */
export const SETUP_STEPS = ['YEAR', 'SEMESTER', 'TEACHERS', 'CLASSES', 'SUBJECTS', 'STUDENTS'];

const day = (value) => String(value ?? '').slice(0, 10);

/**
 * The year the school is working in: an ACTIVE one whose dates hold today,
 * else the newest ACTIVE one (the backend lists newest first). Null if none.
 */
export function currentYear(years, today) {
  const active = (years ?? []).filter((year) => year.status === 'ACTIVE');
  return active.find((year) => day(year.startDate) <= today && today <= day(year.endDate)) ?? active[0] ?? null;
}

/**
 * @param {{ years: Array|null, classes: Array|null, teachers: Array|null, assignments: Array|null, today: string }} input
 *   years — GET /academics/academic-years; classes — GET /academics/classes (whole school);
 *   teachers — GET /academics/teachers; assignments — GET /academics/class-subjects?status=ACTIVE
 * @returns {{ year: object|null, steps: Array<{ id, state: 'done'|'todo'|'blocked'|'unknown', count?: number }>,
 *   done: number, total: number, next: string|null }}
 */
export function setupSteps({ years, classes, teachers, assignments, today }) {
  const year = years ? currentYear(years, today) : null;
  const semesterIds = new Set((year?.semesters ?? []).map((semester) => semester.id));
  const classesNow = classes && year ? classes.filter((entry) => entry.academicYear?.id === year.id) : null;

  const step = (id, known, done, blocked, count) => ({
    id,
    state: !known ? 'unknown' : done ? 'done' : blocked ? 'blocked' : 'todo',
    ...(count !== undefined ? { count } : {}),
  });

  const hasYear = Boolean(year);
  const semesterCount = year?.semesters?.length ?? 0;
  const teacherCount = teachers?.length ?? 0;
  const classCount = classesNow?.length ?? 0;
  const assignmentCount = assignments
    ? assignments.filter((entry) => semesterIds.has(entry.semester?.id)).length
    : 0;
  const studentCount = (classesNow ?? []).reduce((sum, entry) => sum + (entry.studentCount ?? 0), 0);

  const yearsKnown = years !== null && years !== undefined;
  const steps = [
    step('YEAR', yearsKnown, hasYear, false),
    step('SEMESTER', yearsKnown, semesterCount > 0, !hasYear, semesterCount),
    step('TEACHERS', Boolean(teachers), teacherCount > 0, false, teacherCount),
    /* A class is created with its homeroom teacher, so it waits on both. */
    step('CLASSES', yearsKnown && Boolean(classes) && Boolean(teachers), classCount > 0, !hasYear || teacherCount === 0, classCount),
    /* An assignment is a class × subject × semester. */
    step('SUBJECTS', yearsKnown && Boolean(assignments) && Boolean(classes), assignmentCount > 0, semesterCount === 0 || classCount === 0, assignmentCount),
    /* Students are placed in a class when their homeroom teacher accepts them. */
    step('STUDENTS', yearsKnown && Boolean(classes), studentCount > 0, classCount === 0, studentCount),
  ];

  const known = steps.filter((entry) => entry.state !== 'unknown');
  return {
    year,
    steps,
    done: known.filter((entry) => entry.state === 'done').length,
    total: known.length,
    next: steps.find((entry) => entry.state === 'todo')?.id ?? null,
  };
}
