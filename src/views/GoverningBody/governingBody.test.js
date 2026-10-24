import { describe, expect, it } from 'vitest';

import { addressLineOf, kindKeyOf } from './governingBody';

// The shape of governingBody.service.js bodyView / addressOf (backend b5cfffd).
const address = {
  street: 'Jl. Merdeka No. 10',
  village: 'Kauman',
  district: 'Klojen',
  city: 'Kota Malang',
  province: 'Jawa Timur',
  postalCode: '65119',
};

describe('governing body - the page', () => {
  it('names each kind, and nothing it does not know', () => {
    expect(kindKeyOf('FOUNDATION')).toBe('gb.kind.FOUNDATION');
    expect(kindKeyOf('ASSOCIATION')).toBe('gb.kind.ASSOCIATION');
    expect(kindKeyOf('GOVERNMENT')).toBe('gb.kind.GOVERNMENT');
    expect(kindKeyOf('SCHOOL')).toBeNull();
    expect(kindKeyOf(undefined)).toBeNull();
  });

  it('writes the address as on a letter, the postal code after the province', () => {
    expect(addressLineOf(address)).toBe('Jl. Merdeka No. 10, Kauman, Klojen, Kota Malang, Jawa Timur 65119');
  });

  it('skips what is empty, the postal code being optional', () => {
    expect(addressLineOf({ ...address, postalCode: null })).toBe('Jl. Merdeka No. 10, Kauman, Klojen, Kota Malang, Jawa Timur');
    expect(addressLineOf({ ...address, village: '  ' })).toBe('Jl. Merdeka No. 10, Klojen, Kota Malang, Jawa Timur 65119');
    expect(addressLineOf(null)).toBe('');
  });
});
