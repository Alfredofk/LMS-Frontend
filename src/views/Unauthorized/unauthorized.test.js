import { describe, expect, it } from 'vitest';

import { unauthorizedViewOf } from './unauthorized';

describe('unauthorizedViewOf (2026-10-30)', () => {
  const state = { from: '/headmaster/classes?tab=x', allowedRoles: ['PRINCIPAL', 'VICE_PRINCIPAL'] };

  it('offers the held role that may open the page, the highest first, and names the page', () => {
    expect(unauthorizedViewOf({ roles: ['TEACHER', 'VICE_PRINCIPAL', 'PRINCIPAL'], activeRole: 'TEACHER', state })).toEqual({
      enterAs: 'PRINCIPAL',
      page: '/headmaster/classes?tab=x',
      from: '/headmaster/classes?tab=x',
    });
  });

  it('offers nothing when no held role may open it, or nothing was sent', () => {
    expect(unauthorizedViewOf({ roles: ['TEACHER', 'GUARDIAN'], activeRole: 'TEACHER', state }).enterAs).toBeNull();
    expect(unauthorizedViewOf({ roles: ['TEACHER', 'PRINCIPAL'], activeRole: 'TEACHER', state: null })).toEqual({ enterAs: null, page: null, from: null });
  });

  it('never offers the role in use, nor an address that is not a path', () => {
    expect(unauthorizedViewOf({ roles: ['PRINCIPAL'], activeRole: 'PRINCIPAL', state }).enterAs).toBeNull();
    expect(unauthorizedViewOf({ roles: ['TEACHER', 'PRINCIPAL'], activeRole: 'TEACHER', state: { ...state, from: 'https://x.test/' } }).enterAs).toBeNull();
  });

  it('names no page to a student or a guardian', () => {
    const asked = { from: '/teacher/courses', allowedRoles: ['TEACHER'] };
    expect(unauthorizedViewOf({ roles: ['STUDENT'], activeRole: 'STUDENT', state: asked }).page).toBeNull();
    expect(unauthorizedViewOf({ roles: ['GUARDIAN', 'TEACHER'], activeRole: 'GUARDIAN', state: asked })).toEqual({ enterAs: 'TEACHER', page: null, from: '/teacher/courses' });
  });
});
