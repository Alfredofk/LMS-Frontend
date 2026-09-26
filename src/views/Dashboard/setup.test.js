import { describe, it, expect } from 'vitest';

import { currentYear, setupSteps } from './setup.js';

const TODAY = '2026-09-26';
const year = (id, status, start, end, semesters = []) => ({
  id, status, label: id, startDate: `${start}T00:00:00.000Z`, endDate: `${end}T00:00:00.000Z`, semesters,
});
const Y = year('2026/2027', 'ACTIVE', '2026-07-13', '2027-06-19', [{ id: 's1', ordinal: 1 }]);
const klass = (id, yearId, studentCount = 0) => ({ id, academicYear: { id: yearId }, studentCount });
const states = (out) => Object.fromEntries(out.steps.map((s) => [s.id, s.state]));

describe('currentYear — the year the school is working in', () => {
  it('prefers the active year holding today, else the newest active one, else none', () => {
    const next = year('2027/2028', 'ACTIVE', '2027-07-12', '2028-06-17');
    const old = year('2025/2026', 'CLOSED', '2025-07-14', '2026-06-20');
    expect(currentYear([next, Y, old], TODAY).id).toBe('2026/2027');
    expect(currentYear([next, old], TODAY).id).toBe('2027/2028');
    expect(currentYear([old], TODAY)).toBeNull();
  });
});

describe('setupSteps — what is done, what is next, what must wait', () => {
  it('a brand-new school: create a year first, and everything that needs one waits', () => {
    const out = setupSteps({ years: [], classes: [], teachers: [], assignments: [], today: TODAY });
    expect(states(out)).toEqual({ YEAR: 'todo', SEMESTER: 'blocked', TEACHERS: 'todo', CLASSES: 'blocked', SUBJECTS: 'blocked', STUDENTS: 'blocked' });
    expect(out.next).toBe('YEAR');
    expect(out).toMatchObject({ done: 0, total: 6 });
  });

  it("the owner's case: an active year with no semester — the semester is next", () => {
    const empty = year('2028/2029', 'ACTIVE', '2026-08-18', '2026-12-18');
    const out = setupSteps({ years: [empty], classes: [klass('c1', '2028/2029', 2)], teachers: [{}], assignments: [], today: TODAY });
    expect(states(out)).toMatchObject({ YEAR: 'done', SEMESTER: 'todo', CLASSES: 'done', SUBJECTS: 'blocked', STUDENTS: 'done' });
    expect(out.next).toBe('SEMESTER');
  });

  it('counts only the current year: classes and assignments of another year do not count', () => {
    const out = setupSteps({
      years: [Y],
      classes: [klass('c1', '2026/2027', 30), klass('old', '2025/2026', 40)],
      teachers: [{}, {}],
      assignments: [{ semester: { id: 's1' } }, { semester: { id: 'other-year-semester' } }],
      today: TODAY,
    });
    const count = Object.fromEntries(out.steps.map((s) => [s.id, s.count]));
    expect(count).toMatchObject({ SEMESTER: 1, TEACHERS: 2, CLASSES: 1, SUBJECTS: 1, STUDENTS: 30 });
    expect(out).toMatchObject({ done: 6, total: 6, next: null });
  });

  it('classes wait for a teacher, since each is created with its homeroom teacher', () => {
    const out = setupSteps({ years: [Y], classes: [], teachers: [], assignments: [], today: TODAY });
    expect(states(out)).toMatchObject({ TEACHERS: 'todo', CLASSES: 'blocked' });
    expect(out.next).toBe('TEACHERS');
  });

  it('a step whose data could not be read is unknown and not counted either way', () => {
    const out = setupSteps({ years: [Y], classes: [klass('c1', '2026/2027')], teachers: null, assignments: null, today: TODAY });
    expect(states(out)).toMatchObject({ TEACHERS: 'unknown', CLASSES: 'unknown', SUBJECTS: 'unknown', STUDENTS: 'todo' });
    expect(out.total).toBe(3);
  });
});
