import { describe, it, expect } from 'vitest';

import { localOf, summarize, bySubject, groupKey, historyOf, rosterCounts, attendanceStat, semesterRate } from './attendance.js';

/* A row as attendance.service.js `mine` answers it: attendanceView plus its sessionView. */
let next = 0;
const row = (status, { code = 'MTK', name = 'Matematika', className = 'XI IPS', startsAt = '2026-09-07T00:00:00.000Z', number = 1, confirmed = true, late = false, outsideSchool = false, sessionStatus = 'SCHEDULED' } = {}) => {
  next += 1;
  return {
    id: `a${next}`,
    studentProfileId: 'sp1',
    status,
    checkedInAt: status === 'PRESENT' ? startsAt : null,
    outsideSchool,
    late,
    session: {
      id: `s${next}`,
      number,
      startsAt,
      endsAt: startsAt,
      status: sessionStatus,
      needsCompletion: false,
      confirmed,
      completedAt: confirmed ? startsAt : null,
      class: className,
      subject: { code, name },
    },
  };
};

describe('localOf — the school’s own day and clock, as shared/timeZone.js utcToLocal', () => {
  it('moves 23:30 UTC into the next day in WITA', () => {
    expect(localOf('2026-07-12T23:30:00.000Z', 'WITA')).toEqual({ date: '2026-07-13', time: '07:30', dayOfWeek: 1 });
  });

  it('uses each zone’s own offset', () => {
    expect(localOf('2026-07-13T00:00:00.000Z', 'WIB').time).toBe('07:00');
    expect(localOf('2026-07-13T00:00:00.000Z', 'WIT').time).toBe('09:00');
  });

  it('names Sunday 7, the way a timetable is read', () => {
    expect(localOf('2026-07-12T03:00:00.000Z', 'WIB').dayOfWeek).toBe(7);
  });

  it('answers null for a time that is not one', () => {
    expect(localOf('not a date', 'WIB')).toBeNull();
  });
});

describe('summarize — counted over confirmed meetings only', () => {
  it('counts each status and the rate of PRESENT among the confirmed', () => {
    const s = summarize([row('PRESENT'), row('PRESENT'), row('PRESENT'), row('SICK'), row('ABSENT')]);
    expect(s).toMatchObject({ confirmed: 5, PRESENT: 3, SICK: 1, EXCUSED: 0, ABSENT: 1, rate: 60, pending: 0 });
  });

  it('leaves a check-in the teacher has not confirmed out of the counts and the rate', () => {
    const s = summarize([row('PRESENT'), row('ABSENT'), row('PRESENT', { confirmed: false })]);
    expect(s).toMatchObject({ confirmed: 2, PRESENT: 1, pending: 1, rate: 50 });
  });

  it('has no rate before anything is confirmed', () => {
    expect(summarize([row('PRESENT', { confirmed: false })]).rate).toBeNull();
    expect(summarize([]).rate).toBeNull();
    expect(summarize(null).confirmed).toBe(0);
  });

  it('counts late and outside check-ins, confirmed or not', () => {
    const s = summarize([row('PRESENT', { late: true }), row('PRESENT', { confirmed: false, late: true, outsideSchool: true })]);
    expect(s).toMatchObject({ late: 2, outside: 1 });
  });

  it('never counts a meeting cancelled after the fact', () => {
    const s = summarize([row('PRESENT'), row('ABSENT', { sessionStatus: 'CANCELLED' })]);
    expect(s).toMatchObject({ confirmed: 1, ABSENT: 0, rate: 100 });
  });

  it('rounds the rate to a whole percent', () => {
    expect(summarize([row('PRESENT'), row('PRESENT'), row('ABSENT')]).rate).toBe(67);
  });
});

describe('bySubject — each subject with its own numbers', () => {
  it('groups by code and orders by name', () => {
    const groups = bySubject([
      row('PRESENT', { code: 'MTK', name: 'Matematika' }),
      row('ABSENT', { code: 'EKO', name: 'Ekonomi' }),
      row('PRESENT', { code: 'MTK', name: 'Matematika' }),
    ]);
    expect(groups.map((g) => [g.subject.code, g.confirmed, g.rate])).toEqual([
      ['EKO', 1, 0],
      ['MTK', 2, 100],
    ]);
  });

  it('answers nothing for nothing', () => {
    expect(bySubject([])).toEqual([]);
  });

  it('counts one subject in two classes apart — a move, or a new year (backend 87f2670)', () => {
    const groups = bySubject([
      row('PRESENT', { code: 'MTK', name: 'Matematika', className: 'XI IPS' }),
      row('ABSENT', { code: 'MTK', name: 'Matematika', className: 'X IPS' }),
      row('PRESENT', { code: 'MTK', name: 'Matematika', className: 'XI IPS' }),
    ]);
    expect(groups.map((g) => [g.key, g.className, g.confirmed, g.rate])).toEqual([
      ['MTK@X IPS', 'X IPS', 1, 0],
      ['MTK@XI IPS', 'XI IPS', 2, 100],
    ]);
  });
});

