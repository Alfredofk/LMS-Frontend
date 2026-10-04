import { describe, expect, it } from 'vitest';

import {
  confirmStatuses,
  confirmTally,
  contentErrors,
  defaultStatusOf,
  moveContent,
  requestChoices,
  requestableSemesters,
  sessionPhase,
  splitTeaching,
  unconfirmedCount,
} from './teaching.js';

/* Rows shaped as academics.service.js classSubjectView answers them. */
const row = (id, status, extra = {}) => ({
  id,
  status,
  requestedAt: '2028-08-01T00:00:00.000Z',
  decidedAt: null,
  endedAt: null,
  class: { id: 'c1', name: 'XI IPS', gradeLevel: 11 },
  subject: { id: `s-${id}`, code: id.toUpperCase(), name: id },
  semester: { id: 'sem1', ordinal: 1, academicYear: '2028/2029' },
  ...extra,
});

describe('splitTeaching - live, waiting, the rest (classSubjectView)', () => {
  it('splits by status, an ended ACTIVE one going to history', () => {
    const { live, waiting, past } = splitTeaching([
      row('mtk', 'ACTIVE'),
      row('eko', 'ACTIVE', { endedAt: '2028-08-20T00:00:00.000Z' }),
      row('bio', 'PENDING'),
      row('fis', 'REJECTED', { decidedAt: '2028-08-02T00:00:00.000Z' }),
      row('kim', 'CANCELLED'),
    ]);
    expect(live.map((r) => r.id)).toEqual(['mtk']);
    expect(waiting.map((r) => r.id)).toEqual(['bio']);
    expect(past.map((r) => r.id)).toEqual(['eko', 'fis', 'kim']);
  });
  it('reads nothing as nothing', () => {
    expect(splitTeaching(null)).toEqual({ live: [], waiting: [], past: [] });
  });
});

const session = (extra = {}) => ({
  id: 's1',
  number: 1,
  status: 'SCHEDULED',
  startsAt: '2028-08-21T00:00:00.000Z',
  endsAt: '2028-08-21T01:30:00.000Z',
  completedAt: null,
  needsCompletion: false,
  ...extra,
});
const at = (iso) => new Date(iso);

describe('sessionPhase - where a meeting stands for its teacher', () => {
  it('is upcoming before it begins, running during, awaiting after', () => {
    expect(sessionPhase(session(), at('2028-08-20T00:00:00Z'))).toBe('upcoming');
    expect(sessionPhase(session(), at('2028-08-21T00:30:00Z'))).toBe('running');
    expect(sessionPhase(session(), at('2028-08-21T02:00:00Z'))).toBe('awaiting');
  });
  it('is confirmed once completed, even while it still runs', () => {
    expect(sessionPhase(session({ completedAt: '2028-08-21T00:40:00Z' }), at('2028-08-21T00:45:00Z'))).toBe('confirmed');
  });
  it('is cancelled whatever the clock says', () => {
    expect(sessionPhase(session({ status: 'CANCELLED' }), at('2028-08-21T00:30:00Z'))).toBe('cancelled');
  });
  it('counts what is begun and not confirmed', () => {
    const list = [session(), session({ id: 's2', completedAt: 'x' }), session({ id: 's3', startsAt: '2028-09-01T00:00:00Z', endsAt: '2028-09-01T01:30:00Z' })];
    expect(unconfirmedCount(list, at('2028-08-22T00:00:00Z'))).toBe(1);
  });
});

/* The roster's students (attendance.service.js rosterView), before confirmation. */
const students = [
  { studentProfileId: 'a', fullName: 'Ani', status: 'PRESENT', checkedInAt: '2028-08-21T00:05:00Z' },
  { studentProfileId: 'b', fullName: 'Budi', status: null, checkedInAt: null },
  { studentProfileId: 'c', fullName: 'Cici', status: null, checkedInAt: null },
];

