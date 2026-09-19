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
   * `membership` is null for someone who belongs to no school yet — a real
   * state, not an error: their token carries no school, so nothing school-owned
   * is reachable with it.
   *
   * @returns {Promise<{ accessToken, refreshToken, user, membership }>}
   * @throws {ApiError} UNAUTHORIZED on bad credentials, or EMAIL_NOT_VERIFIED
   *   (403) when the address was never confirmed — offer resendVerification().
   */
  async login({ email, password }) {
    const auth = await api.post('/auth/login', { email, password }, { auth: false });
    saveTokens(auth);
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
   * Sign in with Google.
   *
   * TODO — still a mock. The backend has no OAuth endpoint yet; someone else is
   * building it. To wire this up, replace the body with a call to whatever the
   * endpoint turns out to be and keep the return shape identical to login():
   * { accessToken, refreshToken, user, membership }, then saveTokens() it. The
   * rest of this module will not need to change.
   */
  async loginWithGoogle(role) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          token: `mock-jwt-token-google-${role || 'teacher'}`,
          user: {
            role: role || 'teacher',
            email: role === 'student' ? 'student.teladan@gmail.com' : 'guru.teladan@gmail.com',
            name: role === 'student' ? 'Student User' : 'Teacher User',
          },
        });
      }, 1500);
    });
  },

  /*
    Three stubs, kept only so the old call sites in useLoginForm fail legibly
    instead of raising "authService.loginWithNpsn is not a function". They go
    when the login UI is rewritten.

    signUp is now register(): it took a role, and a role is not something a
    person picks for themselves at registration.

    Neither an NPSN nor a School Code is a credential in the backend. An NPSN
    identifies a school; a School Code only locates one so a person can ask to
    join it, and a human still approves the request. Signing in is always email
    and password.
  */
  signUp() {
    throw new Error(
      'authService.signUp has been replaced by register({ email, password, fullName }).'
    );
  },

  loginWithNpsn() {
    throw new Error(
      'Signing in with an NPSN is no longer supported. Use email and password.'
    );
  },

  loginWithSchoolCode() {
    throw new Error(
      'Signing in with a School Code is no longer supported. Use email and password.'
    );
  },
};

export default authService;
