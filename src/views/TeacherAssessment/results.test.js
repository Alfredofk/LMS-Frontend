import { describe, expect, it } from 'vitest';

import {
  verdictOf,
  canMark,
  chosenOptions,
  formatNumber,
  markBody,
  markDraftFrom,
  markErrors,
  nextToMark,
  offlineBody,
  offlineDraftsFrom,
  offlineErrors,
  offlineNeedsReason,
  offlineSavedOf,
  pointsChanged,
  pointsValue,
  releaseState,
  flaggedCount,
  hasSignals,
  shownAttempts,
  signalParts,
  signalTotal,
} from './results';

/* Shapes from assessment.marking.js: markingViewOf, attemptView, results. */
const assessment = { id: 'a1', mode: 'ONLINE', status: 'PUBLISHED', canManage: true, closesAt: '2026-10-20T00:00:00Z' };

const view = (over = {}) => ({
  assessment,
  submission: { id: 's1', status: 'WAITING_FOR_MARKING', closedBy: 'STUDENT', comment: null, ...over.submission },
  scores: [],
  questions: [
    { id: 'q1', kind: 'MCQ', points: 2, answer: { optionIds: ['o2'] }, options: [{ id: 'o1', correct: true }, { id: 'o2', correct: false }], autoPoints: 0, teacherPoints: null, comment: null },
    { id: 'q2', kind: 'SHORT', points: 3, answer: { text: 'lima' }, autoPoints: 3, teacherPoints: null, comment: null },
    { id: 'q3', kind: 'ESSAY', points: 10, answer: { text: 'Jawab', file: null }, autoPoints: null, teacherPoints: null, comment: null, needsMarking: true },
    { id: 'q4', kind: 'ESSAY', points: 5, answer: null, autoPoints: null, teacherPoints: null, comment: null },
    ...(over.questions ?? []),
  ],
});

describe('formatNumber - scores in the reader language', () => {
  it('a comma in Indonesian, two decimals at most, a dash for none', () => {
    expect(formatNumber(85.5, 'id')).toBe('85,5');
    expect(formatNumber(85.5, 'en')).toBe('85.5');
    expect(formatNumber(17, 'id')).toBe('17');
    expect(formatNumber(66.666, 'id')).toBe('66,67');
    expect(formatNumber(null, 'id')).toBe('-');
  });
});

describe('releaseState - release (marking.release)', () => {
  const ready = { release: 2 };
  it('online: only once closed, and only with something ready', () => {
    expect(releaseState(assessment, ready, new Date('2026-10-19T23:59:00Z'))).toEqual({ show: true, enabled: false, why: 'tasm.results.releaseAfterClose' });
    expect(releaseState(assessment, ready, new Date('2026-10-20T00:00:00Z'))).toEqual({ show: true, enabled: true, why: null });
    expect(releaseState(assessment, { release: 0 }, new Date('2026-10-21T00:00:00Z')).why).toBe('tasm.results.nothingToRelease');
  });
  it('offline: whenever ready', () => {
    expect(releaseState({ ...assessment, mode: 'OFFLINE' }, ready, new Date('2026-10-01T00:00:00Z')).enabled).toBe(true);
  });
  it('not offered to a reader, on a draft or a cancelled one', () => {
    expect(releaseState({ ...assessment, canManage: false }, ready).show).toBe(false);
    expect(releaseState({ ...assessment, status: 'CANCELLED' }, ready).show).toBe(false);
    expect(releaseState({ ...assessment, status: 'DRAFT' }, ready).show).toBe(false);
  });
});

describe('nextToMark', () => {
  const students = [
    { studentProfileId: 'p1', fullName: 'Ani', attempts: [{ id: 'x1', status: 'WAITING_FOR_MARKING' }] },
    { studentProfileId: 'p2', fullName: 'Budi', attempts: [{ id: 'x2', status: 'RELEASED' }, { id: 'x3', status: 'WAITING_FOR_MARKING' }] },
    { studentProfileId: 'p3', fullName: 'Citra', attempts: [] },
  ];
  it('the next waiting after the current one, round again, never itself', () => {
    expect(nextToMark(students, 'x1').id).toBe('x3');
    expect(nextToMark(students, 'x3').id).toBe('x1');
    expect(nextToMark(students, 'x2').id).toBe('x3');
    expect(nextToMark([students[0]], 'x1')).toBeNull();
  });
});

