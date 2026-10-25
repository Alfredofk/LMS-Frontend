import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { hasUnseenRejection, readSeen, rememberRejection, seenKeyOf } from './rejections';

/*
  Where "this refusal was announced" is kept (owner 2026-10-25): per account in
  localStorage, so a sign-in without "Remember me" does not announce the same old
  refusal every new session. Node has no Web Storage; a small in-memory one stands
  in, as in apiClient.test.js.
*/

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

let local;
let session;

/* A sign-in without "Remember me": the session and the account in sessionStorage. */
const signIn = (userId, store = session) => {
  store.setItem('lms_refresh_token', 'r');
  store.setItem('lms_user', JSON.stringify({ id: userId }));
};

const refused = { id: 'reg1', status: 'REJECTED', rejectionReason: 'Bukan KTP' };

beforeEach(() => {
  local = new MemoryStorage();
  session = new MemoryStorage();
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', session);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('rejections - what was announced', () => {
  it('keys the memory by account', () => {
    expect(seenKeyOf('u1')).toBe('lms_seen_rejections:u1');
    expect(seenKeyOf(null)).toBeNull();
  });

  it('remembers a refusal past the end of a session without "Remember me"', () => {
    signIn('u1');
    expect(hasUnseenRejection(null, refused)).toBe(true);
    rememberRejection('registration:reg1');

    // The browser closed: the session store is gone, a new sign-in follows.
    session.clear();
    signIn('u1');
    expect(hasUnseenRejection(null, refused)).toBe(false);
  });

  it('does not count another account on the same computer as told', () => {
    signIn('u1');
    rememberRejection('registration:reg1');
    session.clear();
    signIn('u2');
    expect(hasUnseenRejection(null, refused)).toBe(true);
  });

  it('still announces a new refusal', () => {
    signIn('u1');
    rememberRejection('registration:reg1');
    expect(hasUnseenRejection(null, { ...refused, id: 'reg2' })).toBe(true);
  });

  it('reads what a session remembered under the old key', () => {
    signIn('u1');
    session.setItem('lms_seen_rejections', JSON.stringify(['registration:reg1']));
    expect(readSeen()).toEqual(['registration:reg1']);
    expect(hasUnseenRejection(null, refused)).toBe(false);
  });

  it('falls back to the session without an account, as before', () => {
    session.setItem('lms_refresh_token', 'r');
    rememberRejection('registration:reg1');
    expect(session.getItem('lms_seen_rejections')).toBe(JSON.stringify(['registration:reg1']));
    expect(local.getItem('lms_seen_rejections')).toBeNull();
  });
});
