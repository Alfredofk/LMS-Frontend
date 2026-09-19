/**
 * The backend's /api/auth contract, thin over apiClient.
 *
 * Every call here returns the `data` half of the envelope and throws an
 * ApiError on failure — unwrapping and token storage live in apiClient.js.
 */

import { api, saveTokens, clearTokens, getRefreshToken } from './apiClient';

/*
  Registration, sign-in and verification are one flow, so they share a shape:
  the backend names a person's display name `fullName`, never `name`, and the
  token pair comes back as `accessToken` / `refreshToken`, never `token`.
*/
export const authService = {
  /**
   * Create an account. The backend sends a verification link; nobody can sign
   * in until that link is clicked.
   *
   * No role is sent. A role is not chosen at registration — it is granted by
   * approval when the person joins a school, and until then they belong to none.
   *
   * @param {{ email: string, password: string, fullName: string }} input
   * @returns {Promise<{ user: object, message: string }>}
   * @throws {ApiError} CONFLICT when the address is already registered
   */
  register({ email, password, fullName }) {
    return api.post('/auth/register', { email, password, fullName }, { auth: false });
  },

  /**
   * Claim the link from the verification email.
   * @returns {Promise<{ verified: boolean, message: string }>}
   */
  verifyEmail(token) {
    return api.get('/auth/verify-email', { query: { token }, auth: false });
  },

  /**
   * Ask for a fresh verification link.
   *
   * Answers the same whether or not the address has an account, so never treat
   * a success here as proof the address exists.
   */
  resendVerification(email) {
    return api.post('/auth/resend-verification', { email }, { auth: false });
  },

  /**
   * Sign in and store the token pair.
   *
   * `remember` decides two things at once, and both matter.
   *
   * Here it picks where the tokens are kept: true survives closing the browser,
   * false ends the session with the tab. Sent on as `rememberMe`, it also tells
   * the server how long to honour the refresh token — 14 days against 1
   * (LMS-Backend shared/auth.js:26-27). The choice is then signed into the token
   * as `rem` and survives every rotation, so it is asked once and never again.
   *
   * Storing tokens permanently while the server only honours them for a day
   * would be a checkbox that promises more than it delivers, which is why both
   * halves move together.
   *
   * `membership` is null for someone who belongs to no school yet — a real
   * state, not an error: their token carries no school, so nothing school-owned
   * is reachable with it.
   *
   * @returns {Promise<{ accessToken, refreshToken, user, membership }>}
   * @throws {ApiError} UNAUTHORIZED on bad credentials, or EMAIL_NOT_VERIFIED
   *   (403) when the address was never confirmed — offer resendVerification().
   */
  async login({ email, password, remember = false }) {
    const auth = await api.post('/auth/login', { email, password, rememberMe: remember }, { auth: false });
    saveTokens(auth, remember);
    return auth;
  },

  /**
   * Trade the stored refresh token for a new pair.
   *
   * Rarely called directly: apiClient does this on its own when a request comes
   * back 401. Claims are rebuilt server-side here, so this is also the moment an
   * approval granted since the last sign-in reaches the token.
   */
  async refresh() {
    const refreshToken = getRefreshToken();
    const auth = await api.post('/auth/refresh', { refreshToken }, { auth: false });
    // No second argument: a refresh keeps the session wherever it already lives.
    saveTokens(auth);
    return auth;
  },

  /**
   * Sign out this device. Idempotent on the backend, and the local tokens are
   * cleared whatever the network did — a failed call must not strand somebody
   * signed in on a machine they are trying to leave.
   */
  async logout() {
    const refreshToken = getRefreshToken();

    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }, { auth: false });
      }
    } finally {
      clearTokens();
    }
  },

  /**
   * Start a password reset. Silent by design: the reply is identical whether or
   * not the address has an account.
   */
  forgotPassword(email) {
    return api.post('/auth/forgot-password', { email }, { auth: false });
  },

  /**
   * Whether a reset link is still good — i.e. whether to render the form.
   * @returns {Promise<{ valid: boolean }>}
   */
  checkResetToken(token) {
    return api.get('/auth/reset-password', { query: { token }, auth: false });
  },

  /**
   * Set a new password from a reset link. Signs the account out of every device,
   * including this one, so the caller must send the person back to sign in.
   */
  resetPassword({ token, password }) {
    return api.post('/auth/reset-password', { token, password }, { auth: false });
  },

  /**
   * Sign in with the ID token Google Identity Services handed the browser.
   *
   * The backend verifies that token itself — Google's signature, the expiry, the
   * issuer, and above all the audience, so a token minted for somebody else's
   * app cannot sign anyone in here. It then answers exactly as /auth/login does,
   * which is why nothing downstream needs a special case for Google.
   *
   * No client secret is involved anywhere in this flow.
   *
   * @param {{ idToken: string, remember?: boolean }} input
   * @returns {Promise<{ accessToken, refreshToken, user, membership }>}
   * @throws {ApiError} UNAUTHORIZED when Google refuses the token, or when the
   *   address behind it is not verified on Google's side
   */
  async signInWithGoogle({ idToken, remember = false }) {
    const auth = await api.post('/auth/google', { idToken, rememberMe: remember }, { auth: false });
    saveTokens(auth, remember);
    return auth;
  },

};

export default authService;
