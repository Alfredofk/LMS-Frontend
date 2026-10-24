import { describe, expect, it } from 'vitest';

import { addressLineOf, kindKeyOf, leaveStateOf, profileErrorsOf, profileFormOf, profilePatchOf, seniorOf } from './governingBody';

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

// governingBody.schema.js profileBody (backend 3d7d05a): the registration's address
// rules, the postal code and the phone nullable, at least one key.
describe('governing body - the address and phone', () => {
  const body = { address, phone: '081234567890' };

  it('starts from what the body holds, empty for what it lacks', () => {
    expect(profileFormOf(body)).toEqual({ ...address, phone: '081234567890' });
    expect(profileFormOf({ address: { ...address, postalCode: null }, phone: null })).toMatchObject({ postalCode: '', phone: '' });
  });

  it('sends nothing when nothing changed, spaces around a value included', () => {
    expect(profilePatchOf(body, { ...profileFormOf(body), street: ' Jl. Merdeka No. 10 ' })).toBeNull();
    expect(profilePatchOf(body, { ...profileFormOf(body), phone: '0812-3456-7890' })).toBeNull();
  });

  it('sends only what changed, trimmed', () => {
    expect(profilePatchOf(body, { ...profileFormOf(body), city: ' Kota Batu ', province: 'Bali' })).toEqual({ city: 'Kota Batu', province: 'Bali' });
    expect(profilePatchOf(body, { ...profileFormOf(body), phone: '0811 222 3333' })).toEqual({ phone: '08112223333' });
  });

  it('clears an emptied postal code or phone with null', () => {
    expect(profilePatchOf(body, { ...profileFormOf(body), postalCode: ' ', phone: '' })).toEqual({ postalCode: null, phone: null });
    const bare = { address: { ...address, postalCode: null }, phone: null };
    expect(profilePatchOf(bare, profileFormOf(bare))).toBeNull();
  });

  it('holds every address part to 2 and its maximum, as the registration does', () => {
    const form = profileFormOf(body);
    expect(profileErrorsOf(form)).toEqual({});
    expect(profileErrorsOf({ ...form, street: '' }).street).toEqual({ key: 'gbreg.address.required' });
    expect(profileErrorsOf({ ...form, village: ' K ' }).village).toEqual({ key: 'gbreg.address.short', vars: { min: 2 } });
    expect(profileErrorsOf({ ...form, street: 'x'.repeat(200) }).street).toBeUndefined();
    expect(profileErrorsOf({ ...form, street: 'x'.repeat(201) }).street).toEqual({ key: 'gbreg.address.long', vars: { max: 200 } });
    expect(profileErrorsOf({ ...form, city: 'x'.repeat(101) }).city).toEqual({ key: 'gbreg.address.long', vars: { max: 100 } });
  });

  it('takes one of the 38 provinces, five digits or no postal code, and an optional phone', () => {
    const form = profileFormOf(body);
    expect(profileErrorsOf({ ...form, province: 'Jawa' }).province).toEqual({ key: 'gbreg.province.required' });
    expect(profileErrorsOf({ ...form, postalCode: '6511' }).postalCode).toEqual({ key: 'gbreg.postalCode.format' });
    expect(profileErrorsOf({ ...form, postalCode: '' }).postalCode).toBeUndefined();
    expect(profileErrorsOf({ ...form, phone: '' }).phone).toBeUndefined();
    expect(profileErrorsOf({ ...form, phone: '1234567' }).phone).toEqual({ key: 'validation.phone.format' });
    expect(profileErrorsOf({ ...form, phone: '+62 812-3456-7890' }).phone).toBeUndefined();
  });
});

// governingBody.admins.js listAdmins / sittingView (backend 3d7d05a): the senior first.
describe('governing body - the admins', () => {
  const admin = (id, extra = {}) => ({ id, user: { id: `u-${id}`, fullName: `Admin ${id}`, email: `${id}@x.id` }, senior: false, you: false, ...extra });

  it('finds the senior', () => {
    expect(seniorOf([admin('a', { senior: true }), admin('b')]).id).toBe('a');
    expect(seniorOf([])).toBeNull();
    expect(seniorOf(undefined)).toBeNull();
  });

  it('refuses the last admin leaving', () => {
    expect(leaveStateOf([admin('a', { senior: true, you: true })])).toEqual({ state: 'LAST' });
  });

  it('names who becomes senior when the senior leaves', () => {
    const next = admin('b');
    expect(leaveStateOf([admin('a', { senior: true, you: true }), next, admin('c')])).toEqual({ state: 'SENIOR', next });
  });

  it('lets any other admin leave', () => {
    expect(leaveStateOf([admin('a', { senior: true }), admin('b', { you: true })])).toEqual({ state: 'OPEN' });
  });
});
