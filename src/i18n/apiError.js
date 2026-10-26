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
  /* Backend 3a22f90: a transaction past its timeout, or with no pool connection in
     time, rolled back - 503. Nothing was saved, and trying again is the remedy. */
  TIMEOUT: 'error.timeout',
  /* Backend a577abd: signing in on a school's own address with an account that is
     not registered there - only once the password has checked out. */
  NOT_REGISTERED_HERE: 'error.notRegisteredHere',
  UNKNOWN_ERROR: 'error.unknown',
};

/**
 * @param {{ code?: string, message?: string }} err
 * @param {(key: string) => string} t
 * @param {Record<string, string>} [overrides]  code → key, for this call site only
 */
export function apiErrorMessage(err, t, overrides) {
  /* The same code at a Governing Body's own address (backend b5cfffd), told apart
     by its sentence as every shared code here is. */
  if (err?.code === 'NOT_REGISTERED_HERE' && String(err.message ?? '').includes('admin of this governing body')) {
    return t('error.notAdminHere');
  }
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
  /* Backend 72e546b: a member may found another school; only a student may not. */
  ['student belongs to one school only', 'reg.conflict.student'],
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

/**
 * The Governing Body holding this NPSN, when a School Registration is refused because a
 * body's School has it (backend ed0d304, K6c: `details.governingBody.name`); otherwise
 * null. Any other taken NPSN keeps the vague sentence. The name is read from the
 * sentence when the details are missing, as "registered by <name>. Ask".
 */
export function npsnHeldByBodyOf(err) {
  if (err?.code !== 'CONFLICT') return null;
  const named = err.details?.governingBody?.name;
  if (typeof named === 'string' && named.trim()) return named.trim();
  const match = String(err.message ?? '').match(/^This NPSN is registered by (.+?)\. Ask it for/);
  return match ? match[1] : null;
}

/*
  Several schools per person (backend 72e546b, membership.eligibility.js assertMayJoin):
  joining is refused, on its sentence, at a school one already belongs to or has a
  request waiting at, and anywhere to a student - one school only.
*/
const JOIN_BY_MESSAGE = [
  ['join request waiting for approval at this school', 'join.conflict.pendingHere'],
  ['already belong to this school', 'join.conflict.memberHere'],
  /* A live admin seat refuses a STUDENT request (backend 3d7d05a); before the general one. */
  ['You are an admin of a governing body', 'join.conflict.studentSeat'],
  /* A waiting Principal application refuses one too (backend e206bd9). */
  ['You have applied to be the Principal of a school', 'join.conflict.studentApplication'],
  /* A body's School with no Principal takes only an application (e206bd9), should a join slip past the lookup. */
  ['takes only an application to be its Principal', 'join.conflict.principalWanted'],
  ['A student belongs to one school only', 'join.conflict.student'],
];

export function joinErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = JOIN_BY_MESSAGE.find(([needle]) => message.includes(needle));
  return hit ? t(hit[1]) : apiErrorMessage(err, t);
}

/**
 * Opening another of one's places (`POST /auth/place`, `/auth/handoff`): one 404 for
 * a place that no longer opens - a school, or a Governing Body seat (backend b5cfffd)
 * when `place` is one.
 */
export function placesErrorMessage(err, t, place) {
  const gone = place?.kind === 'GOVERNING_BODY' ? 'choose.error.goneBody' : 'choose.error.gone';
  return apiErrorMessage(err, t, { NOT_FOUND: gone });
}

/*
  The platform admin's Governing Body queue and bodies (backend b5cfffd,
  governingBody.service.js): CONFLICT and BAD_REQUEST mean several things each, told
  apart by the sentence. "already registered" covers both SK sentences (under review
  or held). "is not deactivated" and "already deactivated" are distinct needles.
*/
const GOVERNING_BODY_ADMIN_BY_MESSAGE = [
  ['has already been decided', 'gbr.error.decided'],
  ['SK number is already registered', 'gbr.error.skTaken'],
  ['applicant account no longer exists', 'gbr.error.applicantGone'],
  ['The applicant is a student', 'gbr.error.applicantStudent'],
  ['is already deactivated', 'gbr.error.alreadyOff'],
  ['is not deactivated', 'gbr.error.notOff'],
  ['changed meanwhile', 'gbr.error.changed'],
  /* The NPYP (backend c79b56f): taken (approval and correction), refused for a Dinas,
     required of a foundation or an association that held one, and its shape. */
  ['NPYP is already registered', 'gbr.error.npypTaken'],
  ['A government body has no NPYP', 'gbr.edit.npypNone'],
  ['A foundation or an association has an NPYP', 'gbr.edit.npypRequired'],
  ['An NPYP is six letters and digits', 'gbreg.npyp.format'],
  ['A government body has no Kemenkumham SK number', 'gbr.edit.skNone'],
  ['Governing body not found', 'gbr.error.bodyGone'],
  ['Governing body registration not found', 'gbr.error.registrationGone'],
];

export function governingBodyAdminErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = GOVERNING_BODY_ADMIN_BY_MESSAGE.find(([needle]) => message.includes(needle));
  return hit ? t(hit[1]) : apiErrorMessage(err, t);
}

/*
  Registering a Governing Body (backend b5cfffd, `submitRegistration` and the
  limiter): four CONFLICTs and the limiter's 429, by their sentences. The limiter's
  sentence and approval.js's durable one share "Too many governing body".
*/
const BODY_REGISTRATION_BY_MESSAGE = [
  ['governing body registration under review', 'gbreg.error.pending'],
  ['A student belongs to one school only', 'gbreg.error.student'],
  ['SK number is already registered', 'gbreg.error.skTaken'],
  ['NPYP is already registered', 'gbreg.error.npypTaken'],
  ['Too many governing body registration', 'gbreg.error.tooMany'],
];

export function bodyRegistrationErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = BODY_REGISTRATION_BY_MESSAGE.find(([needle]) => message.includes(needle));
  return hit ? t(hit[1]) : apiErrorMessage(err, t);
}

/** Whether the row on screen is out of date: decided, switched or changed elsewhere, or gone. Read the queue again. */
export function isStaleGoverningBody(err) {
  const message = String(err?.message ?? '');
  return ['has already been decided', 'is already deactivated', 'is not deactivated', 'changed meanwhile', 'not found'].some((needle) => message.includes(needle));
}

