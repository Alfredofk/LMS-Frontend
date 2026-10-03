import { describe, it, expect } from 'vitest';

import {
  WEEK_DAYS,
  ALL_DAYS,
  visibleDays,
  weekOf,
  slotErrors,
  slotsValid,
  payloadOf,
  classClash,
  parseClash,
  changeStage,
  sessionState,
  rosterOpenable,
  dayName,
  timeRange,
} from './timetable.js';

const slot = (dayOfWeek, start, end) => ({ dayOfWeek, start, end });
const row = (id, name) => ({ classSubjectId: id, status: 'ACTIVE', subject: { name }, teacher: { fullName: 'Guru' } });

describe('dayName — ISO days from Intl (1 Monday … 7 Sunday)', () => {
  it('names Monday 1 and Sunday 7 in both languages', () => {
    expect(dayName(1, 'en')).toBe('Monday');
    expect(dayName(7, 'en')).toBe('Sunday');
    expect(dayName(1, 'id')).toBe('Senin');
    expect(dayName(6, 'id')).toBe('Sabtu');
  });
});

describe('visibleDays / weekOf — Monday to Saturday, Sunday only when used', () => {
  it('draws six days, seven once a slot is on Sunday', () => {
    expect(visibleDays([slot(1, '07:00', '08:00')])).toEqual(WEEK_DAYS);
    expect(visibleDays([slot(7, '07:00', '08:00')])).toEqual(ALL_DAYS);
    expect(visibleDays(null)).toEqual(WEEK_DAYS);
  });

  it('puts every slot under its day in time order, with its row', () => {
    const mtk = row('a', 'Matematika');
    const eko = row('b', 'Ekonomi');
    const week = weekOf([
      { row: mtk, slots: [slot(1, '09:00', '10:00'), slot(3, '07:00', '08:00')] },
      { row: eko, slots: [slot(1, '07:00', '08:30')] },
    ]);
    expect(week.map((d) => d.day)).toEqual(WEEK_DAYS);
    expect(week[0].items.map((i) => i.row.subject.name)).toEqual(['Ekonomi', 'Matematika']);
    expect(week[2].items).toHaveLength(1);
    expect(week[1].items).toEqual([]);
  });
});

describe('slotErrors — sessions.schema.js scheduleBody', () => {
  it('needs at least one slot and allows at most 30', () => {
    expect(slotErrors([]).form).toBe('timetable.error.noSlots');
    const thirty = Array.from({ length: 30 }, (_, i) => slot(1 + (i % 6), `${String(6 + Math.floor(i / 6)).padStart(2, '0')}:00`, `${String(6 + Math.floor(i / 6)).padStart(2, '0')}:45`));
    expect(slotsValid(slotErrors(thirty))).toBe(true);
    expect(slotErrors([...thirty, slot(7, '07:00', '08:00')]).form).toBe('timetable.error.tooMany');
  });

  it('takes a day from 1 to 7, as the form sends it (a string)', () => {
    expect(slotErrors([slot('', '07:00', '08:00')]).rows[0].day).toBe('timetable.error.day');
    expect(slotErrors([slot('8', '07:00', '08:00')]).rows[0].day).toBe('timetable.error.day');
    expect(slotsValid(slotErrors([slot('7', '07:00', '08:00')]))).toBe(true);
  });

  it('takes HH:mm, 24-hour — 23:59 yes, 24:00 and 7:30 no', () => {
    expect(slotsValid(slotErrors([slot(1, '22:00', '23:59')]))).toBe(true);
    expect(slotErrors([slot(1, '23:00', '24:00')]).rows[0].end).toBe('timetable.error.time');
    expect(slotErrors([slot(1, '7:30', '08:00')]).rows[0].start).toBe('timetable.error.time');
  });

  it('must end after it starts — equal is refused', () => {
    expect(slotErrors([slot(1, '08:00', '08:00')]).rows[0].end).toBe('timetable.error.endBeforeStart');
    expect(slotErrors([slot(1, '08:00', '07:00')]).rows[0].end).toBe('timetable.error.endBeforeStart');
  });

  it('refuses two slots of one timetable that overlap, marked on the later one; touching is fine', () => {
    const errors = slotErrors([slot(1, '07:00', '08:30'), slot(1, '08:00', '09:00')]);
    expect(errors.rows[0]).toEqual({});
    expect(errors.rows[1].end).toBe('timetable.error.overlapSelf');
    expect(slotsValid(slotErrors([slot(1, '07:00', '08:00'), slot(1, '08:00', '09:00')]))).toBe(true);
    expect(slotsValid(slotErrors([slot(1, '07:00', '08:00'), slot(2, '07:00', '08:00')]))).toBe(true);
  });
});

describe('payloadOf — what PUT …/schedule takes', () => {
  it('turns the day into a number and orders by day and time', () => {
    expect(payloadOf([slot('3', '07:00', '08:00'), slot('1', '09:00', '10:00'), slot('1', '07:00', '08:00')])).toEqual([
      slot(1, '07:00', '08:00'),
      slot(1, '09:00', '10:00'),
      slot(3, '07:00', '08:00'),
    ]);
  });
});

