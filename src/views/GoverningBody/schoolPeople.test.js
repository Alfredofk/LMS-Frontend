import { describe, expect, it } from 'vitest';

import { classGroupsOf, staffRolesOf, studentQueryOf, tabOf, teacherMatches, termOf } from './schoolPeople';

describe('school page - the tab', () => {
  it('opens the tab named, the summary otherwise', () => {
    expect(tabOf('guru')).toBe('guru');
    expect(tabOf('lamaran')).toBe('lamaran');
    expect(tabOf('nilai')).toBe('ringkasan');
    expect(tabOf(null)).toBe('ringkasan');
  });
});

// governingBody.reads.js teacherView: roles ordered by name on the server, STAFF_ROLES only.
describe('school page - teachers', () => {
  const teacher = { fullName: 'Kevin Aprilian', nip: '1222334565', nuptk: null, roles: ['TEACHER', 'PRINCIPAL'] };

  it('puts the highest role first', () => {
    expect(staffRolesOf(teacher)).toEqual(['PRINCIPAL', 'TEACHER']);
    expect(staffRolesOf({ roles: ['VICE_PRINCIPAL', 'TEACHER'] })).toEqual(['VICE_PRINCIPAL', 'TEACHER']);
    expect(staffRolesOf({})).toEqual([]);
  });

  it('finds a teacher by a part of the name, NIP or NUPTK', () => {
    expect(teacherMatches(teacher, '')).toBe(true);
    expect(teacherMatches(teacher, ' aprili ')).toBe(true);
    expect(teacherMatches(teacher, '2334')).toBe(true);
    expect(teacherMatches({ ...teacher, nip: null, nuptk: '1234567890123456' }, '789012')).toBe(true);
    expect(teacherMatches(teacher, 'budi')).toBe(false);
  });
});

// governingBody.reads.js termView: either may be null.
describe('school page - the term', () => {
  it('names the Semester and year, the year alone, or none', () => {
    expect(termOf({ academicYear: { id: 'y', label: '2026/2027' }, semester: { id: 's', ordinal: 1 } })).toEqual({
      key: 'gbsp.term',
      vars: { ordinal: 1, label: '2026/2027' },
    });
    expect(termOf({ academicYear: { id: 'y', label: '2026/2027' }, semester: null })).toEqual({ key: 'gbsp.term.noSemester', vars: { label: '2026/2027' } });
    expect(termOf({ academicYear: null, semester: null })).toEqual({ key: 'gbsp.term.none', vars: {} });
    expect(termOf(undefined)).toEqual({ key: 'gbsp.term.none', vars: {} });
  });
});

// governingBody.reads.js listStudents: classes ordered by grade then name.
describe('school page - students', () => {
  it('groups the Classes by grade, lowest first', () => {
    expect(
      classGroupsOf([
        { id: 'c3', name: 'XII IPA', gradeLevel: 12 },
        { id: 'c2', name: 'XI IPS', gradeLevel: 11 },
        { id: 'c1', name: 'XI IPA', gradeLevel: 11 },
      ])
    ).toEqual([
      { grade: 11, classes: [{ id: 'c1', name: 'XI IPA', gradeLevel: 11 }, { id: 'c2', name: 'XI IPS', gradeLevel: 11 }] },
      { grade: 12, classes: [{ id: 'c3', name: 'XII IPA', gradeLevel: 12 }] },
    ]);
    expect(classGroupsOf(undefined)).toEqual([]);
  });

  // governingBody.schema.js studentsQuery: q trimmed 1-100, classId, limit 1-100, offset.
  it('sends only what carries something', () => {
    expect(studentQueryOf({})).toEqual({ limit: 50, offset: 0 });
    expect(studentQueryOf({ needle: '   ', classId: '' })).toEqual({ limit: 50, offset: 0 });
    expect(studentQueryOf({ needle: ' ani ', classId: 'c1', offset: 50 })).toEqual({ limit: 50, offset: 50, q: 'ani', classId: 'c1' });
    expect(studentQueryOf({ needle: 'x'.repeat(120) }).q).toHaveLength(100);
  });
});
