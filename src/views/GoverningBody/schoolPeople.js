/*
  One of a Governing Body's Schools, read by its admins (backend f01cd28, governing-body
  ticket 07; owner 2026-10-26, D1-D7), kept out of the markup so it can be tested.

  - The page has four tabs in `?tab=`: ringkasan (the School's row: Principal, Vice
    Principals, counts, code), guru, siswa and lamaran (the Principal applications).
  - Teachers come all at once (not paged), so they are searched here, by name, NIP or
    NUPTK. Students come a page at a time and are searched on the server (`q`, a part of
    the name or NISN, 1-100 after trimming) and kept to a Class (`classId`).
  - Both reads name the current year (and Semester, for Teachers); either may be null.
*/

export const SCHOOL_TABS = ['ringkasan', 'guru', 'siswa', 'lamaran'];

/** The tab a `?tab=` names, the summary when it names none. */
export const tabOf = (value) => (SCHOOL_TABS.includes(value) ? value : 'ringkasan');

const STAFF_ORDER = ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEACHER'];

/** A Teacher's staff roles, the highest first. */
export const staffRolesOf = (teacher) => STAFF_ORDER.filter((role) => (teacher?.roles ?? []).includes(role));

/** Whether a Teacher matches what was typed: a part of the name, NIP or NUPTK. */
export function teacherMatches(teacher, needle) {
  const typed = String(needle ?? '').trim().toLowerCase();
  if (!typed) return true;
  return [teacher?.fullName, teacher?.nip, teacher?.nuptk].some((value) => String(value ?? '').toLowerCase().includes(typed));
}

/** Which term a read speaks of, as `{ key, vars }`: the Semester and year, the year alone, or none. */
export function termOf(answer) {
  const year = answer?.academicYear ?? null;
  const semester = answer?.semester ?? null;
  if (year && semester) return { key: 'gbsp.term', vars: { ordinal: semester.ordinal, label: year.label } };
  if (year) return { key: 'gbsp.term.noSemester', vars: { label: year.label } };
  return { key: 'gbsp.term.none', vars: {} };
}

/** The current year's Classes grouped by grade, lowest first, for the filter. */
export function classGroupsOf(classes) {
  const byGrade = new Map();
  for (const row of Array.isArray(classes) ? classes : []) {
    if (!byGrade.has(row.gradeLevel)) byGrade.set(row.gradeLevel, []);
    byGrade.get(row.gradeLevel).push(row);
  }
  return [...byGrade.entries()]
    .sort(([a], [b]) => a - b)
    .map(([grade, rows]) => ({ grade, classes: [...rows].sort((x, y) => x.name.localeCompare(y.name)) }));
}

/** The students query as studentsQuery reads it: only the keys that carry something. */
export function studentQueryOf({ needle, classId, offset = 0, limit = 50 } = {}) {
  const query = { limit, offset };
  const q = String(needle ?? '').trim().slice(0, 100);
  if (q) query.q = q;
  if (classId) query.classId = classId;
  return query;
}
