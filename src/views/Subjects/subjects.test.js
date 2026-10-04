import { describe, it, expect } from 'vitest';

import {
  defaultSlot,
  freeSubjects,
  subjectsInUse,
  selectionChanges,
  boardWritable,
  deadlinePassed,
  bulkOutcome,
  isOwnRequest,
  canChangeAssignment,
  replacementTeachers,
  changeErrors,
} from './subjects.js';
import { validateSubjectCode, validateSubjectName, normaliseSubjectCode, deadlineFits } from '../../utils/validation.js';

const sem = (id, ordinal, start, end, status = 'OPEN', deadline = null) => ({
  id, ordinal, startDate: `${start}T00:00:00.000Z`, endDate: `${end}T00:00:00.000Z`, status,
  classSubjectRegistrationDeadline: deadline,
});

describe('defaultSlot — where the board opens (yearSelect, newest year first)', () => {
  const years = [
    { id: 'y-next', status: 'ACTIVE', semesters: [] },
    { id: 'y-now', status: 'ACTIVE', semesters: [sem('s1', 1, '2026-07-13', '2026-12-19'), sem('s2', 2, '2027-01-04', '2027-06-19')] },
    { id: 'y-old', status: 'CLOSED', semesters: [sem('o1', 1, '2025-07-14', '2025-12-20')] },
  ];

  it('takes the newest active year, and in it the semester holding today', () => {
    const [, now, old] = years;
    expect(defaultSlot([now, old], '2027-02-01')).toEqual({ yearId: 'y-now', semesterId: 's2' });
    expect(defaultSlot([now, old], '2026-09-26')).toEqual({ yearId: 'y-now', semesterId: 's1' });
  });

  it('opens the active year even with no semester yet, rather than a closed one (found in real use)', () => {
    expect(defaultSlot(years, '2026-09-26')).toEqual({ yearId: 'y-next', semesterId: null });
    expect(defaultSlot([years[0], years[2]], '2026-09-26')).toEqual({ yearId: 'y-next', semesterId: null });
  });

  it('falls back to the first OPEN semester between terms, then to the first', () => {
    const between = [{ id: 'y', status: 'ACTIVE', semesters: [sem('a', 1, '2026-07-13', '2026-12-19', 'CLOSED'), sem('b', 2, '2027-01-04', '2027-06-19')] }];
    expect(defaultSlot(between, '2026-12-28')).toEqual({ yearId: 'y', semesterId: 'b' });
  });

  it('with no active year opens the newest year that has a semester, and answers null for nothing', () => {
    const closedEmpty = { id: 'y-empty', status: 'CLOSED', semesters: [] };
    expect(defaultSlot([closedEmpty, years[2]], '2026-09-26')).toEqual({ yearId: 'y-old', semesterId: 'o1' });
    expect(defaultSlot([closedEmpty], '2026-09-26')).toEqual({ yearId: 'y-empty', semesterId: null });
    expect(defaultSlot([], '2026-09-26')).toBeNull();
  });
});

describe('freeSubjects — one PENDING or ACTIVE per class + subject + semester', () => {
  it('drops every subject already taught or waiting in the class', () => {
    const catalog = [{ id: 'mtk' }, { id: 'bind' }, { id: 'fis' }];
    const boardClass = { subjects: [{ subject: { id: 'mtk' } }, { subject: { id: 'fis' } }] };
    expect(freeSubjects(catalog, boardClass).map((s) => s.id)).toEqual(['bind']);
  });
  it('never offers a subject the school deselected (assertSubjectSelected)', () => {
    const catalog = [{ id: 'mtk', selected: true }, { id: 'bind', selected: false }, { id: 'fis' }];
    expect(freeSubjects(catalog, { subjects: [] }).map((s) => s.id)).toEqual(['mtk', 'fis']);
  });
});

describe('selectionChanges - the Catalog ticks against the server (a852609)', () => {
  const catalog = [
    { id: 'mtk', national: true, selected: true, activeClassSubjects: 2, pendingRequests: 1 },
    { id: 'bjw', national: true, selected: true, activeClassSubjects: 0, pendingRequests: 0 },
    { id: 'sen', national: true, selected: false, activeClassSubjects: 0, pendingRequests: 0 },
    { id: 'mulok', national: false, selected: true },
  ];
  it('is clean when the ticks match the server', () => {
    const c = selectionChanges(catalog, new Set(['mtk', 'bjw']));
    expect(c.dirty).toBe(false);
    expect(c.selectedIds).toEqual(['mtk', 'bjw']);
  });
  it('sends every national subject ticked, never a local one', () => {
    const c = selectionChanges(catalog, new Set(['mtk', 'sen', 'mulok']));
    expect(c.selectedIds).toEqual(['mtk', 'sen']);
    expect(c.selecting.map((s) => s.id)).toEqual(['sen']);
    expect(c.deselecting.map((s) => s.id)).toEqual(['bjw']);
  });
  it('flags a deselected subject only while something runs or waits on it', () => {
    const c = selectionChanges(catalog, new Set([]));
    expect(c.deselecting.map((s) => s.id)).toEqual(['mtk', 'bjw']);
    expect(c.stillRunning.map((s) => s.id)).toEqual(['mtk']);
    expect(c.selectedIds).toEqual([]);
  });
});

