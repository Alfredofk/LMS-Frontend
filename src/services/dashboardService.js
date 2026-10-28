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

  GET /classes/:id (backend 7ee7857, dashboard ticket 03; its Homeroom Teacher, the
  Principal, a Vice Principal - anyone else 404) answers, bare:
    { class: { id, name, academicYear }, semester (as above) | null, thresholds,
      subjects: [{ classSubjectId, subject: { id, code, name }, kktp }],
      summary: { studentsPlacedNow, withSignal, belowKktpSomewhere } | null,
      students: [{ studentProfileId, fullName,
                   attendance: { counted, present, sick, excused, absent, late, outsideSchool, percent },
                   grades: [{ classSubjectId, finalGrade, belowKktp, waiting }],
                   signals: [{ type, value, threshold, subject: { id, code, name } | null }] }] }
  A Class of another year answers `semester: null` and nothing else. The Students are
  those placed now, by name; FREQUENT_ABSENCE counts days with an absence, INACTIVE
  spans every Subject (subject null). See views/Homeroom/homeroomSummary.js.

  GET /marking-by-teacher (backend 0eefba2, dashboard ticket 04; the Principal or a
  Vice Principal - anyone else 403) answers, bare:
    { teachers: [{ membershipId, fullName, marking, release }], unanswered: { marking, release } }
  Slow on the server (3-4 s for a big School), so its card reads it on its own. See
  views/Dashboard/markingByTeacher.js.

  GET /school?semesterId= (backend 1a1eed7, dashboard ticket 06; the Principal or a
  Vice Principal - anyone else 403; a Semester neither current nor CLOSED 404): the
  School, its Classes and its Subjects per grade level as of the nightly rollup. See
  views/SchoolOverview/schoolOverview.js for the shape.
*/
export const dashboardService = {
  async teaching() {
    return api.get('/dashboard/teaching');
  },
  async signalSettings() {
    const answer = await api.get('/dashboard/signal-settings');
    return answer.settings;
  },
  async classSummary(classId) {
    return api.get(`/dashboard/classes/${encodeURIComponent(classId)}`);
  },
  async markingByTeacher() {
    return api.get('/dashboard/marking-by-teacher');
  },
  async school(semesterId) {
    return api.get(semesterId ? `/dashboard/school?semesterId=${encodeURIComponent(semesterId)}` : '/dashboard/school');
  },
  async setSignalSettings(body) {
    const answer = await api.put('/dashboard/signal-settings', body);
    return answer.settings;
  },
};
