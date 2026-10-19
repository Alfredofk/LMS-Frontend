/*
  A student's assessments (backend 113ae37, ticket 07; owner 2026-10-12). Pure:
  the screens are /assessment (views/Assessment/AssessmentPage, a card per
  subject that has any), a subject's "Penilaian" tab (SubjectAssessments) and the
  marker on "Kelas Saya"'s cards.

  GET /assessments/mine answers one semester - the one asked for, else the
  server's default - with the semesters to choose from, and the classes the
  student sat in during it, the one they sit in now first. Each entry carries the
  assessment on the student's own terms (a make-up's window, if any), where they
  stand (`status`), the counted score once released, and what they may still do
  (`inProgressId`, `canStart`).

  Within a class the entries fall in three sections (owner, 2026-10-12):
  - TODO: an attempt running, or one the server lets them start that they have
    not handed in yet - never begun, voided, or late but still taken.
  - UPCOMING: not open yet on their own window; an OFFLINE one until its window
    closes, since nothing is done for it in the app - unless its marks are
    released early, which shows the score.
  - DONE: the rest - released, waiting for release, did not submit, cancelled -
    newest closed first. One handed in that may still be tried again stays here,
    with "Bisa dicoba lagi".

  A LATIHAN (backend 026e4f9, owner 2026-10-18) sits among them with its own
  statuses - NOT_STARTED, IN_PROGRESS, DONE (handed in at least once) - and shows
  its best attempt in place of a score (owner 2026-10-19: the best alone). It is
  never on the "Nilai" tab and never counted as handed in on the dashboard.
*/

export const MENU_SECTIONS = ['TODO', 'UPCOMING', 'DONE'];

/** The statuses that mean nothing handed in stands: what makes a startable one "to do". */
const UNANSWERED = new Set(['NOT_STARTED', 'VOIDED', 'DID_NOT_SUBMIT']);

/** Which section an entry of the menu falls in: TODO, UPCOMING or DONE. */
export function sectionOf(entry, now = new Date()) {
  const { assessment } = entry;
  if (assessment.status === 'CANCELLED') return 'DONE';
  if (entry.inProgressId) return 'TODO';
  if (entry.canStart && UNANSWERED.has(entry.status)) return 'TODO';
  // An OFFLINE one's marks may be released before its window ends: its score is shown.
  if (assessment.mode === 'OFFLINE') return entry.status !== 'RELEASED' && now < new Date(assessment.closesAt) ? 'UPCOMING' : 'DONE';
  if (now < new Date(assessment.opensAt)) return 'UPCOMING';
  return 'DONE';
}

/**
 * The word at the row's end, a key under `smenu.status.`, or null when the
 * score says it (RELEASED) or the section's heading already does (UPCOMING).
 */
export function wordOf(entry, now = new Date()) {
  const section = sectionOf(entry, now);
  if (entry.assessment.status === 'CANCELLED') return 'CANCELLED';
  if (section === 'TODO') {
    if (entry.inProgressId) return 'IN_PROGRESS';
    if (entry.status === 'VOIDED') return 'VOIDED';
    if (now >= new Date(entry.assessment.closesAt)) return 'LATE';
    return 'NOT_STARTED';
  }
  if (section === 'UPCOMING') return null;
  if (entry.status === 'RELEASED') return null;
  // A LATIHAN done: its best attempt says it, or "Sudah dikerjakan" when it has no total (essays alone).
  if (entry.status === 'DONE') return practiceBestOf(entry) !== null ? null : 'DONE';
  return entry.status;
}

/** Whether a handed-in one may be tried again: shown as "Bisa dicoba lagi" under DONE. */
export const canRetry = (entry, now = new Date()) => sectionOf(entry, now) === 'DONE' && entry.canStart === true;

/**
 * The time the row says, `{ key, vars? }` under `smenu.when.`: when it closes while
 * open, when it opens before, when it closed after. `instant` is the ISO time the
 * caller formats.
 */
export function whenOf(entry, now = new Date()) {
  const { assessment } = entry;
  if (now < new Date(assessment.opensAt)) return { key: 'opens', instant: assessment.opensAt };
  if (now < new Date(assessment.closesAt)) return { key: 'closes', instant: assessment.closesAt };
  return { key: 'closed', instant: assessment.closesAt };
}

const time = (instant) => new Date(instant).getTime();

