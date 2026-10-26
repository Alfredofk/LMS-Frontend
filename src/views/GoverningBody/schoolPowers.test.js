import { describe, expect, it } from 'vitest';

import { manageActionsOf, principalFateOf, successorsOf } from './schoolPowers';

const principal = { membershipId: 't1', fullName: 'Ahmad Fauzi', roles: ['PRINCIPAL', 'TEACHER'] };
const vice = { membershipId: 't2', fullName: 'Rina Kartika', roles: ['TEACHER', 'VICE_PRINCIPAL'] };
const teacher = { membershipId: 't3', fullName: 'Yusuf Hidayat', roles: ['TEACHER'] };

// membership.service.js teacherByMembership: an ACTIVE member holding an ACTIVE TEACHER role.
describe('school powers - who may be made Principal', () => {
  it('offers every teacher but the Principal sitting', () => {
    expect(successorsOf([principal, vice, teacher]).map((row) => row.membershipId)).toEqual(['t2', 't3']);
    expect(successorsOf(undefined)).toEqual([]);
  });
});

// membership.service.js endSittingPrincipals (ADR-0008): kept if another role is held.
describe('school powers - the Principal before', () => {
  const school = { hasPrincipal: true, principal: { fullName: 'Ahmad Fauzi' } };

  it('stays as a teacher when on the teacher list', () => {
    expect(principalFateOf(school, [principal, teacher])).toEqual({ name: 'Ahmad Fauzi', fate: 'STAYS' });
  });

  it('may leave when not teaching', () => {
    expect(principalFateOf(school, [teacher])).toEqual({ name: 'Ahmad Fauzi', fate: 'MAY_LEAVE' });
    expect(principalFateOf(school, undefined)).toEqual({ name: 'Ahmad Fauzi', fate: 'MAY_LEAVE' });
  });

  it('is nobody when none sits', () => {
    expect(principalFateOf({ hasPrincipal: false }, [teacher])).toBeNull();
  });
});

// governingBody.powers.js: release needs a Principal; reactivate refused for the Platform Admin's.
describe('school powers - the buttons', () => {
  it('a running School with no Principal: appoint and switch off only', () => {
    expect(manageActionsOf({ hasPrincipal: false, deactivatedAt: null })).toEqual({
      appoint: 'APPOINT',
      end: false,
      deactivate: true,
      reactivate: false,
      braked: false,
      release: false,
    });
  });

  it('a headed School: replace, end and release too', () => {
    expect(manageActionsOf({ hasPrincipal: true, deactivatedAt: null })).toMatchObject({ appoint: 'REPLACE', end: true, release: true, deactivate: true });
  });

  it('a School switched off offers the way back until the Platform Admin is found to hold it', () => {
    const off = { hasPrincipal: true, deactivatedAt: '2026-10-26T03:00:00Z' };
    expect(manageActionsOf(off)).toMatchObject({ deactivate: false, reactivate: true, braked: false });
    expect(manageActionsOf(off, { braked: true })).toMatchObject({ deactivate: false, reactivate: false, braked: true });
  });
});
