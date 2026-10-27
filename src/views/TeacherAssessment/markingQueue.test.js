import { describe, expect, it } from 'vitest';

import { markingQueueOf } from './markingQueue';

describe('markingQueue - what waits on the teacher (GET /dashboard/teaching queue)', () => {
  const entry = (id, marking, release, over = {}) => ({
    assessment: { id },
    marking,
    release,
    oldestWaitingSince: '2026-10-20T03:00:00.000Z',
    releasableAt: null,
    ...over,
  });

  it('adds marking and release up, and keeps each entry by its assessment', () => {
    const out = markingQueueOf([entry('a', 2, 1), entry('c', 0, 5, { oldestWaitingSince: '2026-10-18T01:00:00.000Z' })]);
    expect(out.waitingById).toEqual({
      a: { marking: 2, release: 1, since: '2026-10-20T03:00:00.000Z', releasableAt: null },
      c: { marking: 0, release: 5, since: '2026-10-18T01:00:00.000Z', releasableAt: null },
    });
    expect(out.marking).toBe(2);
    expect(out.release).toBe(6);
  });

  it('counts as releasable only what may be released now', () => {
    const out = markingQueueOf([entry('open', 0, 3, { releasableAt: '2026-12-19T16:59:00.000Z' }), entry('closed', 1, 2)]);
    expect(out.release).toBe(5);
    expect(out.releasable).toBe(2);
    expect(out.waitingById.open.releasableAt).toBe('2026-12-19T16:59:00.000Z');
  });

  it('an empty or missing queue is all zeros', () => {
    expect(markingQueueOf([])).toEqual({ waitingById: {}, marking: 0, release: 0, releasable: 0 });
    expect(markingQueueOf(undefined)).toEqual({ waitingById: {}, marking: 0, release: 0, releasable: 0 });
  });
});
