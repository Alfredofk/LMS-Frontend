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
const BY_CODE = {
  UNAUTHORIZED: 'error.unauthorized',
  EMAIL_NOT_VERIFIED: 'error.emailNotVerified',
  CONFLICT: 'error.conflict',
  BAD_REQUEST: 'error.badRequest',
  NOT_FOUND: 'error.notFound',
  INVALID_RESPONSE: 'error.unreachable',
  /* generalLimiter counts every request per IP, before sign-in is even checked
     (server.js), so a busy school behind one address meets it first. */
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
  is right: prose is the part that gets reworded. It is broken here on purpose,
  because the alternative is worse. The generic `error.conflict` says "an account
  with this email already exists" — the registration meaning, wrong for all four
  — and falling through to `err.message` would put a lone English sentence in the
  middle of an Indonesian form.

  The match is on a stable prefix of a string literal in
  `school.service.js:169,171,186`, and an unrecognised sentence lands on
  `reg.conflict.other`. So if those words change, this degrades to a vaguer
  sentence rather than breaking.

  The real fix belongs upstream: four conflicts deserve four codes. Delete this
  the day they get them.
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
export function membersErrorMessage(err, t) {
  const message = err?.message ?? '';
  if (err?.code === 'CONFLICT') {
    if (Array.isArray(err.details?.classes) && err.details.classes.length > 0) {
      return t('members.error.homeroom', { classes: err.details.classes.join(', ') });
    }
    if (message.includes('Principal cannot be removed')) return t('members.error.principal');
    if (message.includes('already ended')) return t('members.error.ended');
  }
  return apiErrorMessage(err, t, {
    CONFLICT: 'members.error.conflict',
    NOT_FOUND: 'members.error.notFound',
    FORBIDDEN: 'members.error.forbidden',
  });
}

/*
  Leaving, and taking a request back. Each 409 is somebody else having got there
  first or a rule about who may go; the prose fragments are matched the same
  deliberate way as above, and the homeroom refusal reads details.classes.
*/
export function leaveErrorMessage(err, t) {
  const message = err?.message ?? '';
  if (err?.code === 'CONFLICT') {
    if (Array.isArray(err.details?.classes) && err.details.classes.length > 0) {
      return t('account.leave.error.homeroom', { classes: err.details.classes.join(', ') });
    }
    if (message.includes('without its Principal')) return t('account.leave.error.principal');
    if (message.includes('already ended')) return t('account.leave.error.ended');
  }
  return apiErrorMessage(err, t, {
    NOT_FOUND: 'account.leave.error.ended',
    CONFLICT: 'account.leave.error.ended',
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

export function academicsErrorMessage(err, t) {
  const message = err?.message ?? '';
  const hit = ACADEMICS_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return apiErrorMessage(err, t, {
    CONFLICT: 'classes.error.conflict',
    FORBIDDEN: 'classes.error.forbidden',
  });
}

export default apiErrorMessage;