/*
  A Governing Body's own admins (backend 3d7d05a, governing-body ticket 04:
  governingBody.admins.js and the seat's half of governingBody.service.js): the
  senior's decisions and removals, leaving, the address and the code, by their
  sentences. "Admin application not found" before "Admin not found", which it holds.
*/
const GOVERNING_BODY_SEAT_BY_MESSAGE = [
  ['Only the senior admin can do this', 'gba.error.notSenior'],
  ['This governing body has an admin', 'gbr.admins.error.hasAdmin'],
  ['has already been decided', 'gba.error.decided'],
  ['The applicant account no longer exists', 'gba.error.applicantGone'],
  ['The applicant is a student at a school', 'gba.error.applicantStudent'],
  ['Admin application not found', 'gba.error.applicationGone'],
  ['Admin not found', 'gba.error.adminGone'],
  ['This admin has already left', 'gba.error.adminGone'],
  ['To step down yourself, leave the governing body instead', 'gba.error.removeSelf'],
  ['A governing body cannot be left without an admin', 'gba.error.lastAdmin'],
  ['You have already left this governing body', 'gba.error.alreadyLeft'],
  ['This governing body changed meanwhile', 'gb.profile.error.changed'],
  ['Governing body not found', 'gb.error.gone'],
  ['A rejection reason is required', 'gba.error.reason'],
  ['A reason is required', 'gba.error.reason'],
  ['Give the reason', 'gba.error.reason'],
];

export function governingBodySeatErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = GOVERNING_BODY_SEAT_BY_MESSAGE.find(([needle]) => message.includes(needle));
  return hit ? t(hit[1]) : apiErrorMessage(err, t);
}

/*
  A Governing Body's Schools (backend ed0d304/9697362, governingBody.schools.js):
  creating and fixing, by their sentences. Several taken NPSNs are named by row from
  `details.rows`; one taken is the registration's sentence. "these NPSNs" before
  "NPSN is already registered", which a single row's sentence holds.
*/
const BODY_SCHOOLS_BY_MESSAGE = [
  ['has had a Principal', 'gbs.error.hadPrincipal'],
  ['This school changed meanwhile', 'gbs.error.changed'],
  ['registered meanwhile, so no school was created', 'gbs.error.npsnMeanwhile'],
  ['NPSN is already registered or under review', 'reg.conflict.npsn'],
  ['School not found', 'gbs.error.gone'],
  ['An SMK must state its duration', 'validation.duration.required'],
  ['An SMK runs 3 or 4 years', 'gbs.error.duration'],
];

export function bodySchoolsErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const rows = Array.isArray(err?.details?.rows) ? err.details.rows : [];
  if (err?.code === 'CONFLICT' && rows.length > 1) {
    return t('gbs.error.npsnRows', { rows: rows.map((entry) => entry.row).join(', ') });
  }
  if (err?.code === 'CONFLICT' && rows.length === 1) {
    return t('gbs.error.npsnRow', { row: rows[0].row });
  }
  const hit = BODY_SCHOOLS_BY_MESSAGE.find(([needle]) => message.includes(needle));
  return hit ? t(hit[1]) : apiErrorMessage(err, t);
}

/** Whether the School on screen is out of date: changed meanwhile or gone. Read the list again. */
export function isStaleBodySchool(err) {
  const message = String(err?.message ?? '');
  return ['This school changed meanwhile', 'School not found'].some((needle) => message.includes(needle));
}

/**
 * Whether a fix was refused because the School has had a Principal (backend 9697362).
 * The list says `hadPrincipal` since f669e3e; this still catches one gained meanwhile.
 */
export const isHadPrincipal = (err) => String(err?.message ?? '').includes('has had a Principal');

/*
  Asking to be a Governing Body's admin through its code (backend 3d7d05a): the
  lookup, the application and taking it back, by their sentences. The limiter's
  429 says "Too many incorrect codes" since this commit (one budget with the School
  Code's). The student's sentence differs between the lookup and the application;
  both start the same.
*/
const BODY_APPLICATION_BY_MESSAGE = [
  ['No governing body uses that code', 'gbapp.error.unknown'],
  ['A student belongs to one school only', 'gbapp.error.student'],
  ['You already have an admin application waiting', 'gbapp.error.waiting'],
  ['You are already an admin of this governing body', 'gbapp.error.already'],
  ['Too many rejected admin applications', 'gbapp.error.tooManyRejected'],
  ['Too many incorrect codes', 'gbapp.error.tooManyCodes'],
  ['No admin application of yours is waiting', 'gbapp.error.decided'],
  ['has already been decided', 'gbapp.error.decided'],
];

export function bodyApplicationErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = BODY_APPLICATION_BY_MESSAGE.find(([needle]) => message.includes(needle));
  return hit ? t(hit[1]) : apiErrorMessage(err, t);
}

/*
  Applying to be a Governing Body School's Principal (backend e206bd9,
  governingBody.principals.js submitApplication / cancelApplication): every refusal a
  CONFLICT or NOT_FOUND told apart by its sentence. "This school has a Principal" is
  the one an applicant meets; the automatic rejection's "The school has a Principal
  now" is a reason, never an error. The lookup before it keeps joinErrorMessage.
*/
const PRINCIPAL_APPLICATION_BY_MESSAGE = [
  ['No school uses that code', 'pa.error.unknown'],
  ['Only a school run by a governing body', 'pa.error.notGoverned'],
  ['This school has a Principal', 'pa.error.hasPrincipal'],
  ['You already belong to this school, or have asked to join it', 'pa.error.memberHere'],
  ['join request waiting for approval at this school', 'join.conflict.pendingHere'],
  ['already belong to this school', 'join.conflict.memberHere'],
  ['A student belongs to one school only', 'pa.error.student'],
  ['You already have a Principal application waiting', 'pa.error.waiting'],
  ['Too many rejected Principal applications', 'pa.error.tooManyRejected'],
  ['Too many incorrect codes', 'gbapp.error.tooManyCodes'],
  ['No Principal application of yours is waiting', 'pa.error.decided'],
  ['has already been decided', 'pa.error.decided'],
];

export function principalApplicationErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = PRINCIPAL_APPLICATION_BY_MESSAGE.find(([needle]) => message.includes(needle));
  return hit ? t(hit[1]) : apiErrorMessage(err, t);
}