describe('canMark', () => {
  it('the answering teacher on a closed online attempt of a published one', () => {
    expect(canMark(view())).toBe(true);
    expect(canMark(view({ submission: { status: 'RELEASED' } }))).toBe(true);
    expect(canMark(view({ submission: { status: 'IN_PROGRESS' } }))).toBe(false);
    expect(canMark(view({ submission: { status: 'VOID' } }))).toBe(false);
    expect(canMark(view({ submission: { closedBy: 'TEACHER' } }))).toBe(false);
    expect(canMark({ ...view(), assessment: { ...assessment, canManage: false } })).toBe(false);
    expect(canMark({ ...view(), assessment: { ...assessment, status: 'CANCELLED' } })).toBe(false);
  });
});

describe('the marks typed - markBody / assertMarkable', () => {
  it('points read with a comma or a point, empty is none', () => {
    expect(pointsValue('7,5')).toBe(7.5);
    expect(pointsValue(' 8 ')).toBe(8);
    expect(pointsValue('')).toBeNull();
    expect(pointsValue('-1')).toBeNaN();
    expect(pointsValue('abc')).toBeNaN();
  });

  it('0 to the question points, two decimals at most', () => {
    const v = view();
    const draft = markDraftFrom(v);
    draft.answers.q3.points = '10.5';
    draft.answers.q2.points = '1.255';
    expect(markErrors(draft, v)).toEqual({ q3: { key: 'tasm.mark.error.tooMany', vars: { n: 10 } }, q2: 'tasm.mark.error.points' });
    draft.answers.q3.points = '7,25';
    draft.answers.q2.points = '0';
    expect(markErrors(draft, v)).toEqual({});
  });

  it('a released essay mark is changed, never cleared', () => {
    const v = view({ submission: { status: 'RELEASED' } });
    v.questions[2].teacherPoints = 8;
    const draft = markDraftFrom(v);
    draft.answers.q3.points = '';
    expect(markErrors(draft, v).q3).toBe('tasm.mark.error.keepEssay');
  });

  it('sends only what changed; nothing changed sends nothing', () => {
    const v = view();
    const draft = markDraftFrom(v);
    expect(markBody(draft, v)).toBeNull();
    draft.answers.q3.points = '7,5';
    draft.answers.q2.comment = '  Bagus ';
    draft.comment = 'Rapi';
    expect(markBody(draft, v)).toEqual({
      answers: [
        { questionId: 'q2', comment: 'Bagus' },
        { questionId: 'q3', points: 7.5 },
      ],
      comment: 'Rapi',
    });
  });

  it('a cleared box sends null, taking the teacher points back', () => {
    const v = view();
    v.questions[1].teacherPoints = 2;
    const draft = markDraftFrom(v);
    draft.answers.q2.points = '';
    expect(markBody(draft, v)).toEqual({ answers: [{ questionId: 'q2', points: null }] });
  });

  it('never names an unanswered question or an MCQ', () => {
    const v = view();
    const draft = markDraftFrom(v);
    draft.answers.q4.points = '3';
    draft.answers.q4.comment = 'x';
    draft.answers.q1.points = '2';
    expect(markBody(draft, v)).toBeNull();
  });

  it('released: a reason goes with changed points, not with a comment alone', () => {
    const v = view({ submission: { status: 'RELEASED' } });
    v.questions[2].teacherPoints = 8;
    const draft = markDraftFrom(v);
    draft.answers.q3.comment = 'Lihat lagi';
    expect(pointsChanged(draft, v)).toBe(false);
    expect(markBody(draft, v, 'x')).toEqual({ answers: [{ questionId: 'q3', comment: 'Lihat lagi' }] });
    draft.answers.q3.points = '9';
    expect(pointsChanged(draft, v)).toBe(true);
    expect(markBody(draft, v, ' Salah hitung ').reason).toBe('Salah hitung');
  });
});

