/*
  A teacher's Assessments on one class subject (backend 0bb4598, assessment ticket
  02; owner 2026-10-08) - what the screens decide, apart from their markup so it
  can be tested. Each rule names the line of assessment.schema.js or
  assessment.service.js it restates.

  A window is two instants the teacher types as a day and a clock time in the
  school's zone (WIB/WITA/WIT), sent with that zone's offset. It must lie inside
  the semester: from 00:00 of its first day to 00:00 after its last, in that zone
  (sessions.service.js semesterSpan).
*/

import { localOf } from '../Attendance/attendance';
import { bodyText, formatSchoolDay } from '../QuestionBank/questionBank';

export const TYPES = ['TUGAS', 'KUIS', 'UTS', 'UAS'];
export const MODES = ['ONLINE', 'OFFLINE'];

export const MAX_TITLE = 200;
export const MAX_INSTRUCTIONS = 20_000;
export const MAX_ATTEMPTS = 20;
export const MAX_TIME_LIMIT = 600;
export const MIN_POINTS = 1;
export const MAX_POINTS = 100;
export const MAX_QUESTIONS = 200;
export const MAX_REASON = 500;

const OFFSET = { WIB: '+07:00', WITA: '+08:00', WIT: '+09:00' };

/** The offset a zone sends with, '+00:00' with none (the server reads such a school in UTC). */
export const offsetOf = (zone) => OFFSET[zone] ?? '+00:00';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A day and a clock time in the school's zone as an instant with its offset, or null. */
export function instantOf(day, time, zone) {
  if (!DAY.test(day ?? '') || !CLOCK.test(time ?? '')) return null;
  return `${day}T${time}:00${offsetOf(zone)}`;
}

/** An instant as the school's `{ date, time }`, or empty ones. */
export function partsOf(instant, zone) {
  const local = instant ? localOf(instant, zone) : null;
  return { date: local?.date ?? '', time: local?.time ?? '' };
}

