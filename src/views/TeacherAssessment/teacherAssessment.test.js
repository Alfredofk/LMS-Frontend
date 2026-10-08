import { describe, expect, it } from 'vitest';

import {
  actionsOf,
  cancelReasonError,
  copyBody,
  copyTargets,
  createBody,
  dashboardAssessments,
  emptyForm,
  emptyWindow,
  formErrors,
  formFrom,
  heldBankIds,
  instantOf,
  moveRow,
  needsNewWindow,
  partsOf,
  patchBody,
  questionsBody,
  removeRow,
  rowErrors,
  rowsChanged,
  rowsFrom,
  semesterOf,
  semesterSpan,
  sourcesBySemester,
  stateOf,
  totalPoints,
  windowErrors,
  windowPhase,
  withBankVersion,
  withPicked,
} from './teacherAssessment.js';

/* Shapes from assessment.service.js assessmentView / detailOf and academics.service.js yearSelect. */
const semester = { id: 'sem1', ordinal: 1, startDate: '2026-07-13T00:00:00.000Z', endDate: '2026-12-19T00:00:00.000Z', status: 'OPEN' };
const years = [{ id: 'y1', label: '2026/2027', status: 'ACTIVE', semesters: [semester] }];
const span = semesterSpan(semester, 'WIB');

const saved = {
  id: 'a1',
  type: 'KUIS',
  mode: 'ONLINE',
  title: 'Kuis Bab 1',
  instructions: null,
  opensAt: '2026-10-12T00:00:00.000Z', // 07:00 WIB
  closesAt: '2026-10-12T02:00:00.000Z', // 09:00 WIB
  settings: { maxAttempts: 1, acceptLate: false, timeLimitMinutes: null, shuffleQuestions: false, shuffleOptions: false, showKeyOnRelease: false },
  status: 'DRAFT',
  questionCount: 2,
  totalPoints: 5,
  canManage: true,
  questions: [
    { id: 'c1', order: 1, points: 2, sourceQuestionId: 'b1', kind: 'TF', value: true, body: '<p>x</p>', bank: { changed: false, archived: false } },
    { id: 'c2', order: 2, points: 3, sourceQuestionId: 'b2', kind: 'ESSAY', body: '<p>y</p>', bank: { changed: true, archived: false } },
  ],
};

const filled = (over = {}) => ({ ...emptyForm(), title: 'Kuis', opensDate: '2026-10-12', opensTime: '07:00', closesDate: '2026-10-12', closesTime: '09:00', ...over });

describe('the window, in the school zone', () => {
  it('a day and a clock time go out with the zone offset', () => {
    expect(instantOf('2026-10-12', '07:00', 'WIB')).toBe('2026-10-12T07:00:00+07:00');
    expect(instantOf('2026-10-12', '07:00', 'WIT')).toBe('2026-10-12T07:00:00+09:00');
    expect(instantOf('2026-10-12', '07:00', null)).toBe('2026-10-12T07:00:00+00:00');
    expect(instantOf('2026-10-12', '24:00', 'WIB')).toBeNull();
    expect(instantOf('', '07:00', 'WIB')).toBeNull();
  });

  it('and come back as the same day and time', () => {
    expect(partsOf('2026-10-12T00:00:00.000Z', 'WIB')).toEqual({ date: '2026-10-12', time: '07:00' });
    expect(partsOf('2026-10-11T17:30:00.000Z', 'WITA')).toEqual({ date: '2026-10-12', time: '01:30' });
  });

  it('the semester runs from 00:00 of its first day to 00:00 after its last (semesterSpan)', () => {
    expect(span.start.toISOString()).toBe('2026-07-12T17:00:00.000Z');
    expect(span.end.toISOString()).toBe('2026-12-19T17:00:00.000Z');
    expect(semesterOf(years, 'sem1')).toMatchObject({ id: 'sem1', academicYear: { label: '2026/2027', status: 'ACTIVE' } });
    expect(semesterOf(years, 'nope')).toBeNull();
  });
});

