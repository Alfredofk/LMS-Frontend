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

  **Classes exist now (backend `36476f3`, /headmaster/classes), and that changes
  what reaches this screen.** A teacher named homeroom of a class has that grade in
  scope, so STUDENT requests for it appear in their queue with `canRelease`.
  Releasing one needs a `classId` (`resolveTargetClass` refuses without one);
  `JoinRequestReview` asks for it, from `GET /api/academics/classes`, and
  `approve` below sends it.

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
    writing the day that response says something the list does not. (The
    reviewer's classes, which it once seemed it might, come from
    `GET /api/academics/classes` instead.)
  */

  /**
   * Release the roles this reviewer may release.
   *
   * `classId` is required only when a STUDENT role is being released: it is
   * the class the student is placed in. It must be one the reviewer is homeroom
   * teacher of, at the grade the student asked for (`resolveTargetClass`).
   * `JoinRequestReview` offers exactly those, from `academicsService.classes()`.
   * Sent only when given — a TEACHER or GUARDIAN release takes no body at all.
   *
   * @throws {ApiError} CONFLICT if another reviewer decided it first,
   *   BAD_REQUEST for a student with no class or a class at another grade,
   *   NOT_FOUND for a class that is not this reviewer's
   */
  approve: (id, classId) => api.post(`${BASE}/${id}/approve`, classId ? { classId } : {}),

  /**
   * Release several at once — `POST /membership-requests/approve`.
   *
   * At most 50 ids, one optional `classId` for all of them; each id is approved
   * in its own transaction, so one refusal never costs the others. Answers
   * `{ results: [{ id, ok, status } | { id, ok: false, error: { code, message } }],
   * summary: { released, failed } }` — a 200 even when some failed.
   * `views/Requests/bulk.js` groups and chunks the calls.
   */
  approveMany: (ids, classId) => api.post(`${BASE}/approve`, classId ? { ids, classId } : { ids }),

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
