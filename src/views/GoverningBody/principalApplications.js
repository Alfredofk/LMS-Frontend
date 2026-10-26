import { SCHOOL_HAS_PRINCIPAL } from '../Role/principalApplication';

/*
  A Governing Body's admins deciding who heads its Schools (backend e206bd9,
  governing-body ticket 06; owner 2026-10-26, B1-B9), kept out of the markup so it can
  be tested.

  - The body's list carries `principalApplicationsWaiting` per School (f01cd28); there is
    no list across Schools, so the Schools tab sums the rows.
  - A School's applications are read one School at a time, PENDING by default, oldest
    first. Approving one makes its applicant the Principal and rejects every other one
    still waiting there with the fixed reason SCHOOL_HAS_PRINCIPAL, decided by the same
    admin - said as closed on its own, not as somebody's verdict.
*/

/** How many applications wait across the body's Schools, and at how many Schools. */
export function waitingSummary(schools) {
  let applications = 0;
  let at = 0;
  for (const school of Array.isArray(schools) ? schools : []) {
    const waiting = Number(school?.principalApplicationsWaiting) || 0;
    if (waiting > 0) {
      applications += waiting;
      at += 1;
    }
  }
  return { applications, schools: at };
}

/** The applications still waiting there besides `id`: those an approval closes on its own. */
export const othersWaiting = (applications, id) => (Array.isArray(applications) ? applications : []).filter((row) => row.status === 'PENDING' && row.id !== id).length;

/**
 * What a decided application says: 'APPROVED', 'REJECTED' with the admin's reason,
 * 'CLOSED' when another applicant was approved, or 'CANCELLED' by its applicant; with
 * who decided and when. A waiting one is 'WAITING'.
 */
export function outcomeOf(application) {
  const by = application?.decidedBy?.fullName ?? null;
  const at = application?.decidedAt ?? null;
  switch (application?.status) {
    case 'PENDING':
      return { state: 'WAITING', by: null, at: null, reason: null };
    case 'APPROVED':
      return { state: 'APPROVED', by, at, reason: null };
    case 'REJECTED':
      return application.rejectionReason === SCHOOL_HAS_PRINCIPAL
        ? { state: 'CLOSED', by: null, at, reason: null }
        : { state: 'REJECTED', by, at, reason: application.rejectionReason ?? null };
    case 'CANCELLED':
      return { state: 'CANCELLED', by: null, at, reason: null };
    default:
      return { state: 'WAITING', by: null, at: null, reason: null };
  }
}
