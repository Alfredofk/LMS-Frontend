import { describe, it, expect } from 'vitest';

import { defaultSlot, freeSubjects, boardWritable, deadlinePassed, bulkOutcome } from './subjects.js';
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
