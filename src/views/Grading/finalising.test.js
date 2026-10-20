import { describe, expect, it } from 'vitest';

import {
  blockerView,
  boardByClass,
  canFinalise,
  canStopFinalising,
  canUnfinalise,
  closeBlocksOf,
  closeRefusalParts,
  defaultReportDate,
  finalisingShown,
  reopenBody,
  reopenReasonError,
  reportDateError,
  reportDateRange,
  toggleClass,
  semesterStatusOf,
  slotStateOf,
} from './finalising';

// Shapes from backend eadf680: slotGrades (grading.grades.js), blockersOf (grading.readiness.js), readinessBoard (grading.finalising.js).
const grades = (status, over = {}) => ({ classSubject: { semester: { id: 's1', ordinal: 1, status } }, finalised: null, blockers: [], students: [], ...over });
const finalised = { at: '2026-10-18T07:30:00.000Z', by: { userId: 'u1', fullName: 'Kevin Aprilian' } };

describe('finalising - the teacher card', () => {
  it('shows while the semester is being finalised, or once the slot is; never while it is open', () => {
    expect(semesterStatusOf(grades('FINALIZING'))).toBe('FINALIZING');
    expect(finalisingShown(grades('FINALIZING'))).toBe(true);
    expect(finalisingShown(grades('OPEN'))).toBe(false);
    expect(finalisingShown(grades('CLOSED', { finalised }))).toBe(true);
    expect(finalisingShown({ failed: true })).toBe(false);
    expect(finalisingShown(undefined)).toBe(false);
  });

  it('"Finalkan" only while being finalised, not finalised, nothing blocking', () => {
    expect(canFinalise(grades('FINALIZING'))).toBe(true);
    expect(canFinalise(grades('FINALIZING', { blockers: [{ kind: 'SESSIONS_NEED_COMPLETION', sessions: 2 }] }))).toBe(false);
    expect(canFinalise(grades('FINALIZING', { finalised }))).toBe(false);
    expect(canFinalise(grades('OPEN'))).toBe(false);
  });

  it('undo while finalised and the semester is not closed', () => {
    expect(canUnfinalise(grades('FINALIZING', { finalised }))).toBe(true);
    expect(canUnfinalise(grades('CLOSED', { finalised }))).toBe(false);
    expect(canUnfinalise(grades('FINALIZING'))).toBe(false);
  });
});

describe('finalising - a blocker in words', () => {
  it('meetings to confirm lead to the meetings', () => {
    expect(blockerView({ kind: 'SESSIONS_NEED_COMPLETION', sessions: 2 })).toEqual({
      kind: 'SESSIONS_NEED_COMPLETION',
      key: 'grading.fin.blocker.sessions',
      vars: { n: 2 },
      parts: [],
      link: { to: 'sessions' },
    });
  });

  it('an assessment: what waits, in the teacher order, then who may still answer and until when; it leads to its results', () => {
    const view = blockerView({
      kind: 'ASSESSMENT',
      assessment: { id: 'a1', type: 'KUIS', title: 'Bab 2', mode: 'ONLINE' },
      inProgress: 1,
      waitingForMarking: 3,
      waitingForRelease: 0,
      open: { students: 2, until: '2026-12-20T16:59:00.000Z' },
    });
    expect(view.vars).toEqual({ type: 'KUIS', title: 'Bab 2' });
    expect(view.parts).toEqual([
      { key: 'grading.fin.part.marking', n: 3 },
      { key: 'grading.fin.part.inProgress', n: 1 },
      { key: 'grading.fin.part.mayStart', n: 2, until: '2026-12-20T16:59:00.000Z' },
    ]);
    expect(view.link).toEqual({ to: 'assessment', assessmentId: 'a1' });
  });

  it('an offline one waits for marks, not for a start', () => {
    const view = blockerView({
      kind: 'ASSESSMENT',
      assessment: { id: 'a2', type: 'UTS', title: 'Tengah', mode: 'OFFLINE' },
      inProgress: 0,
      waitingForMarking: 0,
      waitingForRelease: 0,
      open: { students: 4, until: '2026-11-01T02:00:00.000Z' },
    });
    expect(view.parts).toEqual([{ key: 'grading.fin.part.noMark', n: 4, until: '2026-11-01T02:00:00.000Z' }]);
  });

  it("another class's assessment names the class and the students, with nowhere to go", () => {
    const view = blockerView({
      kind: 'POOLED',
      assessment: { id: 'a3', type: 'TUGAS', title: 'Esai', mode: 'ONLINE' },
      class: { id: 'c2', name: 'XI IPA' },
      students: [{ fullName: 'Ani' }, { fullName: 'Budi' }],
    });
    expect(view.vars).toEqual({ type: 'TUGAS', title: 'Esai', className: 'XI IPA', names: 'Ani, Budi' });
    expect(view.link).toBeNull();
    expect(blockerView({ kind: 'NO_TEACHER' }).key).toBe('grading.fin.blocker.noTeacher');
    expect(blockerView({ kind: 'NEW_ONE', text: 'something new' })).toMatchObject({ key: null, vars: { text: 'something new' } });
  });

  it('students with no grade yet are named, and lead to the assessments tab (backend 3a22f90)', () => {
    const view = blockerView({
      kind: 'NO_GRADE',
      students: [{ studentProfileId: 'p1', fullName: 'Ani' }, { studentProfileId: 'p2', fullName: null }, { studentProfileId: 'p3', fullName: 'Budi' }],
    });
    expect(view).toMatchObject({ key: 'grading.fin.blocker.noGrade', vars: { names: 'Ani, Budi' }, parts: [], link: { to: 'assessments' } });
  });
});

