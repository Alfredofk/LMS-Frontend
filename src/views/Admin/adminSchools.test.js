import { describe, expect, it } from 'vitest';

import { SCHOOLS_PAGE, adminActionsOf, registrationLinkOf, schoolsQueryOf, withPage, withSchool } from './adminSchools';

// school.schema.js schoolListQuery and school.service.js schoolListView (backend ed0d304).
describe('platform admin schools - the query', () => {
  it('asks for the first page by name with nothing else by default', () => {
    expect(schoolsQueryOf()).toEqual({ sort: 'name', limit: SCHOOLS_PAGE, offset: 0 });
    expect(SCHOOLS_PAGE).toBe(50);
  });

  it('sends the needle trimmed, and none when it is blank', () => {
    expect(schoolsQueryOf({ needle: '  harapan ' }).q).toBe('harapan');
    expect(schoolsQueryOf({ needle: '   ' })).not.toHaveProperty('q');
  });

  it('cuts the needle at the 100 characters the server takes', () => {
    expect(schoolsQueryOf({ needle: 'a'.repeat(150) }).q).toHaveLength(100);
  });

  it("sends live or switched off as the text 'false' or 'true', and nothing for all", () => {
    expect(schoolsQueryOf({ state: 'ON' }).deactivated).toBe('false');
    expect(schoolsQueryOf({ state: 'OFF' }).deactivated).toBe('true');
    expect(schoolsQueryOf({ state: 'ALL' })).not.toHaveProperty('deactivated');
  });

  it('carries the order and the offset of a further page', () => {
    expect(schoolsQueryOf({ sort: 'newest', offset: 50 })).toEqual({ sort: 'newest', limit: 50, offset: 50 });
  });
});

describe('platform admin schools - the rows', () => {
  const a = { id: 'a', name: 'A' };
  const b = { id: 'b', name: 'B' };
  const c = { id: 'c', name: 'C' };

  it('adds a further page without a row twice', () => {
    expect(withPage([a, b], [b, c]).map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(withPage([], [a])).toEqual([a]);
  });

  it('replaces one school and keeps the rest', () => {
    expect(withSchool([a, b], { id: 'b', subdomain: 'baru' })).toEqual([a, { id: 'b', name: 'B', subdomain: 'baru' }]);
  });

  it("links an independent school to its registration's review, searched by its NPSN", () => {
    expect(registrationLinkOf({ id: 's', npsn: '20512345', registrationId: 'r1' })).toEqual({
      pathname: '/admin/school-registrations',
      state: { open: { id: 'r1', status: 'APPROVED', q: '20512345' } },
    });
  });

  it("links a Governing Body's school nowhere", () => {
    expect(registrationLinkOf({ id: 's', npsn: '1', registrationId: null })).toBeNull();
    expect(registrationLinkOf(null)).toBeNull();
  });
});

// school.service.js deactivateSchoolById / takeOverDeactivation (backend fdf0267).
describe('admin schools - the actions', () => {
  const body = { id: 'b1', name: 'Yayasan A' };

  it("an independent School: switch off, or back on; its Principal is the admin's", () => {
    const plain = { lock: false, governed: false, bodyRuns: false, appoint: true, applications: false };
    expect(adminActionsOf({ deactivatedAt: null, governingBody: null })).toEqual({ deactivate: true, reactivate: false, ...plain });
    expect(adminActionsOf({ deactivatedAt: '2026-10-26T03:00:00Z', deactivatedByPlatform: true, governingBody: null })).toEqual({ deactivate: false, reactivate: true, ...plain });
  });

  // school.service.js schoolListView (227473f): deactivatedByPlatform, governingBody.deactivatedAt.
  it("a body's School the body switched off may be locked; the Platform Admin's may not", () => {
    const off = { deactivatedAt: '2026-10-26T03:00:00Z', deactivatedByPlatform: false, governingBody: body };
    expect(adminActionsOf(off).lock).toBe(true);
    expect(adminActionsOf({ ...off, deactivatedByPlatform: true }).lock).toBe(false);
    expect(adminActionsOf(off, { locked: true }).lock).toBe(false);
    expect(adminActionsOf({ deactivatedAt: null, deactivatedByPlatform: false, governingBody: body }).lock).toBe(false);
  });

  it("a body's School: the Principal and applications only while the body is switched off", () => {
    expect(adminActionsOf({ deactivatedAt: null, governingBody: body })).toMatchObject({ bodyRuns: true, appoint: false, applications: false });
    expect(adminActionsOf({ deactivatedAt: null, governingBody: { ...body, deactivatedAt: '2026-10-20T03:00:00Z' } })).toMatchObject({
      bodyRuns: false,
      appoint: true,
      applications: true,
    });
  });
});
