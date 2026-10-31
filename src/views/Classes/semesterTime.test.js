import { describe, expect, it } from 'vitest';

import { dayNumber, spanOf, semesterTimeOf, deadlineSoonOf } from './semesterTime';

/* A semester as academics.service.js answers it: calendar days stored as midnight UTC. */
const sem = (startDate, endDate, classSubjectRegistrationDeadline = null) => ({
  startDate: `${startDate}T00:00:00.000Z`,
  endDate: `${endDate}T00:00:00.000Z`,
  classSubjectRegistrationDeadline: classSubjectRegistrationDeadline && `${classSubjectRegistrationDeadline}T00:00:00.000Z`,
});

describe('dayNumber and spanOf', () => {
  it('read a calendar day whatever follows it, and nothing as null', () => {
    expect(dayNumber('2026-10-31')).toBe(dayNumber('2026-10-31T00:00:00.000Z'));
    expect(dayNumber('2026-11-01') - dayNumber('2026-10-31')).toBe(1);
    expect(dayNumber(null)).toBeNull();
    expect(dayNumber('rubbish')).toBeNull();
  });

  it('say days under a week and whole weeks from seven', () => {
    expect(spanOf(0)).toEqual({ unit: 'day', n: 0 });
    expect(spanOf(6)).toEqual({ unit: 'day', n: 6 });
    expect(spanOf(7)).toEqual({ unit: 'week', n: 1 });
    expect(spanOf(65)).toEqual({ unit: 'week', n: 9 });
  });
});

describe('semesterTimeOf', () => {
  const first = sem('2026-07-13', '2026-12-19');

  it('counts the week a running semester is in, its length and what is left', () => {
    const at = semesterTimeOf(first, '2026-10-31');
    expect(at).toMatchObject({ phase: 'running', week: 16, weeks: 23, left: { unit: 'week', n: 7 } });
    expect(at.fraction).toBeCloseTo(111 / 160);
  });

  it('starts at week 1 on the first day and ends with 0 days left on the last', () => {
    expect(semesterTimeOf(first, '2026-07-13')).toMatchObject({ phase: 'running', week: 1, fraction: 1 / 160 });
    expect(semesterTimeOf(first, '2026-07-19').week).toBe(1);
    expect(semesterTimeOf(first, '2026-07-20').week).toBe(2);
    expect(semesterTimeOf(first, '2026-12-19')).toMatchObject({ phase: 'running', week: 23, left: { unit: 'day', n: 0 }, fraction: 1 });
  });

  it('says when one not begun starts, and that one past is over', () => {
    expect(semesterTimeOf(sem('2027-01-04', '2027-06-30'), '2026-10-31')).toEqual({ phase: 'upcoming', startsIn: { unit: 'week', n: 9 } });
    expect(semesterTimeOf(sem('2027-01-04', '2027-06-30'), '2027-01-01')).toEqual({ phase: 'upcoming', startsIn: { unit: 'day', n: 3 } });
    expect(semesterTimeOf(first, '2026-12-20')).toEqual({ phase: 'over' });
  });

  it('answers null without a date, or with dates the wrong way round', () => {
    expect(semesterTimeOf(first, '')).toBeNull();
    expect(semesterTimeOf({ startDate: null, endDate: first.endDate }, '2026-10-31')).toBeNull();
    expect(semesterTimeOf(sem('2026-12-19', '2026-07-13'), '2026-10-31')).toBeNull();
  });
});

describe('deadlineSoonOf', () => {
  it('gives the days left from the day itself to a week before', () => {
    expect(deadlineSoonOf(sem('2026-07-13', '2026-12-19', '2026-11-05'), '2026-10-31')).toBe(5);
    expect(deadlineSoonOf(sem('2026-07-13', '2026-12-19', '2026-11-05'), '2026-11-05')).toBe(0);
    expect(deadlineSoonOf(sem('2026-07-13', '2026-12-19', '2026-11-07'), '2026-10-31')).toBe(7);
  });

  it('is null further off, once past, or with no deadline', () => {
    expect(deadlineSoonOf(sem('2026-07-13', '2026-12-19', '2026-11-08'), '2026-10-31')).toBeNull();
    expect(deadlineSoonOf(sem('2026-07-13', '2026-12-19', '2026-10-30'), '2026-10-31')).toBeNull();
    expect(deadlineSoonOf(sem('2026-07-13', '2026-12-19'), '2026-10-31')).toBeNull();
  });
});
