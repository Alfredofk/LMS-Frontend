import { boardWritable, deadlinePassed, freeSubjects } from '../Subjects/subjects.js';

/*
  A teacher's own subjects and meetings (owner, 2026-10-04: the teacher's screens
  are ours now) - what the pages decide, apart from their markup so it can be
  tested.

  - `GET /academics/class-subjects?mine=true`: every request the reader ever made,
    newest first, as classSubjectView: `{ id, status, requestedAt, decidedAt,
    rejectionReason, createdViaOverride, endedAt, endReason, class: { id, name,
    gradeLevel }, subject: { id, code, name }, semester: { id, ordinal,
    academicYear }, teacher }`. An assignment ended by the Principal keeps ACTIVE
    with `endedAt` set (academics.service.js endAssignment).
  - `GET /sessions/class-subjects/:id/sessions`: its meetings, the timetable's
    sessionView (`local`, `status`, `cancelReason`, `needsCompletion`,
    `completedAt`, `topic`).
  - The roster of one meeting (`GET /attendance/sessions/:id`) and its
    confirmation (`POST .../confirm`), attendance.service.js.
*/

const by = (key) => (a, b) => new Date(b[key] ?? 0) - new Date(a[key] ?? 0);

const bySubjectThenClass = (a, b) =>
  (a.subject?.code ?? '').localeCompare(b.subject?.code ?? '') || (a.class?.name ?? '').localeCompare(b.class?.name ?? '');

/**
 * The reader's requests split four ways:
 * - taught: every assignment they taught to its end or still teach - ACTIVE, not
 *   ended - in any year, a closed one included (closing a year leaves its
 *   assignments ACTIVE with no `endedAt`, academics.service.js closeAcademicYear);
 * - live: those of them in a year still open (`openSemesters`, openSemesterIds in
 *   Dashboard/teacherHome.js) - what they teach now; all of `taught` without it;
 * - waiting: PENDING, for the Principal;
 * - past: rejected, withdrawn, or ended, newest first, as history.
 * A closed year's assignments stay in `taught` (owner, 2026-10-05: a teacher
 * looks back at an earlier semester from the semester picker), not in history.
 */
export function splitTeaching(rows, openSemesters = null) {
  const taught = [];
  const waiting = [];
  const past = [];
  for (const row of rows ?? []) {
    if (row.status === 'ACTIVE' && !row.endedAt) taught.push(row);
    else if (row.status === 'PENDING') waiting.push(row);
    else past.push(row);
  }
  taught.sort(bySubjectThenClass);
  return {
    taught,
    live: taught.filter((row) => !openSemesters || openSemesters.has(row.semester?.id)),
    waiting: waiting.sort(by('requestedAt')),
    past: past.sort((a, b) => new Date(b.endedAt ?? b.decidedAt ?? b.requestedAt ?? 0) - new Date(a.endedAt ?? a.decidedAt ?? a.requestedAt ?? 0)),
  };
}

/**
 * The semesters a teacher can look at on /teacher/courses: every one they taught
 * in, newest first (the year's label, then the ordinal), each saying whether its
 * year is still open. `openSemesters` null counts every semester as open.
 *
 * @returns {{ id, ordinal, academicYear, open }[]}
 */
export function teachingSemesters(taught, openSemesters = null) {
  const byId = new Map();
  for (const row of taught ?? []) {
    const semester = row.semester;
    if (semester?.id && !byId.has(semester.id)) {
      byId.set(semester.id, { ...semester, open: !openSemesters || openSemesters.has(semester.id) });
    }
  }
  return [...byId.values()].sort(
    (a, b) => String(b.academicYear ?? '').localeCompare(String(a.academicYear ?? '')) || b.ordinal - a.ordinal
  );
}

/**
 * The semester the page opens on: the one asked for in the URL when the teacher
 * taught in it; else the current one (`current`, defaultSemesterId over the open
 * year's assignments); else the newest.
 */
export function shownTeachingSemester(semesters, asked, current) {
  if (asked && semesters.some((semester) => semester.id === asked)) return asked;
  if (current && semesters.some((semester) => semester.id === current)) return current;
  return semesters[0]?.id ?? null;
}

/**
 * Where a meeting stands for the teacher who answers for it:
 * cancelled · upcoming (not begun) · running · awaiting (over, not confirmed) · confirmed.
 * A running meeting can be confirmed already: the teacher may confirm early.
 */
export function sessionPhase(session, now = new Date()) {
  if (session.status !== 'SCHEDULED') return 'cancelled';
  if (now < new Date(session.startsAt)) return 'upcoming';
  if (session.completedAt) return 'confirmed';
  if (now < new Date(session.endsAt)) return 'running';
  return 'awaiting';
}