describe('finalising - the readiness board', () => {
  const slot = (cls, code, over = {}) => ({
    classSubjectId: `${cls}-${code}`,
    class: { id: cls, name: cls.toUpperCase() },
    subject: { code },
    teacher: { membershipId: 'm1', fullName: 'Kevin' },
    finalised: null,
    blockers: [],
    ...over,
  });
  const readiness = {
    counts: { slots: 3, finalised: 1, notesMissing: 2 },
    slots: [slot('xi-ips', 'MTK', { finalised }), slot('xi-ips', 'BIO', { blockers: [{ kind: 'SESSIONS_NEED_COMPLETION', sessions: 1 }] }), slot('xi-ipa', 'FIS', { teacher: null, blockers: [{ kind: 'NO_TEACHER' }] })],
    notes: [
      { class: { id: 'xi-ipa', name: 'XI-IPA' }, homeroomTeacher: null, students: 1, missing: [] },
      { class: { id: 'xi-ips', name: 'XI-IPS' }, homeroomTeacher: { fullName: 'Kevin' }, students: 2, missing: [{ fullName: 'Ani' }, { fullName: 'Budi' }] },
      { class: { id: 'x-a', name: 'X A' }, homeroomTeacher: null, students: 0, missing: [] },
    ],
  };

  it('a card per class by name, its slots in board order and its notes; a class with no slot kept', () => {
    const board = boardByClass(readiness);
    expect(board.map((entry) => `${entry.class.id}:${entry.slots.map((s) => s.subject.code).join('+')}:${entry.notes?.missing.length}`)).toEqual([
      'x-a::0',
      'xi-ipa:FIS:0',
      'xi-ips:MTK+BIO:2',
    ]);
    expect(board[2].homeroomTeacher).toEqual({ fullName: 'Kevin' });
    expect(boardByClass(null)).toEqual([]);
  });

  it("each slot's state, and stopping only with none finalised", () => {
    expect(readiness.slots.map(slotStateOf)).toEqual(['FINALISED', 'BLOCKED', 'NO_TEACHER']);
    expect(slotStateOf(slot('a', 'X'))).toBe('READY');
    expect(canStopFinalising(readiness)).toBe(false);
    expect(canStopFinalising({ counts: { finalised: 0 } })).toBe(true);
  });
});

