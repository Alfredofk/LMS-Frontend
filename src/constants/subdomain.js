/*
  A school's own address (backend a577abd, governing-body ticket 02; owner 2026-10-22,
  decisions E1-E8). The backend keeps only the label (`school.subdomain`,
  `places[].subdomain`, e.g. "smabintangjayasupreme"); the base domain is this app's
  configuration, `VITE_BASE_DOMAIN` - "localhost" in development, giving
  smabintangjayasupreme.localhost:5173. Left empty, the feature is off and the app
  keeps one address, as before.

  The main domain is the front door - landing, sign-up, sign-in (Google too), choosing
  a school, the platform admin. A school's address signs in for that school only, and
  moving between schools carries the sign-in across with a one-time handoff code
  (`/handoff#code=...`). Pure, but for `ENV_BASE_DOMAIN`.
*/

/** The configured base domain, lower case with no leading dot; '' when the feature is off. */
export const ENV_BASE_DOMAIN = String(import.meta.env?.VITE_BASE_DOMAIN ?? '')
  .trim()
  .toLowerCase()
  .replace(/^\.+/, '');

/** A DNS label as the backend accepts one (school.schema.js SUBDOMAIN_PATTERN). */
export const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Words a school may never take (shared/subdomain.js RESERVED_SUBDOMAINS); the server refuses them too. */
export const RESERVED_SUBDOMAINS = ['www', 'api', 'admin', 'app', 'mail', 'auth', 'static', 'cdn', 'ftp', 'smtp', 'dev', 'staging', 'test', 'docs', 'help', 'support', 'status', 'login'];

/**
 * The school label of a hostname under the base domain: "sma1.localhost" -> "sma1";
 * the main domain itself, "www", another host or a deeper name -> null.
 */
export function subdomainOf(hostname, base = ENV_BASE_DOMAIN) {
  if (!base) return null;
  const host = String(hostname ?? '').toLowerCase();
  if (!host.endsWith(`.${base}`)) return null;
  const label = host.slice(0, -(base.length + 1));
  if (!label || label.includes('.') || label === 'www') return null;
  return label;
}

/** Whether school addresses are in use at all. */
export const subdomainsEnabled = (base = ENV_BASE_DOMAIN) => Boolean(base);

/** "https:" + "//" + host + port, for a host under the base domain. */
const originFor = (host, location) => `${location.protocol}//${host}${location.port ? `:${location.port}` : ''}`;

/** The address of a school's label, with a path and a fragment: `http://sma1.localhost:5173/handoff#code=...`. */
export function schoolUrl(label, path = '/', hash = '', location = window.location, base = ENV_BASE_DOMAIN) {
  return `${originFor(`${label}.${base}`, location)}${path}${hash ? `#${hash}` : ''}`;
}

/** The main domain's address, with a path. */
export function mainUrl(path = '/', location = window.location, base = ENV_BASE_DOMAIN) {
  return `${originFor(base, location)}${path}`;
}

/** A school's address as people read it, without the protocol: "sma1.localhost:5173". */
export function schoolAddressOf(label, location = window.location, base = ENV_BASE_DOMAIN) {
  if (!label || !base) return null;
  return `${label}.${base}${location.port ? `:${location.port}` : ''}`;
}

/** The handoff code in a fragment like `#code=abc`, or null. */
export function handoffCodeOf(hash) {
  const params = new URLSearchParams(String(hash ?? '').replace(/^#/, ''));
  const code = params.get('code');
  return code && code.trim() ? code.trim() : null;
}

/** Why a label typed by the platform admin cannot be sent, as a key, or null. */
export function subdomainLabelError(value, current = null) {
  const label = String(value ?? '').trim().toLowerCase();
  if (!label) return 'subdomain.error.required';
  if (!SUBDOMAIN_PATTERN.test(label)) return 'subdomain.error.pattern';
  if (RESERVED_SUBDOMAINS.includes(label)) return 'subdomain.error.reserved';
  if (current && label === current) return 'subdomain.error.same';
  return null;
}
