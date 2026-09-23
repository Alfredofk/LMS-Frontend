/*
  Where somebody lands after signing in, and what they are called on the way.

  `activeRolesOf` decides which dashboards a person may enter; `ProtectedRoute`
  and the sign-in redirect both lean on it. A mistake here does not show an ugly
  screen — it locks somebody out of the only one they have, or lets a pending
  applicant through. So the two membership shapes the backend sends are both
  exercised, because an earlier bug in this project came from reading a field
  that only one of them carries:

    sign-in   → { schoolId, schoolName, roles: ['TEACHER'] }            (ACTIVE only)
    /users/me → { status, school, roles: [{ role, status, rejectionReason }] }
*/

import { describe, it, expect } from 'vitest';

import {
  ROLES,
  SELECTABLE_ROLES,
  ROLE_HOME,
  ROLE_LABEL_KEY,
  ROLE_TAGLINE_KEY,
  GET_STARTED_PATH,
  activeRolesOf,
  heldRolesOf,
  homeFor,
} from './roles.js';

/* The shape `/users/me` answers with, trimmed to what these functions read. */
const me = (status, roles) => ({
  status,
  roles: roles.map(([role, roleStatus]) => ({ role, status: roleStatus, rejectionReason: null })),
});

describe('activeRolesOf — the roles somebody may route into', () => {
  it('answers nothing for nobody', () => {
    expect(activeRolesOf(null)).toEqual([]);
    expect(activeRolesOf(undefined)).toEqual([]);
  });

  it('reads the sign-in shape: bare strings, all of them ACTIVE', () => {
    expect(activeRolesOf({ roles: ['TEACHER'] })).toEqual(['TEACHER']);
    expect(activeRolesOf({ roles: ['PRINCIPAL', 'TEACHER'] })).toEqual(['PRINCIPAL', 'TEACHER']);
  });

  it('reads the /users/me shape and keeps only ACTIVE rows', () => {
    const membership = me('ACTIVE', [
      ['TEACHER', 'ACTIVE'],
      ['STUDENT', 'PENDING'],
      ['PRINCIPAL', 'REJECTED'],
    ]);
    expect(activeRolesOf(membership)).toEqual(['TEACHER']);
  });

  it('refuses every role of a membership that is not itself ACTIVE', () => {
    /* A pending membership carries no usable role, whatever its rows claim —
       this is what keeps an applicant on /select-role instead of a dashboard. */
    expect(activeRolesOf(me('PENDING', [['TEACHER', 'ACTIVE']]))).toEqual([]);
    expect(activeRolesOf(me('REJECTED', [['TEACHER', 'ACTIVE']]))).toEqual([]);
  });

  it('drops GUARDIAN, because there is no guardian dashboard to route to', () => {
    expect(activeRolesOf({ roles: ['TEACHER', 'GUARDIAN'] })).toEqual(['TEACHER']);
    expect(activeRolesOf(me('ACTIVE', [['GUARDIAN', 'ACTIVE']]))).toEqual([]);
  });

  it('copes with a membership that has no roles array at all', () => {
    expect(activeRolesOf({ status: 'ACTIVE' })).toEqual([]);
  });
});

describe('heldRolesOf — what somebody is, including roles with nowhere to go', () => {
  it('keeps GUARDIAN where activeRolesOf drops it', () => {
    /* The profile card describes a teacher who is also a guardian at the same
       school as both. Routing and describing are different questions. */
    const both = me('ACTIVE', [
      ['TEACHER', 'ACTIVE'],
      ['GUARDIAN', 'ACTIVE'],
    ]);
    expect(heldRolesOf(both)).toEqual(['TEACHER', 'GUARDIAN']);
    expect(activeRolesOf(both)).toEqual(['TEACHER']);
  });

  it('applies the same ACTIVE rules otherwise', () => {
    expect(heldRolesOf(null)).toEqual([]);
    expect(heldRolesOf(me('PENDING', [['TEACHER', 'ACTIVE']]))).toEqual([]);
    expect(heldRolesOf(me('ACTIVE', [['STUDENT', 'PENDING']]))).toEqual([]);
    expect(heldRolesOf({ roles: ['PRINCIPAL'] })).toEqual(['PRINCIPAL']);
  });
});

describe('homeFor', () => {
  it.each([
    [ROLES.STUDENT, '/dashboard'],
    [ROLES.TEACHER, '/teacher/dashboard'],
    [ROLES.PRINCIPAL, '/headmaster/dashboard'],
  ])('%s → %s', (role, path) => {
    expect(homeFor(role)).toBe(path);
  });

  it('sends anybody without a home to /select-role, not to a broken route', () => {
    expect(homeFor(ROLES.GUARDIAN)).toBe('/select-role');
    expect(homeFor(undefined)).toBe('/select-role');
    expect(homeFor('HEADMASTER')).toBe('/select-role'); // the old word, never an identifier
  });
});

describe('the tables agree with one another', () => {
  const all = Object.values(ROLES);

  it('names the four roles exactly as the backend enum does', () => {
    expect([...all].sort()).toEqual(['GUARDIAN', 'PRINCIPAL', 'STUDENT', 'TEACHER']);
    for (const [key, value] of Object.entries(ROLES)) expect(key).toBe(value);
  });

  it('gives every role a label key and a tagline key', () => {
    for (const role of all) {
      expect(ROLE_LABEL_KEY[role]).toBe(`role.${role}.label`);
      expect(ROLE_TAGLINE_KEY[role]).toBe(`role.${role}.tagline`);
    }
  });

  it('gives every card on the picker somewhere to go when the role is not held', () => {
    expect([...SELECTABLE_ROLES].sort()).toEqual([...all].sort());
    for (const role of SELECTABLE_ROLES) expect(GET_STARTED_PATH[role]).toMatch(/^\/get-started\//);
  });

  it('only homes roles that exist', () => {
    for (const role of Object.keys(ROLE_HOME)) expect(all).toContain(role);
  });
});
