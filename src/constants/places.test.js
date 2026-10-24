import { describe, expect, it } from 'vitest';

import {
  hasGoverningBody,
  mayJoinAnother,
  needsPlaceChoice,
  openPlaceOf,
  otherPlacesOf,
  otherSchoolRows,
  placeRequestOf,
  placeRoleKeysOf,
  placeRolesOf,
  placeToOpen,
  rememberPlace,
  rememberedPlaceOf,
  samePlace,
  schoolIdOf,
  waitingRequestsOf,
} from './places';

// Shapes from backend 72e546b: auth.service.js placeView / signIn, users.service.js meOf / membershipView.
const place = (id, roles = ['TEACHER']) => ({ kind: 'SCHOOL', id, name: `School ${id}`, subdomain: id, roles });
// And b5cfffd's seat: openablePlacesOf maps a GoverningBodyAdmin seat to this.
const body = (id) => ({ kind: 'GOVERNING_BODY', id, name: `Yayasan ${id}`, subdomain: `yayasan${id}`, roles: ['ADMIN'] });
const row = (id, status, over = {}) => ({ id, status, school: { id: `s-${id}`, name: `School ${id}` }, roles: [], endReason: null, ...over });
const at = (p) => ({ kind: p.kind, id: p.id });

describe('places - which place a sign-in opens', () => {
  it('asks only when several may be opened and none was', () => {
    expect(needsPlaceChoice({ membership: null, places: [place('a'), place('b')] })).toBe(true);
    expect(needsPlaceChoice({ membership: { schoolId: 'a' }, places: [place('a'), place('b')] })).toBe(false);
    expect(needsPlaceChoice({ membership: null, places: [place('a')] })).toBe(false);
    expect(needsPlaceChoice({ membership: null, places: [] })).toBe(false);
    expect(needsPlaceChoice({ membership: null })).toBe(false);
  });

  it('counts a Governing Body seat opened as a place opened', () => {
    expect(needsPlaceChoice({ membership: null, governingBody: { id: 'g' }, places: [place('a'), body('g')] })).toBe(false);
    expect(needsPlaceChoice({ membership: null, governingBody: null, places: [place('a'), body('g')] })).toBe(true);
    expect(openPlaceOf({ membership: { schoolId: 'a' } })).toEqual({ kind: 'SCHOOL', id: 'a' });
    expect(openPlaceOf({ membership: { school: { id: 'a' } }, governingBody: null })).toEqual({ kind: 'SCHOOL', id: 'a' });
    expect(openPlaceOf({ membership: null, governingBody: { id: 'g', name: 'Yayasan g' } })).toEqual({ kind: 'GOVERNING_BODY', id: 'g' });
    expect(openPlaceOf({ membership: null, governingBody: null })).toBeNull();
    expect(openPlaceOf()).toBeNull();
  });

  it('opens the remembered place only while it is still one of them, kind and id both', () => {
    expect(placeToOpen([place('a'), place('b')], at(place('b')))).toEqual(at(place('b')));
    expect(placeToOpen([place('a'), place('b')], at(place('c')))).toBeNull();
    expect(placeToOpen([place('a'), body('g')], at(body('g')))).toEqual(at(body('g')));
    expect(placeToOpen([place('g')], at(body('g')))).toBeNull();
    expect(placeToOpen([place('a')], null)).toBeNull();
  });

  it('tells two places apart by kind as well as id', () => {
    expect(samePlace(place('a'), at(place('a')))).toBe(true);
    expect(samePlace(place('a'), at(body('a')))).toBe(false);
    expect(samePlace({ id: 'a' }, at(place('a')))).toBe(true);
    expect(samePlace(null, at(place('a')))).toBe(false);
    expect(samePlace({}, {})).toBe(false);
  });

  it('names a place to the server with one id of the two', () => {
    expect(placeRequestOf(at(place('a')))).toEqual({ schoolId: 'a' });
    expect(placeRequestOf(at(body('g')))).toEqual({ governingBodyId: 'g' });
  });

  it('reads the school of either membership shape, and offers the others', () => {
    expect(schoolIdOf({ schoolId: 'a' })).toBe('a');
    expect(schoolIdOf({ school: { id: 'b' } })).toBe('b');
    expect(schoolIdOf(null)).toBeNull();
    expect(otherPlacesOf([place('a'), place('b'), place('c')], at(place('b'))).map((p) => p.id)).toEqual(['a', 'c']);
    expect(otherPlacesOf([place('a')], null).map((p) => p.id)).toEqual(['a']);
    expect(otherPlacesOf([place('a'), body('g')], at(body('g'))).map((p) => p.id)).toEqual(['a']);
    expect(otherPlacesOf([place('g'), body('g')], at(place('g'))).map((p) => p.kind)).toEqual(['GOVERNING_BODY']);
    expect(placeRolesOf(place('a', ['TEACHER', 'GUARDIAN', 'PRINCIPAL']))).toEqual(['PRINCIPAL', 'TEACHER', 'GUARDIAN']);
  });

  it('says "Admin yayasan" under a body, the roles under a school', () => {
    expect(placeRoleKeysOf(body('g'))).toEqual(['place.governingBodyAdmin']);
    expect(placeRolesOf(body('g'))).toEqual([]);
    expect(placeRoleKeysOf(place('a', ['TEACHER', 'PRINCIPAL']))).toEqual(['roleTitle.PRINCIPAL', 'roleTitle.TEACHER']);
    expect(hasGoverningBody([place('a'), body('g')])).toBe(true);
    expect(hasGoverningBody([place('a')])).toBe(false);
    expect(hasGoverningBody(undefined)).toBe(false);
  });
});

describe('places - the place this device remembers', () => {
  const memory = new Map();
  const stand = { getItem: (k) => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) };

  it('keeps the kind with the id, and reads one written before as a school', () => {
    const before = globalThis.localStorage;
    globalThis.localStorage = stand;
    try {
      rememberPlace('u1', at(body('g')));
      expect(rememberedPlaceOf('u1')).toEqual({ kind: 'GOVERNING_BODY', id: 'g' });
      rememberPlace('u1', at(place('a')));
      expect(rememberedPlaceOf('u1')).toEqual({ kind: 'SCHOOL', id: 'a' });
      memory.set('lms_last_school:u2', 'old-school-id');
      expect(rememberedPlaceOf('u2')).toEqual({ kind: 'SCHOOL', id: 'old-school-id' });
      expect(rememberedPlaceOf('nobody')).toBeNull();
      expect(rememberedPlaceOf(null)).toBeNull();
      rememberPlace('u3', null);
      expect(rememberedPlaceOf('u3')).toBeNull();
    } finally {
      globalThis.localStorage = before;
    }
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