describe('offline marks - offlineMarksBody / enterOfflineMark', () => {
  const students = [
    { studentProfileId: 'p1', attempts: [] },
    { studentProfileId: 'p2', attempts: [{ id: 'x2', closedBy: 'TEACHER', status: 'WAITING_FOR_RELEASE', releasedAt: null, mark: { value: 70 } }] },
    { studentProfileId: 'p3', attempts: [{ id: 'x3', closedBy: 'TEACHER', status: 'RELEASED', releasedAt: '2026-10-10T00:00:00Z', mark: { value: 85.5 }, comment: 'Rapi' }] },
  ];

  it('the saved mark is the teacher-entered attempt, not a void one', () => {
    expect(offlineSavedOf(students[2])).toEqual({ submissionId: 'x3', value: 85.5, released: true, comment: 'Rapi' });
    expect(offlineSavedOf({ attempts: [{ id: 'v', closedBy: 'TEACHER', status: 'VOID', mark: { value: 1 } }] })).toBeNull();
    expect(offlineDraftsFrom(students)).toEqual({
      p1: { mark: '', comment: '', loadedComment: null },
      p2: { mark: '70', comment: '', loadedComment: null },
      p3: { mark: '85.5', comment: 'Rapi', loadedComment: 'Rapi' },
    });
    expect(offlineDraftsFrom(students, 'id').p3.mark).toBe('85,5');
  });

  it('nothing changed sends nothing; a new mark and a changed one go, with only a comment touched', () => {
    const drafts = offlineDraftsFrom(students);
    expect(offlineBody(drafts, students)).toBeNull();
    drafts.p1.mark = '90,25';
    drafts.p2.comment = ' Rapi ';
    expect(offlineBody(drafts, students)).toEqual({
      marks: [
        { studentProfileId: 'p1', value: 90.25 },
        { studentProfileId: 'p2', value: 70, comment: 'Rapi' },
      ],
    });
  });

  it('a stored comment is filled from the results and not sent unchanged; a mark saved keeps it', () => {
    const drafts = offlineDraftsFrom(students);
    drafts.p3.comment = ' Rapi ';
    expect(offlineBody(drafts, students)).toBeNull();
    drafts.p3.mark = '86';
    expect(offlineBody(drafts, students, 'Salah input').marks).toEqual([{ studentProfileId: 'p3', value: 86 }]);
    drafts.p3.comment = '';
    expect(offlineBody(drafts, students, 'Salah input').marks).toEqual([{ studentProfileId: 'p3', value: 86, comment: null }]);
  });

  it('0 to 100, two decimals; a saved mark is never emptied; a comment needs a mark', () => {
    const drafts = offlineDraftsFrom(students);
    drafts.p1.mark = '100.5';
    drafts.p2.mark = '';
    drafts.p3.mark = '1.234';
    expect(offlineErrors(drafts, students)).toEqual({ p1: 'tasm.offline.error.mark', p2: 'tasm.offline.error.keep', p3: 'tasm.offline.error.mark' });
    const fresh = offlineDraftsFrom(students);
    fresh.p1.comment = 'Bagus';
    expect(offlineErrors(fresh, students)).toEqual({ p1: 'tasm.offline.error.needMark' });
  });

  it('a released mark changed carries the reason; a released comment alone does not', () => {
    const drafts = offlineDraftsFrom(students);
    drafts.p3.comment = 'Baru';
    expect(offlineNeedsReason(drafts, students)).toBe(false);
    drafts.p3.mark = '88';
    expect(offlineNeedsReason(drafts, students)).toBe(true);
    expect(offlineBody(drafts, students, ' Salah input ').reason).toBe('Salah input');
  });
});

describe('chosenOptions', () => {
  it('letters, what was chosen and what is correct', () => {
    expect(chosenOptions(view().questions[0])).toEqual([
      { id: 'o1', correct: true, letter: 'A', chosen: false },
      { id: 'o2', correct: false, letter: 'B', chosen: true },
    ]);
  });
});

