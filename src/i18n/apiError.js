/**
 * Turn an ApiError into a sentence in the reader's language.
 *
 * The backend speaks English only. Every failure it sends carries a
 * machine-readable `code` beside the prose, and this app has branched on that
 * code from the start — which is exactly what makes translating possible now:
 * the codes are stable, the prose is not.
 *
 * A code with no entry here falls back to the server's own words rather than to
 * silence. English in one place beats a blank where the reason should be.
 *
 * One code cannot carry one sentence, though. UNAUTHORIZED on a sign-in means
 * the password was wrong; on any later call it means the session has run out,
 * and telling somebody their password is wrong when they never typed one is
 * worse than saying nothing. So the default here is the one that is true
 * everywhere, and the screens that know better say so with `overrides`.
 */
import { formatDay } from '../views/Classes/format';

const BY_CODE = {
  UNAUTHORIZED: 'error.unauthorized',
  EMAIL_NOT_VERIFIED: 'error.emailNotVerified',
  CONFLICT: 'error.conflict',
  BAD_REQUEST: 'error.badRequest',
  NOT_FOUND: 'error.notFound',
  INVALID_RESPONSE: 'error.unreachable',
  /* generalLimiter counts per user since backend a09f399 — 1000 per 15 minutes,
     read from the access token — and per network only for anonymous requests
     (300), so a school on one Wi-Fi no longer shares one budget. */
  TOO_MANY_REQUESTS: 'error.tooManyRequests',
  UNKNOWN_ERROR: 'error.unknown',
};

/**
 * @param {{ code?: string, message?: string }} err
 * @param {(key: string) => string} t
 * @param {Record<string, string>} [overrides]  code → key, for this call site only
 */
export function apiErrorMessage(err, t, overrides) {
  const key = overrides?.[err?.code] ?? BY_CODE[err?.code];
  if (key) return t(key);
  return err?.message || t('error.unknown');
}

/*
  School registration: one code, four meanings — and the one place this app
  reads the server's prose.

  `POST /school-registrations` answers CONFLICT for four unrelated things: you
  already have a registration under review, you already belong to a school, that
  NPSN is taken, or you have submitted too often today. Only the last is
  distinguishable without touching the words — it is the only one carrying
  `details.attempts`.

  Branching on prose is what `apiClient` tells callers never to do, and the rule
  holds for everything else: prose is the part that gets reworded. For a 409 it is
  the backend's own design — every refusal keeps the one code CONFLICT and is told
  apart by its sentence (David, 2026-09-30) — and the alternative is worse anyway.
  The generic `error.conflict` says "an account
  with this email already exists" — the registration meaning, wrong for all four
  — and falling through to `err.message` would put a lone English sentence in the
  middle of an Indonesian form.

  The match is on a stable prefix of a string literal in
  `school.service.js:169,171,186`, and an unrecognised sentence lands on
  `reg.conflict.other`. So if those words change, this degrades to a vaguer
  sentence rather than breaking.

  This is permanent, like every *_BY_MESSAGE table below: the backend will not
  split CONFLICT into separate codes, so there is nothing to wait for.
*/
const CONFLICT_BY_MESSAGE = [
  ['already have a school registration', 'reg.conflict.pending'],
  ['already belong to a school', 'reg.conflict.member'],
  ['NPSN is already registered', 'reg.conflict.npsn'],
];

/**
 * @param {{ code?: string, message?: string, details?: object }} err
 * @param {(key: string, vars?: object) => string} t
 */
export function registrationErrorMessage(err, t) {
  if (err?.code !== 'CONFLICT') return apiErrorMessage(err, t);

  // The only conflict that identifies itself without prose.
  if (err.details && !Array.isArray(err.details) && err.details.attempts !== undefined) {
    return t('reg.conflict.tooMany', {
      attempts: err.details.attempts,
      hours: err.details.windowHours ?? 24,
    });
  }

  const message = err.message ?? '';
  const hit = CONFLICT_BY_MESSAGE.find(([needle]) => message.includes(needle));
  return t(hit ? hit[1] : 'reg.conflict.other');
}

