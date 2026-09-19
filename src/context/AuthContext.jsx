import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { authService } from '../services/authService';
import { usersService } from '../services/usersService';
import { activeRolesOf } from '../constants/roles';

const AuthContext = createContext(null);

/*
  Three keys, and none of them holds a token — those live in apiClient.js, which
  is the only module allowed to touch them.

  The membership is cached beside the user so a reload does not blank the sidebar
  while /users/me is in flight. It is a cache and nothing more: refreshMe()
  replaces it with the server's answer, and every authorization decision the
  backend makes is made from the token's own claims, never from this.
*/
const USER_KEY = 'lms_user';
const MEMBERSHIP_KEY = 'lms_membership';
const ACTIVE_ROLE_KEY = 'lms_active_role';

const readJson = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
};

const writeJson = (key, value) => {
  if (value === null || value === undefined) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [membership, setMembership] = useState(null);
  const [activeRole, setActiveRoleState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(readJson(USER_KEY));
    setMembership(readJson(MEMBERSHIP_KEY));
    setActiveRoleState(localStorage.getItem(ACTIVE_ROLE_KEY));
    setLoading(false);
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

    let nextRole = null;
    if (previousRole && available.includes(previousRole)) nextRole = previousRole;
    else if (available.length === 1) nextRole = available[0];

    setUser(nextUser);
    setMembership(nextMembership);
    setActiveRoleState(nextRole);

    writeJson(USER_KEY, nextUser);
    writeJson(MEMBERSHIP_KEY, nextMembership);
    if (nextRole) localStorage.setItem(ACTIVE_ROLE_KEY, nextRole);
    else localStorage.removeItem(ACTIVE_ROLE_KEY);

    return { user: nextUser, membership: nextMembership, roles: available, activeRole: nextRole };
  }, []);

  /**
   * Sign in. Tokens are stored by authService; this stores the person.
   *
   * @throws {ApiError} UNAUTHORIZED on bad credentials, EMAIL_NOT_VERIFIED (403)
   *   when the address was never confirmed.
   */
  const signIn = useCallback(
    async ({ email, password }) => {
      const auth = await authService.login({ email, password });
      // A fresh sign-in starts with no prior choice: whoever just typed their
      // password may not be whoever used this browser last.
      return applySession(auth.user, auth.membership, null);
    },
    [applySession]
  );

  /**
   * Re-read the account from the server.
   *
   * Sign-in reports only ACTIVE roles, so a request still waiting on approval is
   * invisible in its answer. /users/me carries each role's status, which is why
   * the role picker and the no-school screen both refresh through here rather
   * than trusting what sign-in cached.
   */
  const refreshMe = useCallback(async () => {
    const me = await usersService.getMe();
    return applySession(me.user, me.membership, activeRole);
  }, [applySession, activeRole]);

  /**
   * Enter as one of the roles this person holds.
   * @returns {boolean} false if they do not hold it, and nothing changes
   */
  const selectRole = useCallback(
    (role) => {
      if (!roles.includes(role)) return false;
      setActiveRoleState(role);
      localStorage.setItem(ACTIVE_ROLE_KEY, role);
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
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(MEMBERSHIP_KEY);
      localStorage.removeItem(ACTIVE_ROLE_KEY);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      membership,
      roles,
      activeRole,
      loading,
      isAuthenticated: !!user,
      signIn,
      logout,
      refreshMe,
      selectRole,
      register: authService.register,
    }),
    [user, membership, roles, activeRole, loading, signIn, logout, refreshMe, selectRole]
  );

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
