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
  The access token keeps the key it has always had: renaming it would log out
  everyone holding a session under the old name, for no gain. The refresh token
  is new, so it gets a new key.

  Nothing reads these keys directly any more. Thirty-three sites across thirteen
  views used to call localStorage.getItem('token'), which was wrong rather than
  merely untidy: a session with "Remember me" unchecked — the default — lives in
  `sessionStorage`, so every one of them read null and sent "Bearer null". The
  endpoints behind them all 404 today, so it cost nothing yet; the day they exist
  it would have been an intermittent 401 that follows a checkbox.

  They go through `getAccessToken()` now, which asks `activeStore()` where the
  session actually is. Keep it that way: read a token through this module, never
  from a storage by name.
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

/*
  A session lives in exactly one of the two web storages, and which one is what
  "Remember me" decides.

    localStorage    survives closing the browser
    sessionStorage  dies with the tab

  The backend has no say in this — its login body is only { email, password } —
  and it caps the whole thing anyway: a refresh token is good for 7 days, rolling
  (LMS-Backend/src/shared/auth.js:63). So this choice is about the machine in
  front of the person, which matters most on the shared ones in a school.

  There is no separate flag recording the choice. The session is found by looking
  for it: sessionStorage first, then localStorage. A flag could drift out of step
  with where the tokens actually are; a search cannot.
*/
const holdsSession = (store) => {
  try {
    return store.getItem(REFRESH_TOKEN_KEY) !== null;
  } catch {
    // Private browsing and blocked site data both throw rather than return null.
    return false;
  }
};

/** The storage this session currently lives in. */
export const activeStore = () =>
  holdsSession(sessionStorage) ? sessionStorage : localStorage;

const readToken = (key) => {
  try {
    return activeStore().getItem(key);
  } catch {
    return null;
  }
};

export const getAccessToken = () => readToken(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => readToken(REFRESH_TOKEN_KEY);

/**
 * What the access token we are already carrying says about itself.
 *
 * **This is not verification, and must never be used as any.** The signature is
 * the server's to check; this only reads the payload we already hold, so the app
 * can answer one question: is this token out of date? A token whose contents were
 * trusted would be a token an attacker could write. Nothing here decides what
 * somebody may do — only whether to go and trade the token in.
 *
 * The one caller is `/select-role`, which compares `schoolId` against what
 * `/users/me` reports. Approval grants a role without minting a new token
 * (`membership.service.js` touches neither), so the two can disagree, and that
 * disagreement is exactly what this exposes.
 *
 * Decoded through `TextDecoder` rather than bare `atob`: `schoolName` rides in
 * the claims (`shared/auth.js:56`) and a school's name is not guaranteed ASCII.
 *
 * @returns {{ sub: string, membershipId: string|null, schoolId: string|null,
 *   schoolName: string|null, roles: string[], rem: boolean }|null}
 *   `null` when there is no token, or when it is malformed — which callers should
 *   read as "cannot tell", never as "stale".
 */
export function accessTokenClaims() {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    /* base64url → base64, then bytes → UTF-8. */
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    /* Not a JWT, truncated, or not JSON. Anything we cannot read, we do not
       pretend to know. */
    return null;
  }
}

/**
 * Store a token pair.
 *
 * @param {{ accessToken?: string, refreshToken?: string }} auth
 * @param {boolean} [persist] true keeps the session across browser restarts,
 *   false ends it with the tab. **Leave it out to keep the session where it
 *   already is** — a mid-flight token refresh must not quietly move somebody
 *   onto permanent storage they never asked for.
 */
export function saveTokens({ accessToken, refreshToken }, persist) {
  const target =
    persist === undefined ? activeStore() : persist ? localStorage : sessionStorage;
  const other = target === localStorage ? sessionStorage : localStorage;

  try {
    // Clear the other one first: a session that exists in both is a session that
    // outlives the choice somebody made about it.
    other.removeItem(ACCESS_TOKEN_KEY);
    other.removeItem(REFRESH_TOKEN_KEY);

    if (accessToken) target.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) target.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch {
    // Storage can be unavailable entirely. The tokens in memory still serve this
    // page; the next reload will simply ask the person to sign in again.
  }
}

