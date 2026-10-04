import { describe, expect, it } from 'vitest';

import { currentSubjects, defaultMeetingId, defaultSemesterId, matchesSearch, meetingState, meetingWhen, meetingWindow, nextMeetingAcross, progressOf, semestersOf, shownSessions } from './myClasses.js';

const session = (number, startsAt, extra = {}) => ({
  id: `s${number}`,
  number,
  startsAt,
  endsAt: new Date(new Date(startsAt).getTime() + 90 * 60 * 1000).toISOString(),
  status: 'SCHEDULED',
  cancelReason: null,
  completedAt: null,
  ...extra,
});

const subject = (id, semesterId, ordinal, extra = {}) => ({
  id,
  class: { id: 'c1', name: 'XI IPS' },
  subject: { id: `sub-${id}`, code: id.toUpperCase(), name: `Subject ${id}` },
  semester: { id: semesterId, ordinal, academicYear: '2028/2029' },
  teacher: { fullName: 'Bu Rina' },
  ...extra,
});

describe('shownSessions - as the calendars show them (SHOWN_ON_CALENDAR)', () => {
  it('drops only numbers cancelled because the timetable changed', () => {
    const list = [
      session(1, '2028-08-01T00:30:00Z'),
      session(2, '2028-08-08T00:30:00Z', { status: 'CANCELLED', cancelReason: 'HOLIDAY' }),
      session(3, '2028-08-15T00:30:00Z', { status: 'CANCELLED', cancelReason: 'SCHEDULE_CHANGED' }),
    ];
    expect(shownSessions(list).map((s) => s.number)).toEqual([1, 2]);
  });
});

describe('semestersOf', () => {
  it('lists each semester once, by ordinal', () => {
    const list = [subject('b', 'sem2', 2), subject('a', 'sem1', 1), subject('c', 'sem1', 1)];
    expect(semestersOf(list).map((s) => s.ordinal)).toEqual([1, 2]);
  });
});

describe('defaultSemesterId - the semester the meetings say is on', () => {
  const subjects = [subject('a', 'sem1', 1), subject('b', 'sem2', 2)];
  const sessionsById = {
    a: [session(1, '2028-07-17T00:30:00Z'), session(2, '2028-12-11T00:30:00Z')],
    b: [session(1, '2029-01-08T00:30:00Z'), session(2, '2029-06-04T00:30:00Z')],
  };

  it('opens the one whose meetings span now', () => {
    expect(defaultSemesterId(subjects, sessionsById, new Date('2028-09-01T00:00:00Z'))).toBe('sem1');
    expect(defaultSemesterId(subjects, sessionsById, new Date('2029-03-01T00:00:00Z'))).toBe('sem2');
  });

  it('between semesters, the last that has begun', () => {
    expect(defaultSemesterId(subjects, sessionsById, new Date('2028-12-25T00:00:00Z'))).toBe('sem1');
    expect(defaultSemesterId(subjects, sessionsById, new Date('2029-07-01T00:00:00Z'))).toBe('sem2');
  });

  it('before any meeting, the first', () => {
    expect(defaultSemesterId(subjects, sessionsById, new Date('2028-07-01T00:00:00Z'))).toBe('sem1');
  });

  it('with no meetings read, the first; with no subjects, none', () => {
    expect(defaultSemesterId(subjects, {}, new Date('2029-03-01T00:00:00Z'))).toBe('sem1');
    expect(defaultSemesterId([], {})).toBeNull();
  });
});

describe('progressOf - meetings over, running and next', () => {
  const list = [
    session(1, '2028-08-01T00:30:00Z'),
    session(2, '2028-08-08T00:30:00Z', { status: 'CANCELLED', cancelReason: 'HOLIDAY' }),
    session(3, '2028-08-15T00:30:00Z'),
    session(4, '2028-08-22T00:30:00Z'),
  ];

  it('counts scheduled meetings only, and finds the next', () => {
    const p = progressOf(list, new Date('2028-08-10T00:00:00Z'));
    expect(p).toMatchObject({ held: 1, total: 3, current: null });
    expect(p.next.number).toBe(3);
  });

  it('names the meeting running now', () => {
    const p = progressOf(list, new Date('2028-08-15T01:00:00Z'));
    expect(p.current.number).toBe(3);
    expect(p.next.number).toBe(4);
    expect(p.held).toBe(1);
  });

  it('is null when the meetings could not be read', () => {
    expect(progressOf(null)).toBeNull();
  });
});

describe('matchesSearch - the navbar ?q=', () => {
  const entry = subject('mtk', 'sem1', 1, { subject: { code: 'MTK', name: 'Matematika' } });
  it('matches code, name or teacher, any case', () => {
    expect(matchesSearch(entry, 'mat')).toBe(true);
    expect(matchesSearch(entry, 'mtk')).toBe(true);
    expect(matchesSearch(entry, 'rina')).toBe(true);
    expect(matchesSearch(entry, 'fisika')).toBe(false);
    expect(matchesSearch(entry, '  ')).toBe(true);
  });
});

