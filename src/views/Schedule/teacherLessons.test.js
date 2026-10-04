import { describe, it, expect } from 'vitest';

import { teachingAssignments, teacherSessionsIn } from './teacherLessons';

/* Shapes from academics.service.js classSubjectView and sessions.service.js sessionView. */
const assignment = (id, extra = {}) => ({
  id,
  status: 'ACTIVE',
  endedAt: null,
  class: { id: `c-${id}`, name: `Class ${id}`, gradeLevel: 11 },
  subject: { id: `s-${id}`, code: id.toUpperCase(), name: `Subject ${id}` },
  semester: { id: 'sem', ordinal: 1, academicYear: '2028/2029' },
  ...extra,
});
const session = (id, date, startsAt, extra = {}) => ({
  id,
  number: 1,
  startsAt,
  endsAt: startsAt,
  local: { date, dayOfWeek: 1, start: '08:00', end: '09:00' },
  status: 'SCHEDULED',
  cancelReason: null,
  needsCompletion: false,
  completedAt: null,
  topic: null,
  ...extra,
});

describe('teachingAssignments', () => {
  it('keeps the ACTIVE ones only (a request still waiting has no meetings)', () => {
    const list = [assignment('a'), assignment('b', { status: 'PENDING' }), assignment('c', { status: 'REJECTED' })];
    expect(teachingAssignments(list).map((entry) => entry.id)).toEqual(['a']);
  });
  it('answers an empty list for nothing', () => {
    expect(teachingAssignments(null)).toEqual([]);
  });
});

describe('teacherSessionsIn - a teacher month from their assignments', () => {
  const bio = assignment('bio');
  const eko = assignment('eko');
  const sessions = {
    bio: [session('b1', '2028-08-21', '2028-08-21T01:40:00.000Z'), session('b2', '2028-09-04', '2028-09-04T01:40:00.000Z')],
    eko: [session('e1', '2028-08-22', '2028-08-22T00:00:00.000Z')],
  };

  it('keeps the days inside the range, both ends included, oldest first', () => {
    const out = teacherSessionsIn([bio, eko], sessions, '2028-08-01', '2028-08-31');
    expect(out.map((row) => row.id)).toEqual(['b1', 'e1']);
  });

  it('adds what the calendar draws: subject, class name, no attendance', () => {
    const [row] = teacherSessionsIn([bio], sessions, '2028-08-21', '2028-08-21');
    expect(row).toMatchObject({ classSubjectId: 'bio', subject: { code: 'BIO', name: 'Subject bio' }, class: 'Class bio', attendance: null });
  });

  it('drops the meetings of an ended assignment from its end on: they went to the successor', () => {
    const ended = assignment('bio', { endedAt: '2028-08-25T00:00:00.000Z' });
    const out = teacherSessionsIn([ended], sessions, '2028-08-01', '2028-09-30');
    expect(out.map((row) => row.id)).toEqual(['b1']);
  });

  it('skips an assignment whose meetings were not read', () => {
    expect(teacherSessionsIn([assignment('mtk')], sessions, '2028-01-01', '2028-12-31')).toEqual([]);
  });
});
