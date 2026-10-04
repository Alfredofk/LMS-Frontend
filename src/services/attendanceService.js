import { api } from './apiClient';

/*
  Attendance — backend `deb95e8` (teaching-and-learning ticket 03), mounted at
  `/api/attendance`.

  The student's own (`GET /me` → `{ attendance }`, one row per Session they have
  a record for, any Class at the school — see views/Attendance/attendance.js) and
  their check-in, to a Session found through `sessionsService.mine` (backend
  87f2670). For the Principal and Vice Principals a Session's roster and one
  record's changes. For the teacher who answers for a Session, confirming it and
  correcting a record afterwards (owner, 2026-10-04: the teacher's screens are
  ours now):

    confirm  POST /sessions/:id/confirm { statuses?: [{ studentProfileId, status, note? }] }
             - everyone not named keeps the default: PRESENT if checked in, ABSENT if
             not. Answers the roster again (plus `message`). Only once the Session
             has begun, not cancelled, not confirmed yet.
    correct  PATCH /:id { status, note } - after confirmation only, a note of 3+
             characters required; answers `{ attendance }`.

    checkIn  { session: <roster's session>, attendance: { id, studentProfileId,
               status: 'PRESENT', checkedInAt, outsideSchool, late } }   — 201

    roster   { session: { id, number, startsAt, endsAt, status, needsCompletion,
                          confirmed, completedAt, class, subject },
               students: [{ studentProfileId, fullName, attendanceId, status|null,
                            checkedInAt, outsideSchool, late }] }   — by name
    history  { attendance, changes: [{ id, fromStatus, toStatus, note,
                                       changedBy: { userId, fullName }, at }] } — oldest first
*/
export const attendanceService = {
  /** The student's own rows, oldest Session first; narrowed to one ClassSubject when given. */
  async mine(classSubjectId) {
    const query = classSubjectId ? `?classSubjectId=${encodeURIComponent(classSubjectId)}` : '';
    const answer = await api.get(`/attendance/me${query}`);
    return answer?.attendance ?? [];
  },

  /**
   * The student checks in where they stand (controller `checkIn`). The server
   * takes it 150 m from the school's point too, flagged `outsideSchool`, and more
   * than 30 minutes after the start flagged `late`.
   */
  async checkIn(sessionId, { latitude, longitude }) {
    return api.post(`/attendance/sessions/${sessionId}/check-in`, { latitude, longitude });
  },

  /** A Session's roster: every student placed in the class at its start (controller `getRoster`). */
  /** Confirms a Session; `statuses` names only the students set to other than their default. */
  async confirm(sessionId, statuses = []) {
    return api.post(`/attendance/sessions/${encodeURIComponent(sessionId)}/confirm`, statuses.length ? { statuses } : {});
  },

  /** Corrects one record after confirmation. */
  async correct(attendanceId, { status, note }) {
    const answer = await api.patch(`/attendance/${encodeURIComponent(attendanceId)}`, { status, note });
    return answer?.attendance ?? null;
  },

  async roster(sessionId) {
    return api.get(`/attendance/sessions/${sessionId}`);
  },

  /** One record's changes by the teacher, with their notes (controller `history`). */
  async history(attendanceId) {
    return api.get(`/attendance/${attendanceId}/history`);
  },
};

export default attendanceService;
