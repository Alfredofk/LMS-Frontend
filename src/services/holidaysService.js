import { api } from './apiClient';

/*
  Holidays — backend `9dee2e2` (teaching-and-learning ticket 08). Two calendars,
  kept by two different people.

  **The school's** (`/api/holidays`), read by every ACTIVE member:
    GET ?year=  → { observesJointLeave, national: [...], school: [...] } — not
                  wrapped, the service's own object.
      national  { id, date, name, kind: NATIONAL|JOINT_LEAVE, observed, choice }
                CONFIRMED days only. `observed` is whether the school is off that
                day; `choice` is this school's pick for a joint-leave day —
                true / false, or null for "the school's default".
      school    { id, startDate, endDate, name, withdrawnAt } — standing ones.
      examWeeks { id, semesterId, type: UTS|UAS, name, startDate, endDate,
                  gradeLevels: number[], withdrawnAt } — standing ones (backend
                  `cbec3b6`, ticket 13). No holiday: only those grade levels stop
                  teaching, and a UTS/UAS of theirs is published inside one.
  The Principal adds and withdraws the school's own days, and says whether joint
  leave is observed — by default, and day by day.

  **The Platform Admin's** (`/api/admin/holidays`): the national holidays and
  joint leave for a year, fetched as DRAFTS from an unofficial community source
  (there is no government API — the SKB 3 Menteri is a document), checked, then
  confirmed. Only CONFIRMED days reach any school.

  Dates are calendar days, 'YYYY-MM-DD', the same across WIB, WITA and WIT.
*/
export const holidaysService = {
  /** @param {number} year 2020–2100 */
  calendar: (year) => api.get('/holidays', { query: { year } }),

  /** @param {{ startDate: string, endDate: string, name: string }} body at most 90 days */
  async addSchoolHoliday(body) {
    const answer = await api.post('/holidays/school', body);
    return answer?.holiday ?? null;
  },

  async withdrawSchoolHoliday(id) {
    const answer = await api.post(`/holidays/school/${encodeURIComponent(id)}/withdraw`);
    return answer?.holiday ?? null;
  },

  /** The school's default for every joint-leave day. Answers `{ observesJointLeave }`. */
  setJointLeave: (observesJointLeave) => api.patch('/holidays/joint-leave', { observesJointLeave }),

  /**
   * One joint-leave day: true (off), false (in school), null (back to the default).
   * `id` is the national holiday's, as the calendar lists it. Answers `{ day }`.
   */
  async setJointLeaveDay(id, observed) {
    const answer = await api.put(`/holidays/joint-leave/${encodeURIComponent(id)}`, { observed });
    return answer?.day ?? null;
  },

  /* ---- Exam Weeks (backend cbec3b6, ticket 13) ----
     Set and withdrawn by the Principal or a Vice Principal, never edited. Set in an
     OPEN or FINALIZING semester of an ACTIVE year, its days inside the semester, at
     most 31, and never overlapping another standing on a shared grade level (409). */

  /** A semester's standing ones, oldest first. */
  async examWeeks(semesterId) {
    const answer = await api.get('/holidays/exam-weeks', { query: { semesterId } });
    return answer?.examWeeks ?? [];
  },

  /** @param {{ semesterId: string, type: 'UTS'|'UAS', name: string, startDate: string, endDate: string, gradeLevels: number[] }} body */
  async addExamWeek(body) {
    const answer = await api.post('/holidays/exam-weeks', body);
    return answer?.examWeek ?? null;
  },

  async withdrawExamWeek(id) {
    const answer = await api.post(`/holidays/exam-weeks/${encodeURIComponent(id)}/withdraw`);
    return answer?.examWeek ?? null;
  },

  /* ---- the Platform Admin's national calendar ---- */

  /** Every status for the year — drafts waiting, confirmed, withdrawn. */
  async listNational(year) {
    const answer = await api.get('/admin/holidays', { query: { year } });
    return answer?.holidays ?? [];
  },

  /**
   * Fetch the year's days from the community source as DRAFTS. Answers
   * `{ fetched, added, holidays, message }`; 502 HOLIDAY_SOURCE_FAILED when the
   * source is down or answers nonsense.
   */
  fetchDrafts: (year) => api.post('/admin/holidays/fetch', { year }),

  /** Added by hand: CONFIRMED at once, since the admin is the one checking. */
  async addNational(body) {
    const answer = await api.post('/admin/holidays', body);
    return answer?.holiday ?? null;
  },

  /** A DRAFT only; a confirmed day is withdrawn and added again instead. */
  async updateDraft(id, changes) {
    const answer = await api.patch(`/admin/holidays/${encodeURIComponent(id)}`, changes);
    return answer?.holiday ?? null;
  },

  /** At most 100. Answers `{ confirmed, skipped }`. */
  confirm: (ids) => api.post('/admin/holidays/confirm', { ids }),

  async withdrawNational(id) {
    const answer = await api.post(`/admin/holidays/${encodeURIComponent(id)}/withdraw`);
    return answer?.holiday ?? null;
  },
};

export default holidaysService;
