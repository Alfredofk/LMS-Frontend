import { describe, expect, it } from 'vitest';

import { roleRankOf, sortByRole } from './members';

const m = (membershipId, fullName, roles) => ({ membershipId, fullName, roles });

describe('roleRankOf', () => {
  it('takes the highest role a member holds', () => {
    expect(roleRankOf(m('1', 'A', ['GUARDIAN', 'TEACHER', 'PRINCIPAL']))).toBe(0);
    expect(roleRankOf(m('2', 'B', ['TEACHER', 'VICE_PRINCIPAL']))).toBe(1);
    expect(roleRankOf(m('3', 'C', ['GUARDIAN', 'TEACHER']))).toBe(2);
    expect(roleRankOf(m('4', 'D', ['STUDENT']))).toBe(3);
    expect(roleRankOf(m('5', 'E', ['GUARDIAN']))).toBe(4);
  });

  it('puts a member with no known role last', () => {
    expect(roleRankOf(m('6', 'F', []))).toBe(5);
    expect(roleRankOf(m('7', 'G', ['SOMETHING']))).toBe(5);
  });
});

describe('sortByRole', () => {
  it('orders leaders, teachers, students, guardians, each A-Z', () => {
    const list = [
      m('s2', 'Budi', ['STUDENT']),
      m('g1', 'Ani', ['GUARDIAN']),
      m('t1', 'Zaki', ['TEACHER']),
      m('s1', 'Andi', ['STUDENT']),
      m('v1', 'Rina', ['TEACHER', 'VICE_PRINCIPAL']),
      m('p1', 'Yusuf', ['PRINCIPAL', 'TEACHER', 'GUARDIAN']),
      m('t2', 'Citra', ['TEACHER', 'GUARDIAN']),
    ];
    expect(sortByRole(list).map((row) => row.fullName)).toEqual(['Yusuf', 'Rina', 'Citra', 'Zaki', 'Andi', 'Budi', 'Ani']);
  });

  it('ignores case in names and keeps equal names in one order', () => {
    const list = [m('b', 'kevin', ['STUDENT']), m('a', 'Kevin', ['STUDENT']), m('c', 'adi', ['STUDENT'])];
    expect(sortByRole(list).map((row) => row.membershipId)).toEqual(['c', 'a', 'b']);
  });

  it('does not change the list it was given', () => {
    const list = [m('s', 'B', ['STUDENT']), m('p', 'A', ['PRINCIPAL'])];
    sortByRole(list);
    expect(list.map((row) => row.membershipId)).toEqual(['s', 'p']);
  });

  it('answers an empty list for nothing', () => {
    expect(sortByRole(null)).toEqual([]);
  });
});
