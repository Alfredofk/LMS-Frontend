/**
 * The backend's /api/users contract, thin over apiClient.
 *
 * Every route here sits behind requireAuth, so every call needs a bearer token
 * and a 401 is handled by apiClient's single-flight refresh, not here.
 */

import { api, saveTokens } from './apiClient';

export const usersService = {
  /**
   * The signed-in person's own account and standing.
   *
   * This is the only endpoint that reports a role's *approval status*. Sign-in
   * returns membership.roles as a flat list of names and only ever the ACTIVE
   * ones, so a role still waiting on approval is simply absent there. Here each
   * role arrives as { role, status, rejectionReason }, which is what lets the
   * role picker say "waiting" instead of silently omitting the card.
   *
   * @returns {Promise<{
   *   user: { id, email, fullName, emailVerifiedAt, createdAt },
   *   membership: null | {
   *     id: string,
   *     status: 'PENDING' | 'ACTIVE',
   *     requestedAt: string,
   *     approvedAt: string | null,
   *     school: { id, name, schoolType },
   *     roles: Array<{
   *       role: 'PRINCIPAL' | 'TEACHER' | 'STUDENT' | 'GUARDIAN',
   *       status: 'PENDING' | 'ACTIVE' | 'REJECTED',
   *       rejectionReason: string | null
   *     }>
   *   }
   * }>}
   */
  getMe() {
    return api.get('/users/me');
  },

  /**
   * Rename oneself. `fullName` is the only field a person may change here —
   * email is an identity the backend does not let anybody edit in place.
   */
  updateMe({ fullName }) {
    return api.patch('/users/me', { fullName });
  },

  /**
   * Change the password.
   *
   * This signs every *other* device out, so the backend hands back a fresh token
   * pair for this one. Storing it is not optional: skip saveTokens and the tokens
   * in localStorage are the ones that were just revoked, and the next request
   * logs this device out too.
   *
   * @returns {Promise<{ accessToken, refreshToken, user, membership }>}
   * @throws {ApiError} UNAUTHORIZED when currentPassword is wrong
   */
  async changePassword({ currentPassword, newPassword }) {
    /*
      Refresh-and-retry stays ON here, and it is worth saying why, because
      turning it off looks right and is not.

      This endpoint answers 401 for two unrelated things, under one code: a wrong
      `currentPassword`, and an access token that has expired. Those pull in
      opposite directions.

      Switching the retry off makes the wrong-password case tidy — no refresh
      token rotated for a request that was never going to succeed. But an access
      token only lives fifteen minutes, so somebody who opens this screen, is
      interrupted, and comes back to type their correct password gets a 401 for
      the *other* reason and is told their password is wrong. Leaving the retry
      on costs one wasted rotation per typo; switching it off breaks a case that
      happens on its own, without anybody making a mistake.

      Which of the two happened is worked out at the call site, from whether the
      tokens survived — see PasswordForm.
    */
    const auth = await api.post('/users/me/change-password', {
      currentPassword,
      newPassword,
    });

    saveTokens(auth);
    return auth;
  },
};

export default usersService;
