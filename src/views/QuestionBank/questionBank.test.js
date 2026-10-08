import { describe, expect, it } from 'vitest';

import {
  bodyText,
  draftChanged,
  draftFrom,
  duplicateGrades,
  emptyDraft,
  filterChoices,
  filterQuestions,
  imageFileError,
  isPrivateOn,
  markCorrect,
  moveOption,
  questionErrors,
  questionPayload,
  taughtPairs,
  withKind,
  yearAhead,
} from './questionBank.js';

/* Shapes from academics.service.js classSubjectView and assessment.bank.js questionView. */
const row = (id, code, grade, extra = {}) => ({
  id,
  status: 'ACTIVE',
  endedAt: null,
  class: { id: `c-${grade}`, name: `${grade} IPS`, gradeLevel: grade },
  subject: { id: `s-${code}`, code, name: code },
  semester: { id: 'sem', ordinal: 1, academicYear: '2026/2027' },
  ...extra,
});
const years = [
  { label: '2026/2027', status: 'ACTIVE' },
  { label: '2025/2026', status: 'CLOSED' },
];

const mcq = (scoring, marks, texts = ['A', 'B', 'C']) => ({
  ...emptyDraft('MCQ', { subjectId: 's-MTK', gradeLevel: 11 }),
  body: '<p>Berapa 1 + 1?</p>',
  mcqScoring: scoring,
  options: texts.map((text, i) => ({ key: `k${i}`, id: null, text, imageId: null, correct: marks.includes(i) })),
});

describe('taughtPairs - what a teacher writes for (assessment.bank.js taughtNowOf)', () => {
  it('keeps ACTIVE, not ended, in an open year, once per subject x grade, sorted', () => {
    const rows = [
      row('a', 'MTK', 11),
      row('b', 'MTK', 11),
      row('c', 'BIO', 10),
      row('d', 'FIS', 11, { status: 'PENDING' }),
      row('e', 'KIM', 11, { endedAt: '2026-10-01T00:00:00Z' }),
      row('f', 'EKO', 11, { semester: { id: 'old', ordinal: 1, academicYear: '2025/2026' } }),
    ];
    expect(taughtPairs(rows, years).map((p) => p.key)).toEqual(['s-BIO:10', 's-MTK:11']);
  });

  it('leaves no year out when the years could not be read', () => {
    const rows = [row('f', 'EKO', 11, { semester: { id: 'old', ordinal: 1, academicYear: '2025/2026' } })];
    expect(taughtPairs(rows, null).map((p) => p.key)).toEqual(['s-EKO:11']);
  });

  it('offers duplicating into the same subject at the grades taught', () => {
    const pairs = taughtPairs([row('a', 'MTK', 10), row('b', 'MTK', 11), row('c', 'BIO', 12)], years);
    expect(duplicateGrades({ subject: { id: 's-MTK' } }, pairs)).toEqual([10, 11]);
    expect(duplicateGrades({ subject: { id: 's-FIS' } }, pairs)).toEqual([]);
  });
});