const ORDER = {
  // Soonest deadline first.
  TODO: (a, b) => time(a.assessment.closesAt) - time(b.assessment.closesAt),
  // Soonest to open first.
  UPCOMING: (a, b) => time(a.assessment.opensAt) - time(b.assessment.opensAt),
  // Newest closed first.
  DONE: (a, b) => time(b.assessment.closesAt) - time(a.assessment.closesAt),
};

/** A class's entries as `[{ key, entries }]` in MENU_SECTIONS' order, empty sections left out. */
export function sectionsOf(entries, now = new Date()) {
  const bySection = new Map(MENU_SECTIONS.map((key) => [key, []]));
  for (const entry of entries ?? []) bySection.get(sectionOf(entry, now)).push(entry);
  return MENU_SECTIONS.map((key) => ({ key, entries: [...bySection.get(key)].sort(ORDER[key]) })).filter(
    (section) => section.entries.length > 0
  );
}

/**
 * The menu's assessments by class subject, the order the server sent the classes
 * in (the current one first), subjects by name within a class:
 * `[{ classSubject, class: { id, name, current }, entries }]`.
 */
export function byClassSubject(classes) {
  const out = [];
  for (const row of classes ?? []) {
    const groups = new Map();
    for (const entry of row.assessments ?? []) {
      const { classSubject } = entry.assessment;
      if (!groups.has(classSubject.id)) {
        groups.set(classSubject.id, { classSubject, class: { id: row.id, name: row.name, current: row.current }, entries: [] });
      }
      groups.get(classSubject.id).entries.push(entry);
    }
    out.push(...[...groups.values()].sort((a, b) => a.classSubject.subject.name.localeCompare(b.classSubject.subject.name)));
  }
  return out;
}

/** One class subject's entries in the menu, or [] when it has none. */
export const entriesOf = (classes, classSubjectId) =>
  byClassSubject(classes).find((group) => group.classSubject.id === classSubjectId)?.entries ?? [];

/**
 * What a subject's card says (owner, 2026-10-12): the line that matters most -
 * `lead` `{ key: 'TODO' | 'UPCOMING', n, when }` with the soonest's time (whenOf),
 * or `{ key: 'ALL_DONE' }` - then the total and the other sections that hold any,
 * `rest` `[{ key, n }]`.
 */
export function cardOf(entries, now = new Date()) {
  const sections = sectionsOf(entries, now);
  const count = (key) => sections.find((section) => section.key === key)?.entries.length ?? 0;
  const leadKey = ['TODO', 'UPCOMING'].find((key) => count(key) > 0) ?? null;
  const lead = leadKey
    ? { key: leadKey, n: count(leadKey), when: whenOf(sections.find((section) => section.key === leadKey).entries[0], now) }
    : { key: 'ALL_DONE' };
  const rest = leadKey ? MENU_SECTIONS.filter((key) => key !== leadKey && count(key) > 0).map((key) => ({ key, n: count(key) })) : [];
  return { total: (entries ?? []).length, lead, rest };
}

/** How many of a class subject's entries wait to be done: "Kelas Saya"'s marker. */
export const todoCount = (classes, classSubjectId, now = new Date()) =>
  entriesOf(classes, classSubjectId).filter((entry) => sectionOf(entry, now) === 'TODO').length;

/** Every entry of the menu, whichever class it sits under. */
const allEntries = (classes) => (classes ?? []).flatMap((row) => row.assessments ?? []);

/** What waits to be done across every subject, soonest deadline first: the dashboard's widget. */
export const todoAcross = (classes, now = new Date()) =>
  allEntries(classes)
    .filter((entry) => sectionOf(entry, now) === 'TODO')
    .sort(ORDER.TODO);

/** The next one to open across every subject, or null: said under an empty widget. */
export const nextUpcoming = (classes, now = new Date()) =>
  allEntries(classes)
    .filter((entry) => sectionOf(entry, now) === 'UPCOMING')
    .sort(ORDER.UPCOMING)[0] ?? null;

/*
  What a subject's "Nilai" tab lists (owner, 2026-10-12; a tab of the subject's
  page since 2026-10-14): what is marked or can no longer be answered - a released
  score, one waiting for release, did not submit. Not what is still to come or
  running, and not a cancelled one: those have, or will have, no score, and the
  subject's "Penilaian" tab shows them.
*/
const SCORED = new Set(['RELEASED', 'WAITING_FOR_RELEASE', 'DID_NOT_SUBMIT']);

