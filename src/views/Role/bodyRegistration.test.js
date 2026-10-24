import { describe, expect, it } from 'vitest';

import { PROVINCES, fileError, registrationErrors, registrationFormData, registrationLineOf, typeOfBytes } from './bodyRegistration';

// governingBody.schema.js registrationBody and governingBody.routes.js registrationFiles (backend b5cfffd).
const filled = {
  kind: 'FOUNDATION',
  name: 'Yayasan Penabur Malang',
  npyp: 'A1B2C3',
  skNumber: 'AHU-0012345.AH.01.04.Tahun 2015',
  street: 'Jl. Merdeka No. 10',
  village: 'Kauman',
  district: 'Klojen',
  city: 'Kota Malang',
  province: 'Jawa Timur',
  postalCode: '',
  applicantPhone: '0812 3456 7890',
};
const keys = (values) => Object.fromEntries(Object.entries(registrationErrors(values)).map(([k, v]) => [k, v.key]));

describe('governing body registration - the fields', () => {
  it('takes a complete registration, the postal code left out', () => {
    expect(registrationErrors(filled)).toEqual({});
    expect(PROVINCES).toHaveLength(38);
    expect(new Set(PROVINCES).size).toBe(38);
  });

  it('asks a known kind and a name of 2-150', () => {
    expect(keys({ ...filled, kind: 'SCHOOL' })).toEqual({ kind: 'gbreg.kind.required' });
    expect(keys({ ...filled, name: ' ' })).toEqual({ name: 'gbreg.name.required' });
    expect(keys({ ...filled, name: 'Y' })).toEqual({ name: 'gbreg.name.short' });
    expect(keys({ ...filled, name: 'Y'.repeat(150) })).toEqual({});
    expect(keys({ ...filled, name: 'Y'.repeat(151) })).toEqual({ name: 'gbreg.name.long' });
  });

  // c79b56f (ticket 04b): the NPYP required, the SK number optional, a government body neither.
  it('asks an NPYP of six letters and digits of a foundation or an association', () => {
    expect(keys({ ...filled, npyp: '' })).toEqual({ npyp: 'gbreg.npyp.required' });
    expect(keys({ ...filled, kind: 'ASSOCIATION', npyp: ' ' })).toEqual({ npyp: 'gbreg.npyp.required' });
    expect(keys({ ...filled, npyp: ' a1b2c3 ' })).toEqual({});
    expect(keys({ ...filled, npyp: 'A1B2C' })).toEqual({ npyp: 'gbreg.npyp.format' });
    expect(keys({ ...filled, npyp: 'A1B2C3D' })).toEqual({ npyp: 'gbreg.npyp.format' });
    expect(keys({ ...filled, npyp: 'A1 2C3' })).toEqual({ npyp: 'gbreg.npyp.format' });
    expect(keys({ ...filled, npyp: 'A1-2C3' })).toEqual({ npyp: 'gbreg.npyp.format' });
  });

  it('takes the SK number as optional, 5-100 when given', () => {
    expect(keys({ ...filled, skNumber: '' })).toEqual({});
    expect(keys({ ...filled, kind: 'ASSOCIATION', skNumber: 'AHU1' })).toEqual({ skNumber: 'gbreg.skNumber.short' });
    expect(keys({ ...filled, skNumber: 'A'.repeat(100) })).toEqual({});
    expect(keys({ ...filled, skNumber: 'A'.repeat(101) })).toEqual({ skNumber: 'gbreg.skNumber.long' });
  });

  it('asks neither of a government body', () => {
    expect(keys({ ...filled, kind: 'GOVERNMENT', npyp: '', skNumber: '' })).toEqual({});
    expect(keys({ ...filled, kind: 'GOVERNMENT', npyp: 'bad', skNumber: 'AHU1' })).toEqual({});
  });

  it('asks every part of the address but the postal code, which is five digits when given', () => {
    expect(keys({ ...filled, street: 'J' })).toEqual({ street: 'gbreg.address.short' });
    expect(keys({ ...filled, street: 'J'.repeat(200) })).toEqual({});
    expect(keys({ ...filled, street: 'J'.repeat(201) })).toEqual({ street: 'gbreg.address.long' });
    expect(keys({ ...filled, village: '', district: '', city: '' })).toEqual({ village: 'gbreg.address.required', district: 'gbreg.address.required', city: 'gbreg.address.required' });
    expect(keys({ ...filled, city: 'K'.repeat(101) })).toEqual({ city: 'gbreg.address.long' });
    expect(keys({ ...filled, province: 'Jatim' })).toEqual({ province: 'gbreg.province.required' });
    expect(keys({ ...filled, postalCode: '6511' })).toEqual({ postalCode: 'gbreg.postalCode.format' });
    expect(keys({ ...filled, postalCode: '65119' })).toEqual({});
  });

  it('asks a phone number the server takes', () => {
    expect(keys({ ...filled, applicantPhone: '' })).toEqual({ applicantPhone: 'validation.phone.required' });
    expect(keys({ ...filled, applicantPhone: '12345' })).toEqual({ applicantPhone: 'validation.phone.format' });
    expect(keys({ ...filled, applicantPhone: '+62-812-3456-7890' })).toEqual({});
  });
});