/*
  A Governing Body's admins deciding a Principal application (backend e206bd9,
  governingBody.principals.js approveAs / rejectAs): decided elsewhere, gone, or the
  School headed meanwhile mean the list is out of date (`isStalePrincipalDecision`:
  a toast and a fresh read); the applicant's own standing is said in the dialog.
*/
const PRINCIPAL_DECISION_BY_MESSAGE = [
  ['has already been decided', 'gbpa.error.decided'],
  ['Principal application not found', 'gbpa.error.decided'],
  ['The school has a Principal now', 'gbpa.error.hasPrincipal'],
  ['The applicant account no longer exists', 'gbpa.error.applicantGone'],
  ['The applicant joined this school meanwhile', 'gbpa.error.joined'],
  ['is a student at', 'gbpa.error.student'],
  ['A rejection reason is required', 'gba.error.reason'],
];

export function principalDecisionErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = PRINCIPAL_DECISION_BY_MESSAGE.find(([needle]) => message.includes(needle));
  return hit ? t(hit[1]) : governingBodySeatErrorMessage(err, t);
}

/** Whether a decision found the list out of date: read it again. */
export const isStalePrincipalDecision = (err) =>
  ['has already been decided', 'Principal application not found', 'The school has a Principal now', 'School not found'].some((needle) => String(err?.message ?? '').includes(needle));

/*
  A Governing Body's powers over its Schools (backend 261a9c7 / fdf0267,
  governingBody.powers.js and the cores it shares): the School headed or emptied, off or
  on, or gone meanwhile reads the School again (`isStaleSchoolPower`); the Platform
  Admin's deactivation is its own sentence (`isPlatformBrake`), which hides the way back.
*/
const SCHOOL_POWER_BY_MESSAGE = [
  ['only the Platform Admin reactivates it', 'gbpw.error.brake'],
  ['deactivated by the Platform Admin, meanwhile', 'gbpw.error.changed'],
  ['No active teacher of this school has that id', 'gbpw.error.notTeacher'],
  ['This school has no Principal', 'gbpw.error.noPrincipal'],
  ['A school is released only while it has a Principal', 'gbpw.error.releaseNeedsPrincipal'],
  ['This school has left this governing body meanwhile', 'gbpw.error.gone'],
  ['This school is already deactivated', 'gbpw.error.alreadyOff'],
  ['This school is not deactivated', 'gbpw.error.notOff'],
  ['School not found', 'gbpw.error.gone'],
  ['Give the reason', 'gba.error.reason'],
];

export function schoolPowerErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = SCHOOL_POWER_BY_MESSAGE.find(([needle]) => message.includes(needle));
  return hit ? t(hit[1]) : governingBodySeatErrorMessage(err, t);
}

/** Whether the Platform Admin switched the School off, so the body cannot switch it on. */
export const isPlatformBrake = (err) => String(err?.message ?? '').includes('only the Platform Admin reactivates it');

/**
 * Whether a reactivation was refused with the claim's sentence, which means either that
 * somebody switched the School on meanwhile or that the Platform Admin holds it off
 * (school.service.js restoreAccess; met for the second on 2026-10-26).
 */
export const isAmbiguousReactivation = (err) => String(err?.message ?? '').includes('deactivated by the Platform Admin, meanwhile');

/** Whether the School changed meanwhile: read it again. */
export const isStaleSchoolPower = (err) =>
  [
    'deactivated by the Platform Admin, meanwhile',
    'This school has no Principal',
    'A school is released only while it has a Principal',
    'This school has left this governing body meanwhile',
    'This school is already deactivated',
    'This school is not deactivated',
    'School not found',
    'No active teacher of this school has that id',
  ].some((needle) => String(err?.message ?? '').includes(needle));

/*
  Independent Schools asking to join the body (backend 261a9c7,
  governingBody.affiliations.js approveRequest / rejectRequest).
*/
const AFFILIATION_DECISION_BY_MESSAGE = [
  ['This request to join has already been decided', 'gbaf.error.decided'],
  ['Request to join not found', 'gbaf.error.decided'],
  ['This school has joined a governing body, or been deactivated, meanwhile', 'gbaf.error.taken'],
  ['A rejection reason is required', 'gba.error.reason'],
];

export function affiliationDecisionErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = AFFILIATION_DECISION_BY_MESSAGE.find(([needle]) => message.includes(needle));
  return hit ? t(hit[1]) : governingBodySeatErrorMessage(err, t);
}

/** Whether the request list is out of date: read it again. */
export const isStaleAffiliation = (err) =>
  ['This request to join has already been decided', 'Request to join not found', 'or been deactivated, meanwhile'].some((needle) => String(err?.message ?? '').includes(needle));

/*
  An independent School's Principal asking to join a Governing Body (backend 261a9c7,
  governingBody.affiliations.js requestAffiliation / cancelRequest), and the code's
  lookup before it. "already belongs" tells the card the School is a body's
  (`isAlreadyGoverned`), which /users/me does not say.
*/
const AFFILIATION_REQUEST_BY_MESSAGE = [
  ['No governing body uses that code', 'gbapp.error.unknown'],
  ['This school already belongs to a governing body', 'aff.error.governed'],
  ['already has a request to join a governing body waiting', 'aff.error.waiting'],
  ['Too many', 'aff.error.tooMany'],
  ['No request of this school to join a governing body is waiting', 'aff.error.decided'],
  ['This request to join has already been decided', 'aff.error.decided'],
  ['Only the Principal can do this', 'aff.error.notPrincipal'],
];

export function affiliationRequestErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  if (message.includes('Too many incorrect codes')) return t('gbapp.error.tooManyCodes');
  const hit = AFFILIATION_REQUEST_BY_MESSAGE.find(([needle]) => message.includes(needle));
  return hit ? t(hit[1]) : apiErrorMessage(err, t);
}

/** Whether the School turned out to be a Governing Body's already. */
export const isAlreadyGoverned = (err) => String(err?.message ?? '').includes('This school already belongs to a governing body');

/*
  The Platform Admin's powers over any School by its id (backend 38ec9ce / 657845a /
  fdf0267, school.service.js and governingBody.principals.js): a body still running
  appoints and decides itself; "already deactivated" on a body's School means the
  deactivation is the Platform Admin's already.
*/
const ADMIN_SCHOOL_BY_MESSAGE = [
  ['This school is already deactivated', 'adminSchools.error.alreadyOff'],
  ['This school is not deactivated', 'adminSchools.error.notOff'],
  ['Its governing body appoints its Principal', 'adminSchools.error.bodyAppoints'],
  ['Its governing body decides the applications', 'adminSchools.error.bodyDecides'],
  ['School not found', 'adminSchools.error.gone'],
  ['A reason is required', 'gba.error.reason'],
];

