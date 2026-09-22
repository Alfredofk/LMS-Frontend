import { api } from './apiClient';

const BASE = '/membership-requests';

/*
  Joining a school that already exists: the reviewer's half of it.

  A separate service from `membershipService.js` on purpose, mirroring the split
  the backend makes. The applicant's routes sit behind `requireAuth` and nothing
  else, because the caller is precisely somebody who holds no membership yet;
  these sit behind `requireAuth, requireActiveMembership, requireRole('PRINCIPAL',
  'TEACHER')`, because the caller has to already be somebody inside the school.
  One file could not honestly describe both.

  **This is what finally makes a dashboard reachable by an ordinary account.**
  Approving a school registration creates the first PRINCIPAL; releasing a join
  request is how everybody else gets an ACTIVE role. Until this screen existed,
  a request submitted through `JoinSchoolForm` had nowhere to be answered.

  ## Who may release what

  The backend decides, and says so per role in the response — see `canRelease`
  below. The rule it applies (`membership.service.js:410`):

    TEACHER  -> the Principal.
    STUDENT  -> a homeroom teacher of a class at the grade that was asked for.
    GUARDIAN -> the homeroom teacher of the class the claimed child sits in.

  **In practice only the first of those can happen today.** A homeroom teacher is
  a Teacher named on a Class, and classes cannot be created yet (ticket 07), so
  no reviewer has any grades in scope and student and guardian requests are
  visible to nobody. That is honest rather than broken, and it is why this screen
  does not collect a `classId`.

  A teacher who is neither Principal nor homeroom of anything gets an **empty
  list rather than a 403** — there is nothing for them to release, and nothing
  leaks either way. The screen has to read that as "nothing waiting", because it
  is what every ordinary teacher will see.
*/
export const membershipReviewService = {
  /**
   * One tab of the queue, oldest first.
   *
   * The three statuses are **membership** statuses, not the school
   * registration's — PENDING is waiting, ACTIVE is released, REJECTED was turned
   * down. They happen to be three words like the admin queue's, and they are not
   * the same three words.
   *
   * @param {'PENDING'|'ACTIVE'|'REJECTED'} status
   * @returns {Promise<{ requests: Array<object> }>}
   */
  list: (status = 'PENDING') => api.get(BASE, { query: { status } }),

  /*
    `GET /:id` is deliberately absent. The queue already carries every field the
    review panel shows, including `canRelease` per role, so fetching one request
    again would be a second round trip for data already in hand. It becomes worth
    writing the day that response says something the list does not — the reviewer
    classes a student approval needs, for one.
  */

  /**
   * Release the roles this reviewer may release.
   *
   * `classId` is required only when a STUDENT role is being released, and
   * **nothing in this app can supply one**: the reviewer's classes are computed
   * server-side (`membership.service.js:377`) and never sent back, and there is
   * no `/api/classes`. It is accepted here so the call is shaped correctly the
   * day that changes; until then a student approval answers 400 `Choose the
   * class this student joins`, which the screen shows as it arrives rather than
   * swallowing.
   *
   * @throws {ApiError} CONFLICT if another reviewer decided it first,
   *   BAD_REQUEST for a student with no class
   */
  approve: (id, classId) => api.post(`${BASE}/${id}/approve`, classId ? { classId } : {}),

  /**
   * `reason` is required despite the zod schema marking it optional — the same
   * arrangement the admin queue has, and for the same reason: `approval.js` owns
   * the "at least 3 characters" rule so that every rejection in the system
   * refuses with one message.
   *
   * @throws {ApiError} BAD_REQUEST on a missing or too-short reason,
   *   CONFLICT if it was already decided
   */
  reject: (id, reason) => api.post(`${BASE}/${id}/reject`, { reason }),

  /*
    Deliberately absent: `POST /membership-requests/approve`, which releases up
    to fifty at once and answers 200 even when some of them failed, with a result
    per id. It needs checkboxes, a select-all, and a way to report a mixed
    outcome — a screen of its own for a situation that only arises once a queue
    has dozens in it. Add it when one does.
  */
};

export default membershipReviewService;
