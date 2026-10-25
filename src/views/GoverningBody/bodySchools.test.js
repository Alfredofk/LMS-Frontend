import { describe, expect, it } from 'vitest';

import {
  MAX_SCHOOLS_AT_ONCE,
  createBodyOf,
  emptyRow,
  fixErrorsOf,
  fixFormOf,
  fixPatchOf,
  matchesSchool,
  repeatedNpsnsOf,
  rowErrorsOf,
  rowTouched,
  rowsErrorsOf,
  serverRowErrorsOf,
} from './bodySchools';

// governingBody.schema.js createSchoolsBody / schoolPatchBody and school.schema.js
// schoolFields (backend ed0d304).
const filled = (over = {}) => ({
  ...emptyRow('a'),
  npsn: '20512345',
  schoolName: 'SD Harapan',
  schoolType: 'SD',
  city: 'Kota Malang',
  latitude: '-7,9666',
  longitude: '112.6326',
  timeZone: 'WIB',
  ...over,
});

describe('governing body schools - creating', () => {
  it('caps a submission at ten, as MAX_SCHOOLS_AT_ONCE', () => {
    expect(MAX_SCHOOLS_AT_ONCE).toBe(10);
  });

  it('starts a card empty, as an SMA, and counts the preset type as nothing typed', () => {
    const row = emptyRow('k');
    expect(row.schoolType).toBe('SMA');
    expect(rowTouched(row)).toBe(false);
    expect(rowTouched({ ...row, city: 'Malang' })).toBe(true);
    expect(rowTouched({ ...row, npsn: '   ' })).toBe(false);
  });

  it('passes a filled card and names every empty field of an empty one', () => {
    expect(rowErrorsOf(filled())).toEqual({});
    const errors = rowErrorsOf(emptyRow('k'));
    expect(Object.keys(errors).sort()).toEqual(['city', 'latitude', 'longitude', 'npsn', 'schoolName', 'timeZone']);
  });

  it('asks an SMK for its duration, and no other type', () => {
    expect(rowErrorsOf(filled({ schoolType: 'SMK' })).durationYears).toEqual({ key: 'validation.duration.required' });
    expect(rowErrorsOf(filled({ schoolType: 'SMK', durationYears: '4' })).durationYears).toBeUndefined();
    expect(rowErrorsOf(filled({ schoolType: 'SMA' })).durationYears).toBeUndefined();
  });

  it('marks the later of two cards naming one NPSN, with the first card counted from 1', () => {
    const rows = [filled(), filled({ npsn: '20512346' }), filled({ npsn: ' 20512345 ' })];
    expect(repeatedNpsnsOf(rows)).toEqual({ 2: 0 });
    expect(rowsErrorsOf(rows)).toEqual({ 2: { npsn: { key: 'gbs.new.error.npsnRepeat', vars: { row: 1 } } } });
  });

  it('points every later repeat at the first card, not at the one before it', () => {
    const rows = [filled(), filled(), filled()];
    expect(repeatedNpsnsOf(rows)).toEqual({ 1: 0, 2: 0 });
  });

  it('leaves the repeat to the shape rule when the NPSN is malformed anyway', () => {
    const rows = [filled({ npsn: '123' }), filled({ npsn: '123' })];
    expect(rowsErrorsOf(rows)[1].npsn).toEqual({ key: 'validation.npsn.format' });
  });

  it('sends trimmed text, numbers for the point, and a duration for an SMK only', () => {
    const body = createBodyOf([filled({ schoolName: '  SD Harapan ' }), filled({ npsn: '20512346', schoolType: 'SMK', durationYears: '4' })]);
    expect(body.schools[0]).toEqual({
      npsn: '20512345',
      schoolName: 'SD Harapan',
      schoolType: 'SD',
      city: 'Kota Malang',
      latitude: -7.9666,
      longitude: 112.6326,
      timeZone: 'WIB',
    });
    expect(body.schools[0]).not.toHaveProperty('durationYears');
    expect(body.schools[1].durationYears).toBe(4);
    expect(body.schools[0]).not.toHaveProperty('key');
  });

  it("lays a 400's issues on their cards in the server's words, and skips the rest", () => {
    const err = {
      code: 'BAD_REQUEST',
      details: [
        { path: 'schools.1.npsn', message: 'NPSN must be 8 digits' },
        { path: 'schools.0.city', message: 'City is required' },
        { path: 'schools', message: 'At most 10 schools in one submission' },
        { path: 'schools.0.applicantPhone', message: 'Unrecognized key' },
        { path: 'student.0.npsn', message: 'Not a card' },
      ],
    };
    expect(serverRowErrorsOf(err)).toEqual({
      rows: { 1: { npsn: { text: 'NPSN must be 8 digits' } }, 0: { city: { text: 'City is required' } } },
      rowNumbers: [1, 2],
    });
  });

  it("lays a 409's taken NPSNs on their cards", () => {
    const err = { code: 'CONFLICT', details: { rows: [{ row: 3, index: 2, npsn: '1' }, { row: 1, index: 0, npsn: '2' }] } };
    expect(serverRowErrorsOf(err)).toEqual({
      rows: { 2: { npsn: { key: 'reg.conflict.npsn' } }, 0: { npsn: { key: 'reg.conflict.npsn' } } },
      rowNumbers: [1, 3],
    });
  });

  it('lays nothing for a refusal that names no card', () => {
    expect(serverRowErrorsOf({ code: 'CONFLICT', message: 'One of these NPSNs was registered meanwhile' })).toEqual({ rows: {}, rowNumbers: [] });
    expect(serverRowErrorsOf({ code: 'FORBIDDEN' })).toEqual({ rows: {}, rowNumbers: [] });
  });
});

