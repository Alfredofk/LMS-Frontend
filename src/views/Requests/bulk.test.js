/*
  Releasing several join requests at once. The request shape is the backend's
  `requestView` (membership.service.js): roles carry `canRelease`, a student
  request carries `student.gradeLevel`, a guardian's further child is an ACTIVE
  membership with a PENDING link. Results are `bulkApprove`'s `{ id, ok, ... }`.
*/

import { describe, it, expect } from 'vitest';

import {
  MAX_PER_CALL,
  classesFor,
  isBulkable,
  needsClass,
  groupForApproval,
  chunk,
  planCalls,
  summarise,
} from './bulk.js';

const request = (id, roles, extra = {}) => ({
  id,
  status: 'PENDING',
  roles: roles.map(([role, canRelease = true]) => ({ role, status: 'PENDING', canRelease })),
  ...extra,
});
const student = (id, grade) => request(id, [['STUDENT']], { student: { nisn: '0012345678', gradeLevel: grade } });
const teacher = (id) => request(id, [['TEACHER']]);
const furtherChild = (id) => ({
  id,
  status: 'ACTIVE',
  roles: [{ role: 'GUARDIAN', status: 'ACTIVE', canRelease: false }],
  children: [{ id: `${id}-l`, status: 'PENDING', canRelease: true, relationship: 'Ibu', student: { fullName: 'Anak' } }],
});

describe('which requests get a box', () => {
  it('only those this desk can decide', () => {
    expect(isBulkable(student('s1', 10), 'TEACHER')).toBe(true);
    expect(isBulkable(request('s2', [['STUDENT', false]]), 'TEACHER')).toBe(false);
    expect(isBulkable(teacher('t1'), 'PRINCIPAL')).toBe(true);
    expect(isBulkable(teacher('t1'), 'TEACHER')).toBe(false);
    expect(isBulkable(furtherChild('g1'), 'TEACHER')).toBe(true);
  });

  it('asks for a class only where a student is released', () => {
    expect(needsClass(student('s1', 10), 'TEACHER')).toBe(true);
    expect(needsClass(teacher('t1'), 'PRINCIPAL')).toBe(false);
    expect(needsClass(furtherChild('g1'), 'TEACHER')).toBe(false);
  });
});

describe('grouping for the calls — one class per grade (owner, 2026-09-24)', () => {
  it('puts students under their grade, lowest first, and the rest together', () => {
    const groups = groupForApproval(
      [student('a', 11), furtherChild('g'), student('b', 10), student('c', 11), request('x', [['STUDENT', false]])],
      'TEACHER'
    );
    expect(groups.noClass).toEqual(['g']);
    expect(groups.students).toEqual([
      { grade: 10, ids: ['b'] },
      { grade: 11, ids: ['a', 'c'] },
    ]);
  });

  it('plans one call for the no-class group and one per grade with its class', () => {
    const groups = { noClass: ['g'], students: [{ grade: 10, ids: ['b'] }, { grade: 11, ids: ['a', 'c'] }] };
    expect(planCalls(groups, { 10: 'k10', 11: 'k11' })).toEqual([
      { ids: ['g'], classId: undefined },
      { ids: ['b'], classId: 'k10' },
      { ids: ['a', 'c'], classId: 'k11' },
    ]);
  });

  it('sends nothing for a grade whose class was not chosen — the server would refuse them all', () => {
    const groups = { noClass: [], students: [{ grade: 10, ids: ['b'] }] };
    expect(planCalls(groups, {})).toEqual([]);
  });

  it('splits past the backend limit of fifty', () => {
    const ids = Array.from({ length: 120 }, (_, i) => `r${i}`);
    expect(MAX_PER_CALL).toBe(50);
    expect(chunk(ids).map((piece) => piece.length)).toEqual([50, 50, 20]);
    expect(planCalls({ noClass: ids, students: [] }, {}).length).toBe(3);
  });
});

describe('the class choices', () => {
  const k = (id, grade, homeroom, year = 'ACTIVE', name = id) => ({
    id,
    name,
    gradeLevel: grade,
    homeroomTeacher: { membershipId: homeroom },
    academicYear: { status: year },
  });

  it("offers the reader's own classes at the grade, in an active year, by name", () => {
    const classes = [k('b', 10, 'me', 'ACTIVE', 'X IPS'), k('a', 10, 'me', 'ACTIVE', 'X IPA'), k('c', 10, 'other'), k('d', 11, 'me'), k('e', 10, 'me', 'CLOSED')];
    expect(classesFor(classes, 'me', 10).open.map((c) => c.id)).toEqual(['a', 'b']);
    expect(classesFor(classes, 'me', 10).closedOnly).toBe(false);
    expect(classesFor([k('e', 10, 'me', 'CLOSED')], 'me', 10)).toEqual({ open: [], closedOnly: true });
  });
});

describe('the outcome', () => {
  it('counts what went through and keeps what did not', () => {
    const outcome = summarise([
      [{ id: 'a', ok: true, status: 'ACTIVE' }, { id: 'b', ok: false, error: { code: 'CONFLICT', message: 'decided' } }],
      [{ id: 'c', ok: true, status: 'ACTIVE' }],
    ]);
    expect(outcome.released).toBe(2);
    expect(outcome.failed.map((f) => f.id)).toEqual(['b']);
  });
});