describe('formErrors - assessment.schema.js and assertWindow', () => {
  it('a filled form passes', () => {
    expect(formErrors(filled(), { zone: 'WIB', span })).toEqual({});
  });

  it('a title of 1 to 200', () => {
    expect(formErrors(filled({ title: '  ' }), { zone: 'WIB' }).title).toBe('tasm.error.titleEmpty');
    expect(formErrors(filled({ title: 'a'.repeat(201) }), { zone: 'WIB' }).title).toBe('tasm.error.titleLong');
    expect(formErrors(filled({ title: 'a'.repeat(200) }), { zone: 'WIB' }).title).toBeUndefined();
  });

  it('opening before closing, both inside the semester', () => {
    expect(formErrors(filled({ closesTime: '07:00' }), { zone: 'WIB', span }).closes).toBe('tasm.error.order');
    expect(formErrors(filled({ opensDate: '2026-07-12' }), { zone: 'WIB', span }).opens).toBe('tasm.error.outsideSemester');
    expect(formErrors(filled({ opensDate: '2026-07-13', opensTime: '00:00' }), { zone: 'WIB', span }).opens).toBeUndefined();
    expect(formErrors(filled({ closesDate: '2026-12-19', closesTime: '23:59' }), { zone: 'WIB', span }).closes).toBeUndefined();
    expect(formErrors(filled({ closesDate: '2026-12-20', closesTime: '00:01' }), { zone: 'WIB', span }).closes).toBe('tasm.error.outsideSemester');
    expect(formErrors(filled({ opensDate: '' }), { zone: 'WIB', span }).opens).toBe('tasm.error.when');
  });

  it('a published one closes no earlier than now when moved; left as it is, it passes', () => {
    const now = new Date('2026-10-12T03:00:00Z');
    const moved = formErrors(filled({ closesTime: '08:00' }), { zone: 'WIB', span, published: true, savedClosesAt: saved.closesAt, now });
    expect(moved.closes).toBe('tasm.error.closedBeforeNow');
    expect(formErrors(filled(), { zone: 'WIB', span, published: true, savedClosesAt: saved.closesAt, now })).toEqual({});
  });

  it('online settings: 1 to 20 attempts, a time limit of 1 to 600 or none', () => {
    expect(formErrors(filled({ maxAttempts: '0' }), { zone: 'WIB' }).maxAttempts).toBe('tasm.error.attempts');
    expect(formErrors(filled({ maxAttempts: '21' }), { zone: 'WIB' }).maxAttempts).toBe('tasm.error.attempts');
    expect(formErrors(filled({ maxAttempts: '20', timeLimit: '600' }), { zone: 'WIB' })).toEqual({});
    expect(formErrors(filled({ timeLimit: '601' }), { zone: 'WIB' }).timeLimit).toBe('tasm.error.timeLimit');
    expect(formErrors(filled({ timeLimit: '1.5' }), { zone: 'WIB' }).timeLimit).toBe('tasm.error.timeLimit');
    expect(formErrors(filled({ mode: 'OFFLINE', maxAttempts: '0' }), { zone: 'WIB' })).toEqual({});
  });
});

describe('the bodies sent', () => {
  it('POST: an OFFLINE one names no setting (the schema is strict)', () => {
    expect(Object.keys(createBody(filled({ mode: 'OFFLINE' }), 'WIB')).sort()).toEqual(['closesAt', 'mode', 'opensAt', 'title', 'type']);
    expect(createBody(filled({ timeLimit: '45' }), 'WIB')).toMatchObject({ mode: 'ONLINE', maxAttempts: 1, timeLimitMinutes: 45, opensAt: '2026-10-12T07:00:00+07:00' });
  });

  it('instructions with no words are left out', () => {
    expect('instructions' in createBody(filled({ instructions: '<p> </p>' }), 'WIB')).toBe(false);
    expect(createBody(filled({ instructions: '<p>Kerjakan</p>' }), 'WIB').instructions).toBe('<p>Kerjakan</p>');
  });

  it('PATCH: only what changed, never the mode', () => {
    const form = formFrom(saved, 'WIB');
    expect(patchBody(form, saved, 'WIB')).toEqual({});
    expect(patchBody({ ...form, title: ' Kuis Bab 1b ', closesTime: '10:00', timeLimit: '30' }, saved, 'WIB')).toEqual({
      title: 'Kuis Bab 1b',
      closesAt: '2026-10-12T10:00:00+07:00',
      timeLimitMinutes: 30,
    });
    expect(patchBody({ ...form, instructions: '<p></p>' }, { ...saved, instructions: '<p>a</p>' }, 'WIB')).toEqual({ instructions: null });
    const offline = { ...saved, mode: 'OFFLINE', settings: null };
    expect(patchBody({ ...formFrom(offline, 'WIB'), maxAttempts: '3' }, offline, 'WIB')).toEqual({});
  });
});