/*
  The school's calendar and classes: the same problem as registration, wider.

  `academics.service.js` answers CONFLICT for four things — a label, a semester
  or a class name already taken, and a year already closed — and BAD_REQUEST for
  rules only the database can check: a semester outside its year or overlapping
  the other half, a grade the school does not have, a homeroom teacher who does
  not teach. None of them carries a code of its own, and the shared defaults say
  the wrong thing here (CONFLICT's is about an email address).

  So the same deliberate exception as above: a stable fragment of each string
  literal in `academics.service.js`, most specific first — "is already closed"
  before "is closed" would be wrong, since the second is not a substring of the
  first but reads like it. Anything unrecognised falls to a sentence that is true
  for every CONFLICT here, rather than to the server's English.
*/
const ACADEMICS_BY_MESSAGE = [
  ['is already closed', 'classes.error.alreadyClosed'],
  ['is closed', 'classes.error.yearClosed'],
  ['academic year with that label already exists', 'classes.error.yearExists'],
  ['semester already exists', 'classes.error.semesterExists'],
  ['class with that name already exists', 'classes.error.classExists'],
  ['must fall inside academic year', 'classes.error.semesterOutside'],
  ['overlaps semester', 'classes.error.semesterOverlap'],
  ['must be an active teacher', 'classes.error.notTeacher'],
  ['Teacher not found', 'classes.error.teacherGone'],
  ['does not exist at a', 'classes.error.gradeInvalid'],
  /* Correcting and deleting — academics.service.js, backend f669286. */
  ['would fall outside the academic year', 'classes.error.yearHoldsSemesters'],
  ['Only an empty year can be deleted', 'classes.error.yearNotEmpty'],
  ['Only a semester without any can be deleted', 'classes.error.semesterInUse'],
  ['is not open', 'classes.error.semesterNotOpen'],
  ['so its grade can no longer change', 'classes.error.gradeLocked'],
  ['Only an empty class can be deleted', 'classes.error.classNotEmpty'],
];

/*
  Removing a member: three CONFLICTs, one of which names classes.

  `removeMember` (membership.service.js) answers CONFLICT for a Principal, for a
  membership that has already ended, and for somebody still homeroom teacher of a
  class in an ACTIVE year — the last carrying the class names in
  `details.classes`, which is the part worth repeating: it is what the Principal
  has to go and hand on first. NOT_FOUND covers everyone this reader may not
  remove, including a student who is not in their class; FORBIDDEN is the member
  list refusing a teacher.
*/
/*
  Handing the school over — membership.service.js handOverPrincipal and
  loadSuccessor (backend 1416e24). Told apart on its sentences; a homeroom
  refusal names its classes in `details.classes`, which is worth repeating:
  those classes need another homeroom teacher before the Principal can leave.
*/
const HANDOVER_BY_MESSAGE = [
  ['already the Principal', 'handover.error.alreadyPrincipal'],
  ['must be an active teacher', 'handover.error.notTeacher'],
  ['no longer the Principal', 'handover.error.notPrincipal'],
  ['no longer a member here', 'handover.error.gone'],
  ['Member not found', 'handover.error.gone'],
  ['Give your NIP or NUPTK', 'handover.error.teacherIds'],
  ['Only the Principal', 'handover.error.notPrincipal'],
];

export function handoverErrorMessage(err, t) {
  if (Array.isArray(err?.details?.classes) && err.details.classes.length > 0) {
    return t('handover.error.homeroom', { classes: err.details.classes.join(', ') });
  }
  const message = String(err?.message ?? '');
  const hit = HANDOVER_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return apiErrorMessage(err, t);
}

export function membersErrorMessage(err, t) {
  const message = err?.message ?? '';
  if (err?.code === 'CONFLICT') {
    if (Array.isArray(err.details?.classes) && err.details.classes.length > 0) {
      return t('members.error.homeroom', { classes: err.details.classes.join(', ') });
    }
    if (message.includes('Principal cannot be removed')) return t('members.error.principal');
    /* Since backend 75e2fdd: a member asking to leave is decided, not removed. */
    if (message.includes('leave request waiting')) return t('members.error.leaveWaiting');
    if (message.includes('already ended')) return t('members.error.ended');
  }
  return apiErrorMessage(err, t, {
    CONFLICT: 'members.error.conflict',
    NOT_FOUND: 'members.error.notFound',
    FORBIDDEN: 'members.error.forbidden',
  });
}

