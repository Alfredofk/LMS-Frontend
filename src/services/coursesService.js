import { api } from './apiClient';

/*
  Classes, their assignments and their materials.

  **None of these routes exist yet.** The backend mounts six namespaces — auth,
  users, the two halves of school registration, and the two halves of membership —
  and academics is not among them. Every call here answers 404 today, so callers
  pair it with `isNotBuiltYet` from ./apiClient and say so on screen rather than
  showing a failure nobody caused.

  Paths and field names are recorded in `docs/api-contract.md`, which is the
  document the backend is being written against. Two of its open questions land
  squarely on this file:

    - `course` here is the schema's **ClassSubject** (a class + a subject + a
      semester + the teacher who teaches it). If the API adopts that word, only
      the paths in this file change, not the fifty-four call sites.

    - the list currently answers `grade_level`, `student_count` and `teacher_id`
      in snake_case while Prisma produces camelCase. Whichever wins, this file
      is where the rename happens.

  That is the whole point of the indirection: a contract that is still being
  negotiated should touch one file, not sixteen.
*/
/*
  Only the reads are here. The six writes that used to sit alongside them —
  create, remove, createAssignment, createMaterial, updateMaterial,
  removeMaterial — had no callers: `CourseDetail` and `HeadmasterDashboard` do
  those with inline `fetch`, against the same paths. Two implementations of one
  call, one of them never run and therefore never corrected. Add them back the
  day those screens move onto this file, and not before.
*/
export const coursesService = {
  /** Every class the caller can see. Scope follows their role, not the path. */
  list: () => api.get('/courses'),

  get: (courseId) => api.get(`/courses/${courseId}`),


  students: (courseId) => api.get(`/courses/${courseId}/students`),

  assignments: (courseId) => api.get(`/courses/${courseId}/assignments`),


  materials: (courseId) => api.get(`/courses/${courseId}/materials`),

};

export default coursesService;
