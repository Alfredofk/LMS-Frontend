import { api } from './apiClient';

/*
  Learning events - backend a9ed505 (teaching-and-learning ticket 05), mounted at
  `/api/tracking`. A student's own only (`requireRole('STUDENT')`); staff reading
  content is not tracked.

  POST /events { events: [...] } (1-50) answers 200 always, with one result per
  event: `{ results: [{ index, ok, recorded? , error? }], summary: { recorded,
  notRecorded, refused } }`. A refused event (a draft, another class's content, a
  verb that does not fit the type, a time over a day old or 5 min ahead) is dropped,
  not retried. A whole batch fails only on its shape (400) or on the network.

  The verbs a client may send (tracking.schema.js), each with `contentId` and an
  optional `occurredAt` (ISO):
    content.opened · content.text_read_to_end · content.link_clicked ·
    content.video_progressed { position, duration } (seconds, YouTube only)
  A file's download is recorded by the server itself (content.file_downloaded).

  GET /me/progress (backend 0dd8b44, ticket 06; STUDENT) answers the student's own
  row per subject of their class: `{ class, classSubjects: [...] }` - see
  views/Classroom/myProgress.js. GET /class-subjects/:id/progress (PRINCIPAL,
  VICE_PRINCIPAL, TEACHER; 404 to anyone it does not concern) answers one
  subject's per student and per material - see views/Subjects/SubjectProgress.jsx.
*/
export const trackingService = {
  /** @param {Array<object>} events at most 50 @param {{ keepalive?: boolean }} [options] */
  async send(events, { keepalive = false } = {}) {
    return api.post('/tracking/events', { events }, { keepalive });
  },

  /** The student's own progress, per subject of their class now. */
  async myProgress() {
    const answer = await api.get('/tracking/me/progress');
    return { class: answer?.class ?? null, classSubjects: answer?.classSubjects ?? [] };
  },

  /** One subject's progress per student and per material, for its staff. */
  async classSubjectProgress(classSubjectId) {
    const answer = await api.get(`/tracking/class-subjects/${encodeURIComponent(classSubjectId)}/progress`);
    return { ...answer, contents: answer?.contents ?? [], students: answer?.students ?? [] };
  },
};

export default trackingService;
