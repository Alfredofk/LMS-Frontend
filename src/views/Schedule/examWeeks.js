/*
  Exam Weeks on the school's calendar (backend cbec3b6, teaching-and-learning
  ticket 13; owner 2026-10-18). A run of a semester's days with no teaching for the
  grade levels it names, kept for a UTS or a UAS. Not a holiday: the other grade
  levels are taught as usual, so it is never a day off and never "next holiday".

  Set and withdrawn by the Principal or a Vice Principal (holidays.examWeeks.js),
  never edited. What the form checks restates holidays.schema.js examWeekBody and
  addExamWeek: a type, a name of 3-150, both days, the end on or after the start,
  at most 31 days (`(end - start) / DAY < 31`), inside the chosen semester, and at
  least one grade level. An overlap on a shared grade level is the server's call.

  Only on the leaders' calendar for now (owner): a student's and a teacher's
  lesson calendar and the guardian's next-holiday card read `calendarItems`, which
  leaves Exam Weeks out.
*/

export const EXAM_TYPES = ['UTS', 'UAS'];

export const MAX_EXAM_WEEK_DAYS = 31;

const DAY_MS = 24 * 60 * 60 * 1000;
const day = (value) => new Date(`${String(value).slice(0, 10)}T00:00:00Z`).getTime();

/**
 * `GET /holidays?year=`'s `examWeeks` in the calendar's item shape
 * (utils/holidays.js `calendarItems`): `{ id, kind, source, name, start, end, … }`.
 */
export function examWeekItems(data) {
  return (data?.examWeeks ?? []).map((entry) => ({
    ...entry,
    source: 'EXAM_WEEK',
    kind: 'EXAM_WEEK',
    start: entry.startDate,
    end: entry.endDate,
  }));
}

/**
 * The semesters an Exam Week may be set in: OPEN or FINALIZING, of an ACTIVE year
 * (`assertSemesterTakesExamWeeks`). Newest year first, then by ordinal, each as
 * `{ id, ordinal, yearLabel, startDate, endDate }` with calendar days.
 */
export function examWeekSemesters(years) {
  const out = [];
  for (const year of years ?? []) {
    if (year.status !== 'ACTIVE') continue;
    for (const semester of year.semesters ?? []) {
      if (semester.status !== 'OPEN' && semester.status !== 'FINALIZING') continue;
      out.push({
        id: semester.id,
        ordinal: semester.ordinal,
        yearLabel: year.label,
        startDate: String(semester.startDate).slice(0, 10),
        endDate: String(semester.endDate).slice(0, 10),
      });
    }
  }
  return out;
}

/** The one running today, else the next to start, else the first listed; null for none. */
export function defaultExamSemester(semesters, today) {
  const list = semesters ?? [];
  const running = list.find((semester) => semester.startDate <= today && semester.endDate >= today);
  if (running) return running.id;
  const ahead = list.filter((semester) => semester.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate));
  return (ahead[0] ?? list[0])?.id ?? null;
}

/**
 * The form's failures as `{ field: { key, vars? } }`, empty when it may be sent.
 * `semester` is the chosen one from `examWeekSemesters`.
 */
export function examWeekErrors(form, semester) {
  const out = {};
  if (!semester) out.semesterId = { key: 'exam.error.semester' };
  if (!EXAM_TYPES.includes(form.type)) out.type = { key: 'exam.error.type' };
  const name = String(form.name ?? '').trim();
  if (name.length < 3) out.name = { key: 'exam.error.name' };
  else if (name.length > 150) out.name = { key: 'exam.error.nameLong' };
  if (!form.startDate) out.startDate = { key: 'validation.holiday.startRequired' };
  if (!form.endDate) out.endDate = { key: 'validation.holiday.endRequired' };
  if (form.startDate && form.endDate) {
    const span = (day(form.endDate) - day(form.startDate)) / DAY_MS;
    if (span < 0) out.endDate = { key: 'validation.holiday.endBeforeStart' };
    else if (span >= MAX_EXAM_WEEK_DAYS) out.endDate = { key: 'exam.error.tooLong', vars: { n: MAX_EXAM_WEEK_DAYS } };
    else if (semester && (form.startDate < semester.startDate || form.endDate > semester.endDate)) {
      out.startDate = { key: 'exam.error.outside', vars: { start: semester.startDate, end: semester.endDate } };
    }
  }
  if (!(form.gradeLevels ?? []).length) out.gradeLevels = { key: 'exam.error.grades' };
  return out;
}

