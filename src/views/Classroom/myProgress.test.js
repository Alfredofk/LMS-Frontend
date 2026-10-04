import { describe, expect, it } from 'vitest';

import { progressFor, progressTotals, rateOf } from './myProgress.js';

/* Rows shaped as tracking.service.js ownProgress answers them. */
const row = (classSubjectId, contents, lastActivityAt = null) => ({
  classSubjectId,
  subject: { code: classSubjectId.toUpperCase(), name: classSubjectId },
  semester: { id: 'sem1', ordinal: 1 },
  contents,
  attendance: { counted: 0, present: 0, sick: 0, excused: 0, absent: 0, late: 0, outsideSchool: 0 },
  lastActivityAt,
});

const answer = {
  class: { id: 'c1', name: 'XI IPS' },
  classSubjects: [
    row('eko', { published: 4, opened: 3, completed: 1 }, '2028-08-22T01:00:00.000Z'),
    row('mtk', { published: 2, opened: 1, completed: 1 }, '2028-08-23T02:00:00.000Z'),
    row('bio', { published: 0, opened: 0, completed: 0 }),
  ],
};

describe('rateOf', () => {
  it('rounds to a whole percentage', () => {
    expect(rateOf(1, 3)).toBe(33);
    expect(rateOf(2, 3)).toBe(67);
    expect(rateOf(3, 3)).toBe(100);
  });
  it('is null, not 0, with nothing to count', () => {
    expect(rateOf(0, 0)).toBeNull();
  });
});

describe('progressFor', () => {
  it('finds a subject by its classSubjectId', () => {
    expect(progressFor(answer, 'mtk').contents.completed).toBe(1);
  });
  it('answers null for an unknown id or no answer', () => {
    expect(progressFor(answer, 'nope')).toBeNull();
    expect(progressFor(null, 'mtk')).toBeNull();
  });
});

describe('progressTotals', () => {
  it('adds every subject up, with rates out of the published materials', () => {
    const totals = progressTotals(answer);
    expect(totals).toMatchObject({ subjects: 3, published: 6, opened: 4, completed: 2, openedRate: 67, completedRate: 33 });
  });
  it('keeps the latest activity across subjects', () => {
    expect(progressTotals(answer).lastActivityAt.toISOString()).toBe('2028-08-23T02:00:00.000Z');
  });
  it('keeps only the subjects named', () => {
    expect(progressTotals(answer, ['eko'])).toMatchObject({ subjects: 1, published: 4, completed: 1, completedRate: 25 });
    expect(progressTotals(answer, [])).toMatchObject({ subjects: 0, published: 0 });
  });
  it('has no rate, not 0%, while nothing is published', () => {
    const totals = progressTotals(answer, ['bio']);
    expect(totals.openedRate).toBeNull();
    expect(totals.completedRate).toBeNull();
    expect(totals.lastActivityAt).toBeNull();
  });
  it('reads a missing answer as nothing', () => {
    expect(progressTotals(null)).toMatchObject({ subjects: 0, published: 0, completedRate: null });
  });
});
