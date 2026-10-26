import { describe, expect, it } from 'vitest';

import { affiliationStateOf } from './affiliation';

// governingBody.affiliations.js schoolSideView, newest first.
describe('affiliation card - its state', () => {
  const req = (id, status, extra = {}) => ({ id, status, governingBody: { name: 'Yayasan A', kind: 'FOUNDATION' }, rejectionReason: null, ...extra });

  it('offers the form with nothing asked', () => {
    expect(affiliationStateOf([])).toEqual({ state: 'OPEN', request: null, rejected: false, approved: false });
    expect(affiliationStateOf(undefined)).toEqual({ state: 'OPEN', request: null, rejected: false, approved: false });
  });

  it('says a waiting request, newest first', () => {
    expect(affiliationStateOf([req('r2', 'PENDING'), req('r1', 'REJECTED')])).toEqual({ state: 'WAITING', request: req('r2', 'PENDING') });
  });

  it('offers the form again after a rejection, with it', () => {
    const rejected = req('r1', 'REJECTED', { rejectionReason: 'Belum ada izin' });
    expect(affiliationStateOf([rejected])).toEqual({ state: 'OPEN', request: rejected, rejected: true, approved: false });
  });

  it('offers the form after a cancel', () => {
    expect(affiliationStateOf([req('r1', 'CANCELLED')])).toEqual({ state: 'OPEN', request: null, rejected: false, approved: false });
  });

  // A School let go keeps its APPROVED request (walked 2026-10-26): it is history, not a state.
  it('tells an approved request as history, beside the form', () => {
    expect(affiliationStateOf([req('r1', 'APPROVED')])).toEqual({ state: 'OPEN', request: req('r1', 'APPROVED'), rejected: false, approved: true });
  });

  it('says a member once "already belongs" was met, whatever the requests say', () => {
    expect(affiliationStateOf([], { governed: true })).toEqual({ state: 'MEMBER', request: null, bodyName: null });
    expect(affiliationStateOf([req('r1', 'REJECTED')], { governed: true })).toEqual({ state: 'MEMBER', request: null, bodyName: null });
  });

  // users.service.js schoolForMember (227473f): the body above the School, by name.
  it('names the body /users/me names, over any request', () => {
    expect(affiliationStateOf([req('r1', 'APPROVED')], { bodyName: 'Yayasan A' })).toEqual({ state: 'MEMBER', request: null, bodyName: 'Yayasan A' });
    expect(affiliationStateOf([req('r2', 'PENDING')], { bodyName: 'Yayasan A', governed: true })).toMatchObject({ state: 'MEMBER', bodyName: 'Yayasan A' });
  });

  it('a School let go (governingBody null) keeps the approval as history', () => {
    expect(affiliationStateOf([req('r1', 'APPROVED')], { bodyName: null })).toMatchObject({ state: 'OPEN', approved: true });
  });
});