const nextDay = (day) => new Date(Date.parse(`${day}T00:00:00Z`) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * The semester's span as instants: its first day at 00:00 and the day after its
 * last at 00:00, both in the school's zone. `semester` carries `startDate` and
 * `endDate` as /academics/academic-years answers them (midnight UTC days).
 */
export function semesterSpan(semester, zone) {
  if (!semester?.startDate || !semester?.endDate) return null;
  const first = String(semester.startDate).slice(0, 10);
  const last = String(semester.endDate).slice(0, 10);
  return {
    first,
    last,
    start: new Date(`${first}T00:00:00${offsetOf(zone)}`),
    end: new Date(`${nextDay(last)}T00:00:00${offsetOf(zone)}`),
  };
}

/** The semester an assessment's class subject runs in, found among the years. */
export function semesterOf(years, semesterId) {
  for (const year of years ?? []) {
    const found = (year.semesters ?? []).find((semester) => semester.id === semesterId);
    if (found) return { ...found, academicYear: { label: year.label, status: year.status } };
  }
  return null;
}

// ---------------------------------------------------------------------------
// The details form
// ---------------------------------------------------------------------------

/** A blank form for a new assessment: an online quiz, one attempt, nothing shuffled. */
export function emptyForm() {
  return {
    type: 'KUIS',
    mode: 'ONLINE',
    title: '',
    instructions: '',
    opensDate: '',
    opensTime: '07:00',
    closesDate: '',
    closesTime: '23:59',
    maxAttempts: '1',
    acceptLate: false,
    timeLimit: '',
    shuffleQuestions: false,
    shuffleOptions: false,
    showKeyOnRelease: false,
  };
}

/** A saved assessment as the form. */
export function formFrom(assessment, zone) {
  const opens = partsOf(assessment.opensAt, zone);
  const closes = partsOf(assessment.closesAt, zone);
  const settings = assessment.settings ?? {};
  return {
    type: assessment.type,
    mode: assessment.mode,
    title: assessment.title ?? '',
    instructions: assessment.instructions ?? '',
    opensDate: opens.date,
    opensTime: opens.time,
    closesDate: closes.date,
    closesTime: closes.time,
    maxAttempts: String(settings.maxAttempts ?? 1),
    acceptLate: Boolean(settings.acceptLate),
    timeLimit: settings.timeLimitMinutes ? String(settings.timeLimitMinutes) : '',
    shuffleQuestions: Boolean(settings.shuffleQuestions),
    shuffleOptions: Boolean(settings.shuffleOptions),
    showKeyOnRelease: Boolean(settings.showKeyOnRelease),
  };
}

const wholeIn = (value, min, max) => /^\d+$/.test(String(value).trim()) && Number(value) >= min && Number(value) <= max;

/* Instructions with no words are none: the server refuses markup its sanitiser would empty. */
const instructionsOf = (html) => (bodyText(html) ? html : null);

/**
 * What is wrong with the form, as dictionary keys:
 * `{ title?, instructions?, opens?, closes?, maxAttempts?, timeLimit? }`.
 * `span` is semesterSpan's answer (null when the semester is not known: the
 * server is then the judge); `published` and `now` hold a published one's
 * closing time to the server's rule - brought forward, never to before now - when
 * it is moved.
 */
export function formErrors(form, { zone, span = null, published = false, savedClosesAt = null, now = new Date() } = {}) {
  const errors = {};
  const title = form.title.trim();
  if (!title) errors.title = 'tasm.error.titleEmpty';
  else if (title.length > MAX_TITLE) errors.title = 'tasm.error.titleLong';
  if (String(form.instructions ?? '').length > MAX_INSTRUCTIONS) errors.instructions = 'tasm.error.instructionsLong';

  const opens = instantOf(form.opensDate, form.opensTime, zone);
  const closes = instantOf(form.closesDate, form.closesTime, zone);
  if (!opens) errors.opens = 'tasm.error.when';
  if (!closes) errors.closes = 'tasm.error.when';
  if (opens && closes) {
    const opensAt = new Date(opens);
    const closesAt = new Date(closes);
    if (opensAt >= closesAt) errors.closes = 'tasm.error.order';
    else if (span && opensAt < span.start) errors.opens = 'tasm.error.outsideSemester';
    else if (span && closesAt > span.end) errors.closes = 'tasm.error.outsideSemester';
    else if (published && closesAt < now && closesAt.getTime() !== new Date(savedClosesAt ?? 0).getTime()) {
      errors.closes = 'tasm.error.closedBeforeNow';
    }
  }

  if (form.mode === 'ONLINE') {
    if (!wholeIn(form.maxAttempts, 1, MAX_ATTEMPTS)) errors.maxAttempts = 'tasm.error.attempts';
    if (String(form.timeLimit).trim() && !wholeIn(form.timeLimit, 1, MAX_TIME_LIMIT)) errors.timeLimit = 'tasm.error.timeLimit';
  }
  return errors;
}

/* The ONLINE settings as the server names them. */
const settingsOf = (form) => ({
  maxAttempts: Number(form.maxAttempts),
  acceptLate: Boolean(form.acceptLate),
  timeLimitMinutes: String(form.timeLimit).trim() ? Number(form.timeLimit) : null,
  shuffleQuestions: Boolean(form.shuffleQuestions),
  shuffleOptions: Boolean(form.shuffleOptions),
  showKeyOnRelease: Boolean(form.showKeyOnRelease),
});

/** POST's body (assessmentBody, strict): an OFFLINE one names no setting. */
export function createBody(form, zone) {
  const body = {
    mode: form.mode,
    type: form.type,
    title: form.title.trim(),
    opensAt: instantOf(form.opensDate, form.opensTime, zone),
    closesAt: instantOf(form.closesDate, form.closesTime, zone),
  };
  const instructions = instructionsOf(form.instructions);
  if (instructions) body.instructions = instructions;
  return form.mode === 'ONLINE' ? { ...body, ...settingsOf(form) } : body;
}

/**
 * PATCH's body (assessmentPatch): only what differs from the saved one, so a
 * published one's type is not sent while unchanged. Never the mode. Empty when
 * nothing changed.
 */
export function patchBody(form, saved, zone) {
  const patch = {};
  if (form.type !== saved.type) patch.type = form.type;
  const title = form.title.trim();
  if (title !== saved.title) patch.title = title;
  const instructions = instructionsOf(form.instructions);
  if ((instructions ?? null) !== (saved.instructions ?? null)) patch.instructions = instructions;
  const opensAt = instantOf(form.opensDate, form.opensTime, zone);
  if (opensAt && new Date(opensAt).getTime() !== new Date(saved.opensAt).getTime()) patch.opensAt = opensAt;
  const closesAt = instantOf(form.closesDate, form.closesTime, zone);
  if (closesAt && new Date(closesAt).getTime() !== new Date(saved.closesAt).getTime()) patch.closesAt = closesAt;
  if (saved.mode === 'ONLINE') {
    const settings = settingsOf(form);
    for (const [key, value] of Object.entries(settings)) {
      if (value !== (saved.settings?.[key] ?? null)) patch[key] = value;
    }
  }
  return patch;
}

// ---------------------------------------------------------------------------
// The question list
// ---------------------------------------------------------------------------

let nextKey = 0;
const rowKey = () => `q-${(nextKey += 1)}`;

/**
 * A saved assessment's questions as rows: `{ key, id, sourceQuestionId, points,
 * content, bank }` - `content` is what renders (the copy as it is held).
 */
export const rowsFrom = (assessment) =>
  (assessment?.questions ?? []).map((question) => ({
    key: rowKey(),
    id: question.id,
    questionId: null,
    sourceQuestionId: question.sourceQuestionId ?? null,
    points: String(question.points),
    content: question,
    bank: question.bank ?? null,
  }));

/** Bank questions picked, appended as new rows of 1 point (the server's default). */
export const withPicked = (rows, picked) => [
  ...rows,
  ...picked.map((question) => ({
    key: rowKey(),
    id: null,
    questionId: question.id,
    sourceQuestionId: question.id,
    points: '1',
    content: question,
    bank: null,
  })),
];

/** The bank question ids the list already holds, saved or new: the picker offers none of them twice. */
export const heldBankIds = (rows) => new Set(rows.map((row) => row.sourceQuestionId).filter(Boolean));

/**
 * A copy swapped for the bank's question as it is now (2026-10-07: to change a
 * question's wording, fix it in the bank and put it in again in place of the old
 * copy). Same place, same points; saving removes the copy and copies the bank's.
 */
export const withBankVersion = (rows, key, question) =>
  rows.map((row) =>
    row.key === key ? { ...row, id: null, questionId: question.id, sourceQuestionId: question.id, content: question, bank: null } : row
  );

export function moveRow(rows, key, step) {
  const from = rows.findIndex((row) => row.key === key);
  const to = from + step;
  if (from < 0 || to < 0 || to >= rows.length) return rows;
  const next = [...rows];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export const removeRow = (rows, key) => rows.filter((row) => row.key !== key);

/** `{ [key]: errorKey }` for points outside whole 1 to 100, plus `list` for over 200 questions. */
export function rowErrors(rows) {
  const errors = {};
  for (const row of rows) {
    if (!wholeIn(row.points, MIN_POINTS, MAX_POINTS)) errors[row.key] = 'tasm.error.points';
  }
  if (rows.length > MAX_QUESTIONS) errors.list = 'tasm.error.tooMany';
  return errors;
}

/** PUT's body: a copy by its id, a bank question by its questionId, in order. */
export const questionsBody = (rows) =>
  rows.map((row) => (row.id ? { id: row.id, points: Number(row.points) } : { questionId: row.questionId, points: Number(row.points) }));

/** Whether the list differs from what was saved: order, members or points. */
export function rowsChanged(rows, saved) {
  const before = (saved ?? []).map((question) => `${question.id}:${question.points}`);
  const now = rows.map((row) => (row.id ? `${row.id}:${Number(row.points)}` : `new:${row.questionId}`));
  return before.length !== now.length || before.some((value, i) => value !== now[i]);
}

export const totalPoints = (rows) => rows.reduce((sum, row) => sum + (wholeIn(row.points, MIN_POINTS, MAX_POINTS) ? Number(row.points) : 0), 0);

// ---------------------------------------------------------------------------
// What may be done
// ---------------------------------------------------------------------------

/**
 * What the teacher may do to it, by the server's rules: `edit` the details and
 * questions (not cancelled), `publish` (a draft; an ONLINE one with a question
 * saved), `remove` (a draft), `cancel` (published, not cancelled). All false
 * when it is read only - not theirs to manage (`canManage`), or a closed year.
 */
export function actionsOf(assessment, { readOnly = false } = {}) {
  const none = { edit: false, publish: false, remove: false, cancel: false };
  if (!assessment || readOnly || !assessment.canManage) return none;
  const { status } = assessment;
  if (status === 'CANCELLED') return none;
  return {
    edit: true,
    publish: status === 'DRAFT' && (assessment.mode === 'OFFLINE' || assessment.questionCount > 0),
    remove: status === 'DRAFT',
    cancel: status === 'PUBLISHED',
  };
}

/** A cancellation's reason (cancelBody: trimmed, 1 to 500), as a key or null. */
export function cancelReasonError(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return { key: 'tasm.error.reasonEmpty' };
  if (trimmed.length > MAX_REASON) return { key: 'tasm.error.reasonLong' };
  return null;
}

/** Where an assessment's window stands now: `upcoming`, `open` or `closed`. */
export function windowPhase(assessment, now = new Date()) {
  if (now < new Date(assessment.opensAt)) return 'upcoming';
  if (now < new Date(assessment.closesAt)) return 'open';
  return 'closed';
}

/** The window in words' parts: `{ opens: { date, time }, closes: { date, time } }` in the school's zone. */
export const windowOf = (assessment, zone) => ({ opens: partsOf(assessment.opensAt, zone), closes: partsOf(assessment.closesAt, zone) });

/** "12 Okt 2026 07:00 - 09:00 WIB", the day said once when both ends share it. */
export function windowText(assessment, zone, lang) {
  const { opens, closes } = windowOf(assessment, zone);
  const tail = zone ? ` ${zone}` : '';
  if (opens.date === closes.date) return `${formatSchoolDay(opens.date, lang)} ${opens.time} - ${closes.time}${tail}`;
  return `${formatSchoolDay(opens.date, lang)} ${opens.time} - ${formatSchoolDay(closes.date, lang)} ${closes.time}${tail}`;
}

/**
 * The one word a list says of an assessment (owner, 2026-10-08): `DRAFT`,
 * `ACTIVE` (published, not closed yet - before or during its window), `ENDED`
 * (published, its window over) or `CANCELLED`. The window itself is said beside it.
 */
export function stateOf(assessment, now = new Date()) {
  if (assessment.status === 'CANCELLED') return 'CANCELLED';
  if (assessment.status !== 'PUBLISHED') return 'DRAFT';
  return windowPhase(assessment, now) === 'closed' ? 'ENDED' : 'ACTIVE';
}

/*
  A state's badge colours (owner, 2026-10-08: a pale fill behind the word). Grey
  text on a tinted chip is slate-600, not 500, which measures 4.35:1 there.
*/
export const STATE_TONE = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  ENDED: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-rose-50 text-rose-700',
};

// ---------------------------------------------------------------------------
// Copying (assessment.service.js copy and listCopySources, 2026-10-07)
// ---------------------------------------------------------------------------

export const MAX_COPY_TARGETS = 30;

/**
 * Where an assessment may be copied, from the teacher's own class subjects
 * (`?mine=true` rows): live (ACTIVE, not ended), of its subject and grade, in an
 * OPEN semester of an ACTIVE year (assertTakesNew). Not its own class in its own
 * semester (owner, 2026-10-08: no twin in the same class). Grouped by semester,
 * the source's first, then the latest.
 *
 * @returns {{ semester, rows }[]}  `semester` as semesterOf answers it
 */
export function copyTargets(rows, source, years) {
  const { subject, class: sourceClass, semester: sourceSemester } = source.classSubject;
  const groups = new Map();
  for (const row of rows ?? []) {
    if (row.status !== 'ACTIVE' || row.endedAt) continue;
    if (row.subject?.id !== subject.id || row.class?.gradeLevel !== sourceClass.gradeLevel) continue;
    if (row.class?.id === sourceClass.id && row.semester?.id === sourceSemester.id) continue;
    const semester = semesterOf(years, row.semester?.id);
    if (!semester || semester.status !== 'OPEN' || semester.academicYear.status !== 'ACTIVE') continue;
    if (!groups.has(semester.id)) groups.set(semester.id, { semester, rows: [] });
    groups.get(semester.id).rows.push(row);
  }
  const own = (group) => (group.semester.id === sourceSemester.id ? 1 : 0);
  return [...groups.values()]
    .map((group) => ({ ...group, rows: [...group.rows].sort((a, b) => String(a.class?.name).localeCompare(String(b.class?.name))) }))
    .sort((a, b) => own(b) - own(a) || String(b.semester.startDate).localeCompare(String(a.semester.startDate)));
}

/** Whether a copy must name a new window: a target in another semester than the source's. */
export const needsNewWindow = (semesterIds, sourceSemesterId) => semesterIds.some((id) => id !== sourceSemesterId);

/** An empty window, for a copy that takes a new one (owner, 2026-10-08: empty, the source's shown as a hint). */
export const emptyWindow = () => ({ opensDate: '', opensTime: '', closesDate: '', closesTime: '' });

/**
 * What is wrong with a new window, as keys `{ opens?, closes? }`: both ends, in
 * order, and inside every target semester (`spans`, semesterSpan answers; the
 * server checks each semester once).
 */
export function windowErrors(window, { zone, spans = [] } = {}) {
  const errors = {};
  const opens = instantOf(window.opensDate, window.opensTime, zone);
  const closes = instantOf(window.closesDate, window.closesTime, zone);
  if (!opens) errors.opens = 'tasm.error.when';
  if (!closes) errors.closes = 'tasm.error.when';
  if (!opens || !closes) return errors;
  const opensAt = new Date(opens);
  const closesAt = new Date(closes);
  if (opensAt >= closesAt) errors.closes = 'tasm.error.order';
  else if (spans.some((span) => span && opensAt < span.start)) errors.opens = 'tasm.error.outsideSemester';
  else if (spans.some((span) => span && closesAt > span.end)) errors.closes = 'tasm.error.outsideSemester';
  return errors;
}

/** The copies body (copyBody, strict): the targets, and a new window as both ends or none. */
export function copyBody(classSubjectIds, window, zone) {
  const body = { classSubjectIds: [...classSubjectIds] };
  if (window) {
    body.opensAt = instantOf(window.opensDate, window.opensTime, zone);
    body.closesAt = instantOf(window.closesDate, window.closesTime, zone);
  }
  return body;
}

/**
 * Copy sources (GET /class-subjects/:id/copy-sources) by semester, in the order
 * the server sends them (latest semester first): `[{ key, ordinal, academicYear, rows }]`.
 */
export function sourcesBySemester(sources) {
  const groups = [];
  for (const source of sources ?? []) {
    const { semester, class: cls } = source.classSubject;
    let group = groups.find((item) => item.key === semester.id);
    if (!group) {
      group = { key: semester.id, ordinal: semester.ordinal, academicYear: cls.academicYear, rows: [] };
      groups.push(group);
    }
    group.rows.push(source);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// The teacher's dashboard (owner, 2026-10-08)
// ---------------------------------------------------------------------------

export const DASHBOARD_LIMIT = 5;
const DASHBOARD_GROUPS = ['open', 'upcoming', 'draft'];

/**
 * What the dashboard's "Penilaian" card lists, from each live class subject's
 * list (`[{ row, assessments }]`, `row` the teacher's own `?mine=true` row): the
 * ones open now, soonest to close first; then the published ones not open yet,
 * soonest to open; then drafts, by their window. Ended and cancelled ones ask
 * nothing of the teacher and are left out. One reached through two rows of a
 * slot is listed once. Each item keeps the row it was read through, which is
 * the page's own class subject.
 *
 * @returns {{ items: { assessment, row, group }[], more: number, counts: { open, upcoming, draft } }}
 */
export function dashboardAssessments(lists, { now = new Date(), limit = DASHBOARD_LIMIT } = {}) {
  const seen = new Set();
  const all = [];
  for (const { row, assessments } of lists ?? []) {
    for (const assessment of assessments ?? []) {
      if (seen.has(assessment.id)) continue;
      seen.add(assessment.id);
      const state = stateOf(assessment, now);
      if (state === 'ENDED' || state === 'CANCELLED') continue;
      const group = state === 'DRAFT' ? 'draft' : windowPhase(assessment, now) === 'open' ? 'open' : 'upcoming';
      all.push({ assessment, row, group });
    }
  }
  const at = (item) => new Date(item.group === 'open' ? item.assessment.closesAt : item.assessment.opensAt).getTime();
  all.sort((a, b) => DASHBOARD_GROUPS.indexOf(a.group) - DASHBOARD_GROUPS.indexOf(b.group) || at(a) - at(b));
  const counts = Object.fromEntries(DASHBOARD_GROUPS.map((group) => [group, all.filter((item) => item.group === group).length]));
  return { items: all.slice(0, limit), more: Math.max(0, all.length - limit), counts };
}
