import { describe, it, expect } from 'vitest';

import { openTeachingSessions, openYearLabels } from './teacherLessons';

/* A row as sessions.service.js listTeaching answers it - the fields this file reads. */
const row = (id, academicYear) => ({ id, academicYear, class: 'XI IPS', subject: { code: 'MTK', name: 'Matematika' } });

describe('openYearLabels - the years still ACTIVE', () => {
  it('keeps ACTIVE labels only', () => {
    const years = [
      { label: '2026/2027', status: 'ACTIVE' },
      { label: '2028/2029', status: 'CLOSED' },
    ];
    expect([...openYearLabels(years)]).toEqual(['2026/2027']);
    expect(openYearLabels(undefined).size).toBe(0);
  });
});

describe('openTeachingSessions - listTeaching keeps a closed year, the calendar does not', () => {
  it("leaves out a closed year's meetings and gives every row attendance: null", () => {
    const out = openTeachingSessions([row('a', '2026/2027'), row('b', '2028/2029')], new Set(['2026/2027']));
    expect(out.map((r) => r.id)).toEqual(['a']);
    expect(out[0].attendance).toBeNull();
    expect(out[0].class).toBe('XI IPS');
  });

  it('leaves nothing out when the years could not be read', () => {
    expect(openTeachingSessions([row('a', '2026/2027'), row('b', '2028/2029')], null)).toHaveLength(2);
    expect(openTeachingSessions(undefined, null)).toEqual([]);
  });
});