describe('confirmStatuses - only what differs from the server default', () => {
  it('defaults a check-in to PRESENT and anyone else to ABSENT', () => {
    expect(students.map(defaultStatusOf)).toEqual(['PRESENT', 'ABSENT', 'ABSENT']);
  });
  it('sends nothing when nothing was changed', () => {
    expect(confirmStatuses(students, { a: 'PRESENT', b: 'ABSENT' })).toEqual([]);
  });
  it('names the changed ones, with a note only when typed', () => {
    expect(confirmStatuses(students, { b: 'SICK', c: 'EXCUSED' }, { b: ' surat dokter ', c: '  ' })).toEqual([
      { studentProfileId: 'b', status: 'SICK', note: 'surat dokter' },
      { studentProfileId: 'c', status: 'EXCUSED' },
    ]);
  });
  it('tallies the roster as it will read', () => {
    expect(confirmTally(students, { b: 'SICK' })).toEqual({ PRESENT: 1, SICK: 1, EXCUSED: 0, ABSENT: 1 });
  });
});

describe('requestableSemesters / requestChoices - what a teacher can ask for', () => {
  const years = [
    { id: 'y1', label: '2028/2029', status: 'ACTIVE', semesters: [
      { id: 'sem1', ordinal: 1, status: 'OPEN', classSubjectRegistrationDeadline: '2028-08-10' },
      { id: 'sem2', ordinal: 2, status: 'OPEN', classSubjectRegistrationDeadline: null },
      { id: 'sem3', ordinal: 3, status: 'CLOSED' },
    ] },
    { id: 'y0', label: '2027/2028', status: 'CLOSED', semesters: [{ id: 'old', ordinal: 1, status: 'OPEN' }] },
  ];
  it('keeps OPEN semesters of ACTIVE years, marking a passed deadline', () => {
    const list = requestableSemesters(years, new Date('2028-08-15T00:00:00Z'));
    expect(list.map((s) => [s.id, s.closed])).toEqual([['sem1', true], ['sem2', false]]);
  });
  it('offers per class the subjects in use and still free there', () => {
    const board = { classes: [
      { id: 'c1', name: 'XI IPS', subjects: [{ subject: { id: 'mtk' } }] },
      { id: 'c2', name: 'XI IPA', subjects: [{ subject: { id: 'mtk' } }, { subject: { id: 'eko' } }] },
    ] };
    const catalog = [{ id: 'mtk' }, { id: 'eko' }, { id: 'fis', selected: false }];
    expect(requestChoices(board, catalog).map((c) => [c.class.id, c.subjects.map((s) => s.id)])).toEqual([['c1', ['eko']]]);
  });
});

describe('contentErrors - content.schema.js before the press', () => {
  it('needs a title of 1 to 200', () => {
    expect(contentErrors({ type: 'LINK', title: '  ', url: 'https://a.id' }).title).toBe('teach.content.error.title');
    expect(contentErrors({ type: 'LINK', title: 'x'.repeat(201), url: 'https://a.id' }).title).toBe('teach.content.error.titleLong');
  });
  it('takes https links only', () => {
    expect(contentErrors({ type: 'VIDEO', title: 'v', url: 'http://youtu.be/x' }).url).toBe('teach.content.error.https');
    expect(contentErrors({ type: 'LINK', title: 'l', url: 'https://kemdikbud.go.id' })).toEqual({});
  });
  it('refuses a text with no words', () => {
    expect(contentErrors({ type: 'TEXT', title: 't', html: '<p> &nbsp; </p>' }).html).toBe('teach.content.error.empty');
    expect(contentErrors({ type: 'TEXT', title: 't', html: '<p>Halo</p>' })).toEqual({});
  });
  it('takes the five file types up to 10 MB, and skips the file when editing', () => {
    expect(contentErrors({ type: 'FILE', title: 'f' }).file).toBe('teach.content.error.noFile');
    expect(contentErrors({ type: 'FILE', title: 'f', file: { name: 'a.exe', size: 1 } }).file).toBe('teach.content.error.fileType');
    expect(contentErrors({ type: 'FILE', title: 'f', file: { name: 'a.PDF', size: 11 * 1024 * 1024 } }).file).toBe('teach.content.error.fileSize');
    expect(contentErrors({ type: 'FILE', title: 'f', file: { name: 'a.pptx', size: 1024 } })).toEqual({});
    expect(contentErrors({ type: 'FILE', title: 'f' }, { editing: true })).toEqual({});
  });
});

describe('moveContent - one step up or down', () => {
  it('swaps with the neighbour and stops at an end', () => {
    expect(moveContent(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveContent(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
    expect(moveContent(['a', 'b', 'c'], 'x', 1)).toEqual(['a', 'b', 'c']);
  });
});