export function adminSchoolErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = ADMIN_SCHOOL_BY_MESSAGE.find(([needle]) => message.includes(needle));
  return hit ? t(hit[1]) : apiErrorMessage(err, t);
}

/** Whether a body School's applications are its body's to decide right now (the body runs). */
export const isBodyDecides = (err) => String(err?.message ?? '').includes('Its governing body decides the applications');

/** Whether the admins on screen are out of date: decided, gone or left elsewhere. Read them again. */
export function isStaleSeat(err) {
  const message = String(err?.message ?? '');
  return ['has already been decided', 'Admin application not found', 'Admin not found', 'This admin has already left', 'Only the senior admin can do this', 'This governing body has an admin'].some((needle) =>
    message.includes(needle)
  );
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
  /* The Student rule again at approval (membership.eligibility.js assertStudentAlone);
     the governing body's since backend 3d7d05a. The school is never named (ADR-0001). */
  ['is an admin of a governing body, or has asked to be one', 'requests.error.applicantSeat'],
  ['This applicant has applied to be the Principal of a school', 'requests.error.applicantApplication'],
  ['This applicant belongs to another school', 'requests.error.applicantElsewhere'],
  ['This applicant is a student at another school', 'requests.error.applicantStudentElsewhere'],
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
/* Backend 3a22f90: and only once every semester of it is CLOSED (the Principal closes it). */
const YEAR_SEMESTER_UNCLOSED = /Semester (\d+) of (\S+) is not closed yet/;
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
  const unclosed = YEAR_SEMESTER_UNCLOSED.exec(message);
  if (unclosed) return t('classes.error.yearSemesterUnclosed', { n: unclosed[1], label: unclosed[2] });
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
  ['cannot be a day already past', 'qbank.error.privatePast'],
  ['private for at most a year', 'qbank.error.privateFar'],
];

export function questionBankErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = QUESTION_BANK_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return apiErrorMessage(err, t);
}

/*
  Assessments - assessment.service.js (backend 0bb4598). Its CONFLICTs and
  BAD_REQUESTs told apart on their sentences, as the bank's are. A third item
  reads values out of the sentence for the words (backend 6380e3e names how
  many submissions a change would void).
*/
/*
  A finalised slot (backend eadf680, grading.lock.js assertNotFinalised) refuses every
  staff write on its assessments, its grade settings and its descriptions with one
  sentence: "MTK in XI IPS, Semester 1 is finalised; its teacher undoes the
  finalising to change it". Said the same way everywhere.
*/
const FINALISED = 'is finalised; its teacher undoes the finalising';

/** A refusal because the slot is finalised (ticket 04): undone by its teacher first. */
export const isFinalisedRefusal = (err) => String(err?.message ?? '').includes(FINALISED);

const ASSESSMENT_BY_MESSAGE = [
  [FINALISED, 'grading.finalised.refused'],
  /* A UTS or UAS outside an Exam Week (backend cbec3b6, assertInExamWeek). */
  ['Exam Week is set for grade', 'tasm.error.noExamWeek'],
  ['Exam Week of grade', 'tasm.error.outsideExamWeek'],
  /* LATIHAN, practice never graded (backend 026e4f9). */
  ['is a LATIHAN: it takes no make-up', 'tasm.error.practiceNoException'],
  ['is a LATIHAN: it is never released', 'tasm.error.practiceNoRelease'],
  ['is a LATIHAN: its answers take comments', 'tasm.error.practiceNoPoints'],
  ['A LATIHAN is answered online', 'tasm.error.practiceOffline'],
  ['Unlimited attempts are for a LATIHAN only', 'tasm.error.unlimitedPracticeOnly'],
  /* A remedial mark on an offline one (backend dfa2545), and a remedial's own window (52c31db). */
  ['enter remedial marks once it has closed', 'tasm.offline.error.remedialOpen'],
  ['Enter remedial marks only for students placed in', 'tasm.offline.error.remedialNotPlaced'],
  ['This remedial mark is released', 'tasm.offline.error.remedialReleased'],
  ['Remedial mark not found', 'tasm.offline.error.remedialGone'],
  ['A remedial needs its own window', 'tasm.exc.error.remedialWindow'],
  /* A student's exception (backend 1e6c749), first: some share words with the ones below. */
  ['set exceptions once it is published', 'tasm.exc.error.draft'],
  ['enter the make-up mark when there is one', 'tasm.exc.error.offline'],
  ['Set exceptions only for students placed in', 'tasm.exc.error.notPlaced'],
  ['A make-up window must close after now', 'tasm.exc.error.closesPast'],
  ['set a remedial once it has closed', 'tasm.exc.error.remedialOpen'],
  ['a remedial follows it', 'tasm.exc.error.remedialInProgress'],
  ['This exception was changed meanwhile', 'tasm.exc.error.meanwhile'],
  ['updatedAt you last read of this exception', 'tasm.exc.error.meanwhile'],
  ['An exception was set for this student meanwhile', 'tasm.exc.error.meanwhile'],
  ['has started an attempt under this exception', 'tasm.exc.error.inUse'],
  ['Exception not found', 'tasm.exc.error.gone'],
  ['A remedial gives its extra attempts alone', 'tasm.exc.error.remedialExtra'],
  ['Give a make-up window or extra attempts', 'tasm.exc.error.empty'],
  ['Extra attempts are 0 to 20', 'tasm.exc.error.extra'],
  ['The window must lie inside Semester', 'tasm.error.outsideSemester'],
  ['opensAt must come before closesAt', 'tasm.error.order'],
  ['its type is fixed', 'tasm.error.typeFixed'],
  ['An offline assessment has no settings', 'tasm.error.offlineSettings'],
  ['but not to before now', 'tasm.error.closedBeforeNow'],
  ['changed meanwhile', 'tasm.error.changedMeanwhile'],
  ['nothing in it changes', 'tasm.error.isCancelled'],
  ['it has no questions', 'tasm.error.offlineQuestions'],
  ['A question named is not in this assessment', 'tasm.error.changedMeanwhile'],
  ['A question is in this assessment already', 'tasm.error.twice'],
  ['Pick live questions from the bank', 'tasm.error.bankPick'],
  ['is published already', 'tasm.error.publishedAlready'],
  ['Add at least one question', 'tasm.error.needsQuestion'],
  ['delete it instead', 'tasm.error.isDraft'],
  ['is cancelled already', 'tasm.error.cancelledAlready'],
  ['a published assessment is never deleted', 'tasm.error.neverDeleted'],
  ['set new assessments on the class subject that took its place', 'tasm.error.ended'],
  ['is not open', 'tasm.error.semesterClosed'],
  ['Academic year', 'tasm.error.yearClosed'],
  ['Only the teacher of this class subject', 'tasm.error.notYours'],
  ['Assessment not found', 'tasm.error.gone'],
  ['Class subject not found', 'tasm.error.gone'],
  ['The text is empty', 'tasm.error.instructionsEmpty'],
  ['Give a reason', 'tasm.error.reasonEmpty'],
  ['Copy only to your own live class subjects', 'tasm.error.copyTargets'],
  ['is in that class already', 'tasm.error.copyOwnClass'],
  ['has submissions; its opensAt is fixed', 'tasm.error.opensFixed'],
  ['is released; its questions are locked', 'tasm.error.locked'],
  ['is released; give a reason', 'tasm.error.fixReason'],
  ['is a draft; it has nothing to mark', 'tasm.error.isDraftMark'],
  ['release it once it has closed', 'tasm.error.releaseOpen'],
  ['Enter marks only for students of', 'tasm.offline.error.notRoster'],
  ['Marks were entered meanwhile', 'tasm.offline.error.meanwhile'],
  ['its attempts are marked answer by answer', 'tasm.offline.error.online'],
  ['A released mark changes only with a reason', 'tasm.error.fixReason'],
  ['was cancelled meanwhile', 'tasm.error.isCancelled'],
  ['A question named was not answered', 'tasm.mark.error.unanswered'],
  ['its key marks it', 'tasm.mark.error.keyMarks'],
  ['was released with its mark', 'tasm.mark.error.keepEssay'],
  ['point(s)', 'tasm.mark.error.tooManyServer'],
  ['This attempt is still in progress', 'tasm.mark.readOnly.inProgress'],
  ['This attempt was voided', 'tasm.mark.error.voided'],
  ['A question named is not in this submission', 'tasm.error.changedMeanwhile'],
  ['Submission not found', 'tasm.mark.error.gone'],
  ['send a closesAt still ahead', 'tasm.error.voidsClosed', (message) => ({ n: message.match(/voids (\d+) submission/)?.[1] ?? '' })],
];