describe('the question list', () => {
  it('saved rows go back out by their ids, in order, with their points', () => {
    const rows = rowsFrom(saved);
    expect(questionsBody(rows)).toEqual([{ id: 'c1', points: 2 }, { id: 'c2', points: 3 }]);
    expect(rowsChanged(rows, saved.questions)).toBe(false);
    expect(totalPoints(rows)).toBe(5);
  });

  it('picked bank questions are new rows of 1 point, named by questionId', () => {
    const rows = withPicked(rowsFrom(saved), [{ id: 'b9', kind: 'TF' }]);
    expect(questionsBody(rows).at(-1)).toEqual({ questionId: 'b9', points: 1 });
    expect(rowsChanged(rows, saved.questions)).toBe(true);
    expect([...heldBankIds(rows)].sort()).toEqual(['b1', 'b2', 'b9']);
  });

  it('moving, removing and repointing count as changes', () => {
    const rows = rowsFrom(saved);
    expect(questionsBody(moveRow(rows, rows[1].key, -1)).map((q) => q.id)).toEqual(['c2', 'c1']);
    expect(moveRow(rows, rows[0].key, -1)).toBe(rows);
    expect(rowsChanged(moveRow(rows, rows[1].key, -1), saved.questions)).toBe(true);
    expect(rowsChanged(removeRow(rows, rows[0].key), saved.questions)).toBe(true);
    expect(rowsChanged(rows.map((row, i) => (i === 0 ? { ...row, points: '4' } : row)), saved.questions)).toBe(true);
  });

  it('the bank version takes the copy\'s place and points', () => {
    const rows = rowsFrom(saved);
    const swapped = withBankVersion(rows, rows[1].key, { id: 'b2', kind: 'ESSAY', body: '<p>new</p>' });
    expect(questionsBody(swapped)).toEqual([{ id: 'c1', points: 2 }, { questionId: 'b2', points: 3 }]);
    expect(swapped[1].bank).toBeNull();
  });

  it('points are whole, 1 to 100; at most 200 questions', () => {
    const rows = rowsFrom(saved);
    const bad = rows.map((row, i) => ({ ...row, points: ['0', '101'][i] }));
    expect(Object.keys(rowErrors(bad))).toHaveLength(2);
    expect(rowErrors(rows.map((row) => ({ ...row, points: '100' })))).toEqual({});
    expect(rowErrors(rows.map((row) => ({ ...row, points: '2.5' })))[rows[0].key]).toBe('tasm.error.points');
    expect(rowErrors(withPicked([], Array.from({ length: 201 }, (_, i) => ({ id: `b${i}` })))).list).toBe('tasm.error.tooMany');
  });
});

describe('actionsOf - what the server lets the teacher do', () => {
  it('a draft: edit, delete; publish once an online one has a question', () => {
    expect(actionsOf(saved)).toEqual({ edit: true, publish: true, remove: true, cancel: false });
    expect(actionsOf({ ...saved, questionCount: 0 }).publish).toBe(false);
    expect(actionsOf({ ...saved, mode: 'OFFLINE', questionCount: 0 }).publish).toBe(true);
  });

  it('published: edit and cancel, never delete; cancelled: nothing', () => {
    expect(actionsOf({ ...saved, status: 'PUBLISHED' })).toEqual({ edit: true, publish: false, remove: false, cancel: true });
    expect(actionsOf({ ...saved, status: 'CANCELLED' })).toEqual({ edit: false, publish: false, remove: false, cancel: false });
  });

  it('nothing for a reader, or in a closed year', () => {
    expect(actionsOf({ ...saved, canManage: false }).edit).toBe(false);
    expect(actionsOf(saved, { readOnly: true }).edit).toBe(false);
  });

  it('a cancellation needs a reason of 1 to 500 (cancelBody)', () => {
    expect(cancelReasonError('  ')).toEqual({ key: 'tasm.error.reasonEmpty' });
    expect(cancelReasonError('x')).toBeNull();
    expect(cancelReasonError('x'.repeat(501))).toEqual({ key: 'tasm.error.reasonLong' });
  });

  it('where the window stands', () => {
    expect(windowPhase(saved, new Date('2026-10-11T23:59:00Z'))).toBe('upcoming');
    expect(windowPhase(saved, new Date('2026-10-12T00:00:00Z'))).toBe('open');
    expect(windowPhase(saved, new Date('2026-10-12T02:00:00Z'))).toBe('closed');
  });
});