describe('subjectsInUse - what the school teaches (a852609)', () => {
  it('keeps selected and unmarked rows, drops deselected ones', () => {
    expect(subjectsInUse([{ id: 'a', selected: true }, { id: 'b', selected: false }, { id: 'c' }]).map((s) => s.id)).toEqual(['a', 'c']);
    expect(subjectsInUse(null)).toEqual([]);
  });
});

describe('boardWritable / deadlinePassed — resolveSlot and assertWithinRegistrationDeadline', () => {
  it('needs an ACTIVE year and an OPEN semester', () => {
    expect(boardWritable('ACTIVE', 'OPEN')).toBe(true);
    expect(boardWritable('CLOSED', 'OPEN')).toBe(false);
    expect(boardWritable('ACTIVE', 'CLOSED')).toBe(false);
  });

  it('is passed only once a deadline exists and now is after it', () => {
    const at = '2026-08-01T00:00:00.000Z';
    expect(deadlinePassed({ classSubjectRegistrationDeadline: null }, new Date('2030-01-01'))).toBe(false);
    expect(deadlinePassed({ classSubjectRegistrationDeadline: at }, new Date('2026-07-31T23:59:59Z'))).toBe(false);
    expect(deadlinePassed({ classSubjectRegistrationDeadline: at }, new Date('2026-08-01T00:00:01Z'))).toBe(true);
  });
});

describe('bulkOutcome — one answer per request (bulkApproveClassSubjects)', () => {
  it('counts the approved and names the failed, in the order ticked', () => {
    const requests = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const results = [
      { id: 'c', ok: true, status: 'ACTIVE' },
      { id: 'a', ok: false, error: { code: 'CONFLICT', message: 'This teaching request has already been decided' } },
      { id: 'b', ok: true, status: 'ACTIVE' },
    ];
    const out = bulkOutcome(requests, results);
    expect(out.approved).toBe(2);
    expect(out.failed.map((f) => f.request.id)).toEqual(['a']);
    expect(out.failed[0].error.code).toBe('CONFLICT');
  });

  it('counts a request with no answer as failed rather than approved', () => {
    expect(bulkOutcome([{ id: 'x' }], []).failed).toHaveLength(1);
  });
});

describe('local subjects — subjectBody, academics.schema.js', () => {
  it('folds the code to upper case and takes 2–10 letters or digits', () => {
    expect(normaliseSubjectCode(' mulok1 ')).toBe('MULOK1');
    expect(validateSubjectCode('mulok1')).toBeNull();
    expect(validateSubjectCode('ab')).toBeNull();
    expect(validateSubjectCode('a')).toEqual({ key: 'validation.subjectCode.invalid' });
    expect(validateSubjectCode('x'.repeat(11))).toEqual({ key: 'validation.subjectCode.invalid' });
    expect(validateSubjectCode('BHS-JW')).toEqual({ key: 'validation.subjectCode.invalid' });
    expect(validateSubjectCode('   ')).toEqual({ key: 'validation.subjectCode.required' });
  });

  it('takes a name of 2–100 characters after trim', () => {
    expect(validateSubjectName(' Bahasa Jawa ')).toBeNull();
    expect(validateSubjectName(' B ')).toEqual({ key: 'validation.subjectName.short' });
    expect(validateSubjectName('x'.repeat(100))).toBeNull();
    expect(validateSubjectName('x'.repeat(101))).toEqual({ key: 'validation.subjectName.long' });
  });
});

describe('deadlineFits — the registration deadline inside its semester (createSemester)', () => {
  it('is optional, and when given must fall between the start and the end, both included', () => {
    expect(deadlineFits('2026-07-13', '2026-12-19', '')).toBeNull();
    expect(deadlineFits('2026-07-13', '2026-12-19', '2026-07-13')).toBeNull();
    expect(deadlineFits('2026-07-13', '2026-12-19', '2026-12-19')).toBeNull();
    expect(deadlineFits('2026-07-13', '2026-12-19', '2026-07-12')).toEqual({ key: 'validation.deadline.outside' });
    expect(deadlineFits('2026-07-13', '2026-12-19', '2026-12-20')).toEqual({ key: 'validation.deadline.outside' });
  });
});

