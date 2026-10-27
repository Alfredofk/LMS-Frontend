import { api } from './apiClient';

/*
  The dashboards - backend 27400b4/002298e (dashboard tickets 01-02), mounted at
  `/api/dashboard`. Read-only views across the other modules.

  GET /teaching (TEACHER, a Principal or Vice Principal who teaches included; the
  role read from the token) answers, bare:
    { semester: { id, ordinal, academicYear: { id, label } } | null,
      thresholds: { absenceCount, absenceWindowDays, contentBehindPercent,
                    contentBehindMinPublished, notSubmittedCount, inactiveDays },
      slots: [{ classSubject, studentsPlacedNow, content, attendance, studentsNeedingSupport }],
      queue: [{ assessment: { id, title, type, mode, closesAt },
                classSubject: { id, class, subject, semester, academicYear },
                marking, release, oldestWaitingSince, releasableAt }] }
  `queue` holds only what waits, oldest first, counted per attempt as an
  assessment's results count them; a LATIHAN counts for marking only. `releasableAt`
  is when an ONLINE one's release opens (its closesAt), null once it may be pressed
  and on an OFFLINE one. Heavy on the server (each slot's progress and support
  signals are worked out too), so read through markingQueue.js, kept a minute.

  GET /signal-settings (the School's staff) answers `{ settings }`: each threshold
  `{ value, source: 'SCHOOL' | 'BUILT_IN' }` and `updatedAt` (null before the first
  save). PUT (Principal or Vice Principal, audited) takes any threshold - a whole
  number, or null back to the built-in one - with that updatedAt, and answers
  `{ settings, message }`; a stale updatedAt is 409. See views/Account/signalSettings.js.
*/
export const dashboardService = {
  async teaching() {
    return api.get('/dashboard/teaching');
  },
  async signalSettings() {
    const answer = await api.get('/dashboard/signal-settings');
    return answer.settings;
  },
  async setSignalSettings(body) {
    const answer = await api.put('/dashboard/signal-settings', body);
    return answer.settings;
  },
};
