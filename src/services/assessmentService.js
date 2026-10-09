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
     privateUntil ('YYYY-MM-DD' | null, backend abbb3d5), duplicatedFromId, createdAt, updatedAt }`.

  Images are uploaded first (JPG/PNG, 5 MB, field `image`) and named by id in the
  question; they are never deleted.

  Assessments (backend 0bb4598, ticket 02), on a ClassSubject. Managed by its
  answering teacher; its homeroom teacher, the Principal and Vice Principals read
  (writes 403). assessment.service.js assessmentView:
  `{ id, classSubject: { id, class: { id, name, gradeLevel, academicYear }, subject,
     semester: { id, ordinal }, ended }, type: TUGAS|KUIS|UTS|UAS, mode: ONLINE|OFFLINE,
     title, instructions, opensAt, closesAt, settings: { maxAttempts, acceptLate,
     timeLimitMinutes, shuffleQuestions, shuffleOptions, showKeyOnRelease } | null,
     status: DRAFT|PUBLISHED|CANCELLED, publishedAt, cancelledAt, cancelReason,
     copiedFromId, questionCount, totalPoints, canManage, createdAt, updatedAt }`;
  one read alone adds `questions: [{ id, order, points, sourceQuestionId, ...the
  bank's content and key, bank: { changed, archived } | null }]`. Students answer
  through routes of their own (ticket 03, not built).
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

  /**
   * The whole content again, its kind named; never its subject or grade level.
   * `updatedAt` is the version the form was read at: one saved meanwhile answers
   * 409 rather than being overwritten (backend a6d9d7e, note #12).
   */
  async update(id, body, updatedAt) {
    const answer = await api.put(`/assessments/questions/${q(id)}`, { ...body, updatedAt });
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
  imageBlob: ({ questionId = null, assessmentId = null, imageId }) =>
    requestBlob(
      assessmentId
        ? `/assessments/${q(assessmentId)}/images/${q(imageId)}`
        : questionId
          ? `/assessments/questions/${q(questionId)}/images/${q(imageId)}`
          : `/assessments/questions/images/${q(imageId)}`
    ),

  // ---- Assessments ----

  /** Every Assessment of the class subject's slot, drafts included, earliest window first. */
  async listFor(classSubjectId) {
    const answer = await api.get(`/assessments/class-subjects/${q(classSubjectId)}`);
    return answer?.assessments ?? [];
  },

  /** `{ mode, type, title, instructions?, opensAt, closesAt, ...ONLINE settings }` -> the new one. */
  async createAssessment(classSubjectId, body) {
    const answer = await api.post(`/assessments/class-subjects/${q(classSubjectId)}`, body);
    return answer?.assessment ?? null;
  },

  /** One, with its questions and their keys. */
  async getAssessment(id) {
    const answer = await api.get(`/assessments/${q(id)}`);
    return answer?.assessment ?? null;
  },

  /*
   * The changes below send back the `updatedAt` last read: one changed since, in
   * another tab say, answers 409 (backend a6d9d7e, note #12).
   */

  /** Only what changed; never the mode. Answers the detail. */
  async updateAssessment(id, patch, updatedAt) {
    const answer = await api.patch(`/assessments/${q(id)}`, { ...patch, updatedAt });
    return answer?.assessment ?? null;
  },

  /** The whole list, in order: `[{ id, points } | { questionId, points }]`. Answers the detail. */
  async replaceQuestions(id, questions, updatedAt) {
    const answer = await api.put(`/assessments/${q(id)}/questions`, { questions, updatedAt });
    return answer?.assessment ?? null;
  },

  /**
   * One copy edited in place (backend 6380e3e): `copyPayload`'s content. Only the
   * copy changes, never the bank question. Published with answers in, a change
   * to what students see voids them, to the key re-marks them. Answers the detail.
   */
  async editCopy(id, questionId, content, updatedAt) {
    const answer = await api.put(`/assessments/${q(id)}/questions/${q(questionId)}`, { ...content, updatedAt });
    return answer?.assessment ?? null;
  },

  async publish(id, updatedAt) {
    const answer = await api.post(`/assessments/${q(id)}/publish`, { updatedAt });
    return answer?.assessment ?? null;
  },

  async cancel(id, reason) {
    const answer = await api.post(`/assessments/${q(id)}/cancel`, { reason });
    return answer?.assessment ?? null;
  },

  /**
   * What the teacher may copy into this class subject (backend 0bb4598/abbb3d5):
   * their own of any semester, and anyone's of a semester that is over, of its
   * subject and grade - not its own slot's. Each carries `canManage`.
   */
  async copySources(classSubjectId) {
    const answer = await api.get(`/assessments/class-subjects/${q(classSubjectId)}/copy-sources`);
    return answer?.assessments ?? [];
  },

  /** `{ classSubjectIds, opensAt?, closesAt? }` -> the drafts made, one per target, each a detail. */
  async copy(id, body) {
    const answer = await api.post(`/assessments/${q(id)}/copies`, body);
    return answer?.assessments ?? [];
  },

  /** A draft only. */
  async removeAssessment(id) {
    await api.del(`/assessments/${q(id)}`);
  },
};

export default assessmentService;
