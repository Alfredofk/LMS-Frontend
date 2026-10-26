import { describe, expect, it } from 'vitest';

import { SCHOOL_HAS_PRINCIPAL, applicationErrors, applicationFormData, principalLinesOf, takesApplication } from './principalApplication';

// membership.service.js lookupSchool (backend e206bd9): principalWanted is true only for
// a Governing Body's School with no Principal sitting.
describe('principal application - the lookup', () => {
  it('takes an application only where the lookup says principalWanted', () => {
    expect(takesApplication({ name: 'SD A', principalWanted: true })).toBe(true);
    expect(takesApplication({ name: 'SD A', principalWanted: false })).toBe(false);
    expect(takesApplication({ name: 'SD A' })).toBe(false);
    expect(takesApplication(null)).toBe(false);
  });
});

// governingBody.schema.js principalApplicationBody: { schoolCode, applicantPhone: phone } + ktp.
describe('principal application - the form', () => {
  it('asks for a phone as auth.schema.js reads one', () => {
    expect(applicationErrors({ applicantPhone: '' })).toEqual({ applicantPhone: { key: 'validation.phone.required' } });
    expect(applicationErrors({ applicantPhone: '0812' })).toEqual({ applicantPhone: { key: 'validation.phone.format' } });
    expect(applicationErrors({ applicantPhone: '0812-3456-7890' })).toEqual({});
  });

  it('sends the code in capitals, the phone and the KTP', () => {
    const ktp = new Blob(['x'], { type: 'image/png' });
    const body = applicationFormData(' q65ckt3z ', ' 081234567890 ', ktp);
    expect(body.get('schoolCode')).toBe('Q65CKT3Z');
    expect(body.get('applicantPhone')).toBe('081234567890');
    expect(body.get('ktp')).toBeInstanceOf(Blob);
    expect([...body.keys()]).toEqual(['schoolCode', 'applicantPhone', 'ktp']);
  });
});

// governingBody.principals.js ownView, newest first.
describe('principal application - my applications', () => {
  const school = (name, extra = {}) => ({ name, schoolType: 'SD', city: 'Kota Malang', ...extra });
  const app = (id, status, at, extra = {}) => ({ id, status, school: at, governingBody: { name: 'Yayasan A' }, rejectionReason: null, ...extra });

  it('says a waiting application, which can be taken back', () => {
    expect(principalLinesOf([app('a1', 'PENDING', school('SD A'))])).toEqual([{ id: 'a1', name: 'SD A', state: 'WAITING' }]);
  });

  it('says a rejection with the reason', () => {
    expect(principalLinesOf([app('a1', 'REJECTED', school('SD A'), { rejectionReason: 'KTP buram' })])).toEqual([
      { id: 'a1', name: 'SD A', state: 'REJECTED', reason: 'KTP buram' },
    ]);
  });

  it('says in its own words that another applicant was approved', () => {
    expect(principalLinesOf([app('a1', 'REJECTED', school('SD A'), { rejectionReason: SCHOOL_HAS_PRINCIPAL })])).toEqual([
      { id: 'a1', name: 'SD A', state: 'TAKEN' },
    ]);
  });

  it('says nothing of an approved or a cancelled one', () => {
    expect(principalLinesOf([app('a1', 'APPROVED', school('SD A')), app('a2', 'CANCELLED', school('SD B'))])).toEqual([]);
  });

  it('keeps the newest per School only, told apart by name, type and city', () => {
    const lines = principalLinesOf([
      app('a3', 'PENDING', school('SD A')),
      app('a2', 'REJECTED', school('SD A'), { rejectionReason: 'Data kurang' }),
      app('a1', 'REJECTED', school('SD A', { city: 'Kota Batu' }), { rejectionReason: 'Bukan orangnya' }),
      app('a0', 'CANCELLED', school('SD A', { schoolType: 'SMP' })),
    ]);
    expect(lines).toEqual([
      { id: 'a3', name: 'SD A', state: 'WAITING' },
      { id: 'a1', name: 'SD A', state: 'REJECTED', reason: 'Bukan orangnya' },
    ]);
  });

  it('reads a missing list as none', () => {
    expect(principalLinesOf(undefined)).toEqual([]);
    expect(principalLinesOf(null)).toEqual([]);
  });
});
