import { describe, expect, it } from 'vitest';

import {
  addDays, classCount, currentSemester, dayMeetings, liveAssignments, openSemesterIds, teachingDay, uniqueStudentCount,
} from './teacherHome.js';

const row = (id, over = {}) => ({
  id,
  status: 'ACTIVE',
  endedAt: null,
  class: { id: `class-${id}`, name: `X-${id}`, gradeLevel: 10 },
  subject: { id: `sub-${id}`, code: 'MTK', name: 'Matematika' },
  semester: { id: 'sem-1', ordinal: 1, academicYear: '2026/2027' },
  ...over,
});

const session = (id, startsAt, endsAt, over = {}) => ({
  id,
  number: 1,
  startsAt,
  endsAt,
  status: 'SCHEDULED',
  local: { date: startsAt.slice(0, 10), start: '07:00', end: '08:30' },
  ...over,
});

describe('liveAssignments', () => {
  it('keeps ACTIVE rows not ended, drops pending, rejected and ended', () => {
    const rows = [row('a'), row('b', { status: 'PENDING' }), row('c', { status: 'REJECTED' }), row('d', { endedAt: '2026-09-01T00:00:00Z' })];
    expect(liveAssignments(rows).map((r) => r.id)).toEqual(['a']);
  });
  it('answers [] for nothing', () => expect(liveAssignments(undefined)).toEqual([]));

  it('drops an assignment whose year was closed (it stays ACTIVE on the server)', () => {
    const years = [
      { status: 'CLOSED', semesters: [{ id: 'sem-2028' }] },
      { status: 'ACTIVE', semesters: [{ id: 'sem-1' }] },
    ];
    const rows = [row('a'), row('old', { semester: { id: 'sem-2028', ordinal: 1, academicYear: '2028/2029' } })];
    expect(liveAssignments(rows, openSemesterIds(years)).map((r) => r.id)).toEqual(['a']);
  });
});

describe('openSemesterIds', () => {
  it('collects the semesters of ACTIVE years only', () => {
    const years = [
      { status: 'ACTIVE', semesters: [{ id: 's1' }, { id: 's2' }] },
      { status: 'CLOSED', semesters: [{ id: 'old' }] },
      { status: 'ACTIVE' },
    ];
    expect([...openSemesterIds(years)]).toEqual(['s1', 's2']);
  });
});

describe('classCount', () => {
  it('counts a class taught two subjects once', () => {
    expect(classCount([row('a'), row('b', { class: { id: 'class-a' } }), row('c')])).toBe(2);
  });
});

describe('uniqueStudentCount', () => {
  it('counts a student in two subjects once, and only those placed now', () => {
    const answers = [
      { students: [{ studentProfileId: 's1', placedNow: true }, { studentProfileId: 's2', placedNow: false }] },
      { students: [{ studentProfileId: 's1', placedNow: true }, { studentProfileId: 's3', placedNow: true }] },
    ];
    expect(uniqueStudentCount(answers)).toBe(2);
  });
  it('answers null when one read failed', () => {
    expect(uniqueStudentCount([{ students: [] }, null])).toBeNull();
  });
  it('answers 0 with no assignments', () => expect(uniqueStudentCount([])).toBe(0));
});

describe('currentSemester', () => {
  it('reads the first live row', () => expect(currentSemester([row('a')])).toEqual({ id: 'sem-1', ordinal: 1, academicYear: '2026/2027' }));
  it('answers null with none', () => expect(currentSemester([])).toBeNull());
});

/* A meeting on a school day at 07:00 WIB (00:00 UTC), 90 minutes. */
const on = (id, date, over = {}) =>
  session(id, `${date}T00:00:00Z`, `${date}T01:30:00Z`, { local: { date, start: '07:00', end: '08:30' }, ...over });

/* A row as sessions.service.js listTeaching answers it. */
const taught = (id, classSubjectId, date, over = {}) => ({
  ...on(id, date),
  classSubjectId,
  class: `X-${classSubjectId}`,
  academicYear: '2026/2027',
  subject: { code: 'MTK', name: 'Matematika' },
  ...over,
});

describe('dayMeetings - listTeaching rows as the day card draws them', () => {
  const live = [row('a'), row('b', { class: { id: 'class-b', name: 'X-b', gradeLevel: 11 } })];
  it("leaves out a closed year's meetings and adds each class's grade", () => {
    const out = dayMeetings(
      [taught('m1', 'a', '2026-10-12'), taught('m2', 'b', '2026-10-12'), taught('old', 'a', '2028-08-21', { academicYear: '2028/2029' })],
      live,
      new Set(['2026/2027'])
    );
    expect(out.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(out[0].class).toEqual({ name: 'X-a', gradeLevel: 10 });
    expect(out[1].class).toEqual({ name: 'X-b', gradeLevel: 11 });
  });
  it("keeps a successor's meeting of an ended assignment, without a grade, and leaves nothing out without years", () => {
    const out = dayMeetings([taught('s1', 'ended', '2026-10-12'), taught('old', 'a', '2028-08-21', { academicYear: '2028/2029' })], live, null);
    expect(out.map((m) => m.id)).toEqual(['s1', 'old']);
    expect(out[0].class).toEqual({ name: 'X-ended', gradeLevel: null });
  });
});

describe('addDays', () => {
  it('crosses a month end, and reaches the 42-day window', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-10-05', 41)).toBe('2026-11-15');
  });
});

describe('teachingDay', () => {
  const meetings = [
    on('a0', '2026-10-12'),
    on('a1', '2026-10-14'),
    on('a2', '2026-10-19'),
    session('b0', '2026-10-12T02:30:00Z', '2026-10-12T04:00:00Z', { local: { date: '2026-10-12', start: '09:30', end: '11:00' } }),
    on('bx', '2026-10-13', { status: 'CANCELLED' }),
  ];

  it("lists today's meetings soonest first, and no next", () => {
    const day = teachingDay(meetings, '2026-10-12', new Date('2026-10-12T00:30:00Z'));
    expect(day.meetings.map((m) => m.id)).toEqual(['a0', 'b0']);
    expect(day.next).toBeNull();
  });

  it('keeps a meeting already over today, and one cancelled today', () => {
    expect(teachingDay(meetings, '2026-10-12', new Date('2026-10-12T05:00:00Z')).meetings).toHaveLength(2);
    expect(teachingDay(meetings, '2026-10-13', new Date('2026-10-13T00:00:00Z')).meetings.map((m) => m.id)).toEqual(['bx']);
  });

  it('on a day with none, names the next meeting still to come', () => {
    const day = teachingDay(meetings, '2026-10-05', new Date('2026-10-05T03:00:00Z'));
    expect(day.meetings).toEqual([]);
    expect(day.next.id).toBe('a0');
  });

  it('passes over a cancelled meeting when naming the next', () => {
    const day = teachingDay([on('bx', '2026-10-13', { status: 'CANCELLED' }), on('b9', '2026-10-15')], '2026-10-12');
    expect(day.next.id).toBe('b9');
  });

  it('answers no next when nothing is still to come, and survives nothing read', () => {
    expect(teachingDay(meetings, '2026-12-01', new Date('2026-12-01T00:00:00Z')).next).toBeNull();
    expect(teachingDay(undefined, '2026-10-12')).toEqual({ meetings: [], next: null });
  });
});
