/*
  The Classes page's filters — done in the browser, because the backend has none
  to offer: `GET /academics/academic-years` takes no parameters at all
  (academics.service.js listAcademicYears, no query schema on the route), and
  `GET /academics/classes` takes only `academicYearId`. Both lists are small —
  one academic year per calendar year, a few dozen classes — so filtering what
  already arrived is the right size of solution, not a workaround.
*/

/* The year tabs, in the order they are shown. */
export const YEAR_TABS = ['ACTIVE', 'CLOSED', 'ALL'];

/** The years a tab shows, keeping the backend's newest-first order. */
export function yearsInTab(years, tab) {
  const list = years ?? [];
  if (tab === 'ALL') return list;
  if (tab === 'CLOSED') return list.filter((year) => year.status !== 'ACTIVE');
  return list.filter((year) => year.status === 'ACTIVE');
}

/** Which tab opens first: the years in use — or every year, when none is in use. */
export function defaultYearTab(years) {
  return yearsInTab(years, 'ACTIVE').length > 0 ? 'ACTIVE' : 'ALL';
}

/** The tab a year belongs to, other than ALL. */
export const tabOfYear = (year) => (year?.status === 'ACTIVE' ? 'ACTIVE' : 'CLOSED');

/** The classes of one year, out of the one list holding every year's. */
export function classesOfYear(classes, yearId) {
  return (classes ?? []).filter((entry) => entry.academicYear?.id === yearId);
}

/** What a year card counts: its semesters, its classes, the students placed in them. */
export function yearSummary(year, classes) {
  const own = classesOfYear(classes, year?.id);
  return {
    semesters: year?.semesters?.length ?? 0,
    classes: own.length,
    students: own.reduce((sum, entry) => sum + (entry.studentCount ?? 0), 0),
  };
}

/** The grades that have at least one class, lowest first — the grade chips. */
export function gradesPresent(classes) {
  return [...new Set((classes ?? []).map((entry) => entry.gradeLevel))].sort((a, b) => a - b);
}

const fold = (value) => String(value ?? '').trim().toLocaleLowerCase();

/**
 * Classes matching a search and a grade. The search looks at the class name
 * and its homeroom teacher's name, case ignored; `grade` null means every grade.
 */
export function filterClasses(classes, { query = '', grade = null } = {}) {
  const needle = fold(query);
  return (classes ?? []).filter((entry) => {
    if (grade !== null && entry.gradeLevel !== grade) return false;
    if (!needle) return true;
    return fold(entry.name).includes(needle) || fold(entry.homeroomTeacher?.fullName).includes(needle);
  });
}
