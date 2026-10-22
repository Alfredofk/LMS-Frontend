import { describe, expect, it } from 'vitest';

import { letterheadBody, letterheadDraftOf, letterheadErrors, logoFileError, logoSizeError } from './letterhead';

// Rules from backend 4dae152: school.schema.js letterheadBody, school.routes.js logoUpload,
// school.letterhead.js MAX_LOGO_SIDE.
describe('letterhead - the address and the phone', () => {
  const saved = { address: 'Jl. Merdeka 1, Bandung', phone: '022 123456', hasLogo: false };

  it('fills the form from what is saved, empty when none', () => {
    expect(letterheadDraftOf(saved)).toEqual({ address: 'Jl. Merdeka 1, Bandung', phone: '022 123456' });
    expect(letterheadDraftOf(null)).toEqual({ address: '', phone: '' });
  });

  it('refuses past 300 and 30 characters once trimmed, never an empty box', () => {
    expect(letterheadErrors({ address: 'a'.repeat(300), phone: '1'.repeat(30) })).toEqual({});
    expect(letterheadErrors({ address: ` ${'a'.repeat(300)} `, phone: '' })).toEqual({});
    expect(letterheadErrors({ address: 'a'.repeat(301), phone: '1'.repeat(31) })).toEqual({ address: 'kop.error.addressLong', phone: 'kop.error.phoneLong' });
  });

  it('sends only what changed, an emptied one as null', () => {
    expect(letterheadBody(saved, letterheadDraftOf(saved))).toBeNull();
    expect(letterheadBody(saved, { address: ' Jl. Merdeka 1, Bandung ', phone: '022 999' })).toEqual({ phone: '022 999' });
    expect(letterheadBody(saved, { address: '', phone: '022 123456' })).toEqual({ address: null });
    expect(letterheadBody({ address: null, phone: null }, { address: '  ', phone: '' })).toBeNull();
    expect(letterheadBody(null, { address: 'Jl. A', phone: '' })).toEqual({ address: 'Jl. A' });
  });
});

describe('letterhead - the logo', () => {
  const file = (type, size) => ({ type, size });

  it('a JPG or PNG of at most 2 MB', () => {
    expect(logoFileError(file('image/png', 2 * 1024 * 1024))).toBeNull();
    expect(logoFileError(file('image/jpeg', 10))).toBeNull();
    expect(logoFileError(file('image/png', 2 * 1024 * 1024 + 1))).toBe('kop.error.logoBig');
    expect(logoFileError(file('image/gif', 10))).toBe('kop.error.logoType');
    expect(logoFileError(file('image/webp', 10))).toBe('kop.error.logoType');
    expect(logoFileError(null)).toBeNull();
  });

  it('at most 2000 pixels on its longest side', () => {
    expect(logoSizeError(2000, 2000)).toBeNull();
    expect(logoSizeError(2001, 10)).toBe('kop.error.logoPixels');
    expect(logoSizeError(10, 2001)).toBe('kop.error.logoPixels');
  });
});
