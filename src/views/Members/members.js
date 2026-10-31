import { ROLES } from '../../constants/roles';

/*
  The order of the "All" tab on /headmaster/members (owner, 2026-10-07): by role,
  leaders first, then A-Z by name. Plain A-Z (the backend's own order,
  `orderBy: { user: { fullName: 'asc' } }`) put one teacher among hundreds of
  students and the Principal somewhere in the middle. A member with several roles
  sits under the highest one. The one-role tabs stay A-Z.
*/

export const ROLE_RANK = [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.TEACHER, ROLES.STUDENT, ROLES.GUARDIAN];

/** The member's highest role, as an index into ROLE_RANK; unknown roles last. */
export const roleRankOf = (member) => {
  const ranks = (member?.roles ?? []).map((role) => ROLE_RANK.indexOf(role)).filter((rank) => rank >= 0);
  return ranks.length ? Math.min(...ranks) : ROLE_RANK.length;
};

const byName = (a, b) => String(a.fullName ?? '').localeCompare(String(b.fullName ?? ''), 'id', { sensitivity: 'base' });

/** A new array: highest role first, then name, then id so equal names keep one order. */
export const sortByRole = (members) =>
  [...(members ?? [])].sort(
    (a, b) =>
      roleRankOf(a) - roleRankOf(b) || byName(a, b) || String(a.membershipId ?? '').localeCompare(String(b.membershipId ?? ''))
  );

/**
 * The "All" tab's members, already in sortByRole's order, cut into one group per
 * highest role (owner, 2026-10-31): [{ role, members }]. A member whose roles are
 * all unknown falls in a group with role null, last.
 */
export const roleGroupsOf = (sorted) => {
  const groups = [];
  for (const member of sorted ?? []) {
    const role = ROLE_RANK[roleRankOf(member)] ?? null;
    const last = groups[groups.length - 1];
    if (last && last.role === role) last.members.push(member);
    else groups.push({ role, members: [member] });
  }
  return groups;
};
