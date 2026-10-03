import { describe, it, expect } from 'vitest';

import { PositionError, focusOf, nextReadIn, readPosition, rowState, withCheckIn } from './checkIn';

/*
  Rows shaped as sessions.service.js `listMine` answers them (backend 2a281e7):
  sessionView plus classSubjectId, class, subject, attendance and canCheckIn.
*/
const at = (iso) => new Date(iso);
const session = (over = {}) => ({
  id: 's1',
  number: 3,
  startsAt: '2026-10-05T00:00:00.000Z', // 07:00 WIB
  endsAt: '2026-10-05T01:30:00.000Z', // 08:30 WIB
  local: { date: '2026-10-05', dayOfWeek: 1, start: '07:00', end: '08:30' },
  status: 'SCHEDULED',
  cancelReason: null,
  needsCompletion: false,
  completedAt: null,
  topic: null,
  classSubjectId: 'cs1',
  class: 'XI IPS',
  subject: { code: 'MTK', name: 'Matematika' },
  attendance: null,
  canCheckIn: false,
  ...over,
});
const checkedIn = { id: 'a1', status: 'PRESENT', checkedInAt: '2026-10-05T00:10:00.000Z', outsideSchool: false, late: false };
const context = (now) => ({ now: at(now), hasLocation: true, className: 'XI IPS' });

describe('rowState — what one of today\'s meetings shows', () => {
  it('a cancelled meeting is cancelled, whatever else it carries', () => {
    expect(rowState(session({ status: 'CANCELLED', cancelReason: 'HOLIDAY', canCheckIn: true }), context('2026-10-05T00:20:00Z'))).toBe('cancelled');
  });

  it('a check-in the teacher has not confirmed is waiting; confirmed it is final', () => {
    expect(rowState(session({ attendance: checkedIn }), context('2026-10-05T00:20:00Z'))).toBe('checkedIn');
    expect(rowState(session({ attendance: checkedIn, completedAt: '2026-10-05T02:00:00Z' }), context('2026-10-05T03:00:00Z'))).toBe('final');
  });

  it('confirmed with no record of this student is told apart from final', () => {
    expect(rowState(session({ completedAt: '2026-10-05T01:00:00Z' }), context('2026-10-05T01:10:00Z'))).toBe('confirmed');
  });

  it('the server\'s canCheckIn opens the button inside the window', () => {
    expect(rowState(session({ canCheckIn: true }), context('2026-10-05T00:20:00Z'))).toBe('open');
  });

  it('trusts the server over a device clock a little slow', () => {
    expect(rowState(session({ canCheckIn: true }), context('2026-10-04T23:59:30Z'))).toBe('open');
  });

  it('never offers the button once the meeting has ended by this clock', () => {
    expect(rowState(session({ canCheckIn: true }), context('2026-10-05T01:30:00Z'))).toBe('missed');
  });

  it('before the start: upcoming; after the end with nothing recorded: missed', () => {
    expect(rowState(session(), context('2026-10-04T23:00:00Z'))).toBe('upcoming');
    expect(rowState(session(), context('2026-10-05T02:00:00Z'))).toBe('missed');
  });

  it('begun but refused: no school point, then another class, then waiting on the server', () => {
    const now = '2026-10-05T00:20:00Z';
    expect(rowState(session(), { ...context(now), hasLocation: false })).toBe('noLocation');
    expect(rowState(session({ class: 'X IPS' }), context(now))).toBe('otherClass');
    expect(rowState(session(), context(now))).toBe('waiting');
  });

  it('an unknown hasLocation is not read as "no point"', () => {
    expect(rowState(session(), { now: at('2026-10-05T00:20:00Z'), className: 'XI IPS' })).toBe('waiting');
  });
});

describe('nextReadIn — when the card reads the day again', () => {
  it('a second after the next start or end', () => {
    expect(nextReadIn([session()], context('2026-10-04T23:00:00Z'))).toBe(60 * 60 * 1000 + 1000);
    expect(nextReadIn([session({ canCheckIn: true })], context('2026-10-05T01:00:00Z'))).toBe(30 * 60 * 1000 + 1000);
  });

  it('the nearest edge of several meetings', () => {
    const later = session({ id: 's2', startsAt: '2026-10-05T03:00:00Z', endsAt: '2026-10-05T04:30:00Z' });
    expect(nextReadIn([later, session()], context('2026-10-04T23:00:00Z'))).toBe(60 * 60 * 1000 + 1000);
  });

  it('nothing to wait for: over, cancelled or confirmed', () => {
    expect(nextReadIn([session()], context('2026-10-05T05:00:00Z'))).toBeNull();
    expect(nextReadIn([session({ status: 'CANCELLED' })], context('2026-10-04T23:00:00Z'))).toBeNull();
    expect(nextReadIn([session({ completedAt: '2026-10-05T00:30:00Z' })], context('2026-10-05T00:40:00Z'))).toBeNull();
    expect(nextReadIn([], context('2026-10-05T00:40:00Z'))).toBeNull();
  });

  it('soon while a row is waiting on the server', () => {
    expect(nextReadIn([session()], context('2026-10-05T00:20:00Z'))).toBe(16 * 1000);
  });

  it('never longer than six hours', () => {
    const far = session({ startsAt: '2026-10-05T23:00:00Z', endsAt: '2026-10-05T23:30:00Z' });
    expect(nextReadIn([far], context('2026-10-05T00:00:00Z'))).toBe(6 * 60 * 60 * 1000);
  });
});

