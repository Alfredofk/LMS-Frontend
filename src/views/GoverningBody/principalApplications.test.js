import { describe, expect, it } from 'vitest';

import { othersWaiting, outcomeOf, waitingSummary } from './principalApplications';

// governingBody.schools.js ownSchoolView (backend f01cd28): principalApplicationsWaiting per row.
describe('principal applications - waiting across the Schools', () => {
  it('sums the rows and counts the Schools with any', () => {
    expect(
      waitingSummary([
        { id: 's1', principalApplicationsWaiting: 2 },
        { id: 's2', principalApplicationsWaiting: 0 },
        { id: 's3', principalApplicationsWaiting: 1 },
      ])
    ).toEqual({ applications: 3, schools: 2 });
  });

  it('reads a missing figure or list as none', () => {
    expect(waitingSummary([{ id: 's1' }])).toEqual({ applications: 0, schools: 0 });
    expect(waitingSummary(undefined)).toEqual({ applications: 0, schools: 0 });
  });
});

// governingBody.principals.js approveAs: closeWaitingApplications closes every other PENDING one.
describe('principal applications - what an approval closes', () => {
  const rows = [
    { id: 'a1', status: 'PENDING' },
    { id: 'a2', status: 'PENDING' },
    { id: 'a3', status: 'REJECTED' },
    { id: 'a4', status: 'PENDING' },
  ];

  it('counts the others still waiting, not the one approved nor the decided', () => {
    expect(othersWaiting(rows, 'a1')).toBe(2);
    expect(othersWaiting([{ id: 'a1', status: 'PENDING' }], 'a1')).toBe(0);
    expect(othersWaiting(undefined, 'a1')).toBe(0);
  });
});

// governingBody.principals.js adminView; approval.js SCHOOL_HAS_PRINCIPAL.
describe('principal applications - an outcome', () => {
  const decided = { decidedAt: '2026-10-26T03:00:00Z', decidedBy: { id: 'u1', fullName: 'Kevin Aprilian' } };

  it('says who approved and when', () => {
    expect(outcomeOf({ status: 'APPROVED', ...decided })).toEqual({ state: 'APPROVED', by: 'Kevin Aprilian', at: decided.decidedAt, reason: null });
  });

  it('says a rejection with who, when and the reason', () => {
    expect(outcomeOf({ status: 'REJECTED', rejectionReason: 'KTP buram', ...decided })).toEqual({
      state: 'REJECTED',
      by: 'Kevin Aprilian',
      at: decided.decidedAt,
      reason: 'KTP buram',
    });
  });

  it('says one closed by another approval as closed, naming nobody', () => {
    expect(outcomeOf({ status: 'REJECTED', rejectionReason: 'The school has a Principal now', ...decided })).toEqual({
      state: 'CLOSED',
      by: null,
      at: decided.decidedAt,
      reason: null,
    });
  });

  it('says a cancelled and a waiting one', () => {
    expect(outcomeOf({ status: 'CANCELLED', decidedAt: decided.decidedAt, decidedBy: null }).state).toBe('CANCELLED');
    expect(outcomeOf({ status: 'PENDING', decidedAt: null, decidedBy: null })).toEqual({ state: 'WAITING', by: null, at: null, reason: null });
  });
});
