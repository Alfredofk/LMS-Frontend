import { describe, it, expect } from 'vitest';

import { byDay, dayMarks, monthOf, monthRange, openingDay, shiftMonth } from './lessonCalendar';

/* A session as sessions.service.js `listMine` answers it — the fields this file reads. */
const session = (id, date, start, over = {}) => ({
  id,
  number: 1,
  status: 'SCHEDULED',
  local: { date, dayOfWeek: 1, start, end: start },
  ...over,
});

describe('monthRange — one request per month, inside the server\'s 42 days', () => {
  it('first to last day, February in a leap year and not', () => {
    expect(monthRange(2028, 1)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthRange(2026, 1)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange(2026, 11)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
});

describe('shiftMonth / monthOf', () => {
  it('crosses the year both ways', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth({ year: 2026, month: 5 }, -18)).toEqual({ year: 2024, month: 11 });
  });

  it('reads a calendar day without a Date', () => {
    expect(monthOf('2026-10-03')).toEqual({ year: 2026, month: 9 });
  });
});

describe('byDay — by the school\'s own day, in start order', () => {
  it('groups on local.date and orders each day by its start', () => {
    const days = byDay([
      session('b', '2026-10-05', '10:00'),
      session('a', '2026-10-05', '07:00'),
      session('c', '2026-10-06', '07:00'),
    ]);
    expect([...days.keys()]).toEqual(['2026-10-05', '2026-10-06']);
    expect(days.get('2026-10-05').map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('a meeting at 23:30 UTC belongs to the next day in WIB — the server\'s local.date says so', () => {
    const late = session('x', '2026-10-06', '06:30', { startsAt: '2026-10-05T23:30:00.000Z' });
    expect([...byDay([late]).keys()]).toEqual(['2026-10-06']);
  });
});

describe('dayMarks', () => {
  it('counts running and cancelled meetings apart', () => {
    expect(dayMarks([session('a', 'd', '07:00'), session('b', 'd', '08:00', { status: 'CANCELLED' })])).toEqual({ held: 1, cancelled: 1 });
    expect(dayMarks(undefined)).toEqual({ held: 0, cancelled: 0 });
  });
});

describe('openingDay — what a month opens on', () => {
  const days = byDay([session('a', '2026-11-09', '07:00'), session('b', '2026-11-03', '07:00')]);

  it('today, when today is in it', () => {
    expect(openingDay({ year: 2026, month: 9 }, '2026-10-03', days)).toBe('2026-10-03');
  });

  it('else its first day with a meeting', () => {
    expect(openingDay({ year: 2026, month: 10 }, '2026-10-03', days)).toBe('2026-11-03');
  });

  it('else its first day', () => {
    expect(openingDay({ year: 2026, month: 11 }, '2026-10-03', days)).toBe('2026-12-01');
    expect(openingDay({ year: 2026, month: 11 }, '2026-10-03', null)).toBe('2026-12-01');
  });
});
