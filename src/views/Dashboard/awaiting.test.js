import { describe, it, expect } from 'vitest';

import { byAnswerer, endedTeacherOf, UNANSWERED } from './awaiting.js';

/*
  A row as listNeedingCompletion answers it (sessions.service.js, deb95e8):
  sessionView plus classSubject, and answeredBy. A live assignment is answered by
  its own teacher.
*/
const row = (id, number, startsAt, membershipId, fullName, { ended = false, answeredBy } = {}) => ({
  id,
  number,
  startsAt,
  endsAt: startsAt,
  local: { date: startsAt.slice(0, 10), dayOfWeek: 1, start: '07:00', end: '08:00' },
  status: 'SCHEDULED',
  needsCompletion: true,
  completedAt: null,
  classSubject: {
    id: `cs-${membershipId}`,
    class: 'XI IPS',
    subject: { code: 'MTK', name: 'Matematika' },
    semester: { id: 's1', ordinal: 1, academicYear: '2026/2027' },
    teacher: { membershipId, fullName },
    ended,
  },
  answeredBy: answeredBy === undefined ? { membershipId, fullName } : answeredBy,
});

const names = (groups) => groups.map((g) => [g.answeredBy?.fullName ?? null, g.sessions.length]);

describe('byAnswerer — the whole school’s waiting meetings, by who can answer them', () => {
  it('groups by the answering teacher’s membership, most waiting first', () => {
    const groups = byAnswerer([
      row('a', 1, '2026-07-13T00:00:00Z', 'm-bu', 'Bu Sari'),
      row('b', 1, '2026-07-14T00:00:00Z', 'm-pak', 'Pak Budi'),
      row('c', 2, '2026-07-20T00:00:00Z', 'm-pak', 'Pak Budi'),
    ]);
    expect(names(groups)).toEqual([
      ['Pak Budi', 2],
      ['Bu Sari', 1],
    ]);
  });

  it('puts a meeting left on an ended assignment with its successor, not its old teacher', () => {
    const successor = { membershipId: 'm-new', fullName: 'Bu Rina' };
    const groups = byAnswerer([
      row('old', 1, '2026-07-13T00:00:00Z', 'm-old', 'Pak Lama', { ended: true, answeredBy: successor }),
      row('own', 2, '2026-07-20T00:00:00Z', 'm-new', 'Bu Rina'),
    ]);
    expect(names(groups)).toEqual([['Bu Rina', 2]]);
    expect(groups[0].key).toBe('m-new');
  });

  it('gathers the meetings nobody can answer yet into one group, first, however few', () => {
    const groups = byAnswerer([
      row('a', 1, '2026-07-13T00:00:00Z', 'm-pak', 'Pak Budi'),
      row('b', 2, '2026-07-14T00:00:00Z', 'm-pak', 'Pak Budi'),
      row('x', 1, '2026-07-20T00:00:00Z', 'm-old1', 'Pak Lama', { ended: true, answeredBy: null }),
      row('y', 1, '2026-07-15T00:00:00Z', 'm-old2', 'Bu Lama', { ended: true, answeredBy: null }),
    ]);
    expect(names(groups)).toEqual([
      [null, 2],
      ['Pak Budi', 2],
    ]);
    expect(groups[0].key).toBe(UNANSWERED);
    expect(groups[0].sessions.map((s) => s.id)).toEqual(['y', 'x']);
  });

  it('breaks a tie by name', () => {
    const groups = byAnswerer([
      row('a', 1, '2026-07-13T00:00:00Z', 'm-z', 'Zahra'),
      row('b', 1, '2026-07-13T00:00:00Z', 'm-a', 'Andi'),
    ]);
    expect(groups.map((g) => g.answeredBy.fullName)).toEqual(['Andi', 'Zahra']);
  });

  it('orders each group oldest first and names the oldest start, whatever order they came in', () => {
    const [group] = byAnswerer([
      row('late', 3, '2026-07-27T00:00:00Z', 'm-pak', 'Pak Budi'),
      row('early', 1, '2026-07-13T00:00:00Z', 'm-pak', 'Pak Budi'),
    ]);
    expect(group.sessions.map((s) => s.id)).toEqual(['early', 'late']);
    expect(group.oldest).toBe('2026-07-13');
  });

  it("names the oldest by the school's own day, not the UTC one (07:00 WITA is 23:00 UTC the day before)", () => {
    const wita = { ...row('w', 1, '2026-07-12T23:00:00Z', 'm-pak', 'Pak Budi'), local: { date: '2026-07-13', dayOfWeek: 1, start: '07:00', end: '08:00' } };
    expect(byAnswerer([wita])[0].oldest).toBe('2026-07-13');
  });

  it('keeps two teachers of the same name apart', () => {
    expect(
      byAnswerer([row('a', 1, '2026-07-13T00:00:00Z', 'm-1', 'Budi'), row('b', 1, '2026-07-13T00:00:00Z', 'm-2', 'Budi')])
    ).toHaveLength(2);
  });

  it('answers nothing for nothing', () => {
    expect(byAnswerer([])).toEqual([]);
    expect(byAnswerer(null)).toEqual([]);
  });
});

describe('endedTeacherOf — where a meeting came from', () => {
  it('names the old teacher of an ended assignment', () => {
    const session = row('a', 1, '2026-07-13T00:00:00Z', 'm-old', 'Pak Lama', { ended: true, answeredBy: null });
    expect(endedTeacherOf(session)).toEqual({ membershipId: 'm-old', fullName: 'Pak Lama' });
  });

  it('says nothing for a live assignment', () => {
    expect(endedTeacherOf(row('a', 1, '2026-07-13T00:00:00Z', 'm-pak', 'Pak Budi'))).toBeNull();
  });
});
