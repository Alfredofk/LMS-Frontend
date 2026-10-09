import { openYearLabels } from '../Schedule/teacherLessons.js';

/*
  The question bank (backend ed46340, assessment ticket 01; owner 2026-10-07) -
  what the screens decide, apart from their markup so it can be tested. The rules
  restate assessment.schema.js; the server still checks every one of them, plus
  what only it can (who teaches what now, whose images these are).
*/

export const KINDS = ['MCQ', 'TF', 'SHORT', 'ESSAY'];
export const MCQ_SCORINGS = ['SINGLE', 'ALL_OR_NOTHING', 'PARTIAL'];

export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
export const MAX_OPTION_TEXT = 500;
export const MAX_ACCEPTED = 20;
export const MAX_ACCEPTED_TEXT = 200;
export const MAX_BODY = 50_000;

/* QuestionImage: JPG or PNG, typed by its bytes on the server, at most 5 MB. */
export const IMAGE_TYPES = ['jpg', 'png'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * The Subject x grade level pairs a teacher writes for: their assignments taught
 * now - ACTIVE, not ended, in a year still open - as the server's taughtNowOf
 * decides. `rows` from `?mine=true`, `years` from GET /academics/academic-years
 * (without it, no year is left out). Sorted by subject code, then grade.
 *
 * @returns {{ key, subject: { id, code, name }, gradeLevel }[]}
 */
export function taughtPairs(rows, years = null) {
  const open = years ? openYearLabels(years) : null;
  const pairs = new Map();
  for (const row of rows ?? []) {
    if (row.status !== 'ACTIVE' || row.endedAt) continue;
    if (open && !open.has(row.semester?.academicYear)) continue;
    const gradeLevel = row.class?.gradeLevel;
    if (!row.subject?.id || !gradeLevel) continue;
    const key = pairKey(row.subject.id, gradeLevel);
    if (!pairs.has(key)) pairs.set(key, { key, subject: row.subject, gradeLevel });
  }
  return [...pairs.values()].sort(
    (a, b) => String(a.subject.code).localeCompare(String(b.subject.code)) || a.gradeLevel - b.gradeLevel
  );
}

export const pairKey = (subjectId, gradeLevel) => `${subjectId}:${gradeLevel}`;

/** The grade levels a question may be duplicated into: its subject's, among what the reader teaches now. */
export const duplicateGrades = (question, pairs) =>
  (pairs ?? [])
    .filter((pair) => pair.subject.id === question?.subject?.id)
    .map((pair) => pair.gradeLevel);

/* ------------------------------------------------------------------------ */
/* The draft the editor holds                                                */
/* ------------------------------------------------------------------------ */

let nextKey = 0;
/* A React key for an option row, stable while the teacher edits. */
const rowKey = () => `opt-${(nextKey += 1)}`;

export const blankOption = () => ({ key: rowKey(), id: null, text: '', imageId: null, correct: false });

/*
  Private questions (backend abbb3d5, owner 2026-10-07). Up to `privateUntil`,
  'YYYY-MM-DD', that day included, only the author and the leaders see one; then
  it opens by itself. The day is the school's own date, not past, and at most a
  year ahead (assessment.bank.js assertPrivateUntil); a duplicate keeps it.
*/

/** A year from a school day, as the server reckons it: 29 Feb gives 1 Mar. */
export function yearAhead(today) {
  const [year, month, date] = String(today).split('-').map(Number);
  return new Date(Date.UTC(year + 1, month - 1, date)).toISOString().slice(0, 10);
}

/** Whether a question is private on the school's day `today`. */
export const isPrivateOn = (question, today) => Boolean(question?.privateUntil) && question.privateUntil >= today;

/** A new question's draft; a pair chosen beforehand may be passed. */
export function emptyDraft(kind = 'MCQ', { subjectId = '', gradeLevel = '' } = {}) {
  return {
    subjectId,
    gradeLevel,
    isPrivate: false,
    privateUntil: '',
    kind,
    body: '',
    imageId: null,
    mcqScoring: 'SINGLE',
    options: [blankOption(), blankOption(), blankOption(), blankOption()],
    value: null,
    accepted: [''],
  };
}

/** The draft with another kind: the body, its image, the pair and its privacy stay, the rest starts afresh. */
export const withKind = (draft, kind) => ({
  ...emptyDraft(kind, { subjectId: draft.subjectId, gradeLevel: draft.gradeLevel }),
  isPrivate: draft.isPrivate,
  privateUntil: draft.privateUntil,
  body: draft.body,
  imageId: draft.imageId,
});

/**
 * A saved question as a draft, for editing. A privacy already over reads as
 * none: the box starts unticked, and saving sends null.
 */
export function draftFrom(question, today) {
  const isPrivate = isPrivateOn(question, today);
  return {
    ...emptyDraft(question.kind, { subjectId: question.subject?.id ?? '', gradeLevel: question.gradeLevel ?? '' }),
    isPrivate,
    privateUntil: isPrivate ? question.privateUntil : '',
    body: question.body ?? '',
    imageId: question.imageId ?? null,
    mcqScoring: question.mcqScoring ?? 'SINGLE',
    options:
      question.kind === 'MCQ'
        ? (question.options ?? []).map((option) => ({
            key: rowKey(),
            id: option.id,
            text: option.text ?? '',
            imageId: option.imageId ?? null,
            correct: Boolean(option.correct),
          }))
        : emptyDraft().options,
    value: question.kind === 'TF' ? Boolean(question.value) : null,
    accepted: question.kind === 'SHORT' && question.accepted?.length ? [...question.accepted] : [''],
  };
}

/** One option marked correct; SINGLE leaves only that one marked. */
export function markCorrect(draft, key, correct) {
  return {
    ...draft,
    options: draft.options.map((option) => {
      if (option.key === key) return { ...option, correct };
      return draft.mcqScoring === 'SINGLE' && correct ? { ...option, correct: false } : option;
    }),
  };
}

/** The option rows with one moved a step up (-1) or down (+1). */
export function moveOption(options, key, step) {
  const list = [...options];
  const from = list.findIndex((option) => option.key === key);
  const to = from + step;
  if (from < 0 || to < 0 || to >= list.length) return options;
  [list[from], list[to]] = [list[to], list[from]];
  return list;
}

/* ------------------------------------------------------------------------ */
/* Rules                                                                     */
/* ------------------------------------------------------------------------ */

/** The body's words, as the server's cleanText reads them: tags dropped. */
export const bodyText = (html) =>
  String(html ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * What is wrong with a draft, as dictionary keys (assessment.schema.js):
 * `{ pair?, privateUntil?, body?, options?, option: { [key]: key }?, value?, accepted? }`.
 * An empty object means it may be sent. `today` is the school's date, for the
 * privacy day.
 */
export function questionErrors(draft, { editing = false, today } = {}) {
  const errors = {};
  if (!editing && (!draft.subjectId || !draft.gradeLevel)) errors.pair = 'qbank.error.pair';

  if (draft.isPrivate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.privateUntil ?? '')) errors.privateUntil = 'qbank.error.privateDate';
    else if (today && draft.privateUntil < today) errors.privateUntil = 'qbank.error.privatePast';
    else if (today && draft.privateUntil > yearAhead(today)) errors.privateUntil = 'qbank.error.privateFar';
  }

  if (!bodyText(draft.body)) errors.body = 'qbank.error.bodyEmpty';
  else if (String(draft.body).length > MAX_BODY) errors.body = 'qbank.error.bodyLong';

  if (draft.kind === 'MCQ') {
    const options = draft.options ?? [];
    const option = {};
    for (const row of options) {
      const text = row.text.trim();
      if (!text && !row.imageId) option[row.key] = 'qbank.error.optionEmpty';
      else if (text.length > MAX_OPTION_TEXT) option[row.key] = 'qbank.error.optionLong';
    }
    if (Object.keys(option).length) errors.option = option;

    const correct = options.filter((row) => row.correct).length;
    if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) errors.options = 'qbank.error.optionCount';
    else if (correct === 0) errors.options = 'qbank.error.noCorrect';
    else if (draft.mcqScoring === 'SINGLE' && correct > 1) errors.options = 'qbank.error.singleOne';
  }

  if (draft.kind === 'TF' && typeof draft.value !== 'boolean') errors.value = 'qbank.error.tfPick';

  if (draft.kind === 'SHORT') {
    const accepted = acceptedOf(draft);
    if (accepted.length === 0) errors.accepted = 'qbank.error.acceptedNone';
    else if (accepted.length > MAX_ACCEPTED) errors.accepted = 'qbank.error.acceptedMany';
    else if (accepted.some((answer) => answer.length > MAX_ACCEPTED_TEXT)) errors.accepted = 'qbank.error.acceptedLong';
  }

  return errors;
}

