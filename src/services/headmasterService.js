import { api } from './apiClient';

/*
  The principal dashboard's three counts — the one call left here.

  The roster calls that used to sit beside it (`/headmaster/teachers`,
  `/headmaster/students`, list, create, remove) were never written on the
  backend, and the app no longer asks for them: the school's people come from
  `/api/members` (membersService), on /headmaster/members. Creating an account
  with a password the principal chose was never how anybody gets in here —
  people register, verify their own address, and ask to join.

  `/headmaster/stats` still 404s; the dashboard shows labelled sample numbers.
*/
export const headmasterService = {
  /** @returns {Promise<{totalTeachers: number, totalStudents: number, totalCourses: number}>} */
  stats: () => api.get('/headmaster/stats'),
};

export default headmasterService;