export function clearTokens() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      store.removeItem(ACCESS_TOKEN_KEY);
      store.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // Nothing to clear if the store cannot be reached.
    }
  }
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
  /*
    A FormData body goes out untouched, and without a Content-Type.

    Both halves matter, and getting either wrong fails silently. `JSON.stringify`
    of a FormData is the string "{}" — the fields and the file vanish with no
    error anywhere. And multipart needs a boundary token in its Content-Type
    that only the browser knows; writing the header ourselves leaves it off and
    the server cannot parse the body.

    School registration is the only caller so far: it carries a KTP photo
    alongside the form, in one request, because the backend has no separate
    upload endpoint.
  */
  const isForm = body instanceof FormData;

  const headers = {};
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    ...(body !== undefined ? { body: isForm ? body : JSON.stringify(body) } : {}),
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

    // No second argument: the new pair belongs wherever the old one lived.
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
    const err = toApiError(response, payload);
    if (isMembershipGone(err)) membershipGoneListeners.forEach((listener) => listener(err));
    throw err;
  }

  return payload.data;
}

/*
  The school is no longer this session's — told once, to whoever is listening.

  `requireActiveMembership` reads the database on every request (backend
  `7a91eaf`), so somebody removed, who left on another device, or whose school
  was switched off is refused at once with 403 "You are not an active member of
  any school", while their token still names the school for up to 15 minutes.
  Every screen used to show that as its own error panel. Now the signed-in shell
  listens (MembershipGoneWatcher) and takes them to /select-role, which says
  what happened.

  The same 403 comes from a token that names no school yet — somebody approved
  since sign-in. /select-role trades that token in and sends them back, so the
  one listener heals both.

  Matched on the sentence, the only thing that tells it apart from a role check's
  FORBIDDEN; the code is shared (`shared/auth.js` requireActiveMembership).
*/
const membershipGoneListeners = new Set();

export const isMembershipGone = (err) =>
  err?.status === 403 && /not an active member/i.test(String(err?.message ?? ''));

/** Subscribe; returns the unsubscribe. */
export function onMembershipGone(listener) {
  membershipGoneListeners.add(listener);
  return () => membershipGoneListeners.delete(listener);
}

/**
 * A route that has not been written yet, as opposed to a request that failed.
 *
 * Most of this app's endpoints do not exist: the backend mounts six namespaces
 * and the screens call far more than that. A screen that cannot tell the difference
 * has two bad options — a red panel that blames the reader for something nobody
 * did, or silence that reads as "there is nothing here".
 *
 * So a screen whose endpoint is missing says it is not available yet, and the
 * day the route lands the same code shows the data. Nothing has to be undone.
 *
 * Only 404. A 500 is a real failure and must stay loud.
 */
export const isNotBuiltYet = (err) => err?.status === 404;

/**
 * Fetch bytes rather than JSON, with the same session handling as `request`.
 *
 * One endpoint in this API does not speak the envelope: the KTP photo attached
 * to a school registration comes back as the image itself, so an admin's
 * browser can display it. `readBody` would run `JSON.parse` over a JPEG and
 * throw INVALID_RESPONSE.
 *
 * Everything else is deliberately identical — the bearer token comes from
 * `activeStore()`, and a 401 goes through the same single-flight refresh — so
 * this cannot drift into a second, weaker way of being signed in.
 *
 * The caller owns the Blob. For the KTP that matters: it is a photograph of
 * somebody's national ID, and whoever turns it into an object URL is
 * responsible for revoking it.
 *
 * @throws {ApiError} including 404 once the file has been deleted, which is
 *   what happens the moment a registration is decided.
 */
export async function requestBlob(path, options = {}) {
  const { retryOnUnauthorized = true, ...rest } = options;

  const fetchOnce = async () => {
    const headers = {};
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(buildUrl(path, rest.query), { method: 'GET', headers });
  };

  let response = await fetchOnce();

  if (response.status === 401 && retryOnUnauthorized && getRefreshToken()) {
    if (await refreshTokens()) response = await fetchOnce();
  }

  if (!response.ok) {
    /* An error body IS the envelope, even here — only success is raw bytes. */
    throw toApiError(response, await readBody(response).catch(() => null));
  }

  return response.blob();
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  /* PUT as well as PATCH: the screens ahead of the backend use PUT for whole
     replacements (/materials/:id, /notifications/:id/read, /protests/:id/review)
     while /users/me uses PATCH for a partial one. Both are in the contract. */
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  del: (path, options) => request(path, { ...options, method: 'DELETE' }),
};

export default api;