/** One class subject's scored entries, latest closed first - [] when none is scored yet. */
export const scoredEntriesOf = (classes, classSubjectId) =>
  entriesOf(classes, classSubjectId)
    .filter((entry) => SCORED.has(entry.status))
    .sort(ORDER.DONE);

/*
  The score a remedial counts for (backend 79b319f, owner 2026-10-18): where the
  school's Remedial Rule moves the score that counts - a remedial 95 capped at the
  KKTP of 70 - the menu and the outline carry `afterRule: { score, rule }` beside
  the raw score, which stays. Shown under it ("dihitung 70"); null when the rule
  moved nothing, or there is no released score to sit under.
*/

/*
  The KKTP a score is counted with (backend 3814cf9, owner 2026-10-19): every graded
  entry of the menu and the outline carries `kktp`, the reporting slot's - null on a
  LATIHAN, or where none is known. A released score under it is red, as on the
  teacher's gradebook; the raw score that counts is what is compared.
*/

/** Whether a released score that counts sits under the KKTP. Works on a menu entry and on the outline. */
export function belowKktpOf(entry) {
  if (typeof entry?.kktp !== 'number' || typeof entry.score !== 'number') return false;
  if (entry.status !== undefined && entry.status !== 'RELEASED') return false;
  return entry.score < entry.kktp;
}

/** A LATIHAN's best attempt's value (backend 026e4f9), or null: what its row shows in place of a score. */
export const practiceBestOf = (entry) => (entry?.assessment?.type === 'LATIHAN' ? (entry.practice?.best?.value ?? null) : null);

/** `{ score, rule }` when the rule moves a released score, else null. Works on a menu entry and on the outline. */
export function afterRuleOf(entry) {
  const after = entry?.afterRule;
  if (!after || typeof after.score !== 'number' || entry.score === null || entry.score === undefined) return null;
  if (entry.status !== undefined && entry.status !== 'RELEASED') return null;
  return { score: after.score, rule: after.rule ?? null };
}

/*
  The student dashboard's "Penilaian dikumpulkan" (owner, 2026-10-14): of the
  semester's ONLINE assessments whose outcome is known, how many were handed in -
  marked or waiting for release - against "did not submit". An OFFLINE one is a
  paper the teacher marks, not handed in here; a cancelled, voided, running or
  still-to-do one says nothing yet. A LATIHAN (status DONE) is never counted.
*/
const HANDED_IN = new Set(['RELEASED', 'WAITING_FOR_RELEASE']);

/** `{ handedIn, total, rate }` over every class of the menu; rate null when total is 0. */
export function handedInOf(classes) {
  const known = allEntries(classes).filter(
    (entry) => entry.assessment?.mode === 'ONLINE' && (HANDED_IN.has(entry.status) || entry.status === 'DID_NOT_SUBMIT')
  );
  const handedIn = known.filter((entry) => HANDED_IN.has(entry.status)).length;
  return { handedIn, total: known.length, rate: known.length ? Math.round((handedIn / known.length) * 100) : null };
}

/*
  "Dikumpulkan tepat waktu" under it (backend 3814cf9, owner 2026-10-19): each entry
  carries `late` - its first attempt handed in, void and remedial ones left out,
  late counted from the student's own closesAt (a make-up's if any) - and null with
  none handed in or on an OFFLINE one. Of the graded ones handed in, how many were
  on time. A LATIHAN is left out, as above.
*/

/** `{ onTime, total, rate }` over every class of the menu; rate null when total is 0. */
export function onTimeOf(classes) {
  const known = allEntries(classes).filter(
    (entry) => entry.assessment?.type !== 'LATIHAN' && entry.assessment?.status !== 'CANCELLED' && typeof entry.late === 'boolean'
  );
  const onTime = known.filter((entry) => entry.late === false).length;
  return { onTime, total: known.length, rate: known.length ? Math.round((onTime / known.length) * 100) : null };
}

/** Where a row leads: straight into the attempt running, else the outline. */
export const pathOf = (entry) =>
  entry.inProgressId ? `/assessment/${entry.assessment.id}/percobaan/${entry.inProgressId}` : `/assessment/${entry.assessment.id}`;