/*
  Appointing or revoking a Vice Principal (backend `89a5666`, membership.service.js
  appointVicePrincipal / revokeVicePrincipal). CONFLICT is three things and
  matched on the server's sentences, as above.
*/
export function viceErrorMessage(err, t) {
  const message = err?.message ?? '';
  if (err?.code === 'CONFLICT') {
    if (message.includes('already holds every power')) return t('members.vice.error.principal');
    if (message.includes('already a Vice Principal')) return t('members.vice.error.already');
    if (message.includes('already revoked')) return t('members.vice.error.revoked');
  }
  if (err?.code === 'BAD_REQUEST' && message.includes('active teacher')) return t('members.vice.error.notTeacher');
  return apiErrorMessage(err, t, {
    NOT_FOUND: 'members.vice.error.notFound',
    FORBIDDEN: 'members.error.forbidden',
  });
}

/*
  Leaving, and taking a request back. Each 409 is somebody else having got there
  first or a rule about who may go; the prose fragments are matched the same
  deliberate way as above, and the homeroom refusal reads details.classes.
*/
/*
  Leaving — directly (a guardian) or by a leave request with a letter (a teacher
  or a student, backend `75e2fdd`). The member's own side: sending, cancelling,
  leaving at once. Told apart on the server's sentences (membership.service.js
  loadLeaver / leaveSchool / submitLeaveRequest / cancelLeaveRequest, and the
  letter upload in shared/upload.js).
*/
const LEAVE_BY_MESSAGE = [
  ['without its Principal', 'account.leave.error.principal'],
  ['already ended', 'account.leave.error.ended'],
  ['already waiting for the Principal', 'account.leave.error.waiting'],
  ['need nobody', 'account.leave.error.direct'],
  ['leaves with the Principal', 'account.leave.error.needsRequest'],
  ['You have no leave request waiting', 'account.leave.error.nothingWaiting'],
  ['leave request has already been decided', 'account.leave.error.decided'],
  ['file is required', 'validation.letter.required'],
  ['file must be one of', 'validation.letter.type'],
];

export function leaveErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  if (err?.code === 'CONFLICT' && Array.isArray(err.details?.classes) && err.details.classes.length > 0) {
    return t('account.leave.error.homeroom', { classes: err.details.classes.join(', ') });
  }
  if (message.includes('file must be at most')) return t('validation.letter.tooLarge', { max: '5 MB' });
  const hit = LEAVE_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return apiErrorMessage(err, t, {
    NOT_FOUND: 'account.leave.error.ended',
    CONFLICT: 'account.leave.error.ended',
  });
}

/*
  The Principal deciding a leave request (/api/leave-requests). A homeroom
  teacher of an active-year class is refused at approval as at removal, with
  `details.classes`; somebody deciding first is "already decided".
*/
export function leaveDecisionErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  if (err?.code === 'CONFLICT' && Array.isArray(err.details?.classes) && err.details.classes.length > 0) {
    return t('members.error.homeroom', { classes: err.details.classes.join(', ') });
  }
  if (message.includes('already been decided')) return t('members.leave.error.decided');
  return apiErrorMessage(err, t, {
    NOT_FOUND: 'members.leave.error.gone',
    FORBIDDEN: 'members.error.forbidden',
  });
}

/*
  Deciding a join request — the single review and bulk approval alike.

  CONFLICT here is not one thing. `decideRequest` answers it when somebody else
  decided first, but `translateUniqueViolation` (membership.service.js:1383)
  answers it too when the profile an approval writes already exists — most often
  a student who left or was removed and asked to join the same school again: the
  old StudentProfile is kept on purpose, NISN is unique per school, and approval
  always creates a new one. Calling all of that "already decided" hid the one
  case the reviewer can do nothing about from the app. So each is told apart on
  the server's own words, and anything unrecognised is shown in them.
*/
const DECISION_BY_MESSAGE = [
  ['already been decided', 'requests.alreadyDecided'],
  ['student with this NISN already exists', 'requests.error.nisnTaken'],
  ['NIP or NUPTK already exists', 'requests.error.teacherIdTaken'],
  ['already linked to that student', 'requests.error.guardianLinked'],
  ['cannot be combined with any other role', 'requests.error.studentExclusive'],
  ['carries no NISN', 'requests.error.noNisn'],
  ['Choose the class', 'requests.approve.needsClass'],
  ['and this request asks for grade', 'requests.error.gradeMismatch'],
];

/** Whether the refusal only means the request was decided elsewhere — reload and move on. */
export const isAlreadyDecided = (err) =>
  err?.code === 'CONFLICT' && String(err?.message ?? '').includes('already been decided');