describe('copying - assessment.service.js copy / listCopySources', () => {
  const other = { id: 'sem2', ordinal: 2, startDate: '2027-01-04T00:00:00.000Z', endDate: '2027-06-19T00:00:00.000Z', status: 'OPEN' };
  const oldSem = { id: 'semOld', ordinal: 1, startDate: '2025-07-14T00:00:00.000Z', endDate: '2025-12-20T00:00:00.000Z', status: 'OPEN' };
  const allYears = [
    { id: 'y1', label: '2026/2027', status: 'ACTIVE', semesters: [semester, other] },
    { id: 'y0', label: '2025/2026', status: 'CLOSED', semesters: [oldSem] },
  ];
  const source = { classSubject: { id: 'cs-a', class: { id: 'XI-IPS', name: 'XI IPS', gradeLevel: 11 }, subject: { id: 's-MTK' }, semester: { id: 'sem1' } } };
  const row = (id, cls, sem, over = {}) => ({ id, status: 'ACTIVE', endedAt: null, class: { id: cls, name: cls, gradeLevel: 11 }, subject: { id: 's-MTK' }, semester: { id: sem }, ...over });

  it('targets: own live rows of the subject and grade, open semesters of an active year, not its own class', () => {
    const rows = [
      row('cs-a', 'XI-IPS', 'sem1'),
      row('cs-b', 'XI-IPA', 'sem1'),
      row('cs-c', 'XI-IPS', 'sem2'),
      row('cs-d', 'XI-IPB', 'sem1', { endedAt: 'x' }),
      row('cs-e', 'XI-IPC', 'sem1', { subject: { id: 's-FIS' } }),
      row('cs-f', 'X-IPA', 'sem1', { class: { id: 'X-IPA', name: 'X IPA', gradeLevel: 10 } }),
      row('cs-g', 'XI-IPD', 'semOld'),
      row('cs-h', 'XI-IPE', 'sem1', { status: 'PENDING' }),
    ];
    expect(copyTargets(rows, source, allYears).map((g) => [g.semester.id, g.rows.map((r) => r.id)])).toEqual([
      ['sem1', ['cs-b']],
      ['sem2', ['cs-c']],
    ]);
    expect(copyTargets(rows, source, allYears.map((y) => ({ ...y, semesters: y.semesters.map((s) => ({ ...s, status: 'CLOSED' })) })))).toEqual([]);
  });

  it('a new window is needed once a target lies in another semester', () => {
    expect(needsNewWindow(['sem1'], 'sem1')).toBe(false);
    expect(needsNewWindow(['sem1', 'sem2'], 'sem1')).toBe(true);
    expect(needsNewWindow([], 'sem1')).toBe(false);
  });

  it('the new window fits every target semester', () => {
    const spans = [semesterSpan(semester, 'WIB'), semesterSpan(other, 'WIB')];
    const w = (opensDate, closesDate) => ({ opensDate, opensTime: '07:00', closesDate, closesTime: '09:00' });
    expect(windowErrors(emptyWindow(), { zone: 'WIB', spans })).toEqual({ opens: 'tasm.error.when', closes: 'tasm.error.when' });
    expect(windowErrors(w('2026-10-20', '2026-10-20'), { zone: 'WIB', spans: [spans[0]] })).toEqual({});
    expect(windowErrors(w('2026-10-20', '2026-10-20'), { zone: 'WIB', spans }).opens).toBe('tasm.error.outsideSemester');
    expect(windowErrors(w('2027-01-11', '2027-01-11'), { zone: 'WIB', spans: [spans[1]] })).toEqual({});
    expect(windowErrors({ ...w('2026-10-20', '2026-10-20'), closesTime: '06:00' }, { zone: 'WIB', spans: [spans[0]] }).closes).toBe('tasm.error.order');
  });

  it('the body names a new window as both ends or none', () => {
    expect(copyBody(['cs-b'], null, 'WIB')).toEqual({ classSubjectIds: ['cs-b'] });
    expect(copyBody(['cs-c'], { opensDate: '2027-01-11', opensTime: '07:00', closesDate: '2027-01-11', closesTime: '08:00' }, 'WIB')).toEqual({
      classSubjectIds: ['cs-c'],
      opensAt: '2027-01-11T07:00:00+07:00',
      closesAt: '2027-01-11T08:00:00+07:00',
    });
  });

  it('sources group by semester in the order they come', () => {
    const src = (id, sem, ordinal, year) => ({ id, classSubject: { semester: { id: sem, ordinal }, class: { academicYear: year } } });
    const groups = sourcesBySemester([src('a', 's2', 2, '2026/2027'), src('b', 's2', 2, '2026/2027'), src('c', 's0', 1, '2025/2026')]);
    expect(groups.map((g) => [g.key, g.ordinal, g.academicYear, g.rows.map((r) => r.id)])).toEqual([
      ['s2', 2, '2026/2027', ['a', 'b']],
      ['s0', 1, '2025/2026', ['c']],
    ]);
  });
});