export function assessmentErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = ASSESSMENT_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1], hit[2]?.(message));
  return apiErrorMessage(err, t);
}

/*
  A student answering (backend 6380e3e): refusals of start, a save, a file and a
  hand-in, said in the student's words. Its own table, so a sentence shared with
  the staff's ("is not open") is not read as theirs.
*/
const STUDENT_ASSESSMENT_BY_MESSAGE = [
  ['You have an attempt in progress; continue it', 'sasm.error.inProgress'],
  ['An attempt was started meanwhile; continue it', 'sasm.error.inProgress'],
  ['is not open yet', 'sasm.error.notOpen'],
  ['You have used every attempt at', 'sasm.error.noAttempts'],
  ['has no questions', 'sasm.error.noQuestions'],
  ['is offline: the teacher enters its marks', 'sasm.error.offline'],
  ['Time is up: this attempt was closed', 'sasm.error.timeUp'],
  ['This attempt is handed in already', 'sasm.error.handedIn'],
  ['This attempt was closed meanwhile', 'sasm.error.timeUp'],
  ['This attempt was voided', 'sasm.error.voided'],
  ['You are no longer in', 'sasm.error.moved'],
  ['was cancelled', 'sasm.error.cancelled'],
  ['An option chosen does not belong', 'sasm.error.option'],
  ['Choose one option for this question', 'sasm.error.option'],
  ['A short answer is at most', 'sasm.error.shortLong'],
  ['An answer is at most 20,000 characters', 'sasm.error.essayLong'],
  ['The file file must be at most', 'sasm.error.fileSize'],
  ['The file file must be one of', 'sasm.error.fileType'],
  ['Submission not found', 'sasm.error.gone'],
  ['Assessment not found', 'sasm.error.gone'],
  ['Question not found', 'sasm.error.gone'],
];

export function studentAssessmentErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  if (/ is closed$/.test(message)) return t('sasm.error.closed');
  const hit = STUDENT_ASSESSMENT_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return apiErrorMessage(err, t);
}

/** A student's refusal that means the attempt is over or gone: read it again. */
export const isAttemptOver = (err) =>
  ['Time is up', 'handed in already', 'closed meanwhile', 'was voided', 'You are no longer in', 'was cancelled', 'Submission not found'].some((needle) =>
    String(err?.message ?? '').includes(needle)
  );

/** An exception's refusal that means the dialog is behind: read the results and the exception again. */
export const isStaleException = (err) =>
  [
    'changed meanwhile',
    'updatedAt you last read of this exception',
    'set for this student meanwhile',
    'has started an attempt under this exception',
    'Exception not found',
  ].some((needle) => String(err?.message ?? '').includes(needle));

/** A refusal that means the page is behind: read the assessment again. */
export const isStaleAssessment = (err) =>
  [
    'changed meanwhile',
    'nothing in it changes',
    'A question named is not in this assessment',
    'is published already',
    'delete it instead',
    'is cancelled already',
    'a published assessment is never deleted',
    'is released; its questions are locked',
  ].some((needle) => String(err?.message ?? '').includes(needle));

/*
  A copy edited in place (backend 6380e3e, `editQuestion`): the assessment's
  refusals, then the bank's content ones (an image not the caller's, an option id
  not the copy's). An empty body is the question's, not the instructions'.
*/
export function copyEditErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  if (message.includes('The text is empty')) return t('qbank.error.bodyEmpty');
  const hit = ASSESSMENT_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1], hit[2]?.(message));
  return questionBankErrorMessage(err, t);
}

/** A copy's refusal that means the page is behind: read the assessment again. */
export const isStaleCopy = (err) =>
  isStaleAssessment(err) ||
  ['An option id does not belong', 'Question not found', "A question's kind never changes"].some((needle) => String(err?.message ?? '').includes(needle));

/** A refusal that means the screen is behind: reload the question. */
export const isStaleQuestion = (err) =>
  ['changed meanwhile', 'An option id does not belong', 'archived already', 'is not archived', 'Question not found'].some((needle) =>
    String(err?.message ?? '').includes(needle)
  );