describe('finalising - closing the semester (backend 3a22f90)', () => {
  /* The years list's semester: calendar days at midnight UTC. */
  const semester = { id: 's1', ordinal: 1, startDate: '2026-07-13T00:00:00.000Z', endDate: '2026-12-19T00:00:00.000Z' };
  const range = reportDateRange(semester);

  it('a report card is dated from the first day to 30 days after the last (assertReportDate)', () => {
    expect(range).toEqual({ from: '2026-07-13', to: '2027-01-18' });
    expect(reportDateRange({ startDate: null, endDate: null })).toBeNull();
  });

  it("opens on the school's today, held inside the range", () => {
    expect(defaultReportDate(range, '2026-12-20')).toBe('2026-12-20');
    expect(defaultReportDate(range, '2027-02-01')).toBe('2027-01-18');
    expect(defaultReportDate(range, '2026-07-01')).toBe('2026-07-13');
    expect(defaultReportDate(range, '')).toBe('2026-07-13');
  });

  it('refuses an empty, broken or out-of-range date, the edges included', () => {
    expect(reportDateError('', range)?.key).toBe('grading.fin.close.error.dateRequired');
    expect(reportDateError('20-12-2026', range)?.key).toBe('grading.fin.close.error.dateInvalid');
    expect(reportDateError('2026-07-12', range)?.key).toBe('grading.fin.close.error.dateRange');
    expect(reportDateError('2027-01-19', range)?.key).toBe('grading.fin.close.error.dateRange');
    expect(reportDateError('2026-07-13', range)).toBeNull();
    expect(reportDateError('2027-01-18', range)).toBeNull();
  });

  const board = (counts, slots = []) => ({ counts: { slots: 2, finalised: 2, notesMissing: 0, ...counts }, slots });
  const keys = (blocks) => blocks.map((block) => block.key);

  it('may be pressed on or after the last day, everything finalised, nothing blocked, every note written', () => {
    expect(closeBlocksOf(board({}), semester, '2026-12-19')).toEqual([]);
    expect(closeBlocksOf(board({}), semester, '2026-12-18')).toEqual([{ key: 'grading.fin.close.blocked.notOver', vars: { date: '2026-12-19' } }]);
  });

  it('names each thing still in the way, in order, with its count', () => {
    const blocks = closeBlocksOf(
      board({ finalised: 1, notesMissing: 3 }, [
        { finalised: { at: 'x' }, blockers: [{ kind: 'POOLED' }] },
        { finalised: null, blockers: [{ kind: 'ASSESSMENT' }] },
        { finalised: null, blockers: [{ kind: 'SESSIONS_NEED_COMPLETION' }] },
      ]),
      semester,
      '2026-12-01'
    );
    expect(keys(blocks)).toEqual(['grading.fin.close.blocked.notOver', 'grading.fin.close.blocked.slots', 'grading.fin.close.blocked.stuck', 'grading.fin.close.blocked.notes']);
    expect(blocks.map((block) => block.vars.n)).toEqual([undefined, 1, 1, 3]);
    expect(closeBlocksOf(undefined, semester, '2026-12-20')).toEqual([]);
  });

  it("a 409's details become counts (grading.close.js assertClosable)", () => {
    expect(closeRefusalParts({ notFinalised: [{}, {}], blocked: [], notesMissing: [{}] })).toEqual([
      { key: 'grading.fin.close.blocked.slots', vars: { n: 2 } },
      { key: 'grading.fin.close.blocked.notes', vars: { n: 1 } },
    ]);
    expect(closeRefusalParts(undefined)).toEqual([]);
  });
});

describe('finalising - reopening a closed semester (backend 46c6173)', () => {
  const board = { slots: [{ classSubjectId: 'cs-a' }, { classSubjectId: 'cs-b' }, { classSubjectId: 'cs-c' }] };

  it('a reason is required, 1 to 500 once trimmed (reopenBody)', () => {
    expect(reopenReasonError('   ')?.key).toBe('grading.fin.reopen.error.reasonRequired');
    expect(reopenReasonError('x'.repeat(501))?.key).toBe('grading.fin.reopen.error.reasonLong');
    expect(reopenReasonError(` ${'x'.repeat(500)} `)).toBeNull();
    expect(reopenReasonError('Nilai MTK salah input')).toBeNull();
  });

  it('sends the reason trimmed and the ticked subjects in board order; none ticked is an empty list', () => {
    expect(reopenBody('  Salah input  ', new Set(['cs-c', 'cs-a', 'gone']), board)).toEqual({ reason: 'Salah input', classSubjectIds: ['cs-a', 'cs-c'] });
    expect(reopenBody('Catatan', new Set(), board)).toEqual({ reason: 'Catatan', classSubjectIds: [] });
  });

  it('"Pilih semua" ticks a whole class, and clears it once all are ticked', () => {
    const slots = board.slots.slice(0, 2);
    const some = toggleClass(new Set(['cs-a', 'cs-c']), slots);
    expect([...some].sort()).toEqual(['cs-a', 'cs-b', 'cs-c']);
    expect([...toggleClass(some, slots)]).toEqual(['cs-c']);
    expect([...toggleClass(new Set(['cs-c']), [])]).toEqual(['cs-c']);
  });
});