export function decisionErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = DECISION_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  /* An unrecognised CONFLICT keeps the server's words: the app-wide sentence for it
     is about an email already registered, which is never what this is. */
  if (err?.code === 'CONFLICT' && message) return message;
  return apiErrorMessage(err, t, { NOT_FOUND: 'requests.class.gone' });
}

/*
  Claiming a child — as a new GUARDIAN role or as a further child. The 400 is one
  sentence for every reason on purpose (resolveChild): wrong NISN, wrong name, or
  a child not yet placed in a class all read the same, so a code cannot be used
  to fish for which children exist.
*/
export function guardianErrorMessage(err, t) {
  const message = err?.message ?? '';
  if (err?.code === 'BAD_REQUEST' && message.includes('child details do not match')) {
    return t('guardian.error.noMatch');
  }
  if (err?.code === 'CONFLICT') {
    if (message.includes('already linked')) return t('guardian.error.linked');
    if (message.includes('link to that student is already waiting')) return t('guardian.error.waiting');
    if (message.includes('GUARDIAN role is still waiting')) return t('guardian.error.rolePending');
    if (message.includes('GUARDIAN role is already waiting') || message.includes('already hold the GUARDIAN')) {
      return t('guardian.error.roleTaken');
    }
  }
  return apiErrorMessage(err, t, {
    NOT_FOUND: 'guardian.error.gone',
    CONFLICT: 'guardian.error.conflict',
  });
}

export function cancelErrorMessage(err, t) {
  return apiErrorMessage(err, t, {
    NOT_FOUND: 'selectRole.cancel.error.none',
    CONFLICT: 'selectRole.cancel.error.decided',
  });
}

/*
  Backend a09f399 and 7cdc46d. The two year refusals name a year, so they are read
  with the name kept; the semester's two are fixed sentences
  (sessions.service.js assertSemesterDatesMayChange).
*/
const YEAR_OVERLAP = /The dates overlap academic year (\S+)/;
const YEAR_LABEL_DATES = /Academic year (\S+) must start in (\d{4}) and end in (\d{4})/;
/* Backend 4bdd397: a year closes only once no semester of it runs past today. */
const YEAR_STILL_RUNNING = /Semester (\d+) of (\S+) runs until (\d{4}-\d{2}-\d{2})/;
const SEMESTER_DATES_BY_MESSAGE = [
  ['A meeting in this Semester has already happened, so its start date is fixed', 'classes.error.semesterStartFixed'],
  ['The Semester cannot end before today', 'classes.error.semesterEndPast'],
];

/** `lang` only formats the date the "year still running" refusal names. */
export function academicsErrorMessage(err, t, lang) {
  const message = err?.message ?? '';
  const running = YEAR_STILL_RUNNING.exec(message);
  if (running) {
    return t('classes.error.yearStillRunning', { n: running[1], label: running[2], date: formatDay(running[3], lang) });
  }
  const overlap = YEAR_OVERLAP.exec(message);
  if (overlap) return t('validation.academicYear.overlap', { label: overlap[1] });
  const labelDates = YEAR_LABEL_DATES.exec(message);
  if (labelDates) return t('classes.error.yearLabelDates', { label: labelDates[1], first: labelDates[2], second: labelDates[3] });
  const hit = [...SEMESTER_DATES_BY_MESSAGE, ...ACADEMICS_BY_MESSAGE].find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return apiErrorMessage(err, t, {
    CONFLICT: 'classes.error.conflict',
    FORBIDDEN: 'classes.error.forbidden',
  });
}

/*
  Moving a student (ticket 16). academics.service.js answers CONFLICT for five
  different things and NOT_FOUND for three, so they are told apart on its own
  sentences, like the rest of this file. "is closed" falls through to
  academicsErrorMessage, which already says it.
*/
const MOVES_BY_MESSAGE = [
  ['has no homeroom teacher to accept', 'moves.error.noHomeroom'],
  ['leave request waiting', 'moves.error.leaving'],
  ['already has a class move waiting', 'moves.error.alreadyWaiting'],
  ['has already been decided', 'moves.error.decided'],
  ['is no longer in', 'moves.error.notThere'],
  ['is already in', 'moves.error.sameClass'],
  ['same academic year', 'moves.error.otherYear'],
  ['Student not found', 'moves.error.notYours'],
  ['No class move of yours', 'moves.error.gone'],
  ['Class move not found', 'moves.error.gone'],
  ['Class not found', 'moves.error.classGone'],
];

