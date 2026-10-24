import { describe, expect, it } from 'vitest';

import { correctionErrorsOf, correctionFormOf, correctionPatchOf, decidesApplications, isBodyOff, normaliseSk, reasonErrorOf, removalNoteOf, takesSk } from './bodyDecisions';

// The body as governingBody.service.js bodyView sends it (backend b5cfffd).
const body = { id: 'g-1', kind: 'FOUNDATION', name: 'Yayasan Penabur Malang', npyp: 'A1B2C3', skNumber: 'AHU-0012345.AH.01.04.TAHUN 2015', deactivatedAt: null };

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

  it('asks a name of 2-150, a known kind, and an SK number of 5-100 when given', () => {
    expect(correctionErrorsOf(correctionFormOf(body), body)).toEqual({});
    expect(correctionErrorsOf({ ...correctionFormOf(body), name: ' a ' }, body)).toEqual({ name: 'gbr.edit.error.nameShort' });
    expect(correctionErrorsOf({ ...correctionFormOf(body), name: 'x'.repeat(151) }, body)).toEqual({ name: 'gbr.edit.error.nameLong' });
    expect(correctionErrorsOf({ ...correctionFormOf(body), kind: 'SCHOOL' }, body).kind).toBe('gbr.edit.error.kind');
    expect(correctionErrorsOf({ ...correctionFormOf(body), skNumber: '  ' }, body)).toEqual({});
    expect(correctionErrorsOf({ ...correctionFormOf(body), skNumber: 'AHU1' }, body)).toEqual({ skNumber: 'gbr.edit.error.skShort' });
    expect(correctionErrorsOf({ ...correctionFormOf(body), skNumber: 'A'.repeat(101) }, body)).toEqual({ skNumber: 'gbr.edit.error.skLong' });
    expect(correctionErrorsOf({ name: 'Dinas Pendidikan Kota Malang', kind: 'GOVERNMENT', npyp: 'bad', skNumber: '' }, body)).toEqual({});
  });

  // c79b56f (ticket 04b): an NPYP once held is never cleared; a body from before with none may stay without.
  it('keeps an NPYP a body holds, and lets a body from before go without one', () => {
    expect(correctionErrorsOf({ ...correctionFormOf(body), npyp: '' }, body)).toEqual({ npyp: 'gbr.edit.npypRequired' });
    expect(correctionErrorsOf({ ...correctionFormOf(body), npyp: 'A1B2C' }, body)).toEqual({ npyp: 'gbreg.npyp.format' });
    const before = { ...body, npyp: null };
    expect(correctionErrorsOf(correctionFormOf(before), before)).toEqual({});
    expect(correctionErrorsOf({ ...correctionFormOf(before), npyp: 'A1 B2C' }, before)).toEqual({ npyp: 'gbreg.npyp.format' });
    const dinas = { ...body, kind: 'GOVERNMENT', npyp: null, skNumber: null };
    expect(correctionErrorsOf({ ...correctionFormOf(dinas), kind: 'FOUNDATION' }, dinas)).toEqual({ npyp: 'gbr.edit.npypRequired' });
  });

  it('sends only what changed, and nothing when nothing did', () => {
    expect(correctionPatchOf(body, correctionFormOf(body))).toBeNull();
    expect(correctionPatchOf(body, { ...correctionFormOf(body), name: ' Yayasan Penabur ' })).toEqual({ name: 'Yayasan Penabur' });
    expect(correctionPatchOf(body, { ...correctionFormOf(body), skNumber: 'ahu-0012345.ah.01.04.tahun  2015' })).toBeNull();
    expect(correctionPatchOf(body, { ...correctionFormOf(body), npyp: ' a1b2c3 ' })).toBeNull();
    expect(correctionPatchOf(body, { ...correctionFormOf(body), npyp: 'z9y8x7' })).toEqual({ npyp: 'Z9Y8X7' });
    expect(correctionPatchOf(body, { ...correctionFormOf(body), kind: 'ASSOCIATION' })).toEqual({ kind: 'ASSOCIATION' });
  });

  it('removes an emptied SK number, and adds an NPYP to a body from before', () => {
    expect(correctionPatchOf(body, { ...correctionFormOf(body), skNumber: ' ' })).toEqual({ skNumber: null });
    const before = { ...body, npyp: null, skNumber: null };
    expect(correctionPatchOf(before, correctionFormOf(before))).toBeNull();
    expect(correctionPatchOf(before, { ...correctionFormOf(before), npyp: 'q1w2e3' })).toEqual({ npyp: 'Q1W2E3' });
  });

  it('removes both numbers when the body becomes a government one, and gives them when it stops being', () => {
    expect(correctionPatchOf(body, { ...correctionFormOf(body), kind: 'GOVERNMENT' })).toEqual({ kind: 'GOVERNMENT', npyp: null, skNumber: null });
    const dinas = { ...body, kind: 'GOVERNMENT', npyp: null, skNumber: null };
    expect(correctionPatchOf(dinas, { name: dinas.name, kind: 'GOVERNMENT', npyp: 'A1B2C3', skNumber: 'typed anyway' })).toBeNull();
    expect(correctionPatchOf(dinas, { name: dinas.name, kind: 'FOUNDATION', npyp: 'a1b2c3', skNumber: 'ahu-9' })).toEqual({ kind: 'FOUNDATION', npyp: 'A1B2C3', skNumber: 'AHU-9' });
  });

  it('reads a body switched off from the registration', () => {
    expect(isBodyOff({ governingBody: { ...body, deactivatedAt: '2026-10-24T00:00:00Z' } })).toBe(true);
    expect(isBodyOff({ governingBody: body })).toBe(false);
    expect(isBodyOff({ governingBody: null })).toBe(false);
  });
});

// governingBody.admins.js listAdminsOf / assertNoSittingAdmin (backend 8aff4f4).
describe('governing body review - its admins', () => {
  const admin = (id, senior = false) => ({ id, user: { fullName: `Admin ${id}` }, senior, you: false });

  it('decides the applications only while nobody sits', () => {
    expect(decidesApplications([])).toBe(true);
    expect(decidesApplications([admin('a', true)])).toBe(false);
    expect(decidesApplications(undefined)).toBe(false);
  });

  it('warns that removing the last leaves the body with no admin', () => {
    expect(removalNoteOf([admin('a', true)], 'a')).toEqual({ state: 'LAST' });
  });

  it('names the next senior when the senior is removed', () => {
    const next = admin('b');
    expect(removalNoteOf([admin('a', true), next, admin('c')], 'a')).toEqual({ state: 'SENIOR', next });
  });

  it('says nothing more for any other admin, or one no longer listed', () => {
    expect(removalNoteOf([admin('a', true), admin('b')], 'b')).toBeNull();
    expect(removalNoteOf([admin('a', true)], 'z')).toBeNull();
  });
});
