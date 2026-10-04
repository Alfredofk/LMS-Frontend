import { api, requestBlob } from './apiClient';

/*
  /api/content (backend bf6e9b5, teaching-and-learning ticket 04): what a teacher
  shares for one meeting. The teacher who answers for the meeting adds, edits,
  orders, publishes and deletes it (owner, 2026-10-04: the teacher's screens are
  ours now). A new one is a draft until published; only a published one reaches
  students. VIDEO and LINK take an https URL, TEXT sanitised HTML, FILE a
  multipart upload (pdf, jpg, png, docx, pptx; 10 MB) - content.schema.js.

  Who reads what is the server's (content.service.js `standingOf`): the
  Principal, a Vice Principal and the class's homeroom teacher read everything,
  drafts included; a student placed in the class NOW reads what is published.
  Anyone else, a student of a meeting from a class they left included, gets 404.
*/
export const contentService = {
  /**
   * `{ session: { id, number, status, cancelReason, startsAt, endsAt, class, subject },
   *    canManage, contents: [{ id, type, title, order, published, publishedAt, payload }] }`
   * (content.controller.js listForSession, a bare object). `payload` by type:
   * FILE { fileName, fileType, mimeType, size } · VIDEO { url, provider, videoId } ·
   * TEXT { html } (sanitised by the server) · LINK { url }.
   */
  listForSession: (sessionId) => api.get(`/content/sessions/${encodeURIComponent(sessionId)}`),

  /** A FILE's bytes, with the token: the route sits behind requireAuth. */
  file: (contentId) => requestBlob(`/content/${encodeURIComponent(contentId)}/file`),

  /** A VIDEO, LINK or TEXT draft: `{ type, title, url }` or `{ type: 'TEXT', title, html }`. */
  async create(sessionId, body) {
    const answer = await api.post(`/content/sessions/${encodeURIComponent(sessionId)}`, body);
    return answer?.content ?? null;
  },

  /** A FILE draft: the file under `file`, the title as a form field. */
  async upload(sessionId, file, title) {
    const form = new FormData();
    form.append('title', title);
    form.append('file', file);
    const answer = await api.post(`/content/sessions/${encodeURIComponent(sessionId)}/file`, form);
    return answer?.content ?? null;
  },

  /** `{ title?, url?, html? }` - a FILE's file is not replaced (delete it, add another). */
  async update(contentId, patch) {
    const answer = await api.patch(`/content/${encodeURIComponent(contentId)}`, patch);
    return answer?.content ?? null;
  },

  async publish(contentId) {
    const answer = await api.post(`/content/${encodeURIComponent(contentId)}/publish`);
    return answer?.content ?? null;
  },

  remove: (contentId) => api.del(`/content/${encodeURIComponent(contentId)}`),

  /** Every content of the meeting in its new order, each once. Answers the list again. */
  reorder: (sessionId, contentIds) => api.put(`/content/sessions/${encodeURIComponent(sessionId)}/order`, { contentIds }),
};

export default contentService;