/*
  Grade settings (backend 5d42af6, grading.service.js): told apart on their
  sentences. A shape the browser let through (grading.schema.js) arrives as
  "Invalid request body" with the rule in `details`, read the same way.
*/
const GRADING_BY_MESSAGE = [
  [FINALISED, 'grading.finalised.refused'],
  ['The grade settings were changed meanwhile', 'grading.error.meanwhile'],
  ['updatedAt you last read of these grade settings', 'grading.error.meanwhile'],
  ['Only the teacher of this class subject sets its weights and KKTP', 'grading.error.notYours'],
  ['its grade settings stay as they are', 'grading.error.semesterClosed'],
  ['Only the Principal or a Vice Principal', 'grading.error.leadersOnly'],
  ['Class subject not found', 'grading.error.gone'],
  ['The four weights must add up to 100', 'grading.error.sum'],
  ['A weight is', 'grading.error.weight'],
  ['The KKTP is', 'grading.error.kktp'],
];

export function gradingErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  if (/^Academic year .+ is closed$/.test(message)) return t('grading.error.yearClosed');
  const said = [message, ...(Array.isArray(err?.details) ? err.details.map((issue) => String(issue?.message ?? '')) : [])];
  const hit = GRADING_BY_MESSAGE.find(([needle]) => said.some((text) => text.includes(needle)));
  if (hit) return t(hit[1]);
  return apiErrorMessage(err, t);
}

/** A grade-settings refusal that means the form is behind: read the settings again. */
export const isStaleGrading = (err) =>
  ['The grade settings were changed meanwhile', 'updatedAt you last read of these grade settings'].some((needle) =>
    String(err?.message ?? '').includes(needle)
  );

/** A refusal that means this slot's settings take no change any more (closed semester or year, not the reader's). */
export const isGradingLocked = (err) =>
  /^Academic year .+ is closed$/.test(String(err?.message ?? '')) ||
  [FINALISED, 'its grade settings stay as they are', 'Only the teacher of this class subject sets its weights and KKTP'].some((needle) =>
    String(err?.message ?? '').includes(needle)
  );

/*
  A slot's Descriptions (backend 483be5a, grading.texts.js writeDescriptions), told
  apart on their sentences. A stale row and a student the slot does not describe
  both name the students in `details.studentProfileIds`; the card names them.
*/
const DESCRIPTIONS_BY_MESSAGE = [
  ['changed meanwhile. Reload and try again', 'grading.desc.error.meanwhile'],
  ['writes its descriptions', 'grading.desc.error.notYours'],
  ['its descriptions stay as they are', 'grading.desc.error.semesterClosed'],
  ['does not describe', 'grading.desc.error.notDescribed'],
  ['Class subject not found', 'grading.error.gone'],
  [FINALISED, 'grading.finalised.refused'],
  ['At most 1,000 characters', 'grading.desc.error.tooLong'],
];

/** @param names  the students `details.studentProfileIds` names, already looked up, for {names} */
export function descriptionsErrorMessage(err, t, names = '') {
  const message = String(err?.message ?? '');
  if (/^Academic year .+ is closed$/.test(message)) return t('grading.desc.error.yearClosed');
  const said = [message, ...(Array.isArray(err?.details) ? err.details.map((issue) => String(issue?.message ?? '')) : [])];
  const hit = DESCRIPTIONS_BY_MESSAGE.find(([needle]) => said.some((text) => text.includes(needle)));
  if (hit) return t(hit[1], { names });
  return apiErrorMessage(err, t);
}

/** A Descriptions refusal that means a row is behind: read the grades again. */
export const isStaleDescriptions = (err) => String(err?.message ?? '').includes('changed meanwhile. Reload and try again');

/** A refusal that means this slot's Descriptions take no change any more (closed semester or year, not the reader's). */
export const isDescriptionsLocked = (err) =>
  /^Academic year .+ is closed$/.test(String(err?.message ?? '')) ||
  [FINALISED, 'its descriptions stay as they are', 'writes its descriptions'].some((needle) => String(err?.message ?? '').includes(needle));

/*
  Finalising (backend eadf680, grading.finalising.js), told apart on its sentences.
  Order matters: "is not being finalised yet" (finalising a slot too early) holds
  "is not being finalised" (stopping a semester that is not), so it comes first.
*/
const FINALISING_BY_MESSAGE = [
  ['cannot be finalised yet', 'grading.fin.error.blocked'],
  ['is not being finalised yet; the Principal starts it', 'grading.fin.error.notStarted'],
  ['is no longer being finalised', 'grading.fin.error.notStarted'],
  ['is finalised already', 'grading.fin.error.already'],
  ['are finalised; their teachers undo it first', 'grading.fin.error.stopBlocked'],
  /* Backend 46c6173: a semester closed once and reopened closes again; it never goes back to OPEN. */
  ['was closed and reopened', 'grading.fin.error.stopReopened'],
  ['is not finalised', 'grading.fin.error.notFinalised'],
  ['Only the teacher of this class subject', 'grading.fin.error.notYours'],
  ['Only the Principal', 'grading.fin.error.principalOnly'],
  ['is not being finalised', 'grading.fin.error.notFinalising'],
  ['is not open', 'grading.fin.error.notOpen'],
  ['its class subjects stay finalised', 'grading.fin.error.closed'],
  ['Semester not found', 'grading.fin.error.gone'],
  ['Class subject not found', 'grading.error.gone'],
];

export function finalisingErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  if (/^Academic year .+ is closed$/.test(message)) return t('grading.fin.error.yearClosed');
  if (/^Semester \d+ is closed$/.test(message)) return t('grading.fin.error.closed');
  const hit = FINALISING_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1], { n: err?.details?.finalised ?? '' });
  return apiErrorMessage(err, t);
}

