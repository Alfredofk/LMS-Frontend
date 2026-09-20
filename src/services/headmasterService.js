import { api } from './apiClient';

/*
  The principal's roster: who teaches here, who studies here.

  **Mostly possible today.** `SchoolMembership`, `MembershipRole`,
  `TeacherProfile` and `StudentProfile` all exist, so the three listings and the
  counts need a router and nothing more. See `docs/api-contract.md`.

  **The two create calls need a decision before they are built, not after.**
  They post a `password` chosen by the principal, which contradicts the sign-up
  flow this app already has: register, verify your own address, choose your own
  password. The schema agrees with the flow rather than with these calls — a
  `SchoolMembership` carries `PENDING` and an `approvedAt`, which is the shape of
  an invitation, not of an account handed over ready-made. Written down here so
  that whoever implements it decides deliberately.

  `username` is read by the teacher table but does not exist on `User`, which has
  only `email` and `fullName`. Almost certainly a leftover, and the frontend's to
  delete.
*/
export const headmasterService = {
  /** @returns {Promise<{totalTeachers: number, totalStudents: number, totalCourses: number}>} */
  stats: () => api.get('/headmaster/stats'),

  teachers: {
    list: () => api.get('/headmaster/teachers'),
    create: ({ name, email, password, nip }) =>
      api.post('/headmaster/teachers', { name, email, password, nip }),
    remove: (id) => api.del(`/headmaster/teachers/${id}`),
  },

  students: {
    list: () => api.get('/headmaster/students'),
    create: ({ name, email, password, nis }) =>
      api.post('/headmaster/students', { name, email, password, nis }),
    remove: (id) => api.del(`/headmaster/students/${id}`),
  },
};

export default headmasterService;
