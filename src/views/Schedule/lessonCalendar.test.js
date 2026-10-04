import { describe, it, expect } from 'vitest';

import { agendaOf, agendaStart, byDay, dayMarks, monthOf, monthRange, shiftMonth } from './lessonCalendar';

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

describe('agendaStart — where the month\'s list begins', () => {
  it('a picked day in the month, else today in it, else the first', () => {
    expect(agendaStart({ year: 2026, month: 9 }, '2026-10-03', '2026-10-20')).toBe('2026-10-20');
    expect(agendaStart({ year: 2026, month: 9 }, '2026-10-03', '2026-11-02')).toBe('2026-10-03');
    expect(agendaStart({ year: 2026, month: 9 }, '2026-10-03')).toBe('2026-10-03');
    expect(agendaStart({ year: 2026, month: 10 }, '2026-10-03')).toBe('2026-11-01');
    expect(agendaStart({ year: 2026, month: 8 }, '2026-10-03')).toBe('2026-09-01');
  });
});

describe('agendaOf — lessons and holidays together, by day', () => {
  const days = byDay([session('a', '2026-10-05', '07:00'), session('b', '2026-10-02', '07:00'), session('c', '2026-11-02', '07:00')]);
  const holidays = new Map([
    ['2026-10-05', [{ id: 'h1', kind: 'SCHOOL', name: 'Libur' }]],
    ['2026-10-20', [{ id: 'h2', kind: 'NATIONAL', name: 'Maulid' }]],
    ['2026-09-30', [{ id: 'h3', kind: 'NATIONAL', name: 'Lain' }]],
  ]);

  it('from the start to the month\'s end, days with something only, both kinds on one day', () => {
    expect(agendaOf({ year: 2026, month: 9 }, '2026-10-03', days, holidays)).toEqual([
      { date: '2026-10-05', holidays: [{ id: 'h1', kind: 'SCHOOL', name: 'Libur' }], sessions: days.get('2026-10-05') },
      { date: '2026-10-20', holidays: [{ id: 'h2', kind: 'NATIONAL', name: 'Maulid' }], sessions: [] },
    ]);
  });

  it('nothing to show is an empty list', () => {
    expect(agendaOf({ year: 2026, month: 9 }, '2026-10-21', days, holidays)).toEqual([]);
    expect(agendaOf({ year: 2026, month: 9 }, '2026-10-01', null, null)).toEqual([]);
  });
});