describe('questionErrors - assessment.schema.js', () => {
  it('passes a well-formed question of each kind', () => {
    expect(questionErrors(mcq('SINGLE', [0]))).toEqual({});
    expect(questionErrors(mcq('PARTIAL', [0, 2]))).toEqual({});
    expect(questionErrors({ ...withKind(mcq('SINGLE', [0]), 'TF'), value: false })).toEqual({});
    expect(questionErrors({ ...withKind(mcq('SINGLE', [0]), 'SHORT'), accepted: ['2', ' dua '] })).toEqual({});
    expect(questionErrors(withKind(mcq('SINGLE', [0]), 'ESSAY'))).toEqual({});
  });

  it('asks for a subject and grade on a new question only', () => {
    const draft = { ...mcq('SINGLE', [0]), subjectId: '', gradeLevel: '' };
    expect(questionErrors(draft).pair).toBe('qbank.error.pair');
    expect(questionErrors(draft, { editing: true }).pair).toBeUndefined();
  });

  it('refuses a body with no words (cleanText), and one past 50,000', () => {
    expect(questionErrors({ ...mcq('SINGLE', [0]), body: '<p> &nbsp; </p><br>' }).body).toBe('qbank.error.bodyEmpty');
    expect(questionErrors({ ...mcq('SINGLE', [0]), body: `<p>${'a'.repeat(50_000)}</p>` }).body).toBe('qbank.error.bodyLong');
  });

  it('holds MCQ options to 2-6, each a text or an image, a text to 500', () => {
    expect(questionErrors(mcq('SINGLE', [0], ['A'])).options).toBe('qbank.error.optionCount');
    expect(questionErrors(mcq('SINGLE', [0], ['A', 'B', 'C', 'D', 'E', 'F', 'G'])).options).toBe('qbank.error.optionCount');
    expect(questionErrors(mcq('SINGLE', [0], ['A', 'B', 'C', 'D', 'E', 'F'])).options).toBeUndefined();
    expect(questionErrors(mcq('SINGLE', [0], ['A', '  '])).option).toEqual({ k1: 'qbank.error.optionEmpty' });
    const withImage = mcq('SINGLE', [0], ['A', '']);
    withImage.options[1].imageId = 'img1';
    expect(questionErrors(withImage)).toEqual({});
    expect(questionErrors(mcq('SINGLE', [0], ['A', 'b'.repeat(501)])).option).toEqual({ k1: 'qbank.error.optionLong' });
    expect(questionErrors(mcq('SINGLE', [0], ['A', 'b'.repeat(500)])).option).toBeUndefined();
  });

  it('counts the correct options by scoring: SINGLE exactly one, the others at least one', () => {
    expect(questionErrors(mcq('SINGLE', [])).options).toBe('qbank.error.noCorrect');
    expect(questionErrors(mcq('SINGLE', [0, 1])).options).toBe('qbank.error.singleOne');
    expect(questionErrors(mcq('ALL_OR_NOTHING', [])).options).toBe('qbank.error.noCorrect');
    expect(questionErrors(mcq('ALL_OR_NOTHING', [0, 1, 2])).options).toBeUndefined();
  });

  it('asks a TF for its answer', () => {
    expect(questionErrors(withKind(mcq('SINGLE', [0]), 'TF')).value).toBe('qbank.error.tfPick');
  });

  it('holds SHORT to 1-20 accepted answers of at most 200, blank rows ignored', () => {
    const short = (accepted) => ({ ...withKind(mcq('SINGLE', [0]), 'SHORT'), accepted });
    expect(questionErrors(short(['', '  '])).accepted).toBe('qbank.error.acceptedNone');
    expect(questionErrors(short(Array.from({ length: 21 }, (_, i) => `a${i}`))).accepted).toBe('qbank.error.acceptedMany');
    expect(questionErrors(short(Array.from({ length: 20 }, (_, i) => `a${i}`))).accepted).toBeUndefined();
    expect(questionErrors(short(['x'.repeat(201)])).accepted).toBe('qbank.error.acceptedLong');
    expect(questionErrors(short(['x'.repeat(200)])).accepted).toBeUndefined();
  });
});

describe('questionPayload - the strict body', () => {
  it('names subject and grade on a new question, never on an edit', () => {
    const draft = mcq('SINGLE', [1]);
    expect(questionPayload(draft)).toMatchObject({ kind: 'MCQ', subjectId: 's-MTK', gradeLevel: 11 });
    const edit = questionPayload(draft, { editing: true });
    expect('subjectId' in edit || 'gradeLevel' in edit).toBe(false);
  });

  it('keeps option ids, trims text, drops what is empty', () => {
    const draft = mcq('SINGLE', [0], [' A ', '']);
    draft.options[0].id = 'opt-1';
    draft.options[1].imageId = 'img1';
    expect(questionPayload(draft, { editing: true }).options).toEqual([
      { id: 'opt-1', text: 'A', correct: true },
      { imageId: 'img1', correct: false },
    ]);
  });

  it('carries only what each kind holds', () => {
    const base = mcq('SINGLE', [0]);
    expect(Object.keys(questionPayload({ ...withKind(base, 'TF'), value: true })).sort()).toEqual(['body', 'gradeLevel', 'kind', 'privateUntil', 'subjectId', 'value']);
    expect(questionPayload({ ...withKind(base, 'SHORT'), accepted: [' 2 ', '', 'dua'] }).accepted).toEqual(['2', 'dua']);
    expect(Object.keys(questionPayload(withKind(base, 'ESSAY'))).sort()).toEqual(['body', 'gradeLevel', 'kind', 'privateUntil', 'subjectId']);
    expect(questionPayload({ ...withKind(base, 'ESSAY'), imageId: 'img9' }).imageId).toBe('img9');
  });
});