describe('governing body registration - the files', () => {
  const file = (size) => ({ size, name: 'x' });

  it('reads a type from the bytes, as upload.js does', () => {
    expect(typeOfBytes([0xff, 0xd8, 0xff, 0xe0])).toBe('jpg');
    expect(typeOfBytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).toBe('png');
    expect(typeOfBytes([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])).toBe('pdf');
    expect(typeOfBytes([0x89, 0x50, 0x4e, 0x47])).toBeNull();
    expect(typeOfBytes([0x50, 0x4b, 0x03, 0x04])).toBeNull();
  });

  it('takes a KTP of JPG or PNG up to 2 MB, and a proof of PDF, JPG or PNG up to 5 MB', () => {
    expect(fileError('ktp', null, null)).toEqual({ key: 'gbreg.ktp.required' });
    expect(fileError('ktp', file(2 * 1024 * 1024), 'png')).toBeNull();
    expect(fileError('ktp', file(2 * 1024 * 1024 + 1), 'png')?.key).toBe('gbreg.ktp.tooLarge');
    expect(fileError('ktp', file(10), 'pdf')?.key).toBe('gbreg.ktp.type');
    expect(fileError('proof', file(10), 'pdf')).toBeNull();
    expect(fileError('proof', file(5 * 1024 * 1024 + 1), 'pdf')?.key).toBe('gbreg.proof.tooLarge');
    expect(fileError('proof', file(10), null)?.key).toBe('gbreg.proof.type');
  });
});

describe('governing body registration - what is sent', () => {
  it('trims, leaves out an SK number for a government body and an empty postal code', () => {
    const files = { ktp: new Blob(['k']), proof: new Blob(['p']) };
    const body = registrationFormData({ ...filled, name: ' Yayasan X ', postalCode: '' }, files);
    expect(body.get('name')).toBe('Yayasan X');
    expect(body.get('skNumber')).toBe('AHU-0012345.AH.01.04.Tahun 2015');
    expect(body.has('postalCode')).toBe(false);
    expect(body.get('applicantPhone')).toBe('0812 3456 7890');
    expect(body.has('ktp') && body.has('proof')).toBe(true);
    expect(registrationFormData({ ...filled, npyp: ' a1b2c3 ' }, files).get('npyp')).toBe('A1B2C3');
    expect(registrationFormData({ ...filled, skNumber: '  ' }, files).has('skNumber')).toBe(false);
    const dinas = registrationFormData({ ...filled, kind: 'GOVERNMENT', skNumber: 'typed anyway', postalCode: '65119' }, files);
    expect(dinas.has('skNumber')).toBe(false);
    expect(dinas.has('npyp')).toBe(false);
    expect(dinas.get('postalCode')).toBe('65119');
  });
});

describe('governing body registration - the line on /select-role and My Profile', () => {
  it('follows the newest registration', () => {
    expect(registrationLineOf([])).toEqual({ state: 'OPEN', name: null, reason: null });
    expect(registrationLineOf([{ status: 'PENDING', name: 'Y' }, { status: 'REJECTED', name: 'Y' }]).state).toBe('WAITING');
    expect(registrationLineOf([{ status: 'REJECTED', name: 'Y', rejectionReason: 'SK tidak terbaca' }])).toEqual({ state: 'REJECTED', name: 'Y', reason: 'SK tidak terbaca' });
    expect(registrationLineOf([{ status: 'APPROVED', name: 'Y' }, { status: 'REJECTED', name: 'Y' }]).state).toBe('OPEN');
    expect(registrationLineOf(undefined).state).toBe('OPEN');
  });
});
