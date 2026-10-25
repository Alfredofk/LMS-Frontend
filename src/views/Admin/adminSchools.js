/*
  What the Platform Admin's list of every School decides (backend ed0d304,
  school.schema.js `schoolListQuery`, school.service.js `listSchools`), kept out of
  the markup so it can be tested.

  The owner's filters (2026-10-25): one search box (name, NPSN, city, subdomain),
  live or switched off, and the order. `governed` and `governingBodyId` exist on the
  server and are not offered. `deactivated` travels as the text 'true' / 'false',
  since a query string carries text (`trueOrFalse` on the server).
*/

/** The server's default page, as the registration queue uses. */
export const SCHOOLS_PAGE = 50;

export const SCHOOL_STATES = ['ALL', 'ON', 'OFF'];
export const SCHOOL_SORTS = ['name', 'newest', 'oldest'];

/** The query of one page: only what carries a value. */
export function schoolsQueryOf({ needle = '', state = 'ALL', sort = 'name', offset = 0 } = {}) {
  const query = { sort, limit: SCHOOLS_PAGE, offset };
  const q = String(needle).trim();
  if (q) query.q = q.slice(0, 100);
  if (state === 'ON') query.deactivated = 'false';
  if (state === 'OFF') query.deactivated = 'true';
  return query;
}

/**
 * A further page after the ones shown. A school created or switched between two
 * pages slides the rest by one, so a row already shown is not added twice.
 */
export function withPage(shown, page) {
  const seen = new Set(shown.map((school) => school.id));
  return [...shown, ...page.filter((school) => !seen.has(school.id))];
}

/** One School replaced by its newer self, as after a change of address. */
export const withSchool = (rows, school) => rows.map((row) => (row.id === school.id ? { ...row, ...school } : row));

/**
 * Where "Lihat pendaftaran" goes: the queue's approved tab, searched by the NPSN and
 * that registration opened (AdminRegistrationsPage reads `state.open`). Null for a
 * Governing Body's School, which has no registration.
 */
export function registrationLinkOf(school) {
  if (!school?.registrationId) return null;
  return { pathname: '/admin/school-registrations', state: { open: { id: school.registrationId, status: 'APPROVED', q: school.npsn } } };
}
