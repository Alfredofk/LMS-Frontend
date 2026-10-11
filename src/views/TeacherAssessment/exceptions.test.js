import { describe, expect, it } from 'vitest';

import {
  canSetException,
  exceptionBody,
  exceptionChanged,
  exceptionErrors,
  exceptionFacts,
  exceptionFormFrom,
  remedialOpen,
} from './exceptions';
import { semesterSpan } from './teacherAssessment';

// Against backend 1e6c749: assessment.schema.js exceptionBody, assessment.exception.js.

const assessment = { mode: 'ONLINE', status: 'PUBLISHED', opensAt: '2026-10-12T00:00:00Z', closesAt: '2026-10-19T10:00:00Z' };
const span = semesterSpan({ startDate: '2026-07-13T00:00:00Z', endDate: '2026-12-19T00:00:00Z' }, 'WIB');
const before = new Date('2026-10-15T00:00:00Z');
const after = new Date('2026-10-20T00:00:00Z');

const form = (over = {}) => ({ ...exceptionFormFrom(null, 'WIB'), ...over });
const window = { opensDate: '2026-10-21', opensTime: '07:00', closesDate: '2026-10-22', closesTime: '12:00' };

describe('who and when', () => {
  it('the answering teacher, an online published one, a student placed now', () => {
    expect(canSetException(assessment, { placedNow: true }, true)).toBe(true);
    expect(canSetException(assessment, { placedNow: false }, true)).toBe(false);
    expect(canSetException(assessment, { placedNow: true }, false)).toBe(false);
    expect(canSetException({ ...assessment, mode: 'OFFLINE' }, { placedNow: true }, true)).toBe(false);
    expect(canSetException({ ...assessment, status: 'DRAFT' }, { placedNow: true }, true)).toBe(false);
    expect(canSetException({ ...assessment, status: 'CANCELLED' }, { placedNow: true }, true)).toBe(false);
  });

  it('a remedial once the class window has closed, at its close included', () => {
    expect(remedialOpen(assessment, before)).toBe(false);
    expect(remedialOpen(assessment, new Date(assessment.closesAt))).toBe(true);
    expect(remedialOpen(assessment, after)).toBe(true);
  });
});

describe('the form', () => {
  it('reads an exception back in the school zone', () => {
    const saved = { makeUp: { opensAt: '2026-10-21T00:00:00.000Z', closesAt: '2026-10-22T05:00:00.000Z' }, extraAttempts: 2, remedial: false };
    expect(exceptionFormFrom(saved, 'WIB')).toEqual({ makeUp: true, window, extraAttempts: '2', remedial: false });
    expect(exceptionFormFrom({ makeUp: null, extraAttempts: 1, remedial: true }, 'WIB').makeUp).toBe(false);
  });

  it('something must be given: a window or extra attempts', () => {
    expect(exceptionErrors(form(), { zone: 'WIB', span, assessment, now: before })).toEqual({ form: 'tasm.exc.error.empty' });
    expect(exceptionErrors(form({ extraAttempts: '1' }), { zone: 'WIB', span, assessment, now: before })).toEqual({});
    expect(exceptionErrors(form({ makeUp: true, window }), { zone: 'WIB', span, assessment, now: before })).toEqual({});
  });

  it('extra attempts are a whole 0 to 20', () => {
    for (const typed of ['21', '-1', '1.5', 'dua', '']) {
      expect(exceptionErrors(form({ extraAttempts: typed }), { zone: 'WIB', span, assessment, now: before }).extraAttempts).toBe('tasm.exc.error.extra');
    }
    expect(exceptionErrors(form({ extraAttempts: '20' }), { zone: 'WIB', span, assessment, now: before })).toEqual({});
  });

  it('the window: both ends, in order, inside the semester, closing after now', () => {
    const at = (over) => exceptionErrors(form({ makeUp: true, window: { ...window, ...over } }), { zone: 'WIB', span, assessment, now: before });
    expect(at({ opensTime: '' }).opens).toBe('tasm.error.when');
    expect(at({ closesDate: '2026-10-21', closesTime: '06:00' }).closes).toBe('tasm.error.order');
    expect(at({ closesDate: '2026-12-20', closesTime: '00:01' }).closes).toBe('tasm.error.outsideSemester');
    expect(at({ closesDate: '2026-12-20', closesTime: '00:00' }).closes).toBeUndefined();
    expect(at({ opensDate: '2026-10-10', closesDate: '2026-10-14', closesTime: '12:00' }).closes).toBe('tasm.exc.error.closesPast');
  });

  it('a remedial: after the class closes, at least one attempt', () => {
    const remedial = form({ remedial: true, extraAttempts: '1' });
    expect(exceptionErrors(remedial, { zone: 'WIB', span, assessment, now: before })).toEqual({ form: 'tasm.exc.error.remedialOpen' });
    expect(exceptionErrors(remedial, { zone: 'WIB', span, assessment, now: after })).toEqual({});
    expect(exceptionErrors(form({ remedial: true, makeUp: true, window }), { zone: 'WIB', span, assessment, now: after }).extraAttempts).toBe('tasm.exc.error.remedialExtra');
  });
});

describe('the body', () => {
  it('names every field; a first one sends no updatedAt, a change its own', () => {
    expect(exceptionBody(form({ extraAttempts: '2' }), 'WIB')).toEqual({ makeUp: null, extraAttempts: 2, remedial: false });
    expect(exceptionBody(form({ makeUp: true, window, remedial: true, extraAttempts: '1' }), 'WIB', { updatedAt: '2026-10-11T09:00:00.000Z' })).toEqual({
      makeUp: { opensAt: '2026-10-21T07:00:00+07:00', closesAt: '2026-10-22T12:00:00+07:00' },
      extraAttempts: 1,
      remedial: true,
      updatedAt: '2026-10-11T09:00:00.000Z',
    });
  });

  it('a change is measured against the saved one', () => {
    const saved = { makeUp: { opensAt: '2026-10-21T00:00:00.000Z', closesAt: '2026-10-22T05:00:00.000Z' }, extraAttempts: 0, remedial: false };
    const same = exceptionFormFrom(saved, 'WIB');
    expect(exceptionChanged(same, saved, 'WIB')).toBe(false);
    expect(exceptionChanged({ ...same, extraAttempts: '1' }, saved, 'WIB')).toBe(true);
    expect(exceptionChanged({ ...same, window: { ...same.window, closesTime: '13:00' } }, saved, 'WIB')).toBe(true);
    expect(exceptionChanged(form(), null, 'WIB')).toBe(false);
    expect(exceptionChanged(form({ extraAttempts: '1' }), null, 'WIB')).toBe(true);
  });
});

describe('what a row says', () => {
  it('the window, then the attempts or the remedial', () => {
    expect(exceptionFacts(null)).toEqual([]);
    const makeUp = { opensAt: 'a', closesAt: 'b' };
    expect(exceptionFacts({ makeUp, extraAttempts: 2, remedial: false })).toEqual([
      { key: 'tasm.exc.fact.makeUp', vars: { opens: 'a', closes: 'b' } },
      { key: 'tasm.exc.fact.extra', vars: { n: 2 } },
    ]);
    expect(exceptionFacts({ makeUp: null, extraAttempts: 1, remedial: true })).toEqual([{ key: 'tasm.exc.fact.remedial', vars: { n: 1 } }]);
    expect(exceptionFacts({ makeUp, extraAttempts: 0, remedial: false })).toHaveLength(1);
  });
});
