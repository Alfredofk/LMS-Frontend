import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { authService } from '../services/authService';
import { usersService } from '../services/usersService';
import { activeStore } from '../services/apiClient';
import { adminService } from '../services/adminService';
import { activeRolesOf, defaultRoleOf } from '../constants/roles';

const AuthContext = createContext(null);

/*
  Three keys, and none of them holds a token — those live in apiClient.js, which
  is the only module allowed to touch them.

  The membership is cached beside the user so a reload does not blank the sidebar
  while /users/me is in flight. It is a cache and nothing more: refreshMe()
  replaces it with the server's answer, and every authorization decision the
  backend makes is made from the token's own claims, never from this.

  All three follow the tokens into whichever storage Remember me chose, through
  activeStore(). Leaving them in localStorage while the session sits in
  sessionStorage would strand somebody's name and school on a shared machine
  after the session they belong to is gone.
*/
const USER_KEY = 'lms_user';
const MEMBERSHIP_KEY = 'lms_membership';
const ACTIVE_ROLE_KEY = 'lms_active_role';

/*
  Whether this account is a platform admin, cached like the rest.

  It has to be cached, and the reason is a gap in the API rather than a
  preference: `/users/me` answers `publicUser` — id, email, fullName,
  emailVerifiedAt, createdAt — and says nothing about platform admins. That
  knowledge lives only in the PlatformAdmin table, which `requirePlatformAdmin`
  reads on every request. So the only way to ask is to call an admin route and
  see whether it refuses.

  Asking once, at sign-in, is what lets /select-role decide before it paints.
  Asking from inside that screen instead made the whole page appear and then
  vanish — the flash this key exists to remove.

  Delete it the day the backend puts `isPlatformAdmin` on /users/me.
*/
const PLATFORM_ADMIN_KEY = 'lms_platform_admin';