describe('readPosition — the device\'s position, or why not', () => {
  const geo = (outcome) => ({
    getCurrentPosition: (ok, fail, options) => {
      geo.options = options;
      if (outcome.coords) ok({ coords: outcome.coords });
      else fail(outcome);
    },
  });

  it('answers latitude and longitude only, from a fresh reading', async () => {
    const g = geo({ coords: { latitude: -7.98, longitude: 112.63, accuracy: 12 } });
    await expect(readPosition(g, true)).resolves.toEqual({ latitude: -7.98, longitude: 112.63 });
    expect(geo.options.maximumAge).toBe(0);
  });

  it('names each failure', async () => {
    await expect(readPosition(geo({ code: 1 }), true)).rejects.toMatchObject({ reason: 'denied' });
    await expect(readPosition(geo({ code: 2 }), true)).rejects.toMatchObject({ reason: 'unavailable' });
    await expect(readPosition(geo({ code: 3 }), true)).rejects.toMatchObject({ reason: 'timeout' });
    await expect(readPosition(undefined, true)).rejects.toMatchObject({ reason: 'unsupported' });
    await expect(readPosition(geo({ coords: { latitude: 0, longitude: 0 } }), false)).rejects.toMatchObject({ reason: 'insecure' });
  });

  it('rejects with a PositionError', async () => {
    await expect(readPosition(undefined, true)).rejects.toBeInstanceOf(PositionError);
  });
});

describe('focusOf — the dashboard\'s one meeting', () => {
  /* Five meetings, 07:00–08:30 WIB onwards, an hour and a half each, back to back. */
  const at07 = Date.parse('2026-10-05T00:00:00Z');
  const slot = (i, over = {}) =>
    session({
      id: `m${i}`,
      number: i + 1,
      startsAt: new Date(at07 + i * 90 * 60000).toISOString(),
      endsAt: new Date(at07 + (i + 1) * 90 * 60000).toISOString(),
      ...over,
    });
  const day = [slot(0), slot(1), slot(2), slot(3), slot(4)];

  it('before school: the first meeting, as next', () => {
    expect(focusOf(day, context('2026-10-04T23:00:00Z'))).toMatchObject({ kind: 'next', session: { id: 'm0' }, others: 4 });
  });

  it('during a meeting: that one, as now — checked in or not, until it ends', () => {
    expect(focusOf(day, context('2026-10-05T00:10:00Z'))).toMatchObject({ kind: 'now', session: { id: 'm0' } });
    const checked = [slot(0, { attendance: checkedIn }), ...day.slice(1)];
    expect(focusOf(checked, context('2026-10-05T01:20:00Z'))).toMatchObject({ kind: 'now', session: { id: 'm0' } });
  });

  it('moves on at the end of one meeting', () => {
    expect(focusOf(day, context('2026-10-05T01:30:00Z'))).toMatchObject({ kind: 'now', session: { id: 'm1' } });
  });

  it('the server\'s open check-in counts as on now, even a little before this clock says so', () => {
    const early = [slot(0, { canCheckIn: true }), ...day.slice(1)];
    expect(focusOf(early, context('2026-10-04T23:59:30Z'))).toMatchObject({ kind: 'now', session: { id: 'm0' } });
  });

  it('two at once (a class-move day): the one taking a check-in wins', () => {
    const oldClass = slot(0, { id: 'old', class: 'X IPS' });
    const newClass = slot(0, { id: 'new', canCheckIn: true, startsAt: new Date(at07 + 30 * 60000).toISOString() });
    expect(focusOf([oldClass, newClass], context('2026-10-05T00:40:00Z'))).toMatchObject({ kind: 'now', session: { id: 'new' }, others: 1 });
    expect(focusOf([oldClass, slot(0, { id: 'new', startsAt: new Date(at07 + 30 * 60000).toISOString() })], context('2026-10-05T00:40:00Z')).session.id).toBe('old');
  });

  it('passes over a cancelled meeting, as now or next', () => {
    const cancelledFirst = [slot(0, { status: 'CANCELLED', cancelReason: 'HOLIDAY' }), ...day.slice(1)];
    expect(focusOf(cancelledFirst, context('2026-10-05T00:10:00Z'))).toMatchObject({ kind: 'next', session: { id: 'm1' }, others: 4 });
  });

  it('after the last: done, with how many were checked in to', () => {
    const over = [slot(0, { attendance: checkedIn }), slot(1, { attendance: { ...checkedIn, id: 'a2' } }), slot(2, { status: 'CANCELLED' }), slot(3), slot(4)];
    expect(focusOf(over, context('2026-10-05T10:00:00Z'))).toEqual({ kind: 'done', session: null, others: 5, total: 4, checkedIn: 2 });
  });

  it('nothing held today: cancelled', () => {
    expect(focusOf([slot(0, { status: 'CANCELLED' })], context('2026-10-05T00:10:00Z'))).toEqual({ kind: 'cancelled', session: null, others: 1 });
  });
});

describe('withCheckIn — the answer shown without reading the day again', () => {
  it('puts the record on its meeting and closes its button, leaving the others', () => {
    const other = session({ id: 's2', canCheckIn: true });
    const day = { from: '2026-10-05', to: '2026-10-05', timeZone: 'WIB', class: { id: 'c1', name: 'XI IPS' }, sessions: [session({ canCheckIn: true }), other] };
    const answer = { ...checkedIn, studentProfileId: 'sp1', late: true };
    const next = withCheckIn(day, 's1', answer);
    expect(next.sessions[0].attendance).toEqual({ id: 'a1', status: 'PRESENT', checkedInAt: checkedIn.checkedInAt, outsideSchool: false, late: true });
    expect(next.sessions[0].canCheckIn).toBe(false);
    expect(next.sessions[1]).toBe(other);
    expect(day.sessions[0].attendance).toBeNull();
  });
});