describe('governing body schools - the list', () => {
  const school = { name: 'SMP Harapan Bangsa', npsn: '20512346', city: 'Kota Malang' };

  it('searches the name, the NPSN and the city, ignoring case', () => {
    expect(matchesSchool(school, 'harapan')).toBe(true);
    expect(matchesSchool(school, '2051')).toBe(true);
    expect(matchesSchool(school, 'MALANG')).toBe(true);
    expect(matchesSchool(school, 'Surabaya')).toBe(false);
    expect(matchesSchool(school, '  ')).toBe(true);
  });
});

describe('governing body schools - fixing one', () => {
  const sma = { id: 's', name: 'SMA Harapan', npsn: '20512345', schoolType: 'SMA', durationYears: 3 };
  const smk = { id: 'k', name: 'SMK Harapan', npsn: '20512347', schoolType: 'SMK', durationYears: 4 };

  it('starts from the school, a duration shown for an SMK only', () => {
    expect(fixFormOf(sma)).toEqual({ schoolName: 'SMA Harapan', npsn: '20512345', schoolType: 'SMA', durationYears: '' });
    expect(fixFormOf(smk).durationYears).toBe('4');
  });

  it('sends nothing when nothing changed', () => {
    expect(fixPatchOf(sma, fixFormOf(sma))).toBeNull();
    expect(fixPatchOf(smk, fixFormOf(smk))).toBeNull();
    expect(fixPatchOf(sma, { ...fixFormOf(sma), schoolName: ' SMA Harapan ' })).toBeNull();
  });

  it('sends only what changed', () => {
    expect(fixPatchOf(sma, { ...fixFormOf(sma), schoolName: 'SMA Harapan Bangsa' })).toEqual({ schoolName: 'SMA Harapan Bangsa' });
    expect(fixPatchOf(sma, { ...fixFormOf(sma), npsn: '20512399' })).toEqual({ npsn: '20512399' });
    expect(fixPatchOf(smk, { ...fixFormOf(smk), durationYears: '3' })).toEqual({ durationYears: 3 });
  });

  it('states the duration of a type turned into an SMK, and none for one turned away', () => {
    expect(fixPatchOf(sma, { ...fixFormOf(sma), schoolType: 'SMK', durationYears: '3' })).toEqual({ schoolType: 'SMK', durationYears: 3 });
    expect(fixPatchOf(smk, { ...fixFormOf(smk), schoolType: 'SMA', durationYears: '' })).toEqual({ schoolType: 'SMA' });
  });

  it('refuses a short name, a malformed NPSN and an SMK with no duration', () => {
    expect(fixErrorsOf(fixFormOf(sma))).toEqual({});
    expect(Object.keys(fixErrorsOf({ schoolName: 'SD', npsn: '123', schoolType: 'SMK', durationYears: '' })).sort()).toEqual(['durationYears', 'npsn', 'schoolName']);
  });
});