describe("meetingState - what a meeting says about the student's attendance", () => {
  const now = new Date('2028-08-10T00:00:00Z');
  it('says why a meeting was cancelled', () => {
    expect(meetingState(session(2, '2028-08-08T00:30:00Z', { status: 'CANCELLED', cancelReason: 'HOLIDAY' }), null, now).key).toBe(
      'timetable.session.cancelled.HOLIDAY'
    );
  });

  it('says scheduled before it begins', () => {
    expect(meetingState(session(3, '2028-08-15T00:30:00Z'), null, now).key).toBe('timetable.session.scheduled');
  });

  it('gives the status, final only once confirmed', () => {
    const past = session(1, '2028-08-01T00:30:00Z');
    expect(meetingState(past, { status: 'PRESENT', session: { confirmed: false } }, now)).toEqual({
      key: 'att.status.PRESENT',
      status: 'PRESENT',
      final: false,
    });
    expect(meetingState(past, { status: 'SICK', session: { confirmed: true } }, now).final).toBe(true);
  });

  it('waits for the teacher when there is no row yet', () => {
    expect(meetingState(session(1, '2028-08-01T00:30:00Z'), null, now).key).toBe('att.pending');
  });
});

describe("meetingWhen - the school's own day and clock", () => {
  const s = { local: { date: '2028-10-16', start: '07:30', end: '09:00' } };
  const sameYear = new Date('2028-03-01T00:00:00Z');
  it('reads the day from local.date, whatever the browser zone', () => {
    // The locale decides the punctuation (Node and browsers differ); the day, date and clock are ours.
    expect(meetingWhen(s, 'en', { now: sameYear })).toMatch(/^Mon,? 16 Oct, 07:30$/);
    expect(meetingWhen(s, 'en', { withEnd: true, now: sameYear })).toMatch(/16 Oct, 07:30⁠-⁠09:00$/);
    expect(meetingWhen({}, 'en')).toBe('');
  });
  it('names the year when it is not this one', () => {
    const now = new Date('2026-10-04T00:00:00Z');
    expect(meetingWhen(s, 'en', { now })).toMatch(/16 Oct 2028, 07:30$/);
    expect(meetingWhen(s, 'id', { now })).toMatch(/16 Okt 2028, 07\.?30|16 Okt 2028, 07:30/);
  });
});

describe('defaultMeetingId - the meeting a subject opens on', () => {
  const list = [
    session(1, '2028-08-01T00:30:00Z'),
    session(2, '2028-08-08T00:30:00Z'),
    session(3, '2028-08-15T00:30:00Z', { status: 'CANCELLED', cancelReason: 'HOLIDAY' }),
  ];
  it('is the running one, else the next', () => {
    expect(defaultMeetingId(list, new Date('2028-08-01T01:00:00Z'))).toBe('s1');
    expect(defaultMeetingId(list, new Date('2028-08-05T00:00:00Z'))).toBe('s2');
  });
  it('with everything over, the last one held', () => {
    expect(defaultMeetingId(list, new Date('2028-09-01T00:00:00Z'))).toBe('s2');
  });
  it('is null with no meetings', () => {
    expect(defaultMeetingId([])).toBeNull();
  });
});

describe('meetingWindow - the tabs in view and the rest', () => {
  const list = Array.from({ length: 16 }, (_, i) => session(i + 1, `2028-08-${String(i + 1).padStart(2, '0')}T00:30:00Z`));
  const numbers = (w) => ({ shown: w.shown.map((s) => s.number), rest: w.rest.length });
  it('shows them all when they fit', () => {
    expect(numbers(meetingWindow(list.slice(0, 5), 's3'))).toEqual({ shown: [1, 2, 3, 4, 5], rest: 0 });
  });
  it('keeps the chosen one second-to-last, with the next in view', () => {
    expect(numbers(meetingWindow(list, 's12'))).toEqual({ shown: [6, 7, 8, 9, 10, 11, 12, 13], rest: 8 });
  });
  it('stops at either end', () => {
    expect(numbers(meetingWindow(list, 's2')).shown).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(numbers(meetingWindow(list, 's16')).shown).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
  });
});

describe('nextMeetingAcross - the next meeting of any subject', () => {
  const subjects = [subject('a', 'sem1', 1), subject('b', 'sem1', 1)];
  const sessionsById = {
    a: [session(1, '2028-08-03T00:30:00Z')],
    b: [session(1, '2028-08-02T00:30:00Z', { status: 'CANCELLED', cancelReason: 'HOLIDAY' }), session(2, '2028-08-04T00:30:00Z')],
  };
  it('is the earliest scheduled one still to start, with its subject', () => {
    const next = nextMeetingAcross(subjects, sessionsById, new Date('2028-08-01T00:00:00Z'));
    expect(next.entry.id).toBe('a');
    expect(next.session.number).toBe(1);
  });
  it('skips what has begun, and is null when nothing is left', () => {
    expect(nextMeetingAcross(subjects, sessionsById, new Date('2028-08-03T12:00:00Z')).entry.id).toBe('b');
    expect(nextMeetingAcross(subjects, sessionsById, new Date('2028-09-01T00:00:00Z'))).toBeNull();
    expect(nextMeetingAcross([], {})).toBeNull();
  });
});

describe('currentSubjects - the semester on, counted', () => {
  it('keeps the semester the meetings say is on', () => {
    const subjects = [subject('a', 'sem1', 1), subject('b', 'sem2', 2)];
    const sessionsById = { a: [session(1, '2028-08-01T00:30:00Z')], b: [session(1, '2029-01-08T00:30:00Z')] };
    const list = currentSubjects(subjects, sessionsById, new Date('2028-08-01T01:00:00Z'));
    expect(list.map((item) => item.entry.id)).toEqual(['a']);
    expect(list[0].progress).toMatchObject({ total: 1 });
  });
});
