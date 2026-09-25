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
  isSchoolDeactivated,
  roleToEnter,
  defaultRoleOf,
  ROLE_PRIORITY,
  ADDABLE_ROLES,
  isEstablishedMember,
  rolesToAdd,
  addsInstantly,
  endedMembership,
  cancellableRolesOf,
  requestInPov,
  releasableInPov,
  releasableLinksInPov,
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

  it('routes GUARDIAN too, now that /guardian exists', () => {
    expect(activeRolesOf({ roles: ['TEACHER', 'GUARDIAN'] })).toEqual(['TEACHER', 'GUARDIAN']);
    expect(activeRolesOf(me('ACTIVE', [['GUARDIAN', 'ACTIVE']]))).toEqual(['GUARDIAN']);
  });

  it('copes with a membership that has no roles array at all', () => {
    expect(activeRolesOf({ status: 'ACTIVE' })).toEqual([]);
  });
});

describe('heldRolesOf — what somebody is, including roles with nowhere to go', () => {
  it('describes a teacher who is also a guardian as both', () => {
    const both = me('ACTIVE', [
      ['TEACHER', 'ACTIVE'],
      ['GUARDIAN', 'ACTIVE'],
    ]);
    expect(heldRolesOf(both)).toEqual(['TEACHER', 'GUARDIAN']);
    expect(activeRolesOf(both)).toEqual(['TEACHER', 'GUARDIAN']);
  });

  it('applies the same ACTIVE rules otherwise', () => {
    expect(heldRolesOf(null)).toEqual([]);
    expect(heldRolesOf(me('PENDING', [['TEACHER', 'ACTIVE']]))).toEqual([]);
    expect(heldRolesOf(me('ACTIVE', [['STUDENT', 'PENDING']]))).toEqual([]);
    expect(heldRolesOf({ roles: ['PRINCIPAL'] })).toEqual(['PRINCIPAL']);
  });
});

describe('a school a platform admin has switched off', () => {
  /* The /users/me shape since backend 60ea459: membership.school carries
     deactivatedAt, and the reason only for a Principal (users.service.js
     schoolForMember). The membership and its roles stay ACTIVE. */
  const at = (deactivatedAt, roles, reason = null) => ({
    ...me('ACTIVE', roles),
    school: { id: 's1', name: 'Bintang Jaya Supreme', schoolType: 'SMA', durationYears: 3, deactivatedAt, deactivationReason: reason },
  });
  const off = '2026-09-21T02:00:00.000Z';

  it('is recognised from school.deactivatedAt', () => {
    expect(isSchoolDeactivated(at(off, [['TEACHER', 'ACTIVE']]))).toBe(true);
    expect(isSchoolDeactivated(at(null, [['TEACHER', 'ACTIVE']]))).toBe(false);
    expect(isSchoolDeactivated(null)).toBe(false);
    expect(isSchoolDeactivated({ roles: ['TEACHER'] })).toBe(false); // the sign-in shape has no school object
  });

  it('opens no dashboard, however ACTIVE its roles still read', () => {
    /* Its token carries no school, so every dashboard would answer 403.
       Returning nothing is what sends ProtectedRoute to /select-role. */
    expect(activeRolesOf(at(off, [['TEACHER', 'ACTIVE']]))).toEqual([]);
    expect(activeRolesOf(at(off, [['PRINCIPAL', 'ACTIVE']], 'Kontrak berakhir'))).toEqual([]);
    expect(heldRolesOf(at(off, [['TEACHER', 'ACTIVE'], ['GUARDIAN', 'ACTIVE']]))).toEqual([]);
  });

  it('changes nothing for a school that is running', () => {
    expect(activeRolesOf(at(null, [['TEACHER', 'ACTIVE']]))).toEqual(['TEACHER']);
    expect(heldRolesOf(at(null, [['TEACHER', 'ACTIVE'], ['GUARDIAN', 'ACTIVE']]))).toEqual([
      'TEACHER',
      'GUARDIAN',
    ]);
  });
});

describe('defaultRoleOf — who somebody walks in as (owner, 2026-09-24)', () => {
  it('orders Principal, Teacher, Student, Guardian', () => {
    expect(ROLE_PRIORITY).toEqual(['PRINCIPAL', 'TEACHER', 'STUDENT', 'GUARDIAN']);
  });

  it('sends a Principal who teaches in as Principal, and a teacher who is a guardian in as Teacher', () => {
    expect(defaultRoleOf(['TEACHER', 'PRINCIPAL'])).toBe('PRINCIPAL');
    expect(defaultRoleOf(['GUARDIAN', 'TEACHER'])).toBe('TEACHER');
    expect(defaultRoleOf(['GUARDIAN'])).toBe('GUARDIAN');
    expect(defaultRoleOf([])).toBeNull();
    expect(defaultRoleOf(undefined)).toBeNull();
  });
});

