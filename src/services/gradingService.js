import { api } from './apiClient';

/*
  /api/grading (backend 5d42af6, grading-and-report-card ticket 01): grade
  settings only - the Final Grade and the report card are ticket 02 and later.

  A read (grading.service.js settingsView):
  `{ weights: { value: { TUGAS, KUIS, UTS, UAS }, source },
     kktp: { value, source }, remedialRule: { value, source }, updatedAt | null }`,
  source SLOT | SCHOOL | BUILT_IN. Every write sends back the `updatedAt` it read
  (null before the first save); a stale one is 409, none on an existing row 400.
  Each answers `{ settings, message }` (grading.controller.js), unwrapped here.

  - The school's: read by its staff (Principal, Vice Principal, Teacher); set by
    the Principal or a Vice Principal (403 otherwise), audited.
  - A slot's (Class x Subject x Semester, named by any of its ClassSubjects): read
    by its answering teacher, the Principal, Vice Principals and the class's
    homeroom teacher (404 for anyone else, a student included); set or cleared by
    its answering teacher only (403), never in a CLOSED semester or a closed year
    (409).
*/

const q = (id) => encodeURIComponent(id);

export const gradingService = {
  async schoolSettings() {
    const answer = await api.get('/grading/settings');
    return answer?.settings ?? null;
  },

  /** `{ weights?, kktp?, remedialRule?, updatedAt }` - at least one change. */
  async setSchoolSettings(body) {
    const answer = await api.put('/grading/settings', body);
    return answer?.settings ?? null;
  },

  async slotSettings(classSubjectId) {
    const answer = await api.get(`/grading/class-subjects/${q(classSubjectId)}/settings`);
    return answer?.settings ?? null;
  },

  /** `{ weights?: {...} | null, kktp?: number | null, updatedAt }` - null puts that one back to the school's. */
  async setSlotSettings(classSubjectId, body) {
    const answer = await api.put(`/grading/class-subjects/${q(classSubjectId)}/settings`, body);
    return answer?.settings ?? null;
  },

  /** Back to the school's settings, all of them. */
  async clearSlotSettings(classSubjectId, updatedAt) {
    const answer = await api.del(`/grading/class-subjects/${q(classSubjectId)}/settings`, { body: { updatedAt: updatedAt ?? null } });
    return answer?.settings ?? null;
  },
};

export default gradingService;
