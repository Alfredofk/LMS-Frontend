import { describe, it, expect } from 'vitest';

import { markingSummaryOf } from './markingByTeacher.js';

/* A teacher as markingByTeacher answers one (dashboard.service.js, 0eefba2). */
const teacher = (fullName, marking, release) => ({ membershipId: `m-${fullName}`, fullName, marking, release });

describe('markingSummaryOf', () => {
  it('keeps only the teachers with something waiting, the most to mark first', () => {
    const summary = markingSummaryOf({
      teachers: [teacher('Ani', 0, 0), teacher('Budi', 2, 5), teacher('Citra', 4, 0), teacher('Dewi', 2, 1), teacher('Eka', 0, 3)],
      unanswered: { marking: 0, release: 0 },
    });
    expect(summary.waiting.map((entry) => entry.fullName)).toEqual(['Citra', 'Budi', 'Dewi', 'Eka']);
    expect(summary.idle).toBe(1);
    expect(summary.teachers).toBe(5);
    expect(summary.unanswered).toBeNull();
  });

  it('breaks a tie by name', () => {
    const summary = markingSummaryOf({ teachers: [teacher('Wati', 1, 1), teacher('Agus', 1, 1)], unanswered: { marking: 0, release: 0 } });
    expect(summary.waiting.map((entry) => entry.fullName)).toEqual(['Agus', 'Wati']);
  });

  it('counts the unanswered slots into the totals, and keeps them apart', () => {
    const summary = markingSummaryOf({ teachers: [teacher('Budi', 2, 1)], unanswered: { marking: 3, release: 0 } });
    expect(summary.unanswered).toEqual({ marking: 3, release: 0 });
    expect(summary.totals).toEqual({ marking: 5, release: 1 });
  });

  it('answers an empty school without failing', () => {
    expect(markingSummaryOf({ teachers: [], unanswered: { marking: 0, release: 0 } })).toEqual({
      waiting: [],
      idle: 0,
      teachers: 0,
      totals: { marking: 0, release: 0 },
      unanswered: null,
    });
  });
});
