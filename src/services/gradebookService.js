import { api } from './apiClient';

/*
  Grades, and the appeals against them.

  **No route here exists, and neither does the table.** `schema.prisma` has no
  model for an assignment, a submission, a grade or an appeal — so unlike
  classes and notifications, this domain is waiting on database design, not just
  on a router. See `docs/api-contract.md`.

  One shape is worth knowing before reading any caller: a student's grades
  arrive as a **map keyed by assignment id**, not an array —

      { grades: { asg_1: 88, asg_2: null } }

  and `null` means "not marked yet", which is not the same as zero. Several
  screens branch on exactly that difference.
*/
export const gradebookService = {
  /** One class's full marking sheet: its assignments and every student's row. */
  forCourse: (courseId) => api.get(`/gradebook/${courseId}`),


  /** Every class the signed-in student takes, with their marks in each. */
  studentSummary: () => api.get('/gradebook/student/summary'),

  protests: {
    mine: () => api.get('/protests/student'),

    forTeacher: () => api.get('/protests/teacher'),

    /*
      `submissionId` is ambiguous in the caller as it stands: StudentScores falls
      back to the *assignment* id when no submission id is at hand, so the server
      would be handed two different kinds of identifier in one field and could
      not tell them apart. Flagged in the contract; fix belongs in the screen,
      once the backend says which it wants.
    */
    raise: ({ submissionId, assignmentId, reason, requestedGrade }) =>
      api.post('/protests', { submissionId, assignmentId, reason, requestedGrade }),

    review: (protestId, { status, teacher_feedback }) =>
      api.put(`/protests/${protestId}/review`, { status, teacher_feedback }),
  },
};

export default gradebookService;