describe('roleToEnter — when the role picker steps aside', () => {
  const approved = { id: 'g1', status: 'APPROVED' };

  it('enters the one role there is', () => {
    expect(roleToEnter(me('ACTIVE', [['PRINCIPAL', 'ACTIVE']]), approved)).toBe('PRINCIPAL');
    expect(roleToEnter({ roles: ['TEACHER'] }, null)).toBe('TEACHER');
  });

  it('enters the default when there are several — it no longer asks', () => {
    expect(roleToEnter(me('ACTIVE', [['TEACHER', 'ACTIVE'], ['PRINCIPAL', 'ACTIVE']]), null)).toBe('PRINCIPAL');
    expect(roleToEnter(me('ACTIVE', [['GUARDIAN', 'ACTIVE'], ['TEACHER', 'ACTIVE']]), null)).toBe('TEACHER');
  });

  it('does not stop for a cancelled role — the bug that held a Principal on the picker', () => {
    expect(roleToEnter(me('ACTIVE', [['PRINCIPAL', 'ACTIVE'], ['TEACHER', 'CANCELLED'], ['GUARDIAN', 'CANCELLED']]), approved)).toBe('PRINCIPAL');
  });

  it('stays while a role is still waiting', () => {
    expect(roleToEnter(me('ACTIVE', [['TEACHER', 'ACTIVE'], ['GUARDIAN', 'PENDING']]), null)).toBeNull();
  });

  it('stays for a rejection only until it has been announced', () => {
    const turnedDown = me('ACTIVE', [['TEACHER', 'ACTIVE'], ['GUARDIAN', 'REJECTED']]);
    expect(roleToEnter(turnedDown, null, { unseenRejection: true })).toBeNull();
    expect(roleToEnter(turnedDown, null, { unseenRejection: false })).toBe('TEACHER');
  });

  it('stays while a school registration is waiting', () => {
    expect(roleToEnter(me('ACTIVE', [['TEACHER', 'ACTIVE']]), { id: 'g2', status: 'PENDING' })).toBeNull();
  });

  it('never enters a school that has been switched off, or a membership still pending', () => {
    const off = { ...me('ACTIVE', [['PRINCIPAL', 'ACTIVE']]), school: { id: 's1', deactivatedAt: '2026-09-21T02:00:00.000Z' } };
    expect(roleToEnter(off, approved)).toBeNull();
    expect(roleToEnter(me('PENDING', [['TEACHER', 'PENDING']]), null)).toBeNull();
    expect(roleToEnter(null, null)).toBeNull();
  });
});

