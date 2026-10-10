import { describe, expect, it } from 'vitest';

import { markingQueueOf, queueCandidates } from './markingQueue';

describe('markingQueue - what waits on the teacher (results `waiting`)', () => {
  const now = new Date('2026-10-12T05:00:00Z');

  it('reads only published ones already opened', () => {
    const list = [
      { id: 'open', status: 'PUBLISHED', opensAt: '2026-10-12T00:30:00Z' },
      { id: 'later', status: 'PUBLISHED', opensAt: '2026-10-13T00:00:00Z' },
      { id: 'draft', status: 'DRAFT', opensAt: '2026-10-01T00:00:00Z' },
      { id: 'cancelled', status: 'CANCELLED', opensAt: '2026-10-01T00:00:00Z' },
      { id: 'offlineLater', status: 'PUBLISHED', mode: 'OFFLINE', opensAt: '2026-10-13T00:00:00Z' },
    ];
    expect(queueCandidates(list, now).map((a) => a.id)).toEqual(['open', 'offlineLater']);
  });

  it('keeps only what waits, and adds marking and release up', () => {
    const out = markingQueueOf([{ row: { id: 'cs' }, assessments: [] }], [
      { id: 'a', waiting: { marking: 2, release: 1, inProgress: 4 } },
      { id: 'b', waiting: { marking: 0, release: 0, inProgress: 3 } },
      { id: 'c', waiting: { marking: 0, release: 5 } },
    ]);
    expect(out.waitingById).toEqual({ a: { marking: 2, release: 1 }, c: { marking: 0, release: 5 } });
    expect(out.marking).toBe(2);
    expect(out.release).toBe(6);
    expect(out.lists).toHaveLength(1);
  });
});
