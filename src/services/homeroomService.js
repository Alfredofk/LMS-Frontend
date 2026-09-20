import { api } from './apiClient';

/*
  The homeroom teacher's view of their own class.

  **Half of this is already possible.** `Class.homeroomTeacherMembershipId`
  exists in `schema.prisma`, so `class()` can be answered today; the per-student
  recap needs the grade and attendance models, which do not exist. See
  `docs/api-contract.md`.

  **One failure mode is worth designing around.** HomeroomDashboard treats an
  undefined `isHomeroomTeacher` as a definite "you are not a homeroom teacher"
  and shows an access-denied panel. So a response of the wrong *shape* does not
  look like a bug — it looks like a confident, wrong answer about the reader's
  own job. Of every endpoint in the contract, this is the one where getting the
  shape wrong is hardest to notice.
*/
export const homeroomService = {
  /** @returns {Promise<{isHomeroomTeacher: boolean, classInfo: {name: string}}>} */
  class: () => api.get('/homeroom/class'),

  students: () => api.get('/homeroom/students'),

  report: (studentId) => api.get(`/homeroom/student/${studentId}/report`),
};

export default homeroomService;
