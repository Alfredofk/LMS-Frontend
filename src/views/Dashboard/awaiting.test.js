import { describe, it, expect } from 'vitest';

import { byTeacher } from './awaiting.js';

/* A row as listNeedingCompletion answers it (sessions.service.js): sessionView plus classSubject. */
const row = (id, number, startsAt, membershipId, fullName) => ({
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
  },
});

describe('byTeacher — the whole school’s waiting meetings, by who can answer them', () => {
  it('groups by the teacher’s membership, most waiting first', () => {
    const groups = byTeacher([
      row('a', 1, '2026-07-13T00:00:00Z', 'm-bu', 'Bu Sari'),
      row('b', 1, '2026-07-14T00:00:00Z', 'm-pak', 'Pak Budi'),
      row('c', 2, '2026-07-20T00:00:00Z', 'm-pak', 'Pak Budi'),
    ]);
    expect(groups.map((g) => [g.teacher.fullName, g.sessions.length])).toEqual([
      ['Pak Budi', 2],
      ['Bu Sari', 1],
    ]);
  });

  it('breaks a tie by name', () => {
    const groups = byTeacher([
      row('a', 1, '2026-07-13T00:00:00Z', 'm-z', 'Zahra'),
      row('b', 1, '2026-07-13T00:00:00Z', 'm-a', 'Andi'),
    ]);
    expect(groups.map((g) => g.teacher.fullName)).toEqual(['Andi', 'Zahra']);
  });

  it('orders each group oldest first and names the oldest start, whatever order they came in', () => {
    const [group] = byTeacher([
      row('late', 3, '2026-07-27T00:00:00Z', 'm-pak', 'Pak Budi'),
      row('early', 1, '2026-07-13T00:00:00Z', 'm-pak', 'Pak Budi'),
    ]);
    expect(group.sessions.map((s) => s.id)).toEqual(['early', 'late']);
    expect(group.oldest).toBe('2026-07-13');
  });

  it("names the oldest by the school's own day, not the UTC one (07:00 WITA is 23:00 UTC the day before)", () => {
    const wita = { ...row('w', 1, '2026-07-12T23:00:00Z', 'm-pak', 'Pak Budi'), local: { date: '2026-07-13', dayOfWeek: 1, start: '07:00', end: '08:00' } };
    expect(byTeacher([wita])[0].oldest).toBe('2026-07-13');
  });

  it('keeps two teachers of the same name apart', () => {
    expect(
      byTeacher([row('a', 1, '2026-07-13T00:00:00Z', 'm-1', 'Budi'), row('b', 1, '2026-07-13T00:00:00Z', 'm-2', 'Budi')])
    ).toHaveLength(2);
  });

  it('answers nothing for nothing', () => {
    expect(byTeacher([])).toEqual([]);
    expect(byTeacher(null)).toEqual([]);
  });
});
