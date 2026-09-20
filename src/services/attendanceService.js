import { api } from './apiClient';

/*
  Attendance, from both ends: a student marking themselves present, and a
  teacher marking a whole class.

  **No route and no table** — `schema.prisma` has nothing for attendance. See
  `docs/api-contract.md`.

  Two things here fail quietly if they are got wrong, so they are written down
  rather than left to be discovered:

  **`history[].date` must be `YYYY-MM-DD`, not an ISO timestamp.** The calendar
  in AttendancePage matches it with `===` against a key it builds locally. An ISO
  datetime never matches, so every day renders blank — no error, no clue.

  **The status vocabulary is Indonesian** — `Hadir`, `Izin`, `Sakit`, `Alpa` —
  used as identifiers rather than as labels, and the summary counters are named
  after them too. The contract proposes English constants translated in `i18n/`,
  which is what every other enum in this app already does. Until that is settled
  these stay as the screens expect.
*/
export const attendanceService = {
  student: {
    /** Every class at once, for the attendance page. */
    summary: () => api.get('/attendance/student/summary'),

    /** One class, for the panel inside a classroom. */
    forCourse: (courseId) => api.get(`/attendance/student/${courseId}`),

    checkIn: (courseId) => api.post(`/attendance/student/${courseId}/checkin`),

    /** @param {{status: 'Izin'|'Sakit', notes: string}} reason */
    excuse: (courseId, { status, notes }) =>
      api.post(`/attendance/student/${courseId}/excuse`, { status, notes }),
  },

  teacher: {
    /** @param {string} date `YYYY-MM-DD` */
    forCourse: (courseId, date) =>
      api.get(`/attendance/teacher/${courseId}`, { query: { date } }),

    /**
     * @param {object} payload
     * @param {string} payload.date  `YYYY-MM-DD`
     * @param {Array<{studentId: string, status: string, notes: string}>} payload.attendances
     */
    save: (courseId, { date, attendances }) =>
      api.post(`/attendance/teacher/${courseId}/save`, { date, attendances }),
  },
};

export default attendanceService;