/*
  Closing a semester (backend 3a22f90, grading.close.js closeSemester), told apart on
  its sentences like the rest. "cannot be closed yet" carries what stops it in
  `details` (notFinalised, blocked, notesMissing), said as counts; the board, read
  again, names them per class. Anything else falls to finalisingErrorMessage.
*/
const CLOSE_NOT_OVER = /runs until (\d{4}-\d{2}-\d{2}); it closes on its last day or after/;
const CLOSE_DATE_RANGE = /Date the Report Cards from (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/;
const CLOSE_BY_MESSAGE = [
  ['Only the Principal closes a semester', 'grading.fin.close.error.principalOnly'],
  ['is closed already', 'grading.fin.close.error.already'],
  ['changed while it was being closed', 'grading.fin.close.error.meanwhile'],
];

/**
 * @param parts       closeRefusalParts(details), for "cannot be closed yet"
 * @param formatDate  ('YYYY-MM-DD') => the day in the reader's words
 */
export function closeErrorMessage(err, t, parts = [], formatDate = (day) => day) {
  const message = String(err?.message ?? '');
  if (message.includes('cannot be closed yet')) {
    const said = parts.map((part) => t(part.key, part.vars)).join(', ');
    return t('grading.fin.close.error.blocked', { list: said || message });
  }
  const notOver = CLOSE_NOT_OVER.exec(message);
  if (notOver) return t('grading.fin.close.blocked.notOver', { date: formatDate(notOver[1]) });
  const range = CLOSE_DATE_RANGE.exec(message);
  if (range) return t('grading.fin.close.error.dateRange', { from: formatDate(range[1]), to: formatDate(range[2]) });
  const hit = CLOSE_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return finalisingErrorMessage(err, t);
}

/* Reading report cards (backend 3a22f90, grading.reportCards.js): every refusal is a 404. */
const REPORT_CARDS_BY_MESSAGE = [
  ['Report card not found', 'rc.error.notFound'],
  ['Class not found', 'rc.error.gone'],
  ['Semester not found', 'rc.error.gone'],
];

export function reportCardErrorMessage(err, t) {
  const message = String(err?.message ?? '');
  const hit = REPORT_CARDS_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return apiErrorMessage(err, t);
}

/*
  Reopening a closed semester (backend 46c6173, grading.reopen.js reopenSemester), on
  its sentences. A semester of a closed year falls to finalisingErrorMessage.
*/
const REOPEN_BY_MESSAGE = [
  ['Only the Principal reopens a semester', 'grading.fin.reopen.error.principalOnly'],
  ['is not closed', 'grading.fin.reopen.error.notClosed'],
  ['Not a class subject of', 'grading.fin.reopen.error.stranger'],
  ['Not finalised:', 'grading.fin.reopen.error.meanwhile'],
  ['changed meanwhile', 'grading.fin.reopen.error.meanwhile'],
  ['Give the reason for reopening', 'grading.fin.reopen.error.reasonRequired'],
];

export function reopenErrorMessage(err, t) {
  const said = [String(err?.message ?? ''), ...(Array.isArray(err?.details) ? err.details.map((issue) => String(issue?.message ?? '')) : [])];
  const hit = REOPEN_BY_MESSAGE.find(([needle]) => said.some((text) => text.includes(needle)));
  if (hit) return t(hit[1]);
  return finalisingErrorMessage(err, t);
}

/** A reopening refusal that means the board is behind: read it again. */
export const isStaleReopen = (err) =>
  ['is not closed', 'Not a class subject of', 'Not finalised:', 'changed meanwhile'].some((needle) => String(err?.message ?? '').includes(needle));

/** A closing refusal that means the board is behind: read it again. */
export const isStaleClose = (err) =>
  ['cannot be closed yet', 'changed while it was being closed', 'is closed already', 'is no longer being finalised', 'is not being finalised'].some((needle) =>
    String(err?.message ?? '').includes(needle)
  );

/** A finalising refusal that means the screen is behind (blockers, the slot or the semester changed): read it again. */
export const isStaleFinalising = (err) =>
  ['cannot be finalised yet', 'is finalised already', 'is not finalised', 'is not being finalised', 'is no longer being finalised', 'is not open'].some((needle) =>
    String(err?.message ?? '').includes(needle)
  );

/*
  A Class's Homeroom Notes (backend 483be5a, grading.texts.js readNotes/writeNotes),
  told apart on their sentences. A stale row and a student not placed there now
  name the students in `details.studentProfileIds`; the card names them.
*/
const NOTES_BY_MESSAGE = [
  ['changed meanwhile. Reload and try again', 'homeroom.notes.error.meanwhile'],
  ['writes its notes', 'homeroom.notes.error.notYours'],
  ['its notes stay as they are', 'homeroom.notes.error.semesterClosed'],
  ['Not placed in', 'homeroom.notes.error.notPlaced'],
  ['Class not found', 'homeroom.notes.error.gone'],
  ['Semester not found', 'homeroom.notes.error.gone'],
  ['At most 1,000 characters', 'homeroom.notes.error.tooLong'],
];

/*
  Backend 3a22f90: Notes are written only for students who get a report card, so one
  placed in the class after the semester ended is refused too, in the same 400 as one
  not placed there now; `details.joinedAfter` and `details.notPlaced` split the ids.
*/
const NO_REPORT_CARD = /No Report Card for Semester (\d+)/;

/**
 * @param names    the students `details.studentProfileIds` names, already looked up, for {names}
 * @param namesOf  (ids) => their names joined, for a refusal that splits them (joinedAfter / notPlaced)
 */
export function notesErrorMessage(err, t, names = '', namesOf = null) {
  const message = String(err?.message ?? '');
  const noCard = NO_REPORT_CARD.exec(message);
  if (noCard) {
    const joinedAfter = Array.isArray(err?.details?.joinedAfter) ? err.details.joinedAfter : [];
    const notPlaced = Array.isArray(err?.details?.notPlaced) ? err.details.notPlaced : [];
    const said = [t('homeroom.notes.error.joinedAfter', { n: noCard[1], names: namesOf ? namesOf(joinedAfter) : names })];
    if (notPlaced.length) said.push(t('homeroom.notes.error.notPlaced', { names: namesOf ? namesOf(notPlaced) : names }));
    return said.join(' ');
  }
  if (/^Academic year .+ is closed$/.test(message)) return t('homeroom.notes.error.yearClosed');
  const said = [message, ...(Array.isArray(err?.details) ? err.details.map((issue) => String(issue?.message ?? '')) : [])];
  const hit = NOTES_BY_MESSAGE.find(([needle]) => said.some((text) => text.includes(needle)));
  if (hit) return t(hit[1], { names });
  return apiErrorMessage(err, t);
}

/** A Notes refusal that means the list is behind: read it again (a stale row, a student moved out). */
export const isStaleNotes = (err) =>
  ['changed meanwhile. Reload and try again', 'Not placed in', 'No Report Card for Semester'].some((needle) => String(err?.message ?? '').includes(needle));

/** A refusal that means these Notes take no change any more (closed semester or year, not the reader's). */
export const isNotesLocked = (err) =>
  /^Academic year .+ is closed$/.test(String(err?.message ?? '')) ||
  ['its notes stay as they are', 'writes its notes'].some((needle) => String(err?.message ?? '').includes(needle));

/*
  The report card's letterhead (backend 4dae152, school.letterhead.js and the logo's
  upload), on its sentences. A deactivated school answers "School not found".
*/
const LETTERHEAD_BY_MESSAGE = [
  ['Only the Principal can do this', 'kop.error.principalOnly'],
  ['This PNG cannot be read', 'kop.error.pngBroken'],
  ['The logo may be at most', 'kop.error.logoPixels'],
  ['cannot be printed on the Report Card', 'kop.error.logoUnprintable'],
  ['The logo file must be at most', 'kop.error.logoBig'],
  ['The logo file must be one of', 'kop.error.logoType'],
  ['The school has no logo', 'kop.error.noLogo'],
  ['School not found', 'kop.error.gone'],
  ['At most 300 characters', 'kop.error.addressLong'],
  ['At most 30 characters', 'kop.error.phoneLong'],
];

export function letterheadErrorMessage(err, t) {
  const said = [String(err?.message ?? ''), ...(Array.isArray(err?.details) ? err.details.map((issue) => String(issue?.message ?? '')) : [])];
  const hit = LETTERHEAD_BY_MESSAGE.find(([needle]) => said.some((text) => text.includes(needle)));
  if (hit) return t(hit[1], { max: hit[0].includes('300') ? 300 : 30 });
  return apiErrorMessage(err, t);
}

/*
  A class's Promotion Outcomes (backend 4dae152, grading.promotion.js), on their
  sentences. A stale row names its students in the sentence itself ("The promotion of
  Ani, Budi changed meanwhile"); a 400 names them in `details.studentProfileIds`.
*/
const PROMOTIONS_BY_MESSAGE = [
  ['changed meanwhile. Reload and try again', 'homeroom.promo.error.meanwhile'],
  ['decides its promotions', 'homeroom.promo.error.notYours'],
  ['Promotion is decided at the end of the year', 'homeroom.promo.error.notEven'],
  ['is not being finalised yet', 'homeroom.promo.notYet.open'],
  ['reopen it to change a promotion', 'homeroom.promo.notYet.closed'],
  ['is finalised first; not yet:', 'homeroom.promo.error.waiting'],
  ['Not a student of', 'homeroom.promo.error.notPlaced'],
  ['a promotion is', 'homeroom.promo.error.refused'],
  ['Class not found', 'homeroom.notes.error.gone'],
  ['Semester not found', 'homeroom.notes.error.gone'],
];

/**
 * @param namesOf (ids) => "Ani, Budi" - for the students a 400 names by id
 */
export function promotionsErrorMessage(err, t, namesOf = () => '') {
  const message = String(err?.message ?? '');
  if (/^Academic year .+ is closed$/.test(message)) return t('homeroom.promo.error.yearClosed');
  const stale = /^The promotion of (.+) changed meanwhile/.exec(message);
  const ids = Array.isArray(err?.details?.studentProfileIds) ? err.details.studentProfileIds : [];
  const names = stale ? stale[1] : namesOf(ids);
  const hit = PROMOTIONS_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1], { names });
  return apiErrorMessage(err, t);
}