describe('isOwnRequest — a Vice Principal never decides their own teaching (backend 89a5666)', () => {
  const request = { id: 'r1', teacher: { membershipId: 'm-vice', fullName: 'Wakasek' } };

  it("marks the reader's own request when a Vice Principal reads the queue", () => {
    expect(isOwnRequest(request, 'm-vice')).toBe(true);
    expect(isOwnRequest(request, 'm-other')).toBe(false);
  });

  it('marks nothing for the Principal, who passes no id', () => {
    expect(isOwnRequest(request, null)).toBe(false);
    expect(isOwnRequest({ id: 'r2', teacher: { membershipId: null } }, null)).toBe(false);
  });
});

/* A board row as subjectBoard answers it (academics.service.js, classSubjectId / status / teacher). */
const boardRow = (status, membershipId) => ({
  classSubjectId: 'cs-1',
  status,
  subject: { id: 'sub-1', code: 'MTK', name: 'Matematika' },
  teacher: { membershipId, fullName: 'Guru' },
});

describe('canChangeAssignment — ending or replacing (backend 85bc687, loadLiveAssignment)', () => {
  it('offers an ACTIVE row, never a PENDING one — that belongs to the queue', () => {
    expect(canChangeAssignment(boardRow('ACTIVE', 'm-t'), null)).toBe(true);
    expect(canChangeAssignment(boardRow('PENDING', 'm-t'), null)).toBe(false);
  });

  it("keeps a Vice Principal off their own row (assertNotDecidingForSelf), not off others'", () => {
    expect(canChangeAssignment(boardRow('ACTIVE', 'm-vice'), 'm-vice')).toBe(false);
    expect(canChangeAssignment(boardRow('ACTIVE', 'm-t'), 'm-vice')).toBe(true);
  });

  it('lets the Principal, who passes no id, change any ACTIVE row', () => {
    expect(canChangeAssignment(boardRow('ACTIVE', 'm-principal'), null)).toBe(true);
  });
});

describe('replacementTeachers — never the current teacher ("That teacher already teaches it")', () => {
  const teachers = [
    { membershipId: 'm-a', fullName: 'A' },
    { membershipId: 'm-b', fullName: 'B' },
  ];

  it('leaves out the current teacher and keeps the order', () => {
    expect(replacementTeachers(teachers, boardRow('ACTIVE', 'm-a')).map((t) => t.membershipId)).toEqual(['m-b']);
  });

  it('answers an empty list while none are loaded or none are left', () => {
    expect(replacementTeachers(null, boardRow('ACTIVE', 'm-a'))).toEqual([]);
    expect(replacementTeachers([teachers[0]], boardRow('ACTIVE', 'm-a'))).toEqual([]);
  });
});

describe('changeErrors — endBody / replaceBody and assertRejectionReason(END)', () => {
  const reason = 'Pindah tugas';

  it('asks for a choice before anything else is judged', () => {
    expect(changeErrors({ mode: null, reason }).mode).toBe('subjects.change.modeRequired');
  });

  it('a replacement needs the new teacher', () => {
    expect(changeErrors({ mode: 'REPLACE', teacherId: '', reason })).toEqual({ teacher: 'subjects.assign.teacherRequired' });
    expect(changeErrors({ mode: 'REPLACE', teacherId: 'm-b', reason })).toEqual({});
  });

  it('ending has no default for subjectStops — false is an answer, null is not', () => {
    expect(changeErrors({ mode: 'END', subjectStops: null, reason })).toEqual({ subjectStops: 'subjects.change.stopsRequired' });
    expect(changeErrors({ mode: 'END', subjectStops: false, reason })).toEqual({});
    expect(changeErrors({ mode: 'END', subjectStops: true, reason })).toEqual({});
  });

  it('the reason is 3 to 500 characters once trimmed, either way', () => {
    expect(changeErrors({ mode: 'END', subjectStops: true, reason: '  ab  ' }).reason).toBe('validation.leaveReason.short');
    expect(changeErrors({ mode: 'END', subjectStops: true, reason: 'abc' })).toEqual({});
    expect(changeErrors({ mode: 'REPLACE', teacherId: 'm-b', reason: 'x'.repeat(500) })).toEqual({});
    expect(changeErrors({ mode: 'REPLACE', teacherId: 'm-b', reason: 'x'.repeat(501) }).reason).toBe('validation.leaveReason.long');
  });
});
