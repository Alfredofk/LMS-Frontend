import { api } from './apiClient';

/*
  Classes, their assignments and their materials.

  **None of these routes exist yet** — the backend mounts /auth, /users and
  /school-registrations, and nothing else. Every call here answers 404 today, so
  callers pair it with `isNotBuiltYet` from ./apiClient and say so on screen
  rather than showing a failure nobody caused.

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
export const coursesService = {
  /** Every class the caller can see. Scope follows their role, not the path. */
  list: () => api.get('/courses'),

  get: (courseId) => api.get(`/courses/${courseId}`),

  create: ({ code, name, description, grade_level, teacher_id }) =>
    api.post('/courses', { code, name, description, grade_level, teacher_id }),

  remove: (courseId) => api.del(`/courses/${courseId}`),

  students: (courseId) => api.get(`/courses/${courseId}/students`),

  assignments: (courseId) => api.get(`/courses/${courseId}/assignments`),

  createAssignment: (courseId, { title, description, deadline }) =>
    api.post(`/courses/${courseId}/assignments`, { title, description, deadline }),

  materials: (courseId) => api.get(`/courses/${courseId}/materials`),

  /*
    `size` is a human string like "2.4 MB", not a number, and the actual file is
    never sent: the picker demands one and CourseDetail drops it. There is no
    upload endpoint to send it to yet. When one exists this becomes a FormData
    call — apiClient already passes those through untouched, as the KTP upload
    proves — and the string goes away.
  */
  createMaterial: (courseId, { title, description, size }) =>
    api.post(`/courses/${courseId}/materials`, { title, description, size }),

  updateMaterial: (materialId, { title, description }) =>
    api.put(`/materials/${materialId}`, { title, description }),

  removeMaterial: (materialId) => api.del(`/materials/${materialId}`),
};

export default coursesService;
