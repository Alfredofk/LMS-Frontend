/*
  The two parts of apiClient.js that decide things without the network.

  1. `accessTokenClaims` — reads the token we already hold so /select-role can
     tell whether it is out of date after an approval. It is NOT verification
     (the server checks signatures); these tests only pin that it reads what is
     there, reads non-ASCII school names correctly, and answers null — never
     throws — for anything it cannot read.

  2. Where a session lives. "Remember me" puts it in exactly one of localStorage
     or sessionStorage, and a mid-flight refresh must leave it where it was. The
     backend rotates refresh tokens and treats an old one coming back as theft,
     so a session smeared across both stores is not just untidy.

  Node has no Web Storage, so both are stood in for by the small class below
  rather than a whole DOM library. It implements only the four methods
  apiClient calls.
*/

import { Buffer } from 'node:buffer';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  accessTokenClaims,
  activeStore,
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
} from './apiClient.js';

class MemoryStorage {
  #items = new Map();
  getItem(key) {
    return this.#items.has(key) ? this.#items.get(key) : null;
  }
  setItem(key, value) {
    this.#items.set(key, String(value));
  }
  removeItem(key) {
    this.#items.delete(key);
  }
  clear() {
    this.#items.clear();
  }
}

/* What private browsing and blocked site data do: throw, rather than return. */
class RefusingStorage {
  getItem() {
    throw new Error('SecurityError');
  }
  setItem() {
    throw new Error('SecurityError');
  }
  removeItem() {
    throw new Error('SecurityError');
  }
}

let local;
let session;

beforeEach(() => {
  local = new MemoryStorage();
  session = new MemoryStorage();
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* A token-shaped string. The header and signature are never read, so they are
   placeholders; only the middle segment matters here. */
const tokenWith = (claims) =>
  ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'sig'].join('.');

const holding = (accessToken) => {
  local.setItem('token', accessToken);
  local.setItem('lms_refresh_token', 'refresh');
};

/* ======================================================================== */

describe('accessTokenClaims', () => {
  it('is null when there is no token at all', () => {
    expect(accessTokenClaims()).toBeNull();
  });

  it('reads the claims the server signed in', () => {
    const claims = {
      sub: 'u1',
      membershipId: 'm1',
      schoolId: 's1',
      schoolName: 'Bintang Jaya Supreme',
      roles: ['TEACHER'],
      rem: false,
    };
    holding(tokenWith(claims));
    expect(accessTokenClaims()).toEqual(claims);
  });

  it('reports schoolId null for a token minted before any approval', () => {
    /* This is the whole reason the function exists: /users/me says ACTIVE,
       the token still says no school, and /select-role swaps it. */
    holding(tokenWith({ sub: 'u1', schoolId: null, roles: [] }));
    expect(accessTokenClaims().schoolId).toBeNull();
  });

  it('decodes a school name that is not ASCII', () => {
    /* Bare atob would hand back Latin-1 mojibake here; TextDecoder is why the
       function goes through bytes first. */
    const schoolName = 'SMK Bintang Jaya — 学校 Élite';
    holding(tokenWith({ schoolId: 's1', schoolName }));
    expect(accessTokenClaims().schoolName).toBe(schoolName);
  });

  it.each([
    ['???', '_'],
    ['>>>', '-'],
  ])('handles base64url (%s encodes with %s) and missing padding', (schoolName, char) => {
    const token = tokenWith({ schoolName });
    const payload = token.split('.')[1];
    expect(payload).toContain(char); // precondition: the case really is exercised
    expect(payload.length % 4).not.toBe(0); // and the padding really is missing
    holding(token);
    expect(accessTokenClaims().schoolName).toBe(schoolName);
  });

  it.each([
    ['no dots', 'not-a-jwt'],
    ['an empty payload', 'header..sig'],
    ['a payload that is not base64', 'header.!!!.sig'],
    ['a payload that is not JSON', `header.${Buffer.from('not json').toString('base64url')}.sig`],
  ])('answers null for %s rather than throwing', (_, token) => {
    holding(token);
    expect(() => accessTokenClaims()).not.toThrow();
    expect(accessTokenClaims()).toBeNull();
  });

  it('answers null when storage itself refuses to be read', () => {
    vi.stubGlobal('localStorage', new RefusingStorage());
    vi.stubGlobal('sessionStorage', new RefusingStorage());
    expect(() => accessTokenClaims()).not.toThrow();
    expect(accessTokenClaims()).toBeNull();
  });
});

/* ======================================================================== */

describe('where a session lives — "Remember me"', () => {
  const pair = { accessToken: 'access-1', refreshToken: 'refresh-1' };
  const where = () => ({
    local: [local.getItem('token'), local.getItem('lms_refresh_token')],
    session: [session.getItem('token'), session.getItem('lms_refresh_token')],
  });

  it('ticked: localStorage, and nothing in sessionStorage', () => {
    saveTokens(pair, true);
    expect(where()).toEqual({ local: ['access-1', 'refresh-1'], session: [null, null] });
  });

  it('unticked — the default: sessionStorage, and nothing in localStorage', () => {
    saveTokens(pair, false);
    expect(where()).toEqual({ local: [null, null], session: ['access-1', 'refresh-1'] });
  });

  it('never leaves a session in both after the choice changes', () => {
    saveTokens(pair, true);
    saveTokens({ accessToken: 'access-2', refreshToken: 'refresh-2' }, false);
    expect(where()).toEqual({ local: [null, null], session: ['access-2', 'refresh-2'] });
  });

  it('keeps a refreshed session where it already was when no choice is given', () => {
    /* A mid-flight refresh passes no `persist`. Moving somebody onto permanent
       storage they never asked for is exactly what must not happen. */
    saveTokens(pair, false);
    saveTokens({ accessToken: 'access-2', refreshToken: 'refresh-2' });
    expect(where()).toEqual({ local: [null, null], session: ['access-2', 'refresh-2'] });

    clearTokens();
    saveTokens(pair, true);
    saveTokens({ accessToken: 'access-3', refreshToken: 'refresh-3' });
    expect(where()).toEqual({ local: ['access-3', 'refresh-3'], session: [null, null] });
  });

  it('finds the session by looking for it, sessionStorage first', () => {
    expect(activeStore()).toBe(local); // nothing anywhere: the fallback
    session.setItem('lms_refresh_token', 'r');
    expect(activeStore()).toBe(session);
  });

  it('reads back through the same search', () => {
    saveTokens(pair, false);
    expect(getAccessToken()).toBe('access-1');
    expect(getRefreshToken()).toBe('refresh-1');
  });

  it('signs out of both stores at once', () => {
    saveTokens(pair, true);
    session.setItem('token', 'stray');
    clearTokens();
    expect(where()).toEqual({ local: [null, null], session: [null, null] });
  });

  it('does not throw when storage is unavailable', () => {
    vi.stubGlobal('localStorage', new RefusingStorage());
    vi.stubGlobal('sessionStorage', new RefusingStorage());
    expect(() => saveTokens(pair, true)).not.toThrow();
    expect(() => clearTokens()).not.toThrow();
    expect(getAccessToken()).toBeNull();
  });
});