describe('private questions - assessment.bank.js assertPrivateUntil (backend abbb3d5)', () => {
  const today = '2026-10-08';
  const privately = (privateUntil) => ({ ...mcq('SINGLE', [0]), isPrivate: true, privateUntil });

  it('a year ahead as the server reckons it, 29 February included', () => {
    expect(yearAhead('2026-10-08')).toBe('2027-10-08');
    expect(yearAhead('2028-02-29')).toBe('2029-03-01');
  });

  it('today up to a year ahead passes; past, beyond or no day is refused', () => {
    expect(questionErrors(privately('2026-10-08'), { today })).toEqual({});
    expect(questionErrors(privately('2027-10-08'), { today })).toEqual({});
    expect(questionErrors(privately('2026-10-07'), { today }).privateUntil).toBe('qbank.error.privatePast');
    expect(questionErrors(privately('2027-10-09'), { today }).privateUntil).toBe('qbank.error.privateFar');
    expect(questionErrors(privately(''), { today }).privateUntil).toBe('qbank.error.privateDate');
  });

  it('an unticked box sends null and ignores the day', () => {
    const draft = { ...privately('2020-01-01'), isPrivate: false };
    expect(questionErrors(draft, { today })).toEqual({});
    expect(questionPayload(draft).privateUntil).toBeNull();
    expect(questionPayload(privately('2026-12-15'), { editing: true }).privateUntil).toBe('2026-12-15');
  });

  it('private through its day, included; over the day after', () => {
    expect(isPrivateOn({ privateUntil: '2026-10-08' }, today)).toBe(true);
    expect(isPrivateOn({ privateUntil: '2026-10-07' }, today)).toBe(false);
    expect(isPrivateOn({ privateUntil: null }, today)).toBe(false);
  });

  it('a saved privacy comes back into the draft; one already over does not', () => {
    const saved = { kind: 'ESSAY', subject: { id: 's-MTK' }, gradeLevel: 11, body: '<p>x</p>' };
    expect(draftFrom({ ...saved, privateUntil: '2026-12-15' }, today)).toMatchObject({ isPrivate: true, privateUntil: '2026-12-15' });
    expect(draftFrom({ ...saved, privateUntil: '2026-10-01' }, today)).toMatchObject({ isPrivate: false, privateUntil: '' });
  });

  it('changing the kind keeps the privacy', () => {
    expect(withKind(privately('2026-12-15'), 'TF')).toMatchObject({ isPrivate: true, privateUntil: '2026-12-15' });
  });
});

describe('the draft', () => {
  const saved = {
    id: 'q1',
    subject: { id: 's-MTK', code: 'MTK', name: 'Matematika' },
    gradeLevel: 11,
    kind: 'MCQ',
    mcqScoring: 'PARTIAL',
    body: '<p>Soal</p>',
    imageId: null,
    options: [
      { id: 'o1', text: 'A', imageId: null, correct: true },
      { id: 'o2', text: null, imageId: 'img2', correct: false },
    ],
  };

  it('comes back from a saved question and goes out the same', () => {
    const draft = draftFrom(saved);
    expect(questionPayload(draft, { editing: true })).toEqual({
      kind: 'MCQ',
      privateUntil: null,
      body: '<p>Soal</p>',
      mcqScoring: 'PARTIAL',
      options: [
        { id: 'o1', text: 'A', correct: true },
        { id: 'o2', imageId: 'img2', correct: false },
      ],
    });
  });

  it('reads a TF false and a SHORT list back', () => {
    expect(draftFrom({ ...saved, kind: 'TF', value: false }).value).toBe(false);
    expect(draftFrom({ ...saved, kind: 'SHORT', accepted: ['2'] }).accepted).toEqual(['2']);
  });

  it('marks one correct under SINGLE, any number otherwise', () => {
    const single = mcq('SINGLE', [0]);
    expect(markCorrect(single, 'k2', true).options.map((o) => o.correct)).toEqual([false, false, true]);
    const partial = mcq('PARTIAL', [0]);
    expect(markCorrect(partial, 'k2', true).options.map((o) => o.correct)).toEqual([true, false, true]);
  });

  it('moves an option a step, never off the ends', () => {
    const options = mcq('SINGLE', [0]).options;
    expect(moveOption(options, 'k1', -1).map((o) => o.key)).toEqual(['k1', 'k0', 'k2']);
    expect(moveOption(options, 'k0', -1)).toBe(options);
    expect(moveOption(options, 'k2', 1)).toBe(options);
  });
});