/** The body of `POST /holidays/exam-weeks`, grade levels ascending. */
export function examWeekBody(form) {
  return {
    semesterId: form.semesterId,
    type: form.type,
    name: String(form.name).trim(),
    startDate: form.startDate,
    endDate: form.endDate,
    gradeLevels: [...form.gradeLevels].sort((a, b) => a - b),
  };
}

/** A grade ticked or unticked, the list kept ascending. */
export function toggleGrade(list, grade) {
  const has = (list ?? []).includes(grade);
  return (has ? list.filter((value) => value !== grade) : [...(list ?? []), grade]).sort((a, b) => a - b);
}

/* ---- On a student's and a teacher's lesson calendar (owner 2026-10-18) ----
   Only the Exam Weeks of the reader's own grade levels: a student's class now, a
   teacher's live assignments. Each keeps `shownGrades`, the grades it names that
   are the reader's, for "Kelas 11, 12" on a teacher's row. */

/** `examWeekItems`' weeks naming any of `grades`; none for no grades (a student not placed). */
export function examWeeksForGrades(items, grades) {
  const mine = new Set(grades ?? []);
  if (mine.size === 0) return [];
  return (items ?? [])
    .map((item) => ({ ...item, shownGrades: (item.gradeLevels ?? []).filter((grade) => mine.has(grade)) }))
    .filter((item) => item.shownGrades.length > 0);
}

/**
 * The grade levels a teacher teaches now: their class subjects (`?mine=true`)
 * ACTIVE, not ended, in an open year (`openLabels`, teacherLessons.js
 * `openYearLabels`), ascending.
 */
export function taughtGrades(rows, openLabels) {
  const grades = new Set();
  for (const row of rows ?? []) {
    if (row.status !== 'ACTIVE' || row.endedAt) continue;
    if (openLabels && !openLabels.has(row.semester?.academicYear)) continue;
    if (Number.isInteger(row.class?.gradeLevel)) grades.add(row.class.gradeLevel);
  }
  return [...grades].sort((a, b) => a - b);
}

/* ---- The dashboards' reminder (owner 2026-10-18) ----
   One line on the student's and the teacher's dashboard: an Exam Week of the
   reader's grades from 14 days before it starts, and while it runs. */

export const REMINDER_DAYS = 14;

const DAY = 24 * 60 * 60 * 1000;
const dayNumber = (date) => Date.parse(`${date}T00:00:00Z`) / DAY;

/**
 * `{ kind: 'running', week }` for the week holding `today`, else `{ kind: 'soon',
 * week, days }` for the nearest starting within `REMINDER_DAYS`, else null. `items`
 * are the reader's own (examWeeksForGrades). Running wins over soon; of two
 * running, the one ending first.
 */
export function examWeekReminder(items, today, soonDays = REMINDER_DAYS) {
  if (!today) return null;
  const list = [...(items ?? [])].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const running = list
    .filter((item) => item.start <= today && item.end >= today)
    .sort((a, b) => a.end.localeCompare(b.end))[0];
  if (running) return { kind: 'running', week: running };
  const soon = list.find((item) => item.start > today && dayNumber(item.start) - dayNumber(today) <= soonDays);
  return soon ? { kind: 'soon', week: soon, days: dayNumber(soon.start) - dayNumber(today) } : null;
}

/** The calendar years a reminder needs: today's, and the next when the window crosses New Year. */
export function reminderYears(today, soonDays = REMINDER_DAYS) {
  if (!today) return [];
  const first = Number(today.slice(0, 4));
  const last = Number(new Date((dayNumber(today) + soonDays) * DAY).toISOString().slice(0, 4));
  return last > first ? [first, last] : [first];
}
