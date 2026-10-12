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
  What the "Nilai" page lists (owner, 2026-10-12): what is marked or can no longer
  be answered - a released score, one waiting for release, did not submit. Not
  what is still to come or running, and not a cancelled one: those have, or will
  have, no score, and the subject's "Penilaian" tab shows them.
*/
const SCORED = new Set(['RELEASED', 'WAITING_FOR_RELEASE', 'DID_NOT_SUBMIT']);

/**
 * The "Nilai" page's cards: every class subject of the menu (byClassSubject's
 * order), each with its scored entries, latest closed first - empty when none is
 * scored yet, which the card says.
 */
export const scoreCardsOf = (classes) =>
  byClassSubject(classes).map((group) => ({
    ...group,
    entries: group.entries.filter((entry) => SCORED.has(entry.status)).sort(ORDER.DONE),
  }));

/** Where a row leads: straight into the attempt running, else the outline. */
export const pathOf = (entry) =>
  entry.inProgressId ? `/assessment/${entry.assessment.id}/percobaan/${entry.inProgressId}` : `/assessment/${entry.assessment.id}`;