describe('images', () => {
  it('takes a JPG or PNG up to 5 MB', () => {
    expect(imageFileError({ name: 'a.png', type: 'image/png', size: 5 * 1024 * 1024 })).toBeNull();
    expect(imageFileError({ name: 'a.jpeg', type: '', size: 10 })).toBeNull();
    expect(imageFileError({ name: 'a.gif', type: 'image/gif', size: 10 })).toBe('qbank.error.imageType');
    expect(imageFileError({ name: 'a.png', type: 'image/png', size: 5 * 1024 * 1024 + 1 })).toBe('qbank.error.imageSize');
  });
});

describe('the list', () => {
  const questions = [
    { id: '1', kind: 'MCQ', gradeLevel: 11, mine: true, body: '<p>Limit fungsi</p>', subject: { id: 's-MTK', code: 'MTK', name: 'Matematika' }, author: { fullName: 'Kevin' } },
    { id: '2', kind: 'ESSAY', gradeLevel: 10, mine: false, body: '<p>Sel hewan</p>', subject: { id: 's-BIO', code: 'BIO', name: 'Biologi' }, author: { fullName: 'Rina' } },
  ];

  it('filters by subject, grade, kind, own, and searches words, subject and author', () => {
    expect(filterQuestions(questions, { subjectId: 's-BIO' }).map((q) => q.id)).toEqual(['2']);
    expect(filterQuestions(questions, { gradeLevel: '11' }).map((q) => q.id)).toEqual(['1']);
    expect(filterQuestions(questions, { kind: 'ESSAY' }).map((q) => q.id)).toEqual(['2']);
    expect(filterQuestions(questions, { mine: true }).map((q) => q.id)).toEqual(['1']);
    expect(filterQuestions(questions, { query: 'limit' }).map((q) => q.id)).toEqual(['1']);
    expect(filterQuestions(questions, { query: 'rina' }).map((q) => q.id)).toEqual(['2']);
    expect(filterQuestions(questions, { query: 'p>' })).toEqual([]);
  });

  it('offers only the subjects and grades the bank holds', () => {
    const { subjects, grades } = filterChoices(questions);
    expect(subjects.map((s) => s.code)).toEqual(['BIO', 'MTK']);
    expect(grades).toEqual([10, 11]);
  });

  it('reads the body as words', () => {
    expect(bodyText('<h3>Judul</h3><p>satu&nbsp;dua</p>')).toBe('Judul satu dua');
  });
});

describe('draftChanged - what a move away would lose', () => {
  it('a blank new question, or one with only its pair or kind chosen, holds nothing', () => {
    expect(draftChanged(emptyDraft())).toBe(false);
    expect(draftChanged(emptyDraft('MCQ', { subjectId: 's-MTK', gradeLevel: 11 }))).toBe(false);
    expect(draftChanged(withKind(emptyDraft(), 'ESSAY'))).toBe(false);
    expect(draftChanged(null)).toBe(false);
  });

  it('a body, an option, an answer or privacy is work', () => {
    expect(draftChanged({ ...emptyDraft(), body: '<p>Soal</p>' })).toBe(true);
    const draft = emptyDraft();
    draft.options[0].text = 'A';
    expect(draftChanged(draft)).toBe(true);
    expect(draftChanged({ ...emptyDraft('TF'), value: true })).toBe(true);
    expect(draftChanged({ ...emptyDraft(), isPrivate: true, privateUntil: '2026-12-15' })).toBe(true);
  });

  it('an edit is measured against the saved question', () => {
    const saved = { kind: 'SHORT', subject: { id: 's-MTK' }, gradeLevel: 11, body: '<p>x</p>', accepted: ['5'] };
    const baseline = draftFrom(saved, '2026-10-08');
    expect(draftChanged(draftFrom(saved, '2026-10-08'), baseline)).toBe(false);
    expect(draftChanged({ ...baseline, accepted: ['5', 'lima'] }, baseline)).toBe(true);
  });
});
