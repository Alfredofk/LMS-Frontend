import { describe, it, expect } from 'vitest';

import { belowCountOf, classSignalView, filterCounts, initialsOf, studentsFor, waitingOf } from './homeroomSummary.js';

const student = (fullName, { signals = [], grades = [] } = {}) => ({ studentProfileId: fullName, fullName, signals, grades });

const grade = (belowKktp, waiting = 0) => ({ classSubjectId: 'x', finalGrade: belowKktp ? 60 : 80, belowKktp, waiting });

describe('a student counted', () => {
  it('counts the subjects under the KKTP and the assessments waiting', () => {
    const one = student('A', { grades: [grade(true, 1), grade(false, 2), grade(true)] });
    expect(belowCountOf(one)).toBe(2);
    expect(waitingOf(one)).toBe(3);
    expect(belowCountOf(student('B'))).toBe(0);
  });
});

describe('studentsFor', () => {
  const rows = [
    student('Anisa'),
    student('Bagas', { signals: [{ type: 'FREQUENT_ABSENCE' }] }),
    student('Citra', { grades: [grade(true)] }),
    student('Dimas', { signals: [{ type: 'BELOW_KKTP' }], grades: [grade(true)] }),
  ];

  it('puts those with a signal first and keeps the order otherwise', () => {
    expect(studentsFor(rows).map((row) => row.fullName)).toEqual(['Bagas', 'Dimas', 'Anisa', 'Citra']);
  });

  it('keeps only what a filter asks for', () => {
    expect(studentsFor(rows, 'SIGNAL').map((row) => row.fullName)).toEqual(['Bagas', 'Dimas']);
    expect(studentsFor(rows, 'BELOW').map((row) => row.fullName)).toEqual(['Dimas', 'Citra']);
  });

  it('counts each filter', () => {
    expect(filterCounts(rows)).toEqual({ ALL: 4, SIGNAL: 2, BELOW: 2 });
    expect(filterCounts(null)).toEqual({ ALL: 0, SIGNAL: 0, BELOW: 0 });
  });
});

describe('classSignalView', () => {
  const thresholds = { absenceWindowDays: 14 };

  it('says absences in days for the class', () => {
    expect(classSignalView({ type: 'FREQUENT_ABSENCE', value: 3, threshold: 3 }, thresholds)).toEqual({
      key: 'homeroom.sum.signal.absenceDays',
      vars: { n: 3, days: 14, limit: 3 },
    });
  });

  it('says inactivity across every subject, or never active', () => {
    expect(classSignalView({ type: 'INACTIVE', value: 8, threshold: 7 }, thresholds).key).toBe('homeroom.sum.signal.inactive');
    expect(classSignalView({ type: 'INACTIVE', value: null, threshold: 7 }, thresholds).key).toBe('homeroom.sum.signal.neverActive');
  });

  it("borrows the teacher's sentence for the rest", () => {
    expect(classSignalView({ type: 'BELOW_KKTP', value: 62, threshold: 75 }, thresholds)).toEqual({
      key: 'teacherDash.signal.belowKktp',
      vars: { n: 62, kktp: 75 },
      number: true,
    });
    expect(classSignalView({ type: 'SOMETHING_NEW' }, thresholds)).toBeNull();
  });
});

describe('initialsOf', () => {
  it('takes the first letters of two words', () => {
    expect(initialsOf('bagas pratama putra')).toBe('BP');
    expect(initialsOf('Citra')).toBe('C');
    expect(initialsOf('')).toBe('');
  });
});
