import { describe, expect, it } from 'vitest';

import { mayJoinAnother, needsPlaceChoice, otherPlacesOf, otherSchoolRows, placeRolesOf, placeToOpen, schoolIdOf, waitingRequestsOf } from './places';

// Shapes from backend 72e546b: auth.service.js placeView / signIn, users.service.js meOf / membershipView.
const place = (id, roles = ['TEACHER']) => ({ kind: 'SCHOOL', id, name: `School ${id}`, subdomain: id, roles });
const row = (id, status, over = {}) => ({ id, status, school: { id: `s-${id}`, name: `School ${id}` }, roles: [], endReason: null, ...over });

describe('places - which school a sign-in opens', () => {
  it('asks only when several may be opened and none was', () => {
    expect(needsPlaceChoice({ membership: null, places: [place('a'), place('b')] })).toBe(true);
    expect(needsPlaceChoice({ membership: { schoolId: 'a' }, places: [place('a'), place('b')] })).toBe(false);
    expect(needsPlaceChoice({ membership: null, places: [place('a')] })).toBe(false);
    expect(needsPlaceChoice({ membership: null, places: [] })).toBe(false);
    expect(needsPlaceChoice({ membership: null })).toBe(false);
  });

  it('opens the remembered school only while it is still one of them', () => {
    expect(placeToOpen([place('a'), place('b')], 'b')).toBe('b');
    expect(placeToOpen([place('a'), place('b')], 'c')).toBeNull();
    expect(placeToOpen([place('a')], null)).toBeNull();
  });

  it('reads the school of either membership shape, and offers the others', () => {
    expect(schoolIdOf({ schoolId: 'a' })).toBe('a');
    expect(schoolIdOf({ school: { id: 'b' } })).toBe('b');
    expect(schoolIdOf(null)).toBeNull();
    expect(otherPlacesOf([place('a'), place('b'), place('c')], 'b').map((p) => p.id)).toEqual(['a', 'c']);
    expect(otherPlacesOf([place('a')], null).map((p) => p.id)).toEqual(['a']);
    expect(placeRolesOf(place('a', ['TEACHER', 'GUARDIAN', 'PRINCIPAL']))).toEqual(['PRINCIPAL', 'TEACHER', 'GUARDIAN']);
  });
});

describe('places - joining another school', () => {
  it('is refused to a student, or one asking to be, anywhere', () => {
    expect(mayJoinAnother({ status: 'ACTIVE', roles: [{ role: 'TEACHER', status: 'ACTIVE' }] }, [])).toBe(true);
    expect(mayJoinAnother({ status: 'ACTIVE', roles: [{ role: 'STUDENT', status: 'ACTIVE' }] }, [])).toBe(false);
    expect(mayJoinAnother({ schoolId: 'a', roles: ['STUDENT'] }, [])).toBe(false);
    expect(mayJoinAnother({ status: 'ACTIVE', roles: [{ role: 'TEACHER', status: 'ACTIVE' }] }, [row('x', 'PENDING', { roles: [{ role: 'STUDENT', status: 'PENDING' }] })])).toBe(false);
  });

  it('counts nothing that has ended or was turned down', () => {
    expect(mayJoinAnother({ status: 'LEFT', roles: [{ role: 'STUDENT', status: 'ACTIVE' }] }, [])).toBe(true);
    expect(mayJoinAnother(null, [row('x', 'REJECTED', { roles: [{ role: 'STUDENT', status: 'REJECTED' }] })])).toBe(true);
    expect(mayJoinAnother({ status: 'ACTIVE', roles: [{ role: 'STUDENT', status: 'ENDED' }, { role: 'TEACHER', status: 'ACTIVE' }] }, [])).toBe(true);
    expect(mayJoinAnother(null, [])).toBe(true);
  });
});

describe('places - the other schools', () => {
  it('says each one\'s state with its reason', () => {
    const rows = otherSchoolRows([
      row('w', 'PENDING', { roles: [{ role: 'TEACHER', status: 'PENDING' }] }),
      row('r', 'REJECTED', { roles: [{ role: 'TEACHER', status: 'REJECTED', rejectionReason: 'NIP tidak cocok' }] }),
      row('c', 'CANCELLED'),
      row('l', 'LEFT', { endReason: 'Pindah tugas' }),
      row('o', 'ACTIVE', { school: { id: 's-o', name: 'School o', deactivatedAt: '2026-10-01' } }),
    ]);
    expect(rows.map((entry) => [entry.state, entry.reason])).toEqual([
      ['WAITING', null],
      ['REJECTED', 'NIP tidak cocok'],
      ['CANCELLED', null],
      ['ENDED', 'Pindah tugas'],
      ['SWITCHED_OFF', null],
    ]);
    expect(rows[0]).toMatchObject({ id: 'w', schoolName: 'School w', roles: ['TEACHER'] });
    expect(otherSchoolRows(undefined)).toEqual([]);
  });

  it('lists every request still waiting, here and elsewhere', () => {
    expect(waitingRequestsOf(row('m', 'PENDING'), [row('a', 'PENDING'), row('b', 'REJECTED')])).toEqual([
      { id: 'm', schoolName: 'School m' },
      { id: 'a', schoolName: 'School a' },
    ]);
    expect(waitingRequestsOf({ schoolId: 'x', roles: ['TEACHER'] }, [])).toEqual([]);
  });
});