export function movesErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = MOVES_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return academicsErrorMessage(err, t);
}

/*
  Subjects and teaching assignments (ticket 08). Told apart on the sentences of
  academics.service.js (resolveSlot, translateSlotTaken, decideClassSubject) and
  shared/approval.js (the deadline and the retry cap). Checked before the
  academics map, which would call "The teacher must be an active teacher" a
  homeroom problem.
*/
const SUBJECTS_BY_MESSAGE = [
  ['already has a subject with that code', 'subjects.error.codeTaken'],
  /* Backend c6a1684 names the subject ("This school does not use MTK Matematika."),
     where a852609 said "this subject"; the shared start matches both. */
  ['This school does not use', 'subjects.error.notSelected'],
  ['changed by someone else at the same moment', 'subjects.error.selectionRace'],
  ['already has a teacher, or a request waiting', 'subjects.error.slotTaken'],
  ['has already been decided', 'subjects.error.decided'],
  ['is not open', 'subjects.error.semesterClosed'],
  ['different academic years', 'subjects.error.otherYear'],
  ['registration deadline for this semester has passed', 'subjects.error.deadline'],
  ['Too many rejected requests for this teaching slot', 'subjects.error.tooMany'],
  ['must be an active teacher', 'subjects.error.notTeacher'],
  /* Backend 89a5666: a Vice Principal deciding their own request. */
  ['cannot decide their own teaching assignment', 'subjects.error.ownDecision'],
  /* Backend 85bc687: ending or replacing an assignment (loadLiveAssignment,
     endAssignment, replaceClassSubject). */
  ['No active teaching assignment under that id', 'subjects.change.error.gone'],
  ['This teaching assignment has already ended', 'subjects.change.error.gone'],
  ['That teacher already teaches it', 'subjects.change.error.sameTeacher'],
  ['A reason is required', 'validation.leaveReason.short'],
  ['Teacher not found', 'subjects.error.notTeacher'],
  ['Teaching assignment not found', 'subjects.error.gone'],
  ['No request of yours is waiting', 'subjects.error.gone'],
  ['Subject not found', 'subjects.error.subjectGone'],
  ['Semester not found', 'subjects.error.semesterGone'],
  ['Class not found', 'subjects.error.classGone'],
];

export function subjectsErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = SUBJECTS_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return academicsErrorMessage(err, t);
}

/*
  The weekly timetable (backend 7cdc46d, sessions.service.js setSchedule and
  assertCanRead). A clash is not here: its sentence carries days, times and
  names, and ScheduleDialog takes it apart with `parseClash`. What is left falls
  through to the subjects map, which knows a closed year and a semester not open.
*/
const TIMETABLE_BY_MESSAGE = [
  ["Set the school's time zone", 'timetable.error.noZone'],
  ['Only an active teaching assignment has a timetable', 'timetable.error.notActive'],
  ['Only the Principal or a Vice Principal can set the timetable', 'timetable.error.forbidden'],
  ['Class subject not found', 'timetable.error.gone'],
];

export function timetableErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = TIMETABLE_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return subjectsErrorMessage(err, t);
}

/*
  The teacher answering for a meeting (owner, 2026-10-04): confirming its
  attendance and correcting a record (attendance.service.js confirm, correct), and
  saying it was not held (sessions.service.js markNotHeld). Told apart on their
  sentences, as above; anything else falls back to the shared map.
*/
const TEACH_ATTENDANCE_BY_MESSAGE = [
  ['has already been confirmed', 'teach.att.error.confirmed'],
  ['already confirmed this attendance', 'teach.att.error.confirmed'],
  ['has not begun yet', 'teach.att.error.notBegun'],
  ['was cancelled', 'teach.att.error.cancelled'],
  ['Confirm the attendance first', 'teach.att.error.confirmFirst'],
  ['A note is required for a correction', 'teach.att.error.noteRequired'],
  ['changed meanwhile', 'teach.att.error.changed'],
  ['is not waiting for completion', 'teach.att.error.notWaiting'],
  ['was answered already', 'teach.att.error.answered'],
  ['Only the teacher of this class subject', 'teach.att.error.notYours'],
  ['must be in this class at this session', 'teach.att.error.roster'],
];

export function teachAttendanceErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  if (/^It is [A-Z]+ already/.test(message)) return t('teach.att.error.same');
  const hit = TEACH_ATTENDANCE_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return apiErrorMessage(err, t);
}

