import { describe, expect, it } from 'vitest';

import { blockerView, boardByClass, canFinalise, canStopFinalising, canUnfinalise, finalisingShown, semesterStatusOf, slotStateOf } from './finalising';

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
