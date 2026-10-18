import { describe, it, expect } from 'vitest';

import {
  defaultExamSemester,
  examWeekBody,
  examWeekErrors,
  examWeekItems,
  examWeekSemesters,
  examWeeksForGrades,
  examWeekReminder,
  reminderYears,
  taughtGrades,
  toggleGrade,
} from './examWeeks.js';
import { calendarItems, offDaysOf } from '../../utils/holidays.js';

/* Shapes from holidays.examWeeks.js examWeekView and academics.service.js yearSelect (backend cbec3b6). */
const week = {
  id: 'w1',
  semesterId: 's1',
  type: 'UTS',
  name: 'UTS Semester 1',
  startDate: '2026-10-05',
  endDate: '2026-10-10',
  gradeLevels: [7, 8],
  withdrawnAt: null,
};

const years = [
  {
    id: 'y2',
    label: '2027/2028',
    status: 'ACTIVE',
    semesters: [{ id: 's3', ordinal: 1, status: 'OPEN', startDate: '2027-07-12T00:00:00.000Z', endDate: '2027-12-18T00:00:00.000Z' }],
  },
  {
    id: 'y1',
    label: '2026/2027',
    status: 'ACTIVE',
    semesters: [
      { id: 's1', ordinal: 1, status: 'FINALIZING', startDate: '2026-07-13T00:00:00.000Z', endDate: '2026-12-19T00:00:00.000Z' },
      { id: 's2', ordinal: 2, status: 'CLOSED', startDate: '2027-01-04T00:00:00.000Z', endDate: '2027-06-19T00:00:00.000Z' },
    ],
  },
  {
    id: 'y0',
    label: '2025/2026',
    status: 'CLOSED',
    semesters: [{ id: 's0', ordinal: 1, status: 'OPEN', startDate: '2025-07-14T00:00:00.000Z', endDate: '2025-12-20T00:00:00.000Z' }],
  },
];

const semester = { id: 's1', ordinal: 1, yearLabel: '2026/2027', startDate: '2026-07-13', endDate: '2026-12-19' };

const form = (over = {}) => ({
  semesterId: 's1',
  type: 'UTS',
  name: 'UTS Semester 1',
  startDate: '2026-10-05',
  endDate: '2026-10-10',
  gradeLevels: [7, 8, 9],
  ...over,
});

describe('examWeekItems', () => {
  it('puts each week in the calendar item shape', () => {
    expect(examWeekItems({ examWeeks: [week] })).toEqual([
      { ...week, source: 'EXAM_WEEK', kind: 'EXAM_WEEK', start: '2026-10-05', end: '2026-10-10' },
    ]);
  });

  it('answers nothing for no data, or a calendar from before cbec3b6', () => {
    expect(examWeekItems(null)).toEqual([]);
    expect(examWeekItems({ national: [], school: [] })).toEqual([]);
  });

  it('is never a day off: calendarItems leaves it out', () => {
    expect(offDaysOf(calendarItems({ national: [], school: [], examWeeks: [week] }))).toEqual([]);
  });
});

describe('examWeekSemesters (assertSemesterTakesExamWeeks)', () => {
  it('keeps OPEN and FINALIZING semesters of ACTIVE years, as calendar days', () => {
    expect(examWeekSemesters(years)).toEqual([
      { id: 's3', ordinal: 1, yearLabel: '2027/2028', startDate: '2027-07-12', endDate: '2027-12-18' },
      semester,
    ]);
  });

  it('answers nothing for nothing', () => {
    expect(examWeekSemesters(null)).toEqual([]);
  });
});

describe('defaultExamSemester', () => {
  const list = examWeekSemesters(years);

  it('opens on the one running today', () => {
    expect(defaultExamSemester(list, '2026-10-18')).toBe('s1');
  });

  it('else the next to start', () => {
    expect(defaultExamSemester(list, '2027-01-10')).toBe('s3');
  });

  it('else the first listed, and null for none', () => {
    expect(defaultExamSemester(list, '2028-03-01')).toBe('s3');
    expect(defaultExamSemester([], '2026-10-18')).toBeNull();
  });
});

