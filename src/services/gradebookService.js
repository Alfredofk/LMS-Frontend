import { api } from './apiClient';

/*
  A student's grades, and their appeals against them - the two reads
  StudentScores makes.

  **No route here exists, and neither does the table.** `schema.prisma` has no
  model for an assignment, a submission, a grade or an appeal - this domain is
  waiting on database design, not just on a router. See `docs/api-contract.md`.
  Both calls 404 today, and the screen shows "not available yet" (isNotBuiltYet).

  One shape is worth knowing before reading the caller: a student's grades
  arrive as a **map keyed by assignment id**, not an array -

      { grades: { asg_1: 88, asg_2: null } }

  and `null` means "not marked yet", which is not the same as zero.

  The teacher's marking sheet, the teacher's appeal queue and reviewing an
  appeal were defined here on a guessed contract and never called; they were
  removed on 2026-10-07. Write them again against the real routes.
*/
export const gradebookService = {
  /** Every class the signed-in student takes, with their marks in each. */
  studentSummary: () => api.get('/gradebook/student/summary'),

  protests: {
    mine: () => api.get('/protests/student'),
  },
};

export default gradebookService;
