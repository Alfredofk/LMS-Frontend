import { describe, expect, it } from 'vitest';

import { firstUndone, isTracked, materialState, mergeProgress, progressById, progressSummary } from './materialProgress.js';

const AT = '2026-10-05T03:00:00.000Z';
const EARLIER = '2026-10-04T03:00:00.000Z';

describe('materialState - from a material\'s progress (content.service.js listForSession)', () => {
  it('done, opened, new', () => {
    expect(materialState({ firstOpenedAt: EARLIER, completedAt: EARLIER })).toBe('done');
    expect(materialState({ firstOpenedAt: EARLIER, completedAt: null })).toBe('opened');
    expect(materialState(null)).toBe('new');
    expect(materialState(undefined)).toBe('new');
  });
});

describe('isTracked / progressById', () => {
  it("a student's list carries progress (null included); staff's has no key", () => {
    expect(isTracked([{ id: 'a', progress: null }])).toBe(true);
    expect(isTracked([{ id: 'a' }])).toBe(false);
    expect(isTracked([])).toBe(false);
    expect(progressById([{ id: 'a', progress: null }, { id: 'b', progress: { firstOpenedAt: EARLIER, completedAt: null } }])).toEqual({
      a: null,
      b: { firstOpenedAt: EARLIER, completedAt: null },
    });
  });
});

describe('mergeProgress - what an event answer adds', () => {
  it('opens a material never opened, and completes it when the answer says so', () => {
    expect(mergeProgress(null, { completed: false }, AT)).toEqual({ firstOpenedAt: AT, completedAt: null });
    expect(mergeProgress(null, { completed: true }, AT)).toEqual({ firstOpenedAt: AT, completedAt: AT });
  });

  it('keeps the first opening and the first completion', () => {
    const done = { firstOpenedAt: EARLIER, completedAt: EARLIER };
    expect(mergeProgress(done, { completed: true }, AT)).toEqual(done);
    expect(mergeProgress(done, { completed: false }, AT)).toEqual(done);
    expect(mergeProgress({ firstOpenedAt: EARLIER, completedAt: null }, { completed: true }, AT)).toEqual({
      firstOpenedAt: EARLIER,
      completedAt: AT,
    });
  });
});

describe('progressSummary', () => {
  it('counts the done ones over every material', () => {
    const contents = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const byId = { a: { firstOpenedAt: EARLIER, completedAt: EARLIER }, b: { firstOpenedAt: EARLIER, completedAt: null } };
    expect(progressSummary(contents, byId)).toEqual({ done: 1, total: 3 });
    expect(progressSummary([], {})).toEqual({ done: 0, total: 0 });
  });
});

describe('firstUndone - where the meeting opens', () => {
  const contents = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('the first not done, an opened one counting as not done', () => {
    expect(firstUndone(contents, { a: { firstOpenedAt: EARLIER, completedAt: EARLIER } })).toBe('b');
    expect(firstUndone(contents, { a: { firstOpenedAt: EARLIER, completedAt: EARLIER }, b: { firstOpenedAt: EARLIER, completedAt: null } })).toBe('b');
    expect(firstUndone(contents, {})).toBe('a');
  });
  it('the first when all are done, and null for none', () => {
    const done = { firstOpenedAt: EARLIER, completedAt: EARLIER };
    expect(firstUndone(contents, { a: done, b: done, c: done })).toBe('a');
    expect(firstUndone([], {})).toBeNull();
  });
});
