import { describe, expect, it } from 'vitest';

import {
  AUTOMATIC,
  choiceOf,
  decidedCount,
  evenSemesterOf,
  notDecidableView,
  outcomeCounts,
  promotionChanged,
  promotionsBody,
  promotionsShown,
  resultShown,
} from './promotions';

// Shapes from backend 4dae152: grading.promotion.js readPromotions.
const at = '2027-06-01T02:00:00.000Z';
const student = (id, over = {}) => ({ studentProfileId: id, fullName: id, outcome: null, automatic: false, result: null, updatedAt: at, ...over });

describe('promotions - when the card shows', () => {
  it('only for Semester 2, while it is being finalised or once closed', () => {
    expect(promotionsShown({ ordinal: 2, status: 'FINALIZING' })).toBe(true);
    expect(promotionsShown({ ordinal: 2, status: 'CLOSED' })).toBe(true);
    expect(promotionsShown({ ordinal: 2, status: 'OPEN' })).toBe(false);
    expect(promotionsShown({ ordinal: 1, status: 'FINALIZING' })).toBe(false);
    expect(promotionsShown(null)).toBe(false);
  });

  it('finds the year\'s Semester 2', () => {
    expect(evenSemesterOf({ semesters: [{ id: 's1', ordinal: 1 }, { id: 's2', ordinal: 2 }] })?.id).toBe('s2');
    expect(evenSemesterOf({ semesters: [{ id: 's1', ordinal: 1 }] })).toBeNull();
    expect(evenSemesterOf(undefined)).toBeNull();
  });
});

describe('promotions - a student\'s choice and result', () => {
  it('shows the draft, else the saved outcome, else the automatic rule', () => {
    expect(choiceOf(student('a'), {})).toBe(AUTOMATIC);
    expect(choiceOf(student('a', { outcome: 'RETAINED' }), {})).toBe('RETAINED');
    expect(choiceOf(student('a', { outcome: 'RETAINED' }), { a: AUTOMATIC })).toBe(AUTOMATIC);
  });

  it('counts a change only against what is saved', () => {
    expect(promotionChanged(student('a'), { a: AUTOMATIC })).toBe(false);
    expect(promotionChanged(student('a'), { a: 'PROMOTED' })).toBe(true);
    expect(promotionChanged(student('a', { outcome: 'PROMOTED' }), { a: 'PROMOTED' })).toBe(false);
    expect(promotionChanged(student('a', { outcome: 'PROMOTED' }), { a: AUTOMATIC })).toBe(true);
  });

  it('resolves as the server does: own outcome, else automatic, else undecided', () => {
    expect(resultShown(student('a', { automatic: true }), {}, 'PROMOTED')).toBe('PROMOTED');
    expect(resultShown(student('a', { automatic: true }), {}, 'GRADUATED')).toBe('GRADUATED');
    expect(resultShown(student('a', { automatic: true }), { a: 'RETAINED' }, 'PROMOTED')).toBe('RETAINED');
    expect(resultShown(student('a', { automatic: false }), {}, 'PROMOTED')).toBeNull();
    expect(resultShown(student('a', { automatic: null }), {}, 'PROMOTED')).toBeNull();
    expect(decidedCount([student('a', { automatic: true }), student('b'), student('c', { outcome: 'RETAINED' })], {}, 'PROMOTED')).toBe(2);
    expect(decidedCount([student('a', { automatic: true }), student('b')], { b: 'PROMOTED' }, 'PROMOTED')).toBe(2);
  });
});

describe('promotions - the PUT body', () => {
  it('sends each changed choice, null for the automatic rule, with the updatedAt read', () => {
    const students = [student('a'), student('b', { outcome: 'RETAINED' }), student('c', { outcome: 'PROMOTED' })];
    expect(promotionsBody(students, { a: 'PROMOTED', b: AUTOMATIC, c: 'PROMOTED' })).toEqual([
      { studentProfileId: 'a', outcome: 'PROMOTED', updatedAt: at },
      { studentProfileId: 'b', outcome: null, updatedAt: at },
    ]);
    expect(promotionsBody(students, {})).toEqual([]);
  });
});

describe('promotions - why not now', () => {
  const read = (over) => ({ decidable: false, academicYear: '2026/2027', semester: { status: 'FINALIZING' }, waitingFor: [], ...over });

  it('names the reason from the read\'s fields', () => {
    expect(notDecidableView(read({ decidable: true }))).toBeNull();
    expect(notDecidableView(read({ semester: { status: 'OPEN' } }))).toEqual({ key: 'homeroom.promo.notYet.open' });
    expect(notDecidableView(read({ semester: { status: 'CLOSED' } }))).toEqual({ key: 'homeroom.promo.notYet.closed' });
    expect(notDecidableView(read({ waitingFor: [{ subject: { code: 'MTK' } }, { subject: { code: 'BIO' } }] }))).toEqual({
      key: 'homeroom.promo.notYet.waiting',
      vars: { subjects: 'MTK, BIO' },
    });
    expect(notDecidableView(read({}))).toEqual({ key: 'homeroom.promo.notYet.yearClosed', vars: { year: '2026/2027' } });
  });
});

describe('promotions - the summary counts (2026-10-30)', () => {
  const students = [
    { studentProfileId: 'a', outcome: null, automatic: true },
    { studentProfileId: 'b', outcome: 'RETAINED', automatic: false },
    { studentProfileId: 'c', outcome: null, automatic: false },
    { studentProfileId: 'd', outcome: null, automatic: null },
  ];

  it('counts going up, staying and undecided with the choices on screen', () => {
    expect(outcomeCounts(students, {}, 'PROMOTED')).toEqual({ advance: 1, RETAINED: 1, undecided: 2 });
    expect(outcomeCounts(students, { c: 'PROMOTED', a: 'RETAINED' }, 'PROMOTED')).toEqual({ advance: 1, RETAINED: 2, undecided: 1 });
  });

  it('counts graduating as going up', () => {
    expect(outcomeCounts(students, { d: 'GRADUATED' }, 'GRADUATED')).toEqual({ advance: 2, RETAINED: 1, undecided: 1 });
  });
});
