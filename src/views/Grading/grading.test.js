import { describe, expect, it } from 'vitest';

import {
  kktpError,
  parseWhole,
  schoolBody,
  schoolDraftErrors,
  schoolDraftOf,
  slotChange,
  slotDraftErrors,
  slotDraftOf,
  weightErrors,
  weightsLine,
  weightsSum,
} from './grading';

/* A read as grading.service.js settingsView answers it. */
const read = ({ weights = [25, 25, 25, 25], ws = 'BUILT_IN', kktp = 75, ks = 'BUILT_IN', rule = 'CAP_AT_KKTP', rs = 'BUILT_IN', updatedAt = null } = {}) => ({
  weights: { value: { TUGAS: weights[0], KUIS: weights[1], UTS: weights[2], UAS: weights[3] }, source: ws },
  kktp: { value: kktp, source: ks },
  remedialRule: { value: rule, source: rs },
  updatedAt,
});
const texts = (a, b, c, d) => ({ TUGAS: a, KUIS: b, UTS: c, UAS: d });
const SAVED = '2026-10-14T03:00:00.000Z';

describe('grading - the boxes (grading.schema.js weight, kktp, weights)', () => {
  it('a whole number 0 to 100, nothing else', () => {
    expect(parseWhole('0')).toBe(0);
    expect(parseWhole(' 100 ')).toBe(100);
    expect(parseWhole('101')).toBeNull();
    expect(parseWhole('-1')).toBeNull();
    expect(parseWhole('7,5')).toBeNull();
    expect(parseWhole('7.5')).toBeNull();
    expect(parseWhole('')).toBeNull();
    expect(parseWhole('abc')).toBeNull();
  });

  it('the four weights must add up to 100, said once every box holds a number', () => {
    expect(weightErrors(texts('20', '20', '25', '35'))).toEqual({});
    expect(weightErrors(texts('25', '25', '25', '24'))).toEqual({ sum: 'grading.error.sum' });
    expect(weightErrors(texts('100', '0', '0', '0'))).toEqual({});
    expect(weightErrors(texts('', '25', '25', '50'))).toEqual({ TUGAS: 'grading.error.weight' });
    expect(weightsSum(texts('', '25', '25', '50'))).toBe(100);
  });

  it('the KKTP is 0 to 100', () => {
    expect(kktpError('75')).toBeNull();
    expect(kktpError('0')).toBeNull();
    expect(kktpError('101')).toBe('grading.error.kktp');
    expect(kktpError('')).toBe('grading.error.kktp');
  });

  it('weights read in the order TUGAS/KUIS/UTS/UAS', () => {
    expect(weightsLine({ UAS: 35, TUGAS: 20, UTS: 25, KUIS: 20 })).toBe('20/20/25/35');
  });
});

describe('grading - the school', () => {
  it('nothing changed: nothing to send, built-in values stay unset', () => {
    const settings = read();
    expect(schoolBody(settings, schoolDraftOf(settings))).toBeNull();
  });

  it('only what changed, with the updatedAt read (null before the first save)', () => {
    const settings = read();
    const draft = { ...schoolDraftOf(settings), kktp: '70' };
    expect(schoolBody(settings, draft)).toEqual({ kktp: 70, updatedAt: null });

    const saved = read({ ws: 'SCHOOL', weights: [20, 20, 25, 35], ks: 'SCHOOL', rs: 'SCHOOL', updatedAt: SAVED });
    const next = { ...schoolDraftOf(saved), weights: texts('30', '20', '20', '30'), remedialRule: 'HIGHEST' };
    expect(schoolBody(saved, next)).toEqual({ weights: { TUGAS: 30, KUIS: 20, UTS: 20, UAS: 30 }, remedialRule: 'HIGHEST', updatedAt: SAVED });
  });

  it('the form is checked before anything is sent', () => {
    expect(schoolDraftErrors({ weights: texts('25', '25', '25', '30'), kktp: '75', remedialRule: 'CAP_AT_KKTP' })).toEqual({ weights: { sum: 'grading.error.sum' } });
    expect(schoolDraftErrors({ weights: texts('25', '25', '25', '25'), kktp: '200', remedialRule: 'CAP_AT_KKTP' })).toEqual({ kktp: 'grading.error.kktp' });
  });
});

describe('grading - a slot', () => {
  const school = read({ ws: 'SCHOOL', weights: [20, 20, 25, 35], ks: 'SCHOOL', kktp: 70, rs: 'SCHOOL' });

  it('following the school: the form says so and offers the values as a start', () => {
    expect(slotDraftOf(school)).toEqual({ ownWeights: false, weights: texts('20', '20', '25', '35'), ownKktp: false, kktp: '70' });
    expect(slotChange(school, slotDraftOf(school))).toBeNull();
  });

  it('setting its own: sent with updatedAt null before the slot has a row', () => {
    const draft = { ...slotDraftOf(school), ownKktp: true, kktp: '80' };
    expect(slotChange(school, draft)).toEqual({ method: 'PUT', body: { kktp: 80, updatedAt: null } });
  });

  it('its own weights equal to the school\'s still become its own', () => {
    const draft = { ...slotDraftOf(school), ownWeights: true };
    expect(slotChange(school, draft)).toEqual({ method: 'PUT', body: { weights: { TUGAS: 20, KUIS: 20, UTS: 25, UAS: 35 }, updatedAt: null } });
  });

  it('one part back to the school is a null; the other untouched is not sent', () => {
    const own = read({ ws: 'SLOT', weights: [10, 30, 30, 30], ks: 'SLOT', kktp: 80, rs: 'SCHOOL', updatedAt: SAVED });
    const draft = { ...slotDraftOf(own), ownKktp: false };
    expect(slotChange(own, draft)).toEqual({ method: 'PUT', body: { kktp: null, updatedAt: SAVED } });
  });

  it('both back to the school: the clear route', () => {
    const own = read({ ws: 'SLOT', weights: [10, 30, 30, 30], ks: 'SCHOOL', kktp: 70, rs: 'SCHOOL', updatedAt: SAVED });
    const draft = { ...slotDraftOf(own), ownWeights: false };
    expect(slotChange(own, draft)).toEqual({ method: 'DELETE', body: { updatedAt: SAVED } });
  });

  it('a row with nothing of its own (cleared before) following the school: nothing to send', () => {
    const cleared = { ...school, updatedAt: SAVED };
    expect(slotChange(cleared, slotDraftOf(cleared))).toBeNull();
  });

  it('a changed own value is sent; an unchanged one is not', () => {
    const own = read({ ws: 'SLOT', weights: [10, 30, 30, 30], ks: 'SLOT', kktp: 80, rs: 'SCHOOL', updatedAt: SAVED });
    expect(slotChange(own, slotDraftOf(own))).toBeNull();
    const draft = { ...slotDraftOf(own), weights: texts('10', '30', '20', '40') };
    expect(slotChange(own, draft)).toEqual({ method: 'PUT', body: { weights: { TUGAS: 10, KUIS: 30, UTS: 20, UAS: 40 }, updatedAt: SAVED } });
  });

  it('only the parts it sets itself are checked', () => {
    expect(slotDraftErrors({ ownWeights: false, weights: texts('', '', '', ''), ownKktp: false, kktp: '' })).toEqual({});
    expect(slotDraftErrors({ ownWeights: true, weights: texts('50', '50', '0', '1'), ownKktp: true, kktp: 'x' })).toEqual({
      weights: { sum: 'grading.error.sum' },
      kktp: 'grading.error.kktp',
    });
  });
});
