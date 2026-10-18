import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CalendarCheck, CalendarDays, ListTodo, School, Star, FileText } from 'lucide-react';
import InfoChips from '../../components/ui/InfoChips';

import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import StatCard from './components/StatCard';
import { attendanceService } from '../../services/attendanceService';
import { attendanceStat } from '../Attendance/attendance';
import TodaySessionsCard from '../Attendance/TodaySessionsCard';
import { readMyClasses } from '../Classroom/readMyClasses';
import { currentSubjects } from '../Classroom/myClasses';
import { readMyProgress } from '../Classroom/readMyProgress';
import { progressTotals } from '../Classroom/myProgress';
import { readMyMenu } from '../StudentAssessment/readMyMenu';
import { handedInOf, nextUpcoming, todoAcross } from '../StudentAssessment/studentMenu';
import { ActiveAssessment, CourseProgress } from './components/Widgets';
import PinnedAnnouncements from './components/PinnedAnnouncements';
import ProgressBoard from './components/ProgressBoard';
import { useSchoolToday } from '../../hooks/useSchoolToday';
import { useMyExamWeek } from '../Schedule/useMyExamWeek';
import ExamWeekLine from '../Schedule/ExamWeekLine';
import { examsByDay } from '../Schedule/lessonCalendar';

/*
  A student's home screen: the full layout, with nothing invented in it.

  Real on screen (owner, 2026-10-02 to 10-04):
  - the person's name and their school (`/users/me` through AuthContext);
  - today's meetings with the check-in button (`TodaySessionsCard`,
    `GET /sessions/mine`, backend 87f2670), first;
  - the progress board: materials opened and completed this semester and the
    last activity (`GET /tracking/me/progress`, backend 0dd8b44);
  - the attendance stat card (`GET /attendance/me`, backend deb95e8), counted over
    confirmed meetings as on /attendance, where it leads;
  - the subjects stat card and "Mata Pelajaran & Kemajuan" (readMyClasses);
  - the assessments to do, as a stat card and a widget (GET /assessments/mine
    through readMyMenu, the server's default semester; backend 113ae37, owner
    2026-10-12), both leading to /assessment.

  Everything else - pinned announcements, the average and new-materials stat
  cards - has no backend route yet, so it renders
  `notBuilt` / "-", the same "not available yet" the pages behind it show. It used
  to be sample data under a banner, until the dashboard claimed three active
  assignments the Assessment page said did not exist. When a route lands, feed the
  widget its payload and drop `notBuilt`. No record yet, or a failed read, reads
  "-" with a line saying which - never a 0 nobody counted.

  Only one state is worth rendering. A member still waiting on approval never
  arrives here — `activeRolesOf` returns no roles for a membership that is not
  ACTIVE (constants/roles.js), and ProtectedRoute sends anybody with no usable
  role to /select-role.
*/

/*
  Indonesian divides the day four ways and English three, so a greeting is one
  whole sentence per key rather than a word slotted into a template. The two
  English afternoons are the same sentence on purpose.
*/
const greetingKeyFor = (hour) => {
  if (hour >= 5 && hour < 12) return 'dash.greeting.morning';
  if (hour >= 12 && hour < 15) return 'dash.greeting.midday';
  if (hour >= 15 && hour < 19) return 'dash.greeting.afternoon';
  return 'dash.greeting.evening';
};

/* The average stays "-" until the backend computes a Final Grade (owner, 2026-10-14). */
const STATS = [{ key: 'dash.stat.avgScore', icon: Star }];

