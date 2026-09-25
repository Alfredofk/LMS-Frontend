/*
  The Classes page's filters. The shapes are the backend's own: a year is
  `yearSelect` (academics.service.js) and a class is `classView` — read from the
  service, not guessed, because a stub built on a guess validates the guess.
*/

import { describe, it, expect } from 'vitest';

import {
  YEAR_TABS,
  yearsInTab,
  defaultYearTab,
  tabOfYear,
  classesOfYear,
  yearSummary,
  gradesPresent,
  filterClasses,
} from './filters.js';

const year = (id, status, semesters = 0) => ({
  id,
  label: id,
  status,
  semesters: Array.from({ length: semesters }, (_, i) => ({ id: `${id}-s${i + 1}`, ordinal: i + 1 })),
});
const klass = (id, yearId, gradeLevel, name, homeroom, studentCount = 0) => ({
  id,
  name,
  gradeLevel,
  academicYear: { id: yearId },
  homeroomTeacher: homeroom ? { membershipId: `m-${homeroom}`, fullName: homeroom } : null,
  studentCount,
});

/* Newest first, as listAcademicYears sorts them. */
const years = [year('2028/2029', 'ACTIVE', 2), year('2027/2028', 'CLOSED', 2), year('2026/2027', 'CLOSED')];
const classes = [
  klass('c1', '2028/2029', 10, 'X IPA', 'Rina Guru', 30),
  klass('c2', '2028/2029', 10, 'X IPS', 'Kevin Aprilian', 28),
  klass('c3', '2028/2029', 11, 'XI IPA', 'Budi Santoso'),
  klass('c4', '2027/2028', 10, 'X IPA', 'Test123', 1),
];

describe('year tabs', () => {
  it('are ACTIVE, CLOSED and ALL, in that order', () => {
    expect(YEAR_TABS).toEqual(['ACTIVE', 'CLOSED', 'ALL']);
  });

  it('split the years by status and keep newest first', () => {
    expect(yearsInTab(years, 'ACTIVE').map((y) => y.id)).toEqual(['2028/2029']);
    expect(yearsInTab(years, 'CLOSED').map((y) => y.id)).toEqual(['2027/2028', '2026/2027']);
    expect(yearsInTab(years, 'ALL').map((y) => y.id)).toEqual(['2028/2029', '2027/2028', '2026/2027']);
    expect(yearsInTab(null, 'ALL')).toEqual([]);
  });

  it('open on ACTIVE, or on ALL when no year is active', () => {
    expect(defaultYearTab(years)).toBe('ACTIVE');
    expect(defaultYearTab([year('a', 'CLOSED')])).toBe('ALL');
    expect(defaultYearTab([])).toBe('ALL');
  });

  it('name the tab a year lives in', () => {
    expect(tabOfYear(years[0])).toBe('ACTIVE');
    expect(tabOfYear(years[1])).toBe('CLOSED');
  });
});

describe('a year card', () => {
  it('counts only its own classes and their students', () => {
    expect(classesOfYear(classes, '2028/2029').map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    expect(yearSummary(years[0], classes)).toEqual({ semesters: 2, classes: 3, students: 58 });
    expect(yearSummary(years[1], classes)).toEqual({ semesters: 2, classes: 1, students: 1 });
  });

  it('counts nothing for a year with no class and no semester', () => {
    expect(yearSummary(years[2], classes)).toEqual({ semesters: 0, classes: 0, students: 0 });
  });
});

describe('class filters', () => {
  const own = classesOfYear(classes, '2028/2029');

  it('offer only the grades that have a class, lowest first', () => {
    expect(gradesPresent(own)).toEqual([10, 11]);
    expect(gradesPresent([])).toEqual([]);
    /* However the classes arrive — a class created just now is appended last. */
    expect(gradesPresent([klass('a', 'y', 12, 'XII', 'A'), klass('b', 'y', 10, 'X', 'B'), klass('c', 'y', 12, 'XII B', 'C')])).toEqual([10, 12]);
  });

  it('match the class name or the homeroom teacher, case ignored', () => {
    expect(filterClasses(own, { query: 'ipa' }).map((c) => c.id)).toEqual(['c1', 'c3']);
    expect(filterClasses(own, { query: '  KEVIN ' }).map((c) => c.id)).toEqual(['c2']);
  });

  it('narrow by grade, alone or with a search', () => {
    expect(filterClasses(own, { grade: 11 }).map((c) => c.id)).toEqual(['c3']);
    expect(filterClasses(own, { grade: 10, query: 'ipa' }).map((c) => c.id)).toEqual(['c1']);
  });

  it('let everything through with no filter, and survive a class with no homeroom teacher', () => {
    expect(filterClasses(own).length).toBe(3);
    expect(filterClasses([klass('x', 'y', 10, 'X A', null)], { query: 'guru' })).toEqual([]);
  });
});