const readJson = (key) => {
  try {
    const raw = activeStore().getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeJson = (key, value) => {
  try {
    const store = activeStore();
    if (value === null || value === undefined) store.removeItem(key);
    else store.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked entirely. The session still works for this page.
  }
};

/*
  The active role is a bare string, not JSON. Reading and writing it raw keeps it
  readable in devtools and avoids the quoted "TEACHER" that JSON.stringify would
  leave behind for the next reader to trip over.
*/
const readRaw = (key) => {
  try {
    return activeStore().getItem(key);
  } catch {
    return null;
  }
};

const writeRaw = (key, value) => {
  try {
    activeStore().setItem(key, value);
  } catch {
    // Storage can be blocked entirely.
  }
};

/** Forget a key wherever it ended up, whichever storage that turned out to be. */
const forget = (key) => {
  for (const store of [localStorage, sessionStorage]) {
    try {
      store.removeItem(key);
    } catch {
      // Nothing to remove if the store cannot be reached.
    }
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [membership, setMembership] = useState(null);
  const [activeRole, setActiveRoleState] = useState(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(readJson(USER_KEY));
    setMembership(readJson(MEMBERSHIP_KEY));
    setActiveRoleState(readRaw(ACTIVE_ROLE_KEY));
    setIsPlatformAdmin(readRaw(PLATFORM_ADMIN_KEY) === '1');
    setLoading(false);
  }, []);

  /*
    Ask whether this account is a platform admin, and remember the answer.

    Only asked when there is no role to enter with — a person with a school to
    work in is never probed and pays nothing for this. A 403 is the ordinary
    answer and means exactly what it says.

    Returns the answer so callers can route on it without waiting for the state
    update to land.
  */
  const checkPlatformAdmin = useCallback(async () => {
    try {
      /* `limit: 1` because only the status code is wanted. This used to ask for
         a status and take the default page of fifty rows, every one of which
         was thrown away. */
      await adminService.list({ limit: 1 });
      setIsPlatformAdmin(true);
      writeRaw(PLATFORM_ADMIN_KEY, '1');
      return true;
    } catch {
      setIsPlatformAdmin(false);
      forget(PLATFORM_ADMIN_KEY);
      return false;
    }
  }, []);

  /* The roles this person may actually enter with, right now. */
  const roles = useMemo(() => activeRolesOf(membership), [membership]);

  /*
    Apply whatever the server just told us about this person.

    Choosing the active role is part of the same step, because a stored choice
    can go stale in ways a reload would otherwise hide: a role can be revoked, or
    approved, between one sign-in and the next. So the previous choice survives
    only if it is still held; a single role is entered without asking; and
    anything else means the picker has to run.
  */
  const applySession = useCallback((nextUser, nextMembership, previousRole) => {
    const available = activeRolesOf(nextMembership);

    /* The role chosen before, while it is still held; otherwise the default —
       Principal before Teacher before Student before Guardian (owner,
       2026-09-24). It used to be null for anybody holding two, which sent them
       to /select-role at every sign-in to answer the same question. */
    const nextRole = previousRole && available.includes(previousRole) ? previousRole : defaultRoleOf(available);

    setUser(nextUser);
    setMembership(nextMembership);
    setActiveRoleState(nextRole);

    writeJson(USER_KEY, nextUser);
    writeJson(MEMBERSHIP_KEY, nextMembership);
    if (nextRole) writeRaw(ACTIVE_ROLE_KEY, nextRole);
    else forget(ACTIVE_ROLE_KEY);

    return { user: nextUser, membership: nextMembership, roles: available, activeRole: nextRole };
  }, []);

  /**
   * Sign in. Tokens are stored by authService; this stores the person.
   *
   * `remember` reaches saveTokens first and settles which storage this session
   * lives in, so everything applySession writes afterwards lands in the same
   * place. Order matters here, and this is that order.
   *
   * @throws {ApiError} UNAUTHORIZED on bad credentials, EMAIL_NOT_VERIFIED (403)
   *   when the address was never confirmed.
   */
  const signIn = useCallback(
    async ({ email, password, remember = false }) => {
      const auth = await authService.login({ email, password, remember });
      // A fresh sign-in starts with no prior choice: whoever just typed their
      // password may not be whoever used this browser last.
      const session = applySession(auth.user, auth.membership, null);
      /* Only when there is nothing to enter with — see checkPlatformAdmin.
         Returned on the session rather than read from state by the caller:
         a state update has not landed by the time the caller routes. */
      const admin = session.roles.length === 0 ? await checkPlatformAdmin() : false;
      return { ...session, isPlatformAdmin: admin };
    },
    [applySession, checkPlatformAdmin]
  );

  /**
   * Sign in with a Google ID token.
   *
   * Different credential, identical outcome: the backend answers /auth/google
   * exactly as it answers /auth/login, so the session is built the same way and
   * `remember` means the same thing.
   *
   * @throws {ApiError} UNAUTHORIZED when Google refuses the token
   */
  const signInWithGoogle = useCallback(
    async ({ idToken, remember = false }) => {
      const auth = await authService.signInWithGoogle({ idToken, remember });
      const session = applySession(auth.user, auth.membership, null);
      const admin = session.roles.length === 0 ? await checkPlatformAdmin() : false;
      return { ...session, isPlatformAdmin: admin };
    },
    [applySession, checkPlatformAdmin]
  );

  /**
   * Re-read the account from the server.
   *
   * Sign-in reports only ACTIVE roles, so a request still waiting on approval is
   * invisible in its answer. /users/me carries each role's status, which is why
   * the role picker refreshes through here rather
   * than trusting what sign-in cached.
   */
  const refreshMe = useCallback(async () => {
    const me = await usersService.getMe();
    return applySession(me.user, me.membership, activeRole);
  }, [applySession, activeRole]);

  /**
   * Change one's own name.
   *
   * PATCH /users/me answers with the same { user, membership } pair that
   * /users/me returns, so the result is applied straight away rather than
   * followed by a refreshMe() — one round trip, not two.
   *
   * `activeRole` is passed through because this call changes a name, not a
   * membership: whoever was working as a Teacher is still working as a Teacher
   * afterwards, and applySession would otherwise drop them back to the picker.
   *
   * @throws {ApiError} BAD_REQUEST when the name fails the server's own rule
   */
  const updateProfile = useCallback(
    async ({ fullName }) => {
      const me = await usersService.updateMe({ fullName });
      return applySession(me.user, me.membership, activeRole);
    },
    [applySession, activeRole]
  );

  /**
   * Enter as one of the roles this person holds.
   * @returns {boolean} false if they do not hold it, and nothing changes
   */
  const selectRole = useCallback(
    (role) => {
      if (!roles.includes(role)) return false;
      setActiveRoleState(role);
      writeRaw(ACTIVE_ROLE_KEY, role);
      return true;
    },
    [roles]
  );

  /*
    Sign out of this device.

    authService.logout() posts the refresh token so the backend can revoke it,
    and clears both tokens whatever the network did. The previous version of this
    function sent a bearer header to an endpoint that reads { refreshToken } from
    the body, so the refresh token was never revoked and stayed usable after
    somebody thought they had left.
  */
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setMembership(null);
      setActiveRoleState(null);
      // Clear both storages: signing out must not depend on guessing which one
      // this session happened to use.
      forget(USER_KEY);
      forget(MEMBERSHIP_KEY);
      forget(ACTIVE_ROLE_KEY);
      setIsPlatformAdmin(false);
      forget(PLATFORM_ADMIN_KEY);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      membership,
      roles,
      activeRole,
      loading,
      isPlatformAdmin,
      isAuthenticated: !!user,
      signIn,
      signInWithGoogle,
      logout,
      refreshMe,
      updateProfile,
      checkPlatformAdmin,
      selectRole,
      register: authService.register,
    }),
    [user, membership, roles, activeRole, loading, isPlatformAdmin, signIn, signInWithGoogle, logout, refreshMe, updateProfile, checkPlatformAdmin, selectRole]
  );

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

/* The hook lives beside its provider on purpose — thirty-odd files import both
   from here. The cost is only that editing this file reloads the page in dev
   instead of hot-swapping it. */
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