describe('classClash — the same class, the half of assertNoClash the page can see', () => {
  const eko = row('b', 'Ekonomi');
  const others = [{ row: eko, slots: [slot(1, '07:00', '08:30')] }];

  it('finds an overlap with another subject of the class, and names it', () => {
    const clash = classClash([slot(1, '08:00', '09:00')], others);
    expect(clash).toEqual({ mine: slot(1, '08:00', '09:00'), theirs: slot(1, '07:00', '08:30'), row: eko });
  });

  it('lets a slot that only touches, or sits on another day, through', () => {
    expect(classClash([slot(1, '08:30', '09:00')], others)).toBeNull();
    expect(classClash([slot(2, '07:00', '08:30')], others)).toBeNull();
  });
});

describe("parseClash — the server's clash sentence (sessions.service.js describeSlot)", () => {
  it('reads a clash with the same teacher in another class', () => {
    expect(
      parseClash('Monday 07:00-08:30 clashes: this teacher already teaches Fisika in XI IPA at Monday 07:30-09:00')
    ).toEqual({
      kind: 'teacher',
      mine: slot(1, '07:00', '08:30'),
      theirs: slot(1, '07:30', '09:00'),
      subject: 'Fisika',
      className: 'XI IPA',
    });
  });

  it('reads a clash inside the class, names with spaces included', () => {
    expect(parseClash('Saturday 10:00-11:00 clashes: XI IPS 2 already has Bahasa Indonesia at Saturday 09:30-10:30')).toEqual({
      kind: 'class',
      mine: slot(6, '10:00', '11:00'),
      theirs: slot(6, '09:30', '10:30'),
      subject: 'Bahasa Indonesia',
      className: 'XI IPS 2',
    });
  });

  it('answers null for any other sentence, so it is shown as it came', () => {
    expect(parseClash('Semester 1 is not open')).toBeNull();
    expect(parseClash(undefined)).toBeNull();
  });
});

describe('changeStage — what a change reaches (replansFrom, ticket 09)', () => {
  const semester = { startDate: '2026-07-13T00:00:00.000Z' };
  const none = { scheduled: 0, cancelled: 0, needsCompletion: 0 };

  it('says there is no zone when replansFrom is null', () => {
    expect(changeStage({ replansFrom: null, slots: [], sessions: none }, semester)).toBe('NO_ZONE');
  });

  it('before the start, replansFrom is the first day', () => {
    expect(changeStage({ replansFrom: '2026-07-13', slots: [], sessions: none }, semester)).toBe('BEFORE_START');
  });

  it('after the start, a first timetable is told apart from a change', () => {
    expect(changeStage({ replansFrom: '2026-09-01', slots: [], sessions: none }, semester)).toBe('FIRST_AFTER_START');
    expect(changeStage({ replansFrom: '2026-09-01', slots: [slot(1, '07:00', '08:00')], sessions: none }, semester)).toBe('AFTER_START');
    /* Inherited Sessions and no slot of its own is not a first time either. */
    expect(changeStage({ replansFrom: '2026-09-01', slots: [], sessions: { ...none, scheduled: 4 } }, semester)).toBe('AFTER_START');
  });
});

describe('sessionState — sessionView into a word', () => {
  const now = new Date('2026-09-30T05:00:00Z');
  const base = { status: 'SCHEDULED', cancelReason: null, needsCompletion: false, completedAt: null };

  it('a cancelled one by its reason, before anything else', () => {
    expect(sessionState({ ...base, status: 'CANCELLED', cancelReason: 'HOLIDAY', needsCompletion: true }, now)).toBe(
      'timetable.session.cancelled.HOLIDAY'
    );
  });

  it('waiting for its teacher, then answered as held', () => {
    expect(sessionState({ ...base, needsCompletion: true }, now)).toBe('timetable.session.needsCompletion');
    expect(sessionState({ ...base, needsCompletion: true, completedAt: '2026-09-29T00:00:00Z' }, now)).toBe('timetable.session.completed');
  });

  it('otherwise scheduled ahead, or past once it has ended', () => {
    expect(sessionState({ ...base, endsAt: '2026-09-30T06:00:00Z' }, now)).toBe('timetable.session.scheduled');
    expect(sessionState({ ...base, endsAt: '2026-09-30T04:00:00Z' }, now)).toBe('timetable.session.past');
  });
});

describe('timeRange — a meeting time that never wraps', () => {
  it('joins both sides of the dash with a word joiner, so a narrow screen cannot break it', () => {
    expect(timeRange('07:00', '08:30')).toBe('07:00\u2060–\u206008:30');
    expect(timeRange('07:00', '08:30').replace(/\u2060/g, '')).toBe('07:00–08:30');
  });
});

describe('rosterOpenable — a meeting whose attendance can exist', () => {
  const now = new Date('2026-09-14T01:00:00Z');
  const at = (startsAt, status = 'SCHEDULED') => ({ status, startsAt });

  it('opens a meeting that has begun, ended or not', () => {
    expect(rosterOpenable(at('2026-09-14T00:00:00Z'), now)).toBe(true);
    expect(rosterOpenable(at('2026-09-14T01:00:00Z'), now)).toBe(true);
    expect(rosterOpenable(at('2026-09-07T00:00:00Z'), now)).toBe(true);
  });

  it('not one still ahead', () => {
    expect(rosterOpenable(at('2026-09-14T01:00:01Z'), now)).toBe(false);
  });

  it('not a cancelled one, even past', () => {
    expect(rosterOpenable(at('2026-09-07T00:00:00Z', 'CANCELLED'), now)).toBe(false);
  });
});
