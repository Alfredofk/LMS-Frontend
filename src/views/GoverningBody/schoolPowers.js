/*
  What a Governing Body's admins change in one of its Schools (backend 261a9c7 and
  fdf0267, governing-body ticket 08; owner 2026-10-26, E1-E8), kept out of the markup so
  it can be tested.

  - The Principal is the body's to make, from the School's ACTIVE Teachers (the teacher
    list, ticket 07, by `membershipId`), or to end with no successor. The one before stays
    if they hold another role, else leaves the School (ADR-0008). The teacher list holds
    only those holding TEACHER, so a Principal on it stays as a teacher; one not on it
    leaves unless they hold a role the body never reads (a guardian's).
  - The body switches its School off and on, except a Platform Admin's deactivation (409):
    the School's row does not say whose it is, so a refusal hides "Aktifkan kembali" for
    the visit.
  - It lets the School go only while a Principal sits.
*/

/** The Teachers who may be made Principal: every one but the Principal sitting. */
export const successorsOf = (teachers) => (Array.isArray(teachers) ? teachers : []).filter((teacher) => !(teacher.roles ?? []).includes('PRINCIPAL'));

/**
 * What becomes of the Principal sitting when replaced or ended: 'STAYS' (a teacher too)
 * or 'MAY_LEAVE' (not on the teacher list), with their name; null when none sits.
 */
export function principalFateOf(school, teachers) {
  if (!school?.hasPrincipal) return null;
  const onList = (Array.isArray(teachers) ? teachers : []).find((teacher) => (teacher.roles ?? []).includes('PRINCIPAL'));
  return { name: onList?.fullName ?? school.principal?.fullName ?? '', fate: onList ? 'STAYS' : 'MAY_LEAVE' };
}

/** Which of the "Kelola sekolah" buttons a School offers; `braked` once a reactivation was refused for the Platform Admin's. */
export function manageActionsOf(school, { braked = false } = {}) {
  const headed = Boolean(school?.hasPrincipal);
  const off = Boolean(school?.deactivatedAt);
  return {
    appoint: headed ? 'REPLACE' : 'APPOINT',
    end: headed,
    deactivate: !off,
    reactivate: off && !braked,
    braked: off && braked,
    release: headed,
  };
}
