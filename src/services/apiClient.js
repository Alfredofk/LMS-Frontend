/**
 * The single place that knows how the backend talks.
 *
 * Every response it sends is the envelope { success, data, error }, so callers
 * here get back `data` alone and never unwrap it themselves. A failure arrives
 * as an ApiError carrying the backend's own `code`, which is what lets a caller
 * tell EMAIL_NOT_VERIFIED from a plain UNAUTHORIZED without matching on prose.
 */

const BASE_URL = '/api';

/*
  The access token keeps the key it has always had. AuthContext and a dozen views
  still read localStorage.getItem('token') directly, and renaming it would log
  everyone out for no gain. The refresh token is new, so it gets a new key.
*/
const ACCESS_TOKEN_KEY = 'token';
const REFRESH_TOKEN_KEY = 'lms_refresh_token';

/**
 * A failed request. `code` is the backend's machine-readable reason
 * (UNAUTHORIZED, EMAIL_NOT_VERIFIED, CONFLICT, BAD_REQUEST, ...).
 */
export class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// --- token storage -------------------------------------------------------

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export function saveTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// --- the request itself --------------------------------------------------

const buildUrl = (path, query) => {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;

  const search = new URLSearchParams(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null)
  ).toString();

  return search ? `${url}?${search}` : url;
};

/*
  A proxy that cannot reach the backend answers with HTML, not JSON. Parsing that
  as JSON throws a SyntaxError pointing at column 1 of something the caller never
  sees, so read the body as text first and turn a non-JSON reply into an ApiError
  that says what actually happened.
*/
async function readBody(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      response.ok
        ? 'The server sent a response this app could not read.'
        : `The server returned ${response.status} without a readable message.`
    );
  }
}

async function send(path, { method = 'GET', body, query, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  return { response, payload: await readBody(response) };
}

const toApiError = (response, payload) =>
  new ApiError(
    response.status,
    payload?.error?.code ?? 'UNKNOWN_ERROR',
    payload?.error?.message ?? 'Something went wrong. Please try again.',
    payload?.error?.details ?? null
  );

// --- refresh -------------------------------------------------------------

/*
  One refresh at a time, shared by everyone waiting on it.

  The backend rotates refresh tokens and revokes the one presented. It also
  treats a revoked token coming back as theft and signs the user out of every
  device (LMS-Backend auth.service.js, refreshAuth). So two requests hitting 401
  together must not each post their own refresh: the second would be replaying a
  token the first just spent, and the user would be logged out everywhere for
  doing nothing wrong. This promise is that lock.
*/
let refreshInFlight = null;

async function performRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const { response, payload } = await send('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    });

    if (!response.ok || !payload?.success) {
      clearTokens();
      return false;
    }

    saveTokens(payload.data);
    return true;
  } catch {
    // A network failure is not proof the token is bad, but there is no way to
    // continue the original request either. Keep the tokens and let the caller
    // see the original 401.
    return false;
  }
}

const refreshTokens = () => {
  refreshInFlight = refreshInFlight ?? performRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

/**
 * Make a request and return the `data` half of the envelope.
 *
 * @param {string} path      below /api, e.g. '/auth/login'
 * @param {object} [options]
 * @param {string} [options.method='GET']
 * @param {object} [options.body]          serialised as JSON
 * @param {object} [options.query]         appended as a query string
 * @param {boolean} [options.auth=true]    send the bearer token
 * @param {boolean} [options.retryOnUnauthorized=true]  refresh once on a 401
 * @throws {ApiError}
 */
export async function request(path, options = {}) {
  const { retryOnUnauthorized = true, ...rest } = options;
  const auth = rest.auth ?? true;

  let { response, payload } = await send(path, rest);

  /*
    Only an authenticated call is worth retrying. A 401 from /auth/login means
    the password was wrong, and refreshing would neither fix it nor make sense.
  */
  if (response.status === 401 && auth && retryOnUnauthorized && getRefreshToken()) {
    if (await refreshTokens()) {
      ({ response, payload } = await send(path, rest));
    }
  }

  if (!response.ok || !payload?.success) {
    throw toApiError(response, payload);
  }

  return payload.data;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

export default api;
