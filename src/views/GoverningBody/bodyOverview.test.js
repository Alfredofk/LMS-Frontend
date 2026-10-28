import { describe, expect, it } from 'vitest';

import { attentionOf, readinessOf, totalsOf } from './bodyOverview';

// governingBody.schools.js ownSchoolView (f01cd28 / 227473f): counts, hasPrincipal,
// principalApplicationsWaiting, deactivatedAt.
const school = (id, extra = {}) => ({
  id,
  name: `Sekolah ${id}`,
  hasPrincipal: true,
  deactivatedAt: null,
  principalApplicationsWaiting: 0,
  counts: { students: 0, teachers: 0, principals: 1, vicePrincipals: 0 },
  ...extra,
});

describe('body overview - the totals', () => {
  it('sums every School, one switched off included', () => {
    const rows = [
      school('a', { counts: { students: 120, teachers: 12 } }),
      school('b', { counts: { students: 30, teachers: 4 }, deactivatedAt: '2026-10-26T03:00:00Z' }),
    ];
    expect(totalsOf(rows)).toEqual({ schools: 2, students: 150, teachers: 16 });
  });

  it('is zero for a body with no School, and reads missing counts as none', () => {
    expect(totalsOf([])).toEqual({ schools: 0, students: 0, teachers: 0 });
    expect(totalsOf(undefined)).toEqual({ schools: 0, students: 0, teachers: 0 });
    expect(totalsOf([school('a', { counts: undefined })])).toEqual({ schools: 1, students: 0, teachers: 0 });
  });
});

describe('body overview - what needs the admins', () => {
  it('is nothing when every School runs, is headed and nobody waits', () => {
    expect(attentionOf([school('a'), school('b')], { affiliationRequests: [], admins: { youAreSenior: true, applications: [] } })).toEqual([]);
  });

  it('names and opens the one School a row is about', () => {
    const items = attentionOf([school('a', { hasPrincipal: false, principalApplicationsWaiting: 2 }), school('b')]);
    expect(items).toEqual([
      { kind: 'PRINCIPAL_APPLICATIONS', count: 2, school: 'Sekolah a', at: 1, to: '/governing-body/schools/a?tab=lamaran' },
      { kind: 'NO_PRINCIPAL', count: 1, school: 'Sekolah a', to: '/governing-body/schools/a' },
    ]);
  });

  it('counts several Schools and sends to the list', () => {
    const items = attentionOf([
      school('a', { principalApplicationsWaiting: 1, deactivatedAt: '2026-10-26T03:00:00Z' }),
      school('b', { principalApplicationsWaiting: 3, deactivatedAt: '2026-10-26T03:00:00Z' }),
    ]);
    expect(items).toEqual([
      { kind: 'PRINCIPAL_APPLICATIONS', count: 4, school: null, at: 2, to: '/governing-body/schools' },
      { kind: 'SWITCHED_OFF', count: 2, school: null, to: '/governing-body/schools' },
    ]);
  });

  it('counts the Schools asking to join, waiting ones only', () => {
    const asking = [
      { id: 'r1', status: 'PENDING', school: { name: 'SD Mandiri' } },
      { id: 'r0', status: 'REJECTED', school: { name: 'SD Lama' } },
    ];
    expect(attentionOf([], { affiliationRequests: asking })).toEqual([{ kind: 'AFFILIATION_REQUESTS', count: 1, school: 'SD Mandiri', to: '/governing-body/schools' }]);
  });

  it("shows the admin applications to the senior alone", () => {
    const admins = { applications: [{ id: 's1', status: 'PENDING' }, { id: 's2', status: 'PENDING' }] };
    expect(attentionOf([], { admins: { ...admins, youAreSenior: true } })).toEqual([{ kind: 'ADMIN_APPLICATIONS', count: 2, school: null, to: '/governing-body/admins' }]);
    expect(attentionOf([], { admins: { ...admins, youAreSenior: false } })).toEqual([]);
  });

  it('leaves out what was not read rather than counting it as none', () => {
    expect(attentionOf([school('a')], { affiliationRequests: null, admins: null })).toEqual([]);
  });

  it('puts the applications first and the switched-off last', () => {
    const kinds = attentionOf([school('a', { hasPrincipal: false, deactivatedAt: '2026-10-26T03:00:00Z', principalApplicationsWaiting: 1 })], {
      affiliationRequests: [{ id: 'r1', status: 'PENDING', school: { name: 'X' } }],
      admins: { youAreSenior: true, applications: [{ id: 's1', status: 'PENDING' }] },
    }).map((item) => item.kind);
    expect(kinds).toEqual(['PRINCIPAL_APPLICATIONS', 'AFFILIATION_REQUESTS', 'ADMIN_APPLICATIONS', 'NO_PRINCIPAL', 'SWITCHED_OFF']);
  });
});

describe('readinessOf', () => {
  it('counts Schools with a Principal, switched on, and both', () => {
    const schools = [
      { hasPrincipal: true, deactivatedAt: null },
      { hasPrincipal: true, deactivatedAt: '2026-10-20T00:00:00Z' },
      { hasPrincipal: false, deactivatedAt: null },
    ];
    expect(readinessOf(schools)).toEqual({ total: 3, led: 2, active: 2, ready: 1 });
  });

  it('is all zeros with none or an unread list', () => {
    expect(readinessOf([])).toEqual({ total: 0, led: 0, active: 0, ready: 0 });
    expect(readinessOf(null)).toEqual({ total: 0, led: 0, active: 0, ready: 0 });
  });
});
