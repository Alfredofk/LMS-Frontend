import { api } from './apiClient';

/*
  The teacher dashboard's own numbers, and the student task list that faces them.

  **Partly possible today.** `totalClasses` and `totalStudents` can be counted
  from `ClassSubject` and `ClassMembership`, which exist. `pendingGrading`,
  recent submissions and the assessment list all need the grade and submission
  models, which do not. See `docs/api-contract.md`.

  `xpReward` on an assessment has nothing behind it anywhere: there is no `Xp`,
  `Badge`, `Level` or `Streak` model in the schema. Whether gamification is in
  scope at all is still an open question, not a missing endpoint.
*/
export const teacherService = {
  /** @returns {Promise<{totalClasses: number, totalStudents: number, pendingGrading: number}>} */
  stats: () => api.get('/teacher/stats'),

  recentSubmissions: () => api.get('/teacher/recent-submissions'),
};


export default teacherService;
