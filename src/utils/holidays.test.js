import { describe, it, expect } from 'vitest';

import { todayIso, daysBetween, expandRange, monthGrid, nextHoliday, daysIndex, calendarItems, offDaysOf } from './holidays.js';

describe('calendarItems / offDaysOf — the calendar answer in one shape (holidays.service.js calendar)', () => {
  /* GET /holidays?year= : { observesJointLeave, national: [...], school: [...] } */
  const answer = {
    observesJointLeave: true,
    national: [
      { id: 'n1', date: '2026-12-25', name: 'Natal', kind: 'NATIONAL', observed: true, choice: null },
      { id: 'j1', date: '2026-12-24', name: 'Cuti Bersama Natal', kind: 'JOINT_LEAVE', observed: true, choice: null },
      { id: 'j2', date: '2026-12-26', name: 'Cuti Bersama Lain', kind: 'JOINT_LEAVE', observed: false, choice: false },
    ],
    school: [{ id: 's1', startDate: '2026-12-14', endDate: '2026-12-16', name: 'HUT Sekolah', withdrawnAt: null }],
  };

  it('puts all three sources in date order, with start and end', () => {
    const items = calendarItems(answer);
    expect(items.map((item) => item.id)).toEqual(['s1', 'j1', 'n1', 'j2']);
    expect(items[0]).toMatchObject({ kind: 'SCHOOL', source: 'SCHOOL', start: '2026-12-14', end: '2026-12-16' });
    expect(items[2]).toMatchObject({ kind: 'NATIONAL', start: '2026-12-25', end: '2026-12-25' });
  });

  it('marks an unobserved joint-leave day IN_SCHOOL, and leaves it out of the days off', () => {
    const items = calendarItems(answer);
    expect(items.find((item) => item.id === 'j2')).toMatchObject({ kind: 'IN_SCHOOL', source: 'JOINT_LEAVE' });
    expect(offDaysOf(items).map((item) => item.id)).toEqual(['s1', 'j1', 'n1']);
  });

  it('never names an unobserved joint-leave day as the next holiday', () => {
    const onlyUnobserved = { national: [answer.national[2]], school: [] };
    expect(nextHoliday(offDaysOf(calendarItems(onlyUnobserved)), '2026-12-01')).toBeNull();
  });

  it('answers nothing for no answer', () => {
    expect(calendarItems(null)).toEqual([]);
    expect(offDaysOf(undefined)).toEqual([]);
  });
});

describe('calendar days — the holiday screens (backend 9dee2e2)', () => {
  it("reads today from the reader's clock, not UTC", () => {
    // 00:30 on 1 January, local: still 1 January however far east the reader is.
    expect(todayIso(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
    expect(todayIso(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('counts whole days, across a month and a leap day', () => {
    expect(daysBetween('2026-09-28', '2026-10-01')).toBe(3);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2); // 2028 is a leap year
    expect(daysBetween('2026-10-01', '2026-09-28')).toBe(-3);
  });

  it('expands a range with both ends, and a single day to itself', () => {
    expect(expandRange('2026-03-20', '2026-03-24')).toEqual(['2026-03-20', '2026-03-21', '2026-03-22', '2026-03-23', '2026-03-24']);
    expect(expandRange('2026-08-17', '2026-08-17')).toEqual(['2026-08-17']);
    expect(expandRange('2026-08-18', '2026-08-17')).toEqual([]);
  });
});

describe('monthGrid — weeks start on Monday', () => {
  it('pads the first week to Monday: 1 March 2026 is a Sunday', () => {
    const weeks = monthGrid(2026, 2);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-03-01']);
    expect(weeks[1][0]).toBe('2026-03-02');
  });

  it('holds every day once, in whole weeks', () => {
    const weeks = monthGrid(2026, 1); // February 2026: 28 days, starts on a Sunday
    const days = weeks.flat().filter(Boolean);
    expect(days).toHaveLength(28);
    expect(days[27]).toBe('2026-02-28');
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });

  it('starts flush when the 1st is a Monday: June 2026', () => {
    expect(monthGrid(2026, 5)[0][0]).toBe('2026-06-01');
  });
});

describe('nextHoliday', () => {
  const items = [
    { start: '2026-12-25', end: '2026-12-25', name: 'Natal' },
    { start: '2026-08-17', end: '2026-08-17', name: 'HUT RI' },
    { start: '2026-10-05', end: '2026-10-07', name: 'Libur sekolah' },
  ];

  it('takes the soonest not yet over, with the days to it', () => {
    expect(nextHoliday(items, '2026-09-28')).toMatchObject({ name: 'Libur sekolah', days: 7 });
  });

  it('counts a run already under way as today', () => {
    expect(nextHoliday(items, '2026-10-06')).toMatchObject({ name: 'Libur sekolah', days: 0 });
  });

  it('is null once the year is over', () => {
    expect(nextHoliday(items, '2026-12-26')).toBeNull();
  });
});

describe('daysIndex', () => {
  it('puts every day of a run under it, and keeps two on one day', () => {
    const joint = { start: '2026-03-20', end: '2026-03-20', kind: 'JOINT_LEAVE' };
    const school = { start: '2026-03-19', end: '2026-03-21', kind: 'SCHOOL' };
    const index = daysIndex([joint, school]);
    expect(index.get('2026-03-20')).toEqual([joint, school]);
    expect(index.get('2026-03-21')).toEqual([school]);
    expect(index.has('2026-03-22')).toBe(false);
  });
});