describe('adding a role to a membership already held — /me/roles', () => {
  const off = (roles) => ({ ...me('ACTIVE', roles), school: { id: 's1', deactivatedAt: '2026-09-21T02:00:00.000Z' } });

  it('offers what the backend adds: TEACHER and GUARDIAN (membership.schema.js:127)', () => {
    expect(ADDABLE_ROLES).toEqual(['TEACHER', 'GUARDIAN']);
  });

  it('counts somebody as already at a school only while a role is ACTIVE there', () => {
    expect(isEstablishedMember(me('ACTIVE', [['PRINCIPAL', 'ACTIVE']]))).toBe(true);
    expect(isEstablishedMember({ roles: ['PRINCIPAL'] })).toBe(true); // sign-in shape
    expect(isEstablishedMember(me('PENDING', [['TEACHER', 'PENDING']]))).toBe(false);
    expect(isEstablishedMember(me('REJECTED', [['TEACHER', 'REJECTED']]))).toBe(false);
    expect(isEstablishedMember(off([['PRINCIPAL', 'ACTIVE']]))).toBe(false);
    expect(isEstablishedMember(null)).toBe(false);
  });

  it('offers a Principal both, and a teacher GUARDIAN', () => {
    expect(rolesToAdd(me('ACTIVE', [['PRINCIPAL', 'ACTIVE']]))).toEqual(['TEACHER', 'GUARDIAN']);
    expect(rolesToAdd({ roles: ['PRINCIPAL'] })).toEqual(['TEACHER', 'GUARDIAN']);
    expect(rolesToAdd(me('ACTIVE', [['TEACHER', 'ACTIVE']]))).toEqual(['GUARDIAN']);
  });

  it('does not offer a role already held or already waiting — the server answers 409', () => {
    expect(rolesToAdd(me('ACTIVE', [['PRINCIPAL', 'ACTIVE'], ['TEACHER', 'ACTIVE'], ['GUARDIAN', 'PENDING']]))).toEqual([]);
    expect(rolesToAdd(me('ACTIVE', [['GUARDIAN', 'ACTIVE'], ['TEACHER', 'PENDING']]))).toEqual([]);
  });

  it('offers again a role that was turned down — the server moves that row back to PENDING', () => {
    expect(rolesToAdd(me('ACTIVE', [['GUARDIAN', 'ACTIVE'], ['TEACHER', 'REJECTED']]))).toEqual(['TEACHER']);
  });

  it('offers again a role the person withdrew — CANCELLED is reopened the same way', () => {
    expect(rolesToAdd(me('ACTIVE', [['GUARDIAN', 'ACTIVE'], ['TEACHER', 'CANCELLED']]))).toEqual(['TEACHER']);
  });

  it('offers a student nothing, a newcomer nothing, and a switched-off school nothing', () => {
    expect(rolesToAdd(me('ACTIVE', [['STUDENT', 'ACTIVE']]))).toEqual([]);
    expect(rolesToAdd(null)).toEqual([]);
    expect(rolesToAdd(me('PENDING', [['GUARDIAN', 'PENDING']]))).toEqual([]);
    expect(rolesToAdd(off([['PRINCIPAL', 'ACTIVE']]))).toEqual([]);
  });

  it('grants at once only a Principal adding TEACHER', () => {
    expect(addsInstantly(me('ACTIVE', [['PRINCIPAL', 'ACTIVE']]), 'TEACHER')).toBe(true);
    expect(addsInstantly({ roles: ['PRINCIPAL'] }, 'TEACHER')).toBe(true);
    expect(addsInstantly(me('ACTIVE', [['GUARDIAN', 'ACTIVE']]), 'TEACHER')).toBe(false);
    expect(addsInstantly(me('ACTIVE', [['PRINCIPAL', 'ACTIVE']]), 'GUARDIAN')).toBe(false);
  });
});

describe('endedMembership — somebody who left, or was removed', () => {
  const left = (endReason) => ({
    ...me('LEFT', [['TEACHER', 'ACTIVE']]),
    endedAt: '2026-09-24T03:00:00.000Z',
    endReason,
    school: { id: 's1', name: 'Bintang Jaya Supreme', deactivatedAt: null },
  });

  it('says where, since when, and why when somebody else ended it', () => {
    expect(endedMembership(left('Pindah tugas ke sekolah lain'))).toEqual({
      school: 'Bintang Jaya Supreme',
      since: '2026-09-24T03:00:00.000Z',
      reason: 'Pindah tugas ke sekolah lain',
    });
  });

  it('carries no reason when they left on their own', () => {
    expect(endedMembership(left(null)).reason).toBeNull();
  });

  it('opens nothing, although the role rows it kept as history still read ACTIVE', () => {
    expect(activeRolesOf(left(null))).toEqual([]);
    expect(isEstablishedMember(left(null))).toBe(false);
  });

  it('is null for every membership that has not ended', () => {
    expect(endedMembership(me('ACTIVE', [['TEACHER', 'ACTIVE']]))).toBeNull();
    expect(endedMembership(me('PENDING', [['TEACHER', 'PENDING']]))).toBeNull();
    expect(endedMembership(me('CANCELLED', [['TEACHER', 'CANCELLED']]))).toBeNull();
    expect(endedMembership({ roles: ['TEACHER'] })).toBeNull();
    expect(endedMembership(null)).toBeNull();
  });
});