/* The accepted answers typed, blank rows left out. */
const acceptedOf = (draft) => (draft.accepted ?? []).map((answer) => answer.trim()).filter(Boolean);

/**
 * The body the server takes - strict, so only what the kind holds. A new
 * question names its subject and grade level; an edit never does, and keeps each
 * option's id so its answer and image stay with it. Both name their privacy: a
 * day, or null for none.
 */
export function questionPayload(draft, { editing = false } = {}) {
  const payload = {
    kind: draft.kind,
    ...(editing ? {} : { subjectId: draft.subjectId, gradeLevel: Number(draft.gradeLevel) }),
    privateUntil: draft.isPrivate ? draft.privateUntil : null,
    body: draft.body,
    ...(draft.imageId ? { imageId: draft.imageId } : {}),
  };
  if (draft.kind === 'MCQ') {
    payload.mcqScoring = draft.mcqScoring;
    payload.options = draft.options.map((row) => {
      const text = row.text.trim();
      return {
        ...(row.id ? { id: row.id } : {}),
        ...(text ? { text } : {}),
        ...(row.imageId ? { imageId: row.imageId } : {}),
        correct: Boolean(row.correct),
      };
    });
  }
  if (draft.kind === 'TF') payload.value = draft.value;
  if (draft.kind === 'SHORT') payload.accepted = acceptedOf(draft);
  return payload;
}