/** A promotions refusal that means the card is behind: read it again (a stale row, a student moved, the state changed). */
export const isStalePromotions = (err) =>
  /^Academic year .+ is closed$/.test(String(err?.message ?? '')) ||
  ['changed meanwhile. Reload and try again', 'Not a student of', 'is not being finalised yet', 'reopen it to change a promotion', 'is finalised first; not yet:'].some((needle) =>
    String(err?.message ?? '').includes(needle)
  );

/** A refusal that means this reader may not change them at all. */
export const isPromotionsLocked = (err) => String(err?.message ?? '').includes('decides its promotions');

/*
  A student's check-in — attendance.service.js `checkIn` (backend deb95e8,
  87f2670; the window opens 30 minutes early since 0fb6cb9). Six CONFLICTs told apart on their sentences, as above. NOT_FOUND is a
  meeting of a Class the student is no longer in (moved since the card read).
  Every one of them means the card on screen is behind: it reads again.
*/
const CHECK_IN_BY_MESSAGE = [
  ['already checked in', 'checkin.error.already'],
  ['already confirmed this attendance', 'checkin.error.confirmed'],
  ['was cancelled', 'checkin.error.cancelled'],
  ['minutes before the session starts', 'checkin.error.notYet'],
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

/*
  Exam Weeks - holidays.examWeeks.js (backend cbec3b6, ticket 13). An overlap on a
  shared grade level names the week in the way, which is worth repeating with its
  days; the rest are told apart on their sentences. NOT_FOUND on a withdraw means
  it was withdrawn elsewhere (one answer for every miss).
*/
const EXAM_WEEK_OVERLAP = /overlaps (UTS|UAS) "(.*)" \((\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})\) on grade ([\d, ]+)/;
const EXAM_WEEK_OUTSIDE = /lies inside Semester (\d+): (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/;
const EXAM_WEEK_BY_MESSAGE = [
  ['set at the same moment', 'exam.error.atOnce'],
  ['Academic year', 'exam.error.yearClosed'],
  ['is closed', 'exam.error.semesterClosed'],
  ['has no grade', 'exam.error.gradeMissing'],
  ['No Exam Week of yours', 'exam.error.gone'],
];

export function examWeekErrorMessage(err, t, lang) {
  const message = err?.message ?? '';
  const overlap = EXAM_WEEK_OVERLAP.exec(message);
  if (overlap) {
    return t('exam.error.overlap', {
      type: overlap[1],
      name: overlap[2],
      start: formatDay(overlap[3], lang),
      end: formatDay(overlap[4], lang),
      grades: overlap[5],
    });
  }
  const outside = EXAM_WEEK_OUTSIDE.exec(message);
  if (outside) {
    return t('exam.error.outside', { start: formatDay(outside[2], lang), end: formatDay(outside[3], lang) });
  }
  const hit = EXAM_WEEK_BY_MESSAGE.find(([needle]) => message.includes(needle));
  if (hit) return t(hit[1]);
  return apiErrorMessage(err, t);
}