/** Meetings begun and not yet confirmed - what the teacher still owes. */
export const unconfirmedCount = (sessions, now = new Date()) =>
  (sessions ?? []).filter((session) => ['running', 'awaiting'].includes(sessionPhase(session, now))).length;

/**
 * A student's status if the teacher changes nothing on confirmation
 * (attendance.service.js confirm): PRESENT when they checked in, ABSENT when not.
 */
export const defaultStatusOf = (student) => student?.status ?? 'ABSENT';

/**
 * The confirmation body: only the students set to other than their default, each
 * with its note when one was typed - everyone else keeps the default on the
 * server, so naming them would only write empty changes.
 *
 * @param students  the roster's students
 * @param picks     { [studentProfileId]: status }
 * @param notes     { [studentProfileId]: note }
 */
export function confirmStatuses(students, picks = {}, notes = {}) {
  const out = [];
  for (const student of students ?? []) {
    const picked = picks[student.studentProfileId];
    if (!picked || picked === defaultStatusOf(student)) continue;
    const note = (notes[student.studentProfileId] ?? '').trim();
    out.push({ studentProfileId: student.studentProfileId, status: picked, ...(note ? { note } : {}) });
  }
  return out;
}

/** How the roster will read once confirmed, picks applied: `{ PRESENT, SICK, EXCUSED, ABSENT }`. */
export function confirmTally(students, picks = {}) {
  const out = { PRESENT: 0, SICK: 0, EXCUSED: 0, ABSENT: 0 };
  for (const student of students ?? []) out[picks[student.studentProfileId] ?? defaultStatusOf(student)] += 1;
  return out;
}

/**
 * The semesters a teacher can ask for: OPEN, in an ACTIVE year (resolveSlot), each
 * marked when its sign-up deadline has passed (assertWithinRegistrationDeadline) -
 * shown, but not offered.
 */
export function requestableSemesters(years, now = new Date()) {
  const out = [];
  for (const year of years ?? []) {
    for (const semester of year.semesters ?? []) {
      if (!boardWritable(year.status, semester.status)) continue;
      out.push({ ...semester, yearId: year.id, yearLabel: year.label, closed: deadlinePassed(semester, now) });
    }
  }
  return out;
}

/**
 * Per class of the semester's board, the subjects still free there - in use by the
 * school and with no teacher or waiting request in that slot (freeSubjects) -
 * keeping only classes with something left to ask for.
 */
export function requestChoices(board, catalog) {
  return (board?.classes ?? [])
    .map((boardClass) => ({ class: boardClass, subjects: freeSubjects(catalog, boardClass) }))
    .filter((choice) => choice.subjects.length > 0);
}

export const CONTENT_TYPES = ['TEXT', 'VIDEO', 'LINK', 'FILE'];
export const FILE_TYPES = ['pdf', 'jpg', 'png', 'docx', 'pptx'];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const isHttps = (value) => {
  try {
    return new URL(String(value ?? '').trim()).protocol === 'https:';
  } catch {
    return false;
  }
};

/* What a TEXT holds once its markup is gone - the server refuses an empty one. */
const textOf = (html) =>
  String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim();

/**
 * A material's fields against content.schema.js, before the press. Keys, not
 * sentences: `{ title?, url?, html?, file? }`.
 *
 * @param draft  `{ type, title, url, html, file }`; `editing` skips the file (a
 *               FILE's file is not replaced)
 */
export function contentErrors(draft, { editing = false } = {}) {
  const errors = {};
  const title = String(draft.title ?? '').trim();
  if (!title) errors.title = 'teach.content.error.title';
  else if (title.length > 200) errors.title = 'teach.content.error.titleLong';

  if (draft.type === 'VIDEO' || draft.type === 'LINK') {
    const url = String(draft.url ?? '').trim();
    if (!url || !isHttps(url)) errors.url = 'teach.content.error.https';
    else if (url.length > 2000) errors.url = 'teach.content.error.urlLong';
  }
  if (draft.type === 'TEXT') {
    if (!textOf(draft.html) && !String(draft.html ?? '').includes('<img')) errors.html = 'teach.content.error.empty';
    else if (String(draft.html).length > 200_000) errors.html = 'teach.content.error.textLong';
  }
  if (draft.type === 'FILE' && !editing) {
    const file = draft.file;
    const ext = String(file?.name ?? '').split('.').pop().toLowerCase();
    if (!file) errors.file = 'teach.content.error.noFile';
    else if (!FILE_TYPES.includes(ext)) errors.file = 'teach.content.error.fileType';
    else if (file.size > MAX_FILE_BYTES) errors.file = 'teach.content.error.fileSize';
  }
  return errors;
}

/** The order after moving one content up (-1) or down (+1); unchanged at an end. */
export function moveContent(ids, id, step) {
  const list = [...(ids ?? [])];
  const from = list.indexOf(id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= list.length) return list;
  [list[from], list[to]] = [list[to], list[from]];
  return list;
}