/**
 * An assessment's copy edited in place (backend 6380e3e): the bank's whole
 * content of its kind, without `privateUntil` - a copy has no privacy, and the
 * body is strict. Points stay on the assessment's list.
 */
export function copyPayload(draft) {
  const { privateUntil: _privacy, ...content } = questionPayload(draft, { editing: true });
  return content;
}

/*
  What a draft would send, its subject and grade aside: the pair is a choice, not
  work, and a new question gets it picked for it when only one is taught.
*/
const contentOf = (draft, editing) => {
  const { subjectId: _subject, gradeLevel: _grade, ...rest } = questionPayload(draft, { editing });
  return JSON.stringify(rest);
};

/**
 * Whether the editor holds work a move away would lose (owner, 2026-10-08): an
 * edit that differs from the saved question (`saved`, its draftFrom), or a new
 * question that differs from a blank one of its kind - so changing the kind alone
 * is not work.
 */
export function draftChanged(draft, saved = null) {
  if (!draft) return false;
  if (saved) return contentOf(draft, true) !== contentOf(saved, true);
  return contentOf(draft, false) !== contentOf(emptyDraft(draft.kind), false);
}

/** A file picked for a question image: a key when it may not be sent, else null. */
export function imageFileError(file) {
  if (!file) return null;
  const ext = String(file.name ?? '').split('.').pop().toLowerCase();
  const typed = ['image/jpeg', 'image/png'].includes(file.type) || ['jpg', 'jpeg', 'png'].includes(ext);
  if (!typed) return 'qbank.error.imageType';
  if (file.size > MAX_IMAGE_BYTES) return 'qbank.error.imageSize';
  return null;
}

/* ------------------------------------------------------------------------ */
/* The list                                                                  */
/* ------------------------------------------------------------------------ */

/**
 * The questions shown, filtered in the browser as the Classes page does:
 * `{ subjectId, gradeLevel, kind, mine, query }`, each optional. The search
 * reads the body's words, the subject and the author.
 */
export function filterQuestions(questions, { subjectId = '', gradeLevel = '', kind = '', mine = false, query = '' } = {}) {
  const needle = String(query ?? '').trim().toLocaleLowerCase();
  return (questions ?? []).filter((question) => {
    if (subjectId && question.subject?.id !== subjectId) return false;
    if (gradeLevel && Number(question.gradeLevel) !== Number(gradeLevel)) return false;
    if (kind && question.kind !== kind) return false;
    if (mine && !question.mine) return false;
    if (!needle) return true;
    return [bodyText(question.body), question.subject?.code, question.subject?.name, question.author?.fullName].some((value) =>
      String(value ?? '').toLocaleLowerCase().includes(needle)
    );
  });
}

/** A calendar day 'YYYY-MM-DD' in the reader's language, read as the day it names: "15 Des 2026". */
export const formatSchoolDay = (day, lang) =>
  day ? new Date(`${day}T00:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '-';

/** A question's date, in the reader's language: "7 Okt 2026". */
export const formatQuestionDate = (value, lang) =>
  value ? new Date(value).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

/** The subjects and grade levels the filters offer: those the questions hold. */
export function filterChoices(questions) {
  const subjects = new Map();
  const grades = new Set();
  for (const question of questions ?? []) {
    if (question.subject?.id) subjects.set(question.subject.id, question.subject);
    if (question.gradeLevel) grades.add(question.gradeLevel);
  }
  return {
    subjects: [...subjects.values()].sort((a, b) => String(a.code).localeCompare(String(b.code))),
    grades: [...grades].sort((a, b) => a - b),
  };
}
