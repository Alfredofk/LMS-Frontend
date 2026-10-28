import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, ClipboardCheck, Flag, Users } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { academicsService } from '../../services/academicsService';
import { sessionsService } from '../../services/sessionsService';
import { localOf } from '../Attendance/attendance';
import StatCard from './components/StatCard';
import TeachingDayCard from './components/TeachingDayCard';
import AssessmentsCard from './components/AssessmentsCard';
import TeachingSlotsCard from './components/TeachingSlotsCard';
import { readTeachingDashboard, studentsAcrossClasses, studentsNeedingSupportAcross } from './teachingDashboard';
import { readMarkingQueue, readTeachingLists } from '../TeacherAssessment/markingQueue';
import { dashboardAssessments } from '../TeacherAssessment/teacherAssessment';
import { openYearLabels } from '../Schedule/teacherLessons';
import { useMyExamWeek } from '../Schedule/useMyExamWeek';
import ExamWeekLine from '../Schedule/ExamWeekLine';
import { examsByDay, teacherExamClasses } from '../Schedule/lessonCalendar';
import {
  DAYS_AHEAD, addDays, classCount, currentSemester, dayMeetings, finalisingSemesterOf, liveAssignments, openSemesterIds,
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
  - Students: the classes of this semester's slots in `GET /dashboard/teaching`,
    each counted once (owner 2026-10-27; it was one progress read per assignment).
  - To review (owner, 2026-10-10): attempts waiting for marking, and under them
    how many may be released now - `GET /dashboard/teaching`'s queue through
    markingQueue.js, shared with the sidebar's number (owner 2026-10-27); a click
    opens the assessment waiting longest, on its "Hasil" tab.
  - Assessments (AssessmentsCard, owner 2026-10-08): open, upcoming and drafts
    across the subjects taught now. It took the place of "recent submissions",
    which had no route.
  - This semester's classes (TeachingSlotsCard, owner 2026-10-27): each subject's
    materials and attendance, and the students needing support, from the same
    `GET /dashboard/teaching` answer (readTeachingDashboard, kept a minute).
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

  /* GET /dashboard/teaching: undefined → reading; the answer; null → failed. */
  const [board, setBoard] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    readTeachingDashboard(membership?.id)
      .then((answer) => !cancelled && setBoard(answer))
      .catch(() => !cancelled && setBoard(null));
    return () => {
      cancelled = true;
    };
  }, [membership?.id]);
  const students = board ? studentsAcrossClasses(board.slots) : board;

  /* undefined -> reading; { waitingById, marking, release, releasable } -> read; null -> failed. */
  const [queue, setQueue] = useState(undefined);
  /* The assessments of the slots taught, [{ row, assessments }]: undefined, read, or null. */
  const [lists, setLists] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    readMarkingQueue(membership?.id)
      .then((answer) => !cancelled && setQueue(answer))
      .catch(() => !cancelled && setQueue(null));
    readTeachingLists(membership?.id)
      .then((answer) => !cancelled && setLists(answer))
      .catch(() => !cancelled && setLists(null));
    return () => {
      cancelled = true;
    };
  }, [membership?.id]);
  /* Opened through the teacher's own row of the slot, which the lists carry. */
  const firstWaiting = useMemo(
    () => (queue && lists ? dashboardAssessments(lists, { waitingById: queue.waitingById }).items.find((item) => item.group === 'review') ?? null : null),
    [queue, lists]
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
  /* Today's published UTS and UAS of the subjects taught, from the lists. */
  const examsToday = useMemo(
    () => (examWeekToday && lists ? examsByDay(teacherExamClasses(lists), zone).get(todayLocal) ?? [] : []),
    [examWeekToday, lists, zone, todayLocal]
  );

  const loading = teaching === undefined;
  const failed = teaching === null;
  const facts = [
    schoolName,
    semester && t('teacherDash.academicContext', { year: semester.academicYear, n: semester.ordinal }),
    today,
  ].filter(Boolean);
  /* Students needing support, each once across the subjects (owner, 2026-10-27). */
  const support = board ? studentsNeedingSupportAcross(board.slots) : board;
  const scrollToSlots = () => document.getElementById('teacher-slots-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-6 text-left">
      <header className="select-none">
        <h1 className="text-3xl max-sm:text-2xl font-extrabold leading-tight tracking-tight text-slate-900">
          {t(greetingKeyFor(now.getHours()), { name })}
        </h1>
        {/* One grey slash line in place of the icon chips (owner, 2026-10-27, as the student's). */}
        <p className="mt-2 text-sm font-medium text-slate-500">
          {facts.map((fact, i) => (
            <React.Fragment key={fact}>
              {i > 0 && (
                <>
                  {' '}
                  <span className="mx-1 text-slate-300" aria-hidden="true">
                    /
                  </span>{' '}
                </>
              )}
              <span className="whitespace-nowrap">{fact}</span>
            </React.Fragment>
          ))}
        </p>
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

      <section aria-label={t('teacherDash.stats.label')} className="grid grid-cols-2 gap-5 max-sm:gap-3 lg:grid-cols-4">
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
          subtext={queue === null ? t('dash.att.failed') : queue === undefined ? '' : t('teacherDash.stat.review.sub', { n: queue.releasable })}
          icon={ClipboardCheck}
          onClick={firstWaiting ? () => navigate(`/teacher/courses/${firstWaiting.row.id}/penilaian/${firstWaiting.assessment.id}?tab=hasil`) : undefined}
        />
        <StatCard
          title={t('teacherDash.stat.support')}
          value={support === undefined ? '…' : support === null ? '-' : String(support)}
          subtext={support === null ? t('dash.att.failed') : support === undefined ? '' : t('teacherDash.stat.support.sub')}
          icon={Flag}
          onClick={support ? scrollToSlots : undefined}
        />
      </section>

      {/* Both cards end level (owner, 2026-10-27): the row stretches, HomeCard fills it. */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <TeachingDayCard
          live={teaching === undefined ? undefined : live}
          meetings={meetings}
          today={todayLocal}
          examWeek={examWeekToday}
          exams={examsToday}
          className="lg:col-span-6"
        />

        {/* Half and half since 2026-10-27 (7/5 before): at 5/12 the four tabs did not fit
            and the owner wanted no scrollbar under them. */}
        <AssessmentsCard queue={queue} lists={lists} zone={zone} className="lg:col-span-6" />
      </div>

      <TeachingSlotsCard board={board} />
    </div>
  );
};

export default TeacherDashboard;
