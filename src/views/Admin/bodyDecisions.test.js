import { describe, expect, it } from 'vitest';

import { correctionErrorsOf, correctionFormOf, correctionPatchOf, isBodyOff, normaliseSk, reasonErrorOf, takesSk } from './bodyDecisions';

// The body as governingBody.service.js bodyView sends it (backend b5cfffd).
const body = { id: 'g-1', kind: 'FOUNDATION', name: 'Yayasan Penabur Malang', skNumber: 'AHU-0012345.AH.01.04.TAHUN 2015', deactivatedAt: null };

describe('governing body review - reasons (assertRejectionReason, decisionBody)', () => {
  it('asks 3-500 to reject or switch off, after trimming', () => {
    expect(reasonErrorOf('reject', '  ab ')).toBe('gbr.reject.reason.required');
    expect(reasonErrorOf('reject', 'abc')).toBeNull();
    expect(reasonErrorOf('deactivate', '')).toBe('gbr.deactivate.reason.required');
    expect(reasonErrorOf('deactivate', 'x'.repeat(500))).toBeNull();
    expect(reasonErrorOf('deactivate', 'x'.repeat(501))).toBe('gbr.reason.long');
  });

  it('leaves the note for restoring optional, but not unbounded', () => {
    expect(reasonErrorOf('reactivate', '')).toBeNull();
    expect(reasonErrorOf('reactivate', undefined)).toBeNull();
    expect(reasonErrorOf('reactivate', 'x'.repeat(501))).toBe('gbr.reason.long');
  });
});

describe('governing body review - a correction (editBody, updateGoverningBody)', () => {
  it('keeps an SK number as the server does', () => {
    expect(normaliseSk('  ahu-001   ah.01  ')).toBe('AHU-001 AH.01');
    expect(normaliseSk(null)).toBe('');
    expect(takesSk('FOUNDATION')).toBe(true);
    expect(takesSk('ASSOCIATION')).toBe(true);
    expect(takesSk('GOVERNMENT')).toBe(false);
  });

  it('asks a name of 2-150, a known kind, and a number of 5-100 where the kind takes one', () => {
    expect(correctionErrorsOf(correctionFormOf(body))).toEqual({});
    expect(correctionErrorsOf({ ...correctionFormOf(body), name: ' a ' })).toEqual({ name: 'gbr.edit.error.nameShort' });
    expect(correctionErrorsOf({ ...correctionFormOf(body), name: 'x'.repeat(151) })).toEqual({ name: 'gbr.edit.error.nameLong' });
    expect(correctionErrorsOf({ ...correctionFormOf(body), kind: 'SCHOOL' }).kind).toBe('gbr.edit.error.kind');
    expect(correctionErrorsOf({ ...correctionFormOf(body), skNumber: '  ' })).toEqual({ skNumber: 'gbr.edit.skRequired' });
    expect(correctionErrorsOf({ ...correctionFormOf(body), skNumber: 'AHU1' })).toEqual({ skNumber: 'gbr.edit.error.skShort' });
    expect(correctionErrorsOf({ ...correctionFormOf(body), skNumber: 'A'.repeat(101) })).toEqual({ skNumber: 'gbr.edit.error.skLong' });
    expect(correctionErrorsOf({ name: 'Dinas Pendidikan Kota Malang', kind: 'GOVERNMENT', skNumber: '' })).toEqual({});
  });

  it('sends only what changed, and nothing when nothing did', () => {
    expect(correctionPatchOf(body, correctionFormOf(body))).toBeNull();
    expect(correctionPatchOf(body, { ...correctionFormOf(body), name: ' Yayasan Penabur ' })).toEqual({ name: 'Yayasan Penabur' });
    expect(correctionPatchOf(body, { ...correctionFormOf(body), skNumber: 'ahu-0012345.ah.01.04.tahun  2015' })).toBeNull();
    expect(correctionPatchOf(body, { ...correctionFormOf(body), kind: 'ASSOCIATION' })).toEqual({ kind: 'ASSOCIATION' });
  });

  it('removes the number when the body becomes a government one, and gives one when it stops being', () => {
    expect(correctionPatchOf(body, { ...correctionFormOf(body), kind: 'GOVERNMENT' })).toEqual({ kind: 'GOVERNMENT', skNumber: null });
    const dinas = { ...body, kind: 'GOVERNMENT', skNumber: null };
    expect(correctionPatchOf(dinas, { name: dinas.name, kind: 'GOVERNMENT', skNumber: 'typed anyway' })).toBeNull();
    expect(correctionPatchOf(dinas, { name: dinas.name, kind: 'FOUNDATION', skNumber: 'ahu-9' })).toEqual({ kind: 'FOUNDATION', skNumber: 'AHU-9' });
  });

  it('reads a body switched off from the registration', () => {
    expect(isBodyOff({ governingBody: { ...body, deactivatedAt: '2026-10-24T00:00:00Z' } })).toBe(true);
    expect(isBodyOff({ governingBody: body })).toBe(false);
    expect(isBodyOff({ governingBody: null })).toBe(false);
  });
});