describe('examWeekErrors (holidays.schema.js examWeekBody, addExamWeek)', () => {
  it('passes a whole form', () => {
    expect(examWeekErrors(form(), semester)).toEqual({});
  });

  it('wants a semester and a type', () => {
    expect(examWeekErrors(form(), null).semesterId).toEqual({ key: 'exam.error.semester' });
    expect(examWeekErrors(form({ type: 'KUIS' }), semester).type).toEqual({ key: 'exam.error.type' });
  });

  it('holds the name to 3-150 after trimming', () => {
    expect(examWeekErrors(form({ name: '  ab  ' }), semester).name).toEqual({ key: 'exam.error.name' });
    expect(examWeekErrors(form({ name: 'abc' }), semester).name).toBeUndefined();
    expect(examWeekErrors(form({ name: 'x'.repeat(150) }), semester).name).toBeUndefined();
    expect(examWeekErrors(form({ name: 'x'.repeat(151) }), semester).name).toEqual({ key: 'exam.error.nameLong' });
  });

  it('wants both days, the end not before the start', () => {
    expect(examWeekErrors(form({ startDate: '' }), semester).startDate).toEqual({ key: 'validation.holiday.startRequired' });
    expect(examWeekErrors(form({ endDate: '' }), semester).endDate).toEqual({ key: 'validation.holiday.endRequired' });
    expect(examWeekErrors(form({ endDate: '2026-10-04' }), semester).endDate).toEqual({ key: 'validation.holiday.endBeforeStart' });
    expect(examWeekErrors(form({ endDate: '2026-10-05' }), semester)).toEqual({});
  });

  it('takes at most 31 days: (end - start) / DAY < 31', () => {
    expect(examWeekErrors(form({ startDate: '2026-10-01', endDate: '2026-10-31' }), semester)).toEqual({});
    expect(examWeekErrors(form({ startDate: '2026-10-01', endDate: '2026-11-01' }), semester).endDate).toEqual({
      key: 'exam.error.tooLong',
      vars: { n: 31 },
    });
  });

  it('lies inside the semester, its first and last day included', () => {
    expect(examWeekErrors(form({ startDate: '2026-07-13', endDate: '2026-07-14' }), semester)).toEqual({});
    expect(examWeekErrors(form({ startDate: '2026-12-18', endDate: '2026-12-19' }), semester)).toEqual({});
    const outside = { key: 'exam.error.outside', vars: { start: '2026-07-13', end: '2026-12-19' } };
    expect(examWeekErrors(form({ startDate: '2026-07-12', endDate: '2026-07-14' }), semester).startDate).toEqual(outside);
    expect(examWeekErrors(form({ startDate: '2026-12-18', endDate: '2026-12-20' }), semester).startDate).toEqual(outside);
  });

  it('wants a grade level', () => {
    expect(examWeekErrors(form({ gradeLevels: [] }), semester).gradeLevels).toEqual({ key: 'exam.error.grades' });
  });
});

describe('examWeekBody', () => {
  it('sends the trimmed name and the grades ascending, nothing else', () => {
    expect(examWeekBody({ ...form({ name: '  UTS  ', gradeLevels: [9, 7] }), touchedGrades: true })).toEqual({
      semesterId: 's1',
      type: 'UTS',
      name: 'UTS',
      startDate: '2026-10-05',
      endDate: '2026-10-10',
      gradeLevels: [7, 9],
    });
  });
});

describe('toggleGrade', () => {
  it('adds in order and removes', () => {
    expect(toggleGrade([7, 9], 8)).toEqual([7, 8, 9]);
    expect(toggleGrade([7, 8, 9], 8)).toEqual([7, 9]);
    expect(toggleGrade(undefined, 7)).toEqual([7]);
  });
});

