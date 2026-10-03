import { api } from './apiClient';

/*
  Timetables and Sessions — backend `7cdc46d` (teaching-and-learning tickets 02
  and 09), mounted at `/api/sessions`.

  A ClassSubject's weekly timetable is set whole by the Principal or a Vice
  Principal (PUT), and read by them, its teacher, the Class's homeroom teacher and
  its students (GET) — anyone else gets 404. The Sessions ("Pertemuan ke-N") are
  generated from it across the Semester, skipping holidays.

    schedule  { classSubject: { id, class, subject, semester: { id, ordinal, academicYear } },
                timeZone: 'WIB'|'WITA'|'WIT'|null, replansFrom: 'YYYY-MM-DD'|null,
                slots: [{ dayOfWeek, start, end }],
                sessions: { scheduled, cancelled, needsCompletion } }
    session   { id, number, startsAt, endsAt,
                local: { date, dayOfWeek, start, end },   — in the school's zone
                status: SCHEDULED|CANCELLED, cancelReason, needsCompletion, completedAt, topic }

  Answering a Session (complete / not-held) is the teacher's, and lives with the
  teacher's screens.
*/
export const sessionsService = {
  async schedule(classSubjectId) {
    const answer = await api.get(`/sessions/class-subjects/${classSubjectId}/schedule`);
    return answer?.schedule ?? null;
  },

  /** Replaces the whole week: 1–30 slots `{ dayOfWeek, start, end }`. */
  async setSchedule(classSubjectId, slots) {
    const answer = await api.put(`/sessions/class-subjects/${classSubjectId}/schedule`, { slots });
    return answer?.schedule ?? null;
  },

  /** Every Session of the ClassSubject, by number. */
  async sessions(classSubjectId) {
    const answer = await api.get(`/sessions/class-subjects/${classSubjectId}/sessions`);
    return answer?.sessions ?? [];
  },

  /**
   * A student's own meetings — backend `87f2670`/`2a281e7`, STUDENT only. With
   * nothing given: today in the school's zone; `{ date }` one day; `{ from, to }`
   * a range of at most 42 days, both ends included ('YYYY-MM-DD').
   *
   * Answers the whole `{ from, to, timeZone, class: { id, name } | null, sessions }`
   * (sessions.service.js `listMine`). Each session is the one above plus
   * `classSubjectId`, `class` (name), `subject: { code, name }`, the student's own
   * `attendance: { id, status, checkedInAt, outsideSchool, late } | null`, and
   * `canCheckIn` — by the server's clock at the moment it answered.
   */
  async mine({ date, from, to } = {}) {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return api.get(`/sessions/mine${query ? `?${query}` : ''}`);
  },

  /**
   * Meetings created already past that still wait for their teacher's answer —
   * the reader's own for a teacher, the whole school's for the Principal or a
   * Vice Principal. Each is a session plus
   * `classSubject: { id, class, subject, semester, teacher: { membershipId, fullName } }`.
   */
  async needsCompletion() {
    const answer = await api.get('/sessions/needs-completion');
    return answer?.sessions ?? [];
  },
};

export default sessionsService;