describe('cancellableRolesOf — a role still waiting on an ACTIVE membership', () => {
  const off = (roles) => ({ ...me('ACTIVE', roles), school: { id: 's1', deactivatedAt: '2026-09-21T02:00:00.000Z' } });

  it('offers the waiting TEACHER or GUARDIAN, never one already decided', () => {
    expect(cancellableRolesOf(me('ACTIVE', [['PRINCIPAL', 'ACTIVE'], ['TEACHER', 'PENDING']]))).toEqual(['TEACHER']);
    expect(cancellableRolesOf(me('ACTIVE', [['TEACHER', 'ACTIVE'], ['GUARDIAN', 'PENDING']]))).toEqual(['GUARDIAN']);
    expect(cancellableRolesOf(me('ACTIVE', [['GUARDIAN', 'ACTIVE'], ['TEACHER', 'REJECTED']]))).toEqual([]);
    expect(cancellableRolesOf(me('ACTIVE', [['GUARDIAN', 'ACTIVE'], ['TEACHER', 'CANCELLED']]))).toEqual([]);
  });

  it('offers only what the route takes — TEACHER and GUARDIAN (roleParams)', () => {
    expect(cancellableRolesOf(me('ACTIVE', [['TEACHER', 'ACTIVE'], ['STUDENT', 'PENDING']]))).toEqual([]);
    expect(cancellableRolesOf(me('ACTIVE', [['TEACHER', 'ACTIVE'], ['PRINCIPAL', 'PENDING']]))).toEqual([]);
  });

  it('is nothing for a join request — that is withdrawn whole, not one role of it', () => {
    expect(cancellableRolesOf(me('PENDING', [['TEACHER', 'PENDING'], ['GUARDIAN', 'PENDING']]))).toEqual([]);
  });

  it("is nothing for sign-in's shape, a switched-off school, or nobody", () => {
    expect(cancellableRolesOf({ roles: ['TEACHER'] })).toEqual([]);
    expect(cancellableRolesOf(off([['PRINCIPAL', 'ACTIVE'], ['TEACHER', 'PENDING']]))).toEqual([]);
    expect(cancellableRolesOf(null)).toEqual([]);
  });
});

describe("a guardian's further child — decided as a link, not a role", () => {
  /* requestView: the membership and its GUARDIAN role are ACTIVE, the link waits. */
  const further = (links) => ({
    status: 'ACTIVE',
    roles: [{ role: 'GUARDIAN', status: 'ACTIVE', canRelease: false }],
    children: links.map(([id, status, canRelease]) => ({ id, status, canRelease, relationship: 'Ayah', student: { fullName: 'Anak' } })),
  });

  it('offers the waiting links this reader may release, at the teacher desk', () => {
    const request = further([['l1', 'PENDING', true], ['l2', 'ACTIVE', true], ['l3', 'PENDING', false]]);
    expect(releasableLinksInPov(request, 'TEACHER').map((l) => l.id)).toEqual(['l1']);
  });

  it("offers nothing at the Principal's desk, which does not release guardians", () => {
    expect(releasableLinksInPov(further([['l1', 'PENDING', true]]), 'PRINCIPAL')).toEqual([]);
  });

  it('copes with a request that carries no children', () => {
    expect(releasableLinksInPov({ roles: [] }, 'TEACHER')).toEqual([]);
  });
});

describe('join requests split by point of view', () => {
  /* The review queue's shape (requestView): each role carries canRelease. */
  const request = (...roles) => ({ roles: roles.map(([role, canRelease = true]) => ({ role, status: 'PENDING', canRelease })) });
  const names = (entries) => entries.map((entry) => entry.role);

  it("shows the Principal's desk teachers only", () => {
    expect(requestInPov(request(['TEACHER']), 'PRINCIPAL')).toBe(true);
    expect(requestInPov(request(['STUDENT']), 'PRINCIPAL')).toBe(false);
    expect(requestInPov(request(['GUARDIAN']), 'PRINCIPAL')).toBe(false);
  });

  it("shows the teacher's desk students and guardians only", () => {
    expect(requestInPov(request(['STUDENT']), 'TEACHER')).toBe(true);
    expect(requestInPov(request(['GUARDIAN']), 'TEACHER')).toBe(true);
    expect(requestInPov(request(['TEACHER']), 'TEACHER')).toBe(false);
  });

  it('shows a teacher who is also a guardian on both desks, each releasing its own half', () => {
    const both = request(['GUARDIAN'], ['TEACHER']);
    expect(requestInPov(both, 'PRINCIPAL')).toBe(true);
    expect(requestInPov(both, 'TEACHER')).toBe(true);
    expect(names(releasableInPov(both, 'PRINCIPAL'))).toEqual(['TEACHER']);
    expect(names(releasableInPov(both, 'TEACHER'))).toEqual(['GUARDIAN']);
  });

  it('never offers what the backend did not mark releasable', () => {
    expect(releasableInPov(request(['STUDENT', false]), 'TEACHER')).toEqual([]);
  });

  it('shows nothing to a desk with no review work', () => {
    expect(requestInPov(request(['TEACHER']), 'STUDENT')).toBe(false);
    expect(requestInPov(request(['TEACHER']), undefined)).toBe(false);
    expect(requestInPov(null, 'PRINCIPAL')).toBe(false);
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

  it('sends a guardian to /guardian', () => {
    expect(homeFor(ROLES.GUARDIAN)).toBe('/guardian');
  });

  it('sends anybody without a home to /select-role, not to a broken route', () => {
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
