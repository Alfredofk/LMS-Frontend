import { ROLES, defaultRoleOf } from '../../constants/roles';

/*
  What /unauthorized offers (mockup akses-dialog.html, owner 2026-10-30): ProtectedRoute
  sends the page asked for and the roles it serves in `state`, so the page can open it
  as another role the reader holds, and name the page - but not to a student or a
  guardian, for whom an address like /teacher/courses says nothing.
*/

/** Roles that read no address on this page. */
const NO_ADDRESS = [ROLES.STUDENT, ROLES.GUARDIAN];

/**
 * `{ enterAs, page }`: the held role that may open the page asked for (the first in
 * ROLE_PRIORITY, never the one in use), or null; the page to name, or null.
 */
export function unauthorizedViewOf({ roles, activeRole, state }) {
  const allowed = Array.isArray(state?.allowedRoles) ? state.allowedRoles : [];
  const from = typeof state?.from === 'string' && state.from.startsWith('/') ? state.from : null;
  const enterAs = from ? defaultRoleOf((roles ?? []).filter((role) => role !== activeRole && allowed.includes(role))) : null;
  const page = from && !NO_ADDRESS.includes(activeRole) ? from : null;
  return { enterAs, page, from };
}
