import { describe, it, expect } from 'vitest';

import { daysUntil, dueToneOf, mondayOf, nextToFinishOf, streakOf, weekAssessmentsOf, weekOf } from './studentHome.js';

/* 07:00 WIB on the given day is 00:00Z. */
const row = (date, status, extra = {}) => ({
  status,
  session: { status: 'SCHEDULED', startsAt: `${date}T00:00:00Z`, ...extra },
});

describe('streakOf', () => {
  const now = new Date('2026-10-28T05:00:00Z');

  it('counts PRESENT meetings back from the newest until the first that is not', () => {
    const rows = [row('2026-10-22', 'PRESENT'), row('2026-10-23', 'SICK'), row('2026-10-26', 'PRESENT'), row('2026-10-27', 'PRESENT')];
    expect(streakOf(rows, now)).toBe(2);
  });

  it('leaves out cancelled meetings and ones not begun yet', () => {
    const rows = [
      row('2026-10-26', 'PRESENT'),
      row('2026-10-27', 'ABSENT', { status: 'CANCELLED' }),
      row('2026-10-29', 'ABSENT'),
    ];
    expect(streakOf(rows, now)).toBe(1);
  });

  it('is 0 with no rows', () => {
    expect(streakOf(null, now)).toBe(0);
    expect(streakOf([], now)).toBe(0);
  });
});

describe('weekOf', () => {
  it('starts on Monday', () => {
    expect(mondayOf('2026-10-27')).toBe('2026-10-26');
    expect(mondayOf('2026-10-26')).toBe('2026-10-26');
    expect(mondayOf('2026-11-01')).toBe('2026-10-26');
  });

  it('gives each day of Monday to Saturday its state', () => {
    const rows = [row('2026-10-26', 'PRESENT'), row('2026-10-26', 'PRESENT'), row('2026-10-28', 'PRESENT'), row('2026-10-28', 'ABSENT')];
    const week = weekOf(rows, '2026-10-29', 'WIB');
    expect(week.map((day) => day.state)).toEqual(['present', 'none', 'missed', 'today', 'future', 'future']);
    expect(week[0]).toMatchObject({ date: '2026-10-26', dayOfWeek: 1 });
  });

  it('reads the date in the school zone', () => {
    // 15:30Z on the 26th is 22:30 that day in WIB (+7), 00:30 on the 27th in WIT (+9).
    const rows = [{ status: 'PRESENT', session: { status: 'SCHEDULED', startsAt: '2026-10-26T15:30:00Z' } }];
    expect(weekOf(rows, '2026-10-28', 'WIT')[1].state).toBe('present');
    expect(weekOf(rows, '2026-10-28', 'WIB')[0].state).toBe('present');
  });

  it('is empty before the date is known', () => {
    expect(weekOf([], '', 'WIB')).toEqual([]);
  });
});

describe('weekAssessmentsOf', () => {
  const entry = (closesAt, status, assessment = {}) => ({
    status,
    assessment: { mode: 'ONLINE', type: 'KUIS', status: 'PUBLISHED', closesAt, ...assessment },
  });

  it('counts graded online ones closing this week, and those handed in', () => {
    const classes = [
      {
        assessments: [
          entry('2026-10-26T10:00:00Z', 'RELEASED'),
          entry('2026-10-28T16:59:00Z', 'WAITING_FOR_RELEASE'),
          entry('2026-10-30T16:59:00Z', 'NOT_STARTED'),
          entry('2026-11-02T16:59:00Z', 'NOT_STARTED'),
          entry('2026-10-27T16:59:00Z', 'DONE', { type: 'LATIHAN' }),
          entry('2026-10-27T16:59:00Z', 'NOT_STARTED', { mode: 'OFFLINE' }),
          entry('2026-10-27T16:59:00Z', 'NOT_STARTED', { status: 'CANCELLED' }),
        ],
      },
    ];
    expect(weekAssessmentsOf(classes, '2026-10-27', 'WIB')).toEqual({ done: 2, total: 3 });
  });

  it('takes Sunday night in the school zone as this week', () => {
    // 16:59Z on 1 Nov is 23:59 WIB on Sunday 1 Nov.
    const classes = [{ assessments: [entry('2026-11-01T16:59:00Z', 'NOT_STARTED')] }];
    expect(weekAssessmentsOf(classes, '2026-10-27', 'WIB').total).toBe(1);
  });
});

describe('dueToneOf and daysUntil', () => {
  const now = new Date('2026-10-27T03:00:00Z');

  it('marks closed ones late and the next 24 hours soon', () => {
    expect(dueToneOf('2026-10-27T02:59:00Z', now)).toBe('late');
    expect(dueToneOf('2026-10-28T03:00:00Z', now)).toBe('soon');
    expect(dueToneOf('2026-10-28T03:01:00Z', now)).toBe('');
  });

  it('counts whole school days', () => {
    expect(daysUntil('2026-10-27T16:59:00Z', '2026-10-27', 'WIB')).toBe(0);
    expect(daysUntil('2026-10-28T16:59:00Z', '2026-10-27', 'WIB')).toBe(1);
    expect(daysUntil('2026-10-25T16:59:00Z', '2026-10-27', 'WIB')).toBe(-2);
    // 17:30Z on the 27th is already the 28th in WIB.
    expect(daysUntil('2026-10-27T17:30:00Z', '2026-10-27', 'WIB')).toBe(1);
  });
});

describe('nextToFinishOf', () => {
  const now = new Date('2026-10-27T05:00:00Z');
  const meeting = (id, startsAt, published, completed, status = 'SCHEDULED') => ({ id, startsAt, status, content: { published, completed } });

  it('picks the earliest begun meeting with materials left', () => {
    const sessions = [
      meeting('c', '2026-10-20T00:00:00Z', 3, 1),
      meeting('a', '2026-10-13T00:00:00Z', 2, 2),
      meeting('b', '2026-10-15T00:00:00Z', 4, 2),
      meeting('d', '2026-10-29T00:00:00Z', 2, 0),
    ];
    expect(nextToFinishOf(sessions, now)).toEqual({ session: sessions[2], left: 2 });
  });

  it('skips cancelled meetings and is null when all is done', () => {
    const sessions = [meeting('a', '2026-10-13T00:00:00Z', 2, 0, 'CANCELLED'), meeting('b', '2026-10-15T00:00:00Z', 1, 1)];
    expect(nextToFinishOf(sessions, now)).toBeNull();
    expect(nextToFinishOf(null, now)).toBeNull();
  });
});