/*
  A teacher's materials (content.service.js, content.schema.js, shared/upload.js).
  The upload refusals name the allowed types and size in their own words, so they
  are matched on a fragment.
*/
const CONTENT_BY_MESSAGE = [
  ['The text is empty', 'teach.content.error.empty'],
  ['not a single video', 'teach.content.error.youtube'],
  ['Use an https:// link', 'teach.content.error.https'],
  ['published already', 'teach.content.error.published'],
  ['add the content to another Session', 'teach.content.error.cancelled'],
  ['Name every content', 'teach.content.error.order'],
  ['Only the teacher of this class subject manages', 'teach.content.error.notYours'],
  ['file must be at most', 'teach.content.error.fileSize'],
  ['file must be one of', 'teach.content.error.fileType'],
  ['file is required', 'teach.content.error.noFile'],
  ['Content not found', 'teach.content.error.gone'],
];

export function contentErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = CONTENT_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return apiErrorMessage(err, t);
}

/*
  The question bank (backend ed46340, assessment.bank.js and shared/upload.js).
  Two 403s and three 409s, each its own sentence; told apart on them as above.
*/
const QUESTION_BANK_BY_MESSAGE = [
  ['The text is empty', 'qbank.error.bodyEmpty'],
  ['subject and grade level you teach now', 'qbank.error.notTaught'],
  ['Only its author changes a question', 'qbank.error.notAuthor'],
  ['Use an image you uploaded', 'qbank.error.imageNotYours'],
  ["A question's kind never changes", 'qbank.error.kindFixed'],
  ['An option id does not belong', 'qbank.error.changedMeanwhile'],
  ['changed meanwhile', 'qbank.error.changedMeanwhile'],
  ['archived already', 'qbank.error.archivedAlready'],
  ['is not archived', 'qbank.error.notArchived'],
  ['image file must be at most', 'qbank.error.imageSize'],
  ['image file must be one of', 'qbank.error.imageType'],
  ['Question not found', 'qbank.error.gone'],
  ['Image not found', 'qbank.image.failed'],
];

export function questionBankErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = QUESTION_BANK_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return apiErrorMessage(err, t);
}

/** A refusal that means the screen is behind: reload the question. */
export const isStaleQuestion = (err) =>
  ['changed meanwhile', 'An option id does not belong', 'archived already', 'is not archived', 'Question not found'].some((needle) =>
    String(err?.message ?? '').includes(needle)
  );

/*
  A student's check-in — attendance.service.js `checkIn` (backend deb95e8,
  87f2670). Six CONFLICTs told apart on their sentences, as above. NOT_FOUND is a
  meeting of a Class the student is no longer in (moved since the card read).
  Every one of them means the card on screen is behind: it reads again.
*/
const CHECK_IN_BY_MESSAGE = [
  ['already checked in', 'checkin.error.already'],
  ['already confirmed this attendance', 'checkin.error.confirmed'],
  ['was cancelled', 'checkin.error.cancelled'],
  ['opens when the session starts', 'checkin.error.notYet'],
  ['check-in is closed', 'checkin.error.closed'],
  ['no location set', 'checkin.error.noLocation'],
];

export function checkInErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = CHECK_IN_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return apiErrorMessage(err, t, {
    CONFLICT: 'checkin.error.other',
    NOT_FOUND: 'checkin.error.notFound',
    BAD_REQUEST: 'checkin.error.position',
  });
}

/* A refusal that says the card is behind the server: read today again. */
export const isStaleCheckIn = (err) => err?.code === 'CONFLICT' || err?.code === 'NOT_FOUND';

/* A teaching request decided or withdrawn elsewhere: the row on screen is stale. */
export const isStaleTeaching = (err) =>
  String(err?.message ?? '').includes('has already been decided') ||
  String(err?.message ?? '').includes('Teaching assignment not found');

/* An assignment ended or replaced elsewhere (backend 85bc687): the board row is stale. */
export const isStaleAssignment = (err) =>
  String(err?.message ?? '').includes('No active teaching assignment under that id') ||
  String(err?.message ?? '').includes('This teaching assignment has already ended');

/* Whether a move was decided or withdrawn elsewhere: the row on screen is stale. */
export const isStaleMove = (err) =>
  err?.code === 'NOT_FOUND' || String(err?.message ?? '').includes('has already been decided');

export default apiErrorMessage;