describe('stateOf - the one word a list says (owner, 2026-10-08)', () => {
  it('draft, active before and during its window, ended after it, cancelled whatever its window', () => {
    expect(stateOf(saved)).toBe('DRAFT');
    const published = { ...saved, status: 'PUBLISHED' };
    expect(stateOf(published, new Date('2026-10-11T23:00:00Z'))).toBe('ACTIVE');
    expect(stateOf(published, new Date('2026-10-12T01:00:00Z'))).toBe('ACTIVE');
    expect(stateOf(published, new Date('2026-10-12T02:00:00Z'))).toBe('ENDED');
    expect(stateOf({ ...published, status: 'CANCELLED' }, new Date('2026-10-11T23:00:00Z'))).toBe('CANCELLED');
  });
});

describe('dashboardAssessments - the dashboard card', () => {
  const now = new Date('2026-10-20T03:00:00Z');
  const a = (id, status, opensAt, closesAt) => ({ id, status, opensAt, closesAt });
  const row = { id: 'cs-1' };

  it('open first (soonest to close), then upcoming (soonest to open), then drafts; ended and cancelled left out', () => {
    const lists = [
      { row, assessments: [
        a('openLate', 'PUBLISHED', '2026-10-19T00:00:00Z', '2026-10-30T00:00:00Z'),
        a('draft', 'DRAFT', '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z'),
        a('ended', 'PUBLISHED', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z'),
        a('cancelled', 'CANCELLED', '2026-10-19T00:00:00Z', '2026-10-30T00:00:00Z'),
      ] },
      { row: { id: 'cs-2' }, assessments: [
        a('openSoon', 'PUBLISHED', '2026-10-20T00:00:00Z', '2026-10-21T00:00:00Z'),
        a('upcoming', 'PUBLISHED', '2026-10-25T00:00:00Z', '2026-10-26T00:00:00Z'),
      ] },
    ];
    const out = dashboardAssessments(lists, { now });
    expect(out.items.map((item) => `${item.group}:${item.assessment.id}`)).toEqual(['open:openSoon', 'open:openLate', 'upcoming:upcoming', 'draft:draft']);
    expect(out.counts).toEqual({ open: 2, upcoming: 1, draft: 1 });
    expect(out.items[0].row.id).toBe('cs-2');
    expect(out.more).toBe(0);
  });

  it('at most five, the rest counted; one reached twice listed once', () => {
    const many = Array.from({ length: 7 }, (_, i) => a(`d${i}`, 'DRAFT', `2026-11-0${i + 1}T00:00:00Z`, `2026-11-0${i + 2}T00:00:00Z`));
    const out = dashboardAssessments([{ row, assessments: many }, { row: { id: 'cs-2' }, assessments: [many[0]] }], { now });
    expect(out.items).toHaveLength(5);
    expect(out.more).toBe(2);
    expect(out.counts.draft).toBe(7);
  });
});