describe("a reader's own Exam Weeks on the lesson calendar", () => {
  const items = examWeekItems({ examWeeks: [week, { ...week, id: 'w2', gradeLevels: [12] }, { ...week, id: 'w3', gradeLevels: [8, 9, 12] }] });

  it("keeps the weeks naming a reader's grade, with the grades shown", () => {
    expect(examWeeksForGrades(items, [8]).map((item) => [item.id, item.shownGrades])).toEqual([
      ['w1', [8]],
      ['w3', [8]],
    ]);
    expect(examWeeksForGrades(items, [9, 12]).map((item) => [item.id, item.shownGrades])).toEqual([
      ['w2', [12]],
      ['w3', [9, 12]],
    ]);
  });

  it('shows none to a reader with no grade (a student not placed)', () => {
    expect(examWeeksForGrades(items, [])).toEqual([]);
    expect(examWeeksForGrades(items, null)).toEqual([]);
    expect(examWeeksForGrades(items, [10])).toEqual([]);
  });

  it("a teacher's grades: live assignments in open years, once each, ascending", () => {
    const open = new Set(['2026/2027']);
    const row = (over) => ({ status: 'ACTIVE', endedAt: null, semester: { academicYear: '2026/2027' }, class: { gradeLevel: 11 }, ...over });
    const rows = [
      row({ class: { gradeLevel: 12 } }),
      row({}),
      row({}),
      row({ class: { gradeLevel: 10 }, status: 'PENDING' }),
      row({ class: { gradeLevel: 9 }, endedAt: '2026-10-01T00:00:00Z' }),
      row({ class: { gradeLevel: 7 }, semester: { academicYear: '2025/2026' } }),
    ];
    expect(taughtGrades(rows, open)).toEqual([11, 12]);
    expect(taughtGrades(rows, null)).toEqual([7, 11, 12]);
    expect(taughtGrades(null, open)).toEqual([]);
  });
});

describe("the dashboards' reminder (examWeekReminder)", () => {
  const item = (id, start, end) => ({ id, start, end });
  const uts = item('uts', '2026-10-26', '2026-10-31');
  const uas = item('uas', '2026-12-07', '2026-12-12');

  it('says how far off a week starting within 14 days is', () => {
    expect(examWeekReminder([uas, uts], '2026-10-18')).toEqual({ kind: 'soon', week: uts, days: 8 });
    expect(examWeekReminder([uts], '2026-10-12')).toEqual({ kind: 'soon', week: uts, days: 14 });
    expect(examWeekReminder([uts], '2026-10-25')).toEqual({ kind: 'soon', week: uts, days: 1 });
  });

  it('says nothing further off than 14 days, nor after the week', () => {
    expect(examWeekReminder([uts], '2026-10-11')).toBeNull();
    expect(examWeekReminder([uts], '2026-11-01')).toBeNull();
    expect(examWeekReminder([], '2026-10-18')).toBeNull();
    expect(examWeekReminder([uts], '')).toBeNull();
  });

  it('says a running week on its first and last day, before one coming soon', () => {
    expect(examWeekReminder([uts], '2026-10-26')).toEqual({ kind: 'running', week: uts });
    expect(examWeekReminder([uts], '2026-10-31')).toEqual({ kind: 'running', week: uts });
    const next = item('next', '2026-11-02', '2026-11-03');
    expect(examWeekReminder([next, uts], '2026-10-30')).toEqual({ kind: 'running', week: uts });
  });

  it('reads next year too when the 14 days cross New Year', () => {
    expect(reminderYears('2026-10-18')).toEqual([2026]);
    expect(reminderYears('2026-12-17')).toEqual([2026]);
    expect(reminderYears('2026-12-18')).toEqual([2026, 2027]);
    expect(reminderYears('')).toEqual([]);
  });
});
