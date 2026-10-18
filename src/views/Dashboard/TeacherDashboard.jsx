import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, ClipboardCheck, GraduationCap, School, Users } from 'lucide-react';

import InfoChips from '../../components/ui/InfoChips';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { academicsService } from '../../services/academicsService';
import { sessionsService } from '../../services/sessionsService';
import { trackingService } from '../../services/trackingService';
import { localOf } from '../Attendance/attendance';
import StatCard from './components/StatCard';
import TeachingDayCard from './components/TeachingDayCard';
import AssessmentsCard from './components/AssessmentsCard';
import { readMarkingQueue } from '../TeacherAssessment/markingQueue';
import { dashboardAssessments } from '../TeacherAssessment/teacherAssessment';
import { openYearLabels } from '../Schedule/teacherLessons';
import { useMyExamWeek } from '../Schedule/useMyExamWeek';
import ExamWeekLine from '../Schedule/ExamWeekLine';
import { examsByDay, teacherExamClasses } from '../Schedule/lessonCalendar';
import {
  DAYS_AHEAD, addDays, classCount, currentSemester, dayMeetings, finalisingSemesterOf, liveAssignments, openSemesterIds, uniqueStudentCount,
} from './teacherHome';

/*
  A teacher's home screen on real data (owner, 2026-10-05), laid out like the
  student's: what has a route is read, what has none says "not available yet" and
  shows "-", never a number nobody counted. The sample data and its banner went.

  - Classes taught: `?mine=true`, with `GET /academics/academic-years` to leave out
    a closed year's assignments.
  - Today's meetings (TeachingDayCard): `GET /sessions/teaching` from today over the
    route's 42 days, so a day with none can name the next (backend 1bd81ab; until
    2026-10-05 one read per assignment).
  - Students: one `GET /tracking/class-subjects/:id/progress` per live assignment,
    the only roster a subject teacher may read; see teacherHome.js.
  - To review (owner, 2026-10-10): attempts waiting for marking, and under them
    how many are ready to release - markingQueue.js, shared with the sidebar's
    number; a click opens the first assessment that waits, on its "Hasil" tab.
  - Assessments (AssessmentsCard, owner 2026-10-08): open, upcoming and drafts
    across the subjects taught now. It took the place of "recent submissions",
    which had no route.
*/

const greetingKeyFor = (hour) => {
  if (hour >= 5 && hour < 12) return 'dash.greeting.morning';
  if (hour >= 12 && hour < 15) return 'dash.greeting.midday';
  if (hour >= 15 && hour < 19) return 'dash.greeting.afternoon';
  return 'dash.greeting.evening';
};