describe('historyOf — newest first, one subject or all', () => {
  const a = row('PRESENT', { code: 'MTK', startsAt: '2026-09-07T00:00:00.000Z', number: 1 });
  const b = row('ABSENT', { code: 'EKO', startsAt: '2026-09-09T00:00:00.000Z', number: 1 });
  const c = row('SICK', { code: 'MTK', startsAt: '2026-09-14T00:00:00.000Z', number: 2 });

  it('orders by the meeting’s start, newest first, whatever order they came in', () => {
    expect(historyOf([a, b, c]).map((r) => r.id)).toEqual([c.id, b.id, a.id]);
  });

  it('narrows to one subject', () => {
    expect(historyOf([a, b, c], 'MTK@XI IPS').map((r) => r.id)).toEqual([c.id, a.id]);
  });

  it('narrows to one subject in one class, not the same subject elsewhere', () => {
    const d = row('PRESENT', { code: 'MTK', className: 'X IPS', startsAt: '2026-08-03T00:00:00.000Z' });
    expect(historyOf([a, b, c, d], 'MTK@X IPS').map((r) => r.id)).toEqual([d.id]);
    expect(groupKey(d)).toBe('MTK@X IPS');
  });

  it('does not reorder the list it was given', () => {
    const list = [a, b, c];
    historyOf(list);
    expect(list.map((r) => r.id)).toEqual([a.id, b.id, c.id]);
  });
});

describe('rosterCounts — one meeting, by status', () => {
  /* A student as rosterView answers: status null until a check-in or the confirmation. */
  const student = (status) => ({ studentProfileId: 'sp', fullName: 'X', attendanceId: status ? 'a' : null, status, checkedInAt: null, outsideSchool: false, late: false });

  it('counts each status, and those with no record yet', () => {
    expect(rosterCounts([student('PRESENT'), student('PRESENT'), student('SICK'), student('ABSENT'), student(null), student(null)])).toEqual({
      PRESENT: 2,
      SICK: 1,
      EXCUSED: 0,
      ABSENT: 1,
      unmarked: 2,
    });
  });

  it('answers zeros for nothing', () => {
    expect(rosterCounts(null)).toEqual({ PRESENT: 0, SICK: 0, EXCUSED: 0, ABSENT: 0, unmarked: 0 });
  });
});

describe('attendanceStat — the dashboard card', () => {
  it('gives the rate and how many confirmed meetings it is over', () => {
    expect(attendanceStat([row('PRESENT'), row('PRESENT'), row('ABSENT')])).toEqual({
      value: '67%',
      lines: [{ key: 'dash.att.of', vars: { present: 2, n: 3 } }],
    });
  });

  it('adds the meetings still waiting for the teacher', () => {
    expect(attendanceStat([row('PRESENT'), row('PRESENT', { confirmed: false })]).lines).toEqual([
      { key: 'dash.att.of', vars: { present: 1, n: 1 } },
      { key: 'att.pendingCount', vars: { n: 1 } },
    ]);
  });

  it('says "-" while only check-ins wait, never 0%', () => {
    expect(attendanceStat([row('PRESENT', { confirmed: false })])).toEqual({
      value: '-',
      lines: [{ key: 'att.pendingCount', vars: { n: 1 } }],
    });
  });

  it('says there is nothing yet for no rows', () => {
    expect(attendanceStat([])).toEqual({ value: '-', lines: [{ key: 'dash.att.none' }] });
  });

  it('says the read failed, with no number', () => {
    expect(attendanceStat(null, true)).toEqual({ value: '-', lines: [{ key: 'dash.att.failed' }] });
  });

  it('shows nothing yet while reading', () => {
    expect(attendanceStat(null)).toEqual({ value: '…', lines: [] });
  });
});

describe('semesterRate - a member summary semester (attendanceSummary)', () => {
  it('is present over counted, rounded', () => {
    expect(semesterRate({ counted: 3, present: 2 })).toBe(67);
    expect(semesterRate({ counted: 4, present: 4 })).toBe(100);
  });

  it('is null with nothing counted', () => {
    expect(semesterRate({ counted: 0, present: 0 })).toBeNull();
    expect(semesterRate(undefined)).toBeNull();
  });
});
