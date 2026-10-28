import { describe, it, expect } from 'vitest';

import { changeText, changeToneOf, firstDirOf, isCounted, sortRows, valueOf, valueText } from './schoolOverview.js';

/* A Class row as schoolDashboard answers one (dashboard.school.js, 1a1eed7). */
const klass = (name, gradeLevel, { placed = 0, attendance = null, withSignal = null } = {}) => ({
  class: { id: name, name, gradeLevel },
  studentsPlacedNow: placed,
  attendance: { value: attendance, change: null },
  content: { value: null, change: null },
  belowKktp: { value: 0, change: null },
  withSignal: { value: withSignal, change: null },
  averageGrade: { value: null, change: null },
});
const nameOf = (row) => row.class.name;
const names = (rows) => rows.map(nameOf);

describe('valueOf / valueText', () => {
  it('reads the placed count bare and the rest from { value }', () => {
    const row = klass('XI IPS', 11, { placed: 2, attendance: 13 });
    expect(valueOf(row, 'studentsPlacedNow')).toBe(2);
    expect(valueOf(row, 'attendance')).toBe(13);
    expect(valueOf(row, 'content')).toBeNull();
  });

  it('writes each kind, and "-" for what nobody counted', () => {
    expect(valueText('attendance', 13, 'id')).toBe('13%');
    expect(valueText('averageGrade', 51.5, 'id')).toBe('51,5');
    expect(valueText('averageGrade', 80, 'en')).toBe('80.0');
    expect(valueText('belowKktp', 0, 'id')).toBe('0');
    expect(valueText('content', null, 'id')).toBe('-');
  });
});

describe('changeText / changeToneOf', () => {
  it('signs a change and leaves out none and zero', () => {
    expect(changeText('attendance', 3, 'id')).toBe('+3');
    expect(changeText('averageGrade', -1.5, 'id')).toBe('-1,5');
    expect(changeText('withSignal', 0, 'id')).toBeNull();
    expect(changeText('withSignal', null, 'id')).toBeNull();
  });

  it('calls a rise good for attendance, content and grades, bad for KKTP and signals', () => {
    expect(changeToneOf('attendance', 2)).toBe('good');
    expect(changeToneOf('attendance', -2)).toBe('bad');
    expect(changeToneOf('averageGrade', 0.5)).toBe('good');
    expect(changeToneOf('belowKktp', 1)).toBe('bad');
    expect(changeToneOf('withSignal', -1)).toBe('good');
    expect(changeToneOf('withSignal', 0)).toBeNull();
    expect(changeToneOf('studentsPlacedNow', 4)).toBeNull();
  });
});

describe('sortRows', () => {
  const rows = [
    klass('XI IPS', 11, { attendance: 13, withSignal: 2 }),
    klass('X B', 10, { attendance: null, withSignal: 0 }),
    klass('X A', 10, { attendance: 90, withSignal: 2 }),
    klass('PPKN', 11, { attendance: 50, withSignal: null }),
  ];

  it('orders by grade then name, either way', () => {
    expect(names(sortRows(rows, { key: 'name', dir: 'asc' }, nameOf))).toEqual(['X A', 'X B', 'PPKN', 'XI IPS']);
    expect(names(sortRows(rows, { key: 'name', dir: 'desc' }, nameOf))).toEqual(['XI IPS', 'PPKN', 'X B', 'X A']);
  });

  it('orders by a figure, the uncounted always last', () => {
    expect(names(sortRows(rows, { key: 'attendance', dir: 'desc' }, nameOf))).toEqual(['X A', 'PPKN', 'XI IPS', 'X B']);
    expect(names(sortRows(rows, { key: 'attendance', dir: 'asc' }, nameOf))).toEqual(['XI IPS', 'PPKN', 'X A', 'X B']);
  });

  it('keeps ties in grade-then-name order', () => {
    expect(names(sortRows(rows, { key: 'withSignal', dir: 'desc' }, nameOf))).toEqual(['X A', 'XI IPS', 'X B', 'PPKN']);
  });

  it('leaves the rows it was given alone', () => {
    const before = names(rows);
    sortRows(rows, { key: 'attendance', dir: 'desc' }, nameOf);
    expect(names(rows)).toEqual(before);
  });
});

describe('firstDirOf / isCounted', () => {
  it('starts names A-Z and numbers from the largest', () => {
    expect(firstDirOf('name')).toBe('asc');
    expect(firstDirOf('withSignal')).toBe('desc');
  });

  it('is counted once the rollup has a row', () => {
    expect(isCounted({ asOf: '2026-10-28T02:33:10.379Z' })).toBe(true);
    expect(isCounted({ asOf: null })).toBe(false);
    expect(isCounted(null)).toBe(false);
  });
});
