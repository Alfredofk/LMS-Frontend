import { describe, it, expect } from 'vitest';

import { agendaOf, agendaStart, byDay, dayMarks, examsByDay, monthOf, monthRange, shiftMonth, teacherExamClasses, withoutExamWeekCancelled } from './lessonCalendar';

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
      { date: '2026-10-05', holidays: [{ id: 'h1', kind: 'SCHOOL', name: 'Libur' }], sessions: days.get('2026-10-05'), exams: [] },
      { date: '2026-10-20', holidays: [{ id: 'h2', kind: 'NATIONAL', name: 'Maulid' }], sessions: [], exams: [] },
    ]);
  });

  it('nothing to show is an empty list', () => {
    expect(agendaOf({ year: 2026, month: 9 }, '2026-10-21', days, holidays)).toEqual([]);
    expect(agendaOf({ year: 2026, month: 9 }, '2026-10-01', null, null)).toEqual([]);
  });
});

/* The menu's shape: assessment.menu.js menuOf, each entry's assessment from studentAssessmentView. */
describe("a student's exams by day (examsByDay)", () => {
  const entry = (id, type, opensAt, closesAt, over = {}) => ({
    assessment: { id, type, status: 'PUBLISHED', opensAt, closesAt, ...over },
    status: 'NOT_STARTED',
  });
  const classes = [
    {
      id: 'c1',
      assessments: [
        entry('uts-mtk', 'UTS', '2026-10-27T00:00:00.000Z', '2026-10-27T02:00:00.000Z'), // 07:00-09:00 WIB
        entry('kuis', 'KUIS', '2026-10-27T00:00:00.000Z', '2026-10-27T02:00:00.000Z'),
        entry('uts-gone', 'UTS', '2026-10-27T00:00:00.000Z', '2026-10-27T02:00:00.000Z', { status: 'CANCELLED' }),
        entry('uts-bio', 'UTS', '2026-10-26T23:30:00.000Z', '2026-10-27T01:00:00.000Z'), // 06:30-08:00 WIB
      ],
    },
    {
      id: 'c0',
      /* 13:00 on the 7th to 00:00 after the 9th, WIB. */
      assessments: [entry('uas-long', 'UAS', '2026-12-07T06:00:00.000Z', '2026-12-09T17:00:00.000Z')],
    },
  ];
  const exams = examsByDay(classes, 'WIB');

  it('keeps UTS and UAS not cancelled, by the school day, in opening order', () => {
    expect(exams.get('2026-10-27').map((row) => [row.entry.assessment.id, row.from, row.to])).toEqual([
      ['uts-bio', '06:30', '08:00'],
      ['uts-mtk', '07:00', '09:00'],
    ]);
  });

  it('shows a window of several days on each, a closing at midnight ending the day before', () => {
    const shown = ['2026-12-07', '2026-12-08', '2026-12-09', '2026-12-10'].map((date) => exams.get(date)?.map((row) => [row.from, row.to]));
    expect(shown).toEqual([[['13:00', '24:00']], [['00:00', '24:00']], [['00:00', '24:00']], undefined]);
  });

  it('reads in another zone, and nothing from nothing', () => {
    expect(examsByDay(classes, 'WIT').get('2026-10-27')[0]).toMatchObject({ from: '08:30', to: '10:00' });
    expect(examsByDay(null, 'WIB').size).toBe(0);
  });

  it('agendaOf lists an exam day and carries its exams', () => {
    const agenda = agendaOf({ year: 2026, month: 9 }, '2026-10-01', new Map(), new Map(), exams);
    expect(agenda.map((day) => [day.date, day.exams.length])).toEqual([['2026-10-27', 2]]);
  });

  it('drops the meetings cancelled for an Exam Week, and keeps every other', () => {
    const list = [
      session('a', '2026-10-27', '07:00', { status: 'CANCELLED', cancelReason: 'EXAM_WEEK' }),
      session('b', '2026-10-27', '07:00', { status: 'CANCELLED', cancelReason: 'HOLIDAY' }),
      session('c', '2026-10-27', '07:00'),
    ];
    expect(withoutExamWeekCancelled(list).map((row) => row.id)).toEqual(['b', 'c']);
  });
});

/* The marking queue's lists: markingQueue.js readMarkingQueue, each assessment from GET /assessments/class-subjects/:id. */
describe("a teacher's exams (teacherExamClasses)", () => {
  const row = { id: 'cs1', subject: { code: 'MTK', name: 'Matematika' }, class: { name: 'XI IPS', gradeLevel: 11 } };
  const a = (id, type, status) => ({ id, type, status, opensAt: '2026-10-27T00:00:00.000Z', closesAt: '2026-10-27T02:00:00.000Z' });
  const lists = [{ row, assessments: [a('uts', 'UTS', 'PUBLISHED'), a('draft', 'UAS', 'DRAFT'), a('gone', 'UTS', 'CANCELLED'), a('kuis', 'KUIS', 'PUBLISHED')] }];

  it("keeps published ones, with the row's subject and class, for examsByDay", () => {
    const [group] = teacherExamClasses(lists);
    expect(group.assessments.map((entry) => entry.assessment.id)).toEqual(['uts', 'kuis']);
    expect(group.assessments[0].assessment.classSubject).toEqual({ id: 'cs1', subject: row.subject, class: row.class });
    expect(group.assessments[0].row).toBe(row);
    expect(examsByDay(teacherExamClasses(lists), 'WIB').get('2026-10-27').map((item) => item.entry.assessment.id)).toEqual(['uts']);
  });

  it('answers an empty group for nothing', () => {
    expect(teacherExamClasses(null)).toEqual([{ assessments: [] }]);
  });
});
