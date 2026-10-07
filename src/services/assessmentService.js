import { api, requestBlob } from './apiClient';

/*
  /api/assessments (backend ed46340, assessment ticket 01): the question bank. Only
  the bank exists so far - the Assessments that will draw on it are ticket 02.

  Staff only, and anyone else is answered 404, not 403 (requireRoleHidden). A
  teacher writes for a Subject x grade level they teach now and reads those plus
  their own; the Principal and Vice Principals read the whole bank. Only a
  question's author edits, archives or restores it. Whoever sees a question sees
  its answer key.

  A question (assessment.bank.js questionView):
  `{ id, subject: { id, code, name }, gradeLevel, kind, mcqScoring, body, imageId,
     options?: [{ id, text, imageId, correct }] (MCQ) | value (TF) | accepted (SHORT),
     author: { membershipId, fullName, left }, mine, canEdit, archived, archivedAt,
     duplicatedFromId, createdAt, updatedAt }`.

  Images are uploaded first (JPG/PNG, 5 MB, field `image`) and named by id in the
  question; they are never deleted.
*/

const q = (id) => encodeURIComponent(id);

export const assessmentService = {
  /**
   * `{ subjectId?, gradeLevel?, kind?, mine?, archived? }` - live questions by
   * default, newest first; `archived: true` lists the archived ones instead.
   */
  async list({ archived = false, ...filters } = {}) {
    const query = { ...filters, ...(archived ? { archived: 'true' } : {}) };
    const answer = await api.get('/assessments/questions', { query });
    return answer?.questions ?? [];
  },

  async get(id) {
    const answer = await api.get(`/assessments/questions/${q(id)}`);
    return answer?.question ?? null;
  },

  /** A new question: the whole body of its kind, with `subjectId` and `gradeLevel`. */
  async create(body) {
    const answer = await api.post('/assessments/questions', body);
    return answer?.question ?? null;
  },

  /** The whole content again, its kind named; never its subject or grade level. */
  async update(id, body) {
    const answer = await api.put(`/assessments/questions/${q(id)}`, body);
    return answer?.question ?? null;
  },

  /** A copy owned by the caller; `gradeLevel` omitted keeps the original's. */
  async duplicate(id, gradeLevel) {
    const answer = await api.post(`/assessments/questions/${q(id)}/duplicate`, gradeLevel ? { gradeLevel } : {});
    return answer?.question ?? null;
  },

  async archive(id) {
    const answer = await api.post(`/assessments/questions/${q(id)}/archive`);
    return answer?.question ?? null;
  },

  async restore(id) {
    const answer = await api.post(`/assessments/questions/${q(id)}/restore`);
    return answer?.question ?? null;
  },

  /** `{ id, mimeType, size, createdAt }` of a JPG or PNG just uploaded. */
  async uploadImage(file) {
    const form = new FormData();
    form.append('image', file);
    const answer = await api.post('/assessments/questions/images', form);
    return answer?.image ?? null;
  },

  /**
   * An image's bytes, with the token: a saved question's through that question,
   * the caller's own fresh upload by its id alone.
   */
  imageBlob: ({ questionId = null, imageId }) =>
    requestBlob(
      questionId
        ? `/assessments/questions/${q(questionId)}/images/${q(imageId)}`
        : `/assessments/questions/images/${q(imageId)}`
    ),
};

export default assessmentService;