describe('integrity counts on an attempt (backend b5db324)', () => {
  it('none recorded for a TUGAS or an OFFLINE one: null, not zeros', () => {
    expect(signalParts(null)).toBeNull();
    expect(signalParts(undefined)).toBeNull();
  });
  it('recorded but all zero: an empty list', () => {
    expect(signalParts({ focusLost: 0, pasted: 0, copied: 0, fullscreenExited: 0 })).toEqual([]);
  });
  it('the counts above zero, leaving first, then fullscreen, copy, paste', () => {
    expect(signalParts({ focusLost: 3, pasted: 1, copied: 0, fullscreenExited: 2 })).toEqual([
      { key: 'focusLost', n: 3 },
      { key: 'fullscreenExited', n: 2 },
      { key: 'pasted', n: 1 },
    ]);
  });
});

describe('the Hasil list for many students (owner 2026-10-13)', () => {
  const sig = (n) => ({ focusLost: n, pasted: 0, copied: 0, fullscreenExited: 0 });
  const at = (attempt, status, signals = null) => ({ id: `a${attempt}`, attempt, status, signals });

  it('one number per attempt; null where nothing is recorded by design', () => {
    expect(signalTotal({ focusLost: 4, pasted: 1, copied: 0, fullscreenExited: 4 })).toBe(9);
    expect(signalTotal(sig(0))).toBe(0);
    expect(signalTotal(null)).toBeNull();
  });

  it('students with something recorded, counted for the summary', () => {
    const students = [
      { attempts: [at(1, 'RELEASED', sig(0)), at(2, 'RELEASED', sig(2))] },
      { attempts: [at(1, 'RELEASED', sig(0))] },
      { attempts: [at(1, 'RELEASED', null)] },
      { attempts: [] },
    ];
    expect(students.map(hasSignals)).toEqual([true, false, false, false]);
    expect(flaggedCount(students)).toBe(1);
  });

  it('the newest attempt and those waiting stay; the rest wait behind a count', () => {
    const attempts = [at(1, 'WAITING_FOR_MARKING'), at(2, 'RELEASED'), at(3, 'VOID'), at(4, 'IN_PROGRESS')];
    const { shown, hidden } = shownAttempts(attempts);
    expect(shown.map((a) => a.attempt)).toEqual([4, 1]);
    expect(hidden).toBe(2);
    expect(shownAttempts(attempts, { expanded: true }).shown.map((a) => a.attempt)).toEqual([4, 3, 2, 1]);
  });

  it('under the filter, an older attempt with something recorded shows too', () => {
    const attempts = [at(1, 'RELEASED', sig(3)), at(2, 'RELEASED', sig(0))];
    expect(shownAttempts(attempts).shown.map((a) => a.attempt)).toEqual([2]);
    expect(shownAttempts(attempts, { flaggedOnly: true }).shown.map((a) => a.attempt)).toEqual([2, 1]);
  });
});

describe('results - right or wrong, per question (owner, 2026-10-18)', () => {
  // The marking view's question (assessment.marking.js): earned after a teacher's change, needsMarking.
  it('full points right, none wrong, some partly; from the points saved', () => {
    expect(verdictOf({ kind: 'TF', points: 1, earned: 1, answered: true })).toBe('CORRECT');
    expect(verdictOf({ kind: 'TF', points: 1, earned: 0, answered: true })).toBe('WRONG');
    expect(verdictOf({ kind: 'MCQ', points: 4, earned: 2.5, answered: true })).toBe('PARTIAL');
    expect(verdictOf({ kind: 'SHORT', points: 2, earned: 2, answered: true })).toBe('CORRECT');
  });

  it('not answered says so; an essay, one waiting to be marked, or no points read say nothing', () => {
    expect(verdictOf({ kind: 'SHORT', points: 1, earned: 0, answered: false })).toBe('UNANSWERED');
    expect(verdictOf({ kind: 'ESSAY', points: 10, earned: 10, answered: true })).toBeNull();
    expect(verdictOf({ kind: 'SHORT', points: 1, earned: 0, answered: true, waiting: true })).toBeNull();
    expect(verdictOf({ kind: 'TF', points: 1, earned: null, answered: true })).toBeNull();
  });
});