export const StudentDashboard = () => {
  const { user, membership } = useAuth();
  const { t, lang } = useT();
  const navigate = useNavigate();

  /* undefined → reading; an array → read; null with `failed` → the read failed. */
  const [rows, setRows] = useState(undefined);
  const [failed, setFailed] = useState(false);
  /* Bumped by a check-in, so the rate card counts the new record. */
  const [recorded, setRecorded] = useState(0);
  useEffect(() => {
    let cancelled = false;
    attendanceService
      .mine()
      .then((list) => {
        if (cancelled) return;
        setRows(list);
        setFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRows(null);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [recorded]);
  const attendance = attendanceStat(rows, failed);

  /* The student's subjects this semester (owner, 2026-10-04): the stat card and
     the progress widget, from what "Kelas Saya" reads. null while reading. */
  const [subjects, setSubjects] = useState(null);
  const [subjectsFailed, setSubjectsFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    readMyClasses(membership?.id)
      .then(({ classSubjects, sessionsById }) => !cancelled && setSubjects(currentSubjects(classSubjects, sessionsById)))
      .catch(() => !cancelled && setSubjectsFailed(true));
    return () => {
      cancelled = true;
    };
  }, [membership?.id]);
  const semester = subjects?.[0]?.entry.semester;

  /* The student's own materials progress (backend 0dd8b44, owner 2026-10-04), added
     up over this semester's subjects once they are known. undefined while reading,
     null when it failed. */
  const [progress, setProgress] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    readMyProgress(membership?.id)
      .then((answer) => !cancelled && setProgress(answer))
      .catch(() => !cancelled && setProgress(null));
    return () => {
      cancelled = true;
    };
  }, [membership?.id]);
  const totals =
    progress === undefined || (subjects === null && !subjectsFailed)
      ? undefined
      : progress === null
        ? null
        : progressTotals(progress, subjects ? subjects.map(({ entry }) => entry.id) : null);

  /* The assessments to do across every subject: undefined while reading, null when it failed. */
  const [menu, setMenu] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    readMyMenu(membership?.id)
      .then((answer) => !cancelled && setMenu(answer))
      .catch(() => !cancelled && setMenu(null));
    return () => {
      cancelled = true;
    };
  }, [membership?.id]);
  const todo = menu === undefined ? undefined : menu === null ? null : todoAcross(menu.classes);
  const handedIn = menu === undefined ? undefined : menu === null ? null : handedInOf(menu.classes);
  /* The Exam Week of the student's grade (owner 2026-10-18): a line from 14 days
     before, and while it runs the today card holds that day's UTS and UAS. */
  const schoolToday = useSchoolToday();
  const grade = membership?.student?.class?.gradeLevel ?? null;
  const myGrades = useMemo(() => (grade ? [grade] : membership?.student ? [] : null), [grade, membership?.student]);
  const examReminder = useMyExamWeek(myGrades, schoolToday);
  const examWeekToday = examReminder?.kind === 'running' ? examReminder.week : null;
  const examsToday = useMemo(
    () => (examWeekToday && menu ? examsByDay(menu.classes, membership?.school?.timeZone ?? null).get(schoolToday) ?? [] : []),
    [examWeekToday, menu, membership?.school?.timeZone, schoolToday]
  );

  /* Materials not opened yet, of those published in this semester's subjects (owner, 2026-10-14). */
  const unopened = totals ? Math.max(0, totals.published - totals.opened) : totals;

  const name = user?.fullName || t('dash.greeting.fallback');
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';

  const today = new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div className="select-none text-left">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {t(greetingKeyFor(new Date().getHours()), { name })}
        </h1>
        <InfoChips
          className="mt-2"
          items={[schoolName && { icon: School, label: schoolName }, { icon: CalendarDays, label: today }]}
        />
      </div>

      {/* Pinned announcements first, then today's schedule beside the progress
          board, half and half (owner, 2026-10-03). The next-holiday card and the
          school-announcements widget at the foot of the page went the same day. */}
      {/* The Exam Week line first: it is about the next days, the announcements are not built yet. */}
      <ExamWeekLine reminder={examReminder} />

      <PinnedAnnouncements notBuilt />

      {/* Both cards share the row's height (owner, 2026-10-04): a day with nothing on
          keeps the full card, its empty state centred. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Check-in is the one thing here bound to the clock. It shows one meeting
            (on now, else next), and a day with none, or already over, folds to one line. */}
        <TodaySessionsCard focus examWeek={examWeekToday} exams={examsToday} onCheckedIn={() => setRecorded((n) => n + 1)} />
        <ProgressBoard totals={totals} zone={membership?.school?.timeZone ?? null} handedIn={handedIn} />
      </div>

      {/* The attendance card leads to /attendance and the subjects card to /classroom
          (2026-10-04); the other three have no onClick:
          an inert card, not a button that leads nowhere. Five cards leave a hole in
          two or three columns, so the one with real data spans: the full row in two
          columns, two of three in three — no hole at any width (owner, 2026-10-03). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
        <StatCard
          title={t('dash.stat.attendance')}
          value={attendance.value}
          subtext={attendance.lines.map((line) => t(line.key, line.vars)).join(', ')}
          icon={CalendarCheck}
          onClick={() => navigate('/attendance')}
          className="sm:col-span-2 xl:col-span-1"
        />
        <StatCard
          title={t('dash.stat.subjects')}
          value={subjectsFailed ? '-' : subjects === null ? '…' : String(subjects.length)}
          subtext={
            subjectsFailed
              ? t('dash.att.failed')
              : semester
                ? t('dash.subjects.semester', { n: semester.ordinal, year: semester.academicYear })
                : subjects === null
                  ? ''
                  : t('dash.progress.empty')
          }
          icon={BookOpen}
          onClick={() => navigate('/classroom')}
        />
        <StatCard
          title={t('dash.stat.assessments')}
          value={todo === null ? '-' : todo === undefined ? '…' : String(todo.length)}
          subtext={todo === null ? t('dash.att.failed') : todo === undefined ? '' : t('dash.stat.assessmentsSub')}
          icon={ListTodo}
          onClick={() => navigate('/assessment')}
        />
        <StatCard
          title={t('dash.stat.unopened')}
          value={unopened === null ? '-' : unopened === undefined ? '…' : String(unopened)}
          subtext={
            unopened === null
              ? t('dash.att.failed')
              : unopened === undefined
                ? ''
                : totals.published === 0
                  ? t('dash.board.noMaterials')
                  : t('dash.stat.unopenedSub', { total: totals.published })
          }
          icon={FileText}
          onClick={() => navigate('/classroom')}
        />
        {STATS.map((stat) => (
          <StatCard
            key={stat.key}
            title={t(stat.key)}
            value="-"
            subtext={t('common.notBuilt.title')}
            icon={stat.icon}
          />
        ))}
      </div>

      {/* Two cards since the announcements moved to the top (owner, 2026-10-03). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActiveAssessment todo={todo} next={menu ? nextUpcoming(menu.classes) : null} zone={membership?.school?.timeZone ?? null} />
        <CourseProgress subjects={subjects} failed={subjectsFailed} />
      </div>
    </div>
  );
};

export default StudentDashboard;