export const TeacherDashboard = () => {
  const { user, membership } = useAuth();
  const { t, lang } = useT();
  const navigate = useNavigate();
  const locale = lang === 'id' ? 'id-ID' : 'en-GB';
  const zone = membership?.school?.timeZone ?? null;

  /* The school's day, which the meetings are read from. */
  const todayLocal = localOf(new Date(), zone)?.date ?? null;

  /* undefined → reading; { rows, years, sessions } → read; null → a read failed. The
     years are read too: a closed year leaves its assignments ACTIVE and its meetings
     SCHEDULED, and counting them would be counting classes nobody teaches any more. */
  const [teaching, setTeaching] = useState(undefined);
  useEffect(() => {
    if (!todayLocal) return undefined;
    let cancelled = false;
    Promise.all([
      academicsService.myClassSubjects(),
      academicsService.academicYears(),
      sessionsService.teaching({ from: todayLocal, to: addDays(todayLocal, DAYS_AHEAD) }),
    ])
      .then(([rows, years, answer]) => !cancelled && setTeaching({ rows, years, sessions: answer?.sessions ?? [] }))
      .catch(() => !cancelled && setTeaching(null));
    return () => {
      cancelled = true;
    };
  }, [membership?.id, todayLocal]);

  const live = useMemo(
    () => (teaching ? liveAssignments(teaching.rows, openSemesterIds(teaching.years)) : null),
    [teaching]
  );
  const meetings = useMemo(
    () => (teaching ? dayMeetings(teaching.sessions, live, openYearLabels(teaching.years)) : null),
    [teaching, live]
  );

  /* undefined → reading; a number → counted; null → a read failed (or the
     assignments themselves could not be read). */
  const [counted, setCounted] = useState(undefined);
  useEffect(() => {
    if (!live) return undefined;
    let cancelled = false;
    Promise.all(live.map((row) => trackingService.classSubjectProgress(row.id).catch(() => null)))
      .then((answers) => !cancelled && setCounted(uniqueStudentCount(answers)));
    return () => {
      cancelled = true;
    };
  }, [live]);
  const students = teaching === null ? null : counted;

  /* undefined -> reading; { lists, waitingById, marking, release } -> read; null -> failed. */
  const [queue, setQueue] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    readMarkingQueue(membership?.id)
      .then((answer) => !cancelled && setQueue(answer))
      .catch(() => !cancelled && setQueue(null));
    return () => {
      cancelled = true;
    };
  }, [membership?.id]);
  const firstWaiting = useMemo(
    () => (queue ? dashboardAssessments(queue.lists, { waitingById: queue.waitingById }).items.find((item) => item.group === 'review') ?? null : null),
    [queue]
  );

  const now = new Date();
  const today = now.toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';
  const name = user?.fullName || t('teacherDash.greeting.fallback');
  const semester = currentSemester(live);
  /* A semester being finalised (backend eadf680, owner 2026-10-18): one line, leading to the subjects' Nilai tabs. */
  const finalising = teaching ? finalisingSemesterOf(teaching.years, live) : null;
  /* The Exam Week of a grade taught now (owner 2026-10-18): a line from 14 days before, and
     while it runs the day card leaves out the meetings it cancelled. */
  const myGrades = useMemo(
    () => (live ? [...new Set(live.map((row) => row.class?.gradeLevel).filter(Number.isInteger))] : null),
    [live]
  );
  const examReminder = useMyExamWeek(myGrades, todayLocal);
  const examWeekToday = examReminder?.kind === 'running' ? examReminder.week : null;
  /* Today's published UTS and UAS of the subjects taught, from the queue's lists. */
  const examsToday = useMemo(
    () => (examWeekToday && queue ? examsByDay(teacherExamClasses(queue.lists), zone).get(todayLocal) ?? [] : []),
    [examWeekToday, queue, zone, todayLocal]
  );

  const loading = teaching === undefined;
  const failed = teaching === null;

  return (
    <div className="space-y-6 text-left">
      <header className="select-none">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900">
          {t(greetingKeyFor(now.getHours()), { name })}
        </h1>
        <InfoChips
          className="mt-2"
          items={[
            schoolName && { icon: School, label: schoolName },
            semester && {
              icon: GraduationCap,
              label: t('teacherDash.academicContext', { year: semester.academicYear, n: semester.ordinal }),
            },
            { icon: CalendarDays, label: today },
          ]}
        />
      </header>

      {finalising && (
        <button
          type="button"
          onClick={() => navigate('/teacher/gradebook')}
          className="w-full flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:border-brand cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <span>{t('grading.fin.dashLine', { n: finalising.ordinal, year: finalising.year })}</span>
          <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
        </button>
      )}

      <ExamWeekLine reminder={examReminder} staff />

      <section aria-label={t('teacherDash.stats.label')} className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <StatCard
          title={t('teacherDash.stat.classes')}
          value={loading ? '…' : failed ? '-' : String(classCount(live))}
          subtext={failed ? t('dash.att.failed') : loading ? '' : t('teacherDash.stat.classes.sub', { n: live.length })}
          icon={CalendarDays}
          onClick={() => navigate('/teacher/courses')}
        />
        <StatCard
          title={t('teacherDash.stat.students')}
          value={students === undefined ? '…' : students === null ? '-' : String(students)}
          subtext={students === null ? t('dash.att.failed') : students === undefined ? '' : t('teacherDash.stat.students.sub')}
          icon={Users}
        />
        <StatCard
          title={t('teacherDash.stat.review')}
          value={queue === undefined ? '…' : queue === null ? '-' : String(queue.marking)}
          subtext={queue === null ? t('dash.att.failed') : queue === undefined ? '' : t('teacherDash.stat.review.sub', { n: queue.release })}
          icon={ClipboardCheck}
          onClick={firstWaiting ? () => navigate(`/teacher/courses/${firstWaiting.row.id}/penilaian/${firstWaiting.assessment.id}?tab=hasil`) : undefined}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <TeachingDayCard
          live={teaching === undefined ? undefined : live}
          meetings={meetings}
          today={todayLocal}
          examWeek={examWeekToday}
          exams={examsToday}
          className="lg:col-span-7"
        />

        <AssessmentsCard queue={queue} zone={zone} className="lg:col-span-5" />
      </div>
    </div>
  );
};

export default TeacherDashboard;
