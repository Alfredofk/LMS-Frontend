import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, FileText, ListTodo, Star } from 'lucide-react';

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
import { todoAcross } from '../StudentAssessment/studentMenu';
import PinnedAnnouncements from './components/PinnedAnnouncements';
import ConsistencyCard from './components/ConsistencyCard';
import TodoCard from './components/TodoCard';
import SubjectProgressCard from './components/SubjectProgressCard';
import { streakOf, weekAssessmentsOf, weekOf } from './studentHome';
import { useSchoolToday } from '../../hooks/useSchoolToday';
import { useMyExamWeek } from '../Schedule/useMyExamWeek';
import ExamWeekLine from '../Schedule/ExamWeekLine';
import { examsByDay } from '../Schedule/lessonCalendar';
import { gradingService } from '../../services/gradingService';
import { latestAverageOf } from '../ReportCards/reportCards';

/*
  A student's home screen: the full layout, with nothing invented in it.

  The design the owner approved on 2026-10-27 (the skill
  `.claude/skills/eduforid-design`, its mockup `examples/dashboard-siswa.html`),
  in this order:
  - the greeting and one grey line placing the student (school / class /
    semester / date);
  - pinned announcements, kept at the top (owner, 2026-10-27), then the Exam Week
    line (owner 2026-10-18);
  - "today" with the check-in (`TodaySessionsCard`, `GET /sessions/mine`) beside
    Konsistensi - this week's assessments handed in, meetings attended in a row,
    a dot per day (`studentHome.js`, from `GET /attendance/me` and the menu);
  - four stat cards: attendance (`GET /attendance/me`), assessments to do
    (`GET /assessments/mine`), materials not opened (`GET /tracking/me/progress`)
    and the newest report card's average (`GET /report-cards/mine`, owner
    2026-10-20); the subjects card went with the old layout (owner, 2026-10-27);
  - "Perlu dikerjakan" (`TodoCard`) beside "Kemajuan mapel" (`SubjectProgressCard`).

  Pinned announcements have no backend route yet, so they render `notBuilt`. A
  read that failed reads "-" or says so in its card with a way to read again -
  never a 0 nobody counted.

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

export const StudentDashboard = () => {
  const { user, membership } = useAuth();
  const { t, lang } = useT();
  const navigate = useNavigate();
  const zone = membership?.school?.timeZone ?? null;
  const schoolToday = useSchoolToday();

  /* undefined → reading; an array → read; null with `failed` → the read failed. */
  const [rows, setRows] = useState(undefined);
  const [failed, setFailed] = useState(false);
  /* Bumped by a check-in, so the rate card counts the new record and Konsistensi celebrates. */
  const [recorded, setRecorded] = useState(0);
  /* Bumped by "Coba lagi" on a card that failed. */
  const [retried, setRetried] = useState(0);
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
  }, [recorded, retried]);
  const attendance = attendanceStat(rows, failed);

  /* The student's subjects this semester and their meetings (readMyClasses): Kemajuan
     mapel's rows and the meeting each carries on with. null while reading. */
  const [classes, setClasses] = useState(null);
  const [subjectsFailed, setSubjectsFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    readMyClasses(membership?.id, { fresh: retried > 0 })
      .then(({ classSubjects, sessionsById }) => {
        if (cancelled) return;
        setClasses({ subjects: currentSubjects(classSubjects, sessionsById), sessionsById });
        setSubjectsFailed(false);
      })
      .catch(() => !cancelled && setSubjectsFailed(true));
    return () => {
      cancelled = true;
    };
  }, [membership?.id, retried]);
  const subjects = classes?.subjects ?? null;

  /* The student's own materials progress (backend 0dd8b44, owner 2026-10-04). undefined
     while reading, null when it failed. */
  const [progress, setProgress] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    readMyProgress(membership?.id, { fresh: retried > 0 })
      .then((answer) => !cancelled && setProgress(answer))
      .catch(() => !cancelled && setProgress(null));
    return () => {
      cancelled = true;
    };
  }, [membership?.id, retried]);
  const totals =
    progress === undefined || (subjects === null && !subjectsFailed)
      ? undefined
      : progress === null
        ? null
        : progressTotals(progress, subjects ? subjects.map(({ entry }) => entry.id) : null);

  /* The student's report cards, for the average (backend 3a22f90, owner 2026-10-20):
     undefined while reading, null when it failed. */
  const [reportCards, setReportCards] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    gradingService
      .myReportCards()
      .then((list) => !cancelled && setReportCards(list))
      .catch(() => !cancelled && setReportCards(null));
    return () => {
      cancelled = true;
    };
  }, []);
  const latest = Array.isArray(reportCards) ? latestAverageOf(reportCards) : null;

  /* The semester's assessments: undefined while reading, null when it failed. */
  const [menu, setMenu] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    readMyMenu(membership?.id, null, { fresh: retried > 0 })
      .then((answer) => !cancelled && setMenu(answer))
      .catch(() => !cancelled && setMenu(null));
    return () => {
      cancelled = true;
    };
  }, [membership?.id, retried]);
  const todo = menu === undefined ? undefined : menu === null ? null : todoAcross(menu.classes);

  /* Konsistensi: meetings in a row, this week's days, this week's assessments handed in. */
  const streak = rows === undefined ? undefined : failed ? null : streakOf(rows);
  const week = useMemo(() => (Array.isArray(rows) ? weekOf(rows, schoolToday, zone) : []), [rows, schoolToday, zone]);
  const handed = menu === undefined ? undefined : menu === null ? null : weekAssessmentsOf(menu.classes, schoolToday, zone);

  /* The Exam Week of the student's grade (owner 2026-10-18): a line from 14 days
     before, and while it runs the today card holds that day's UTS and UAS. */
  const grade = membership?.student?.class?.gradeLevel ?? null;
  const myGrades = useMemo(() => (grade ? [grade] : membership?.student ? [] : null), [grade, membership?.student]);
  const examReminder = useMyExamWeek(myGrades, schoolToday);
  const examWeekToday = examReminder?.kind === 'running' ? examReminder.week : null;
  const examsToday = useMemo(
    () => (examWeekToday && menu ? examsByDay(menu.classes, zone).get(schoolToday) ?? [] : []),
    [examWeekToday, menu, zone, schoolToday]
  );

  /* Materials not opened yet, of those published in this semester's subjects (owner, 2026-10-14). */
  const unopened = totals ? Math.max(0, totals.published - totals.opened) : totals;

  const retry = useCallback(() => setRetried((n) => n + 1), []);

  const name = user?.fullName || t('dash.greeting.fallback');
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';
  const className = membership?.student?.class?.name ?? '';
  const semester = subjects?.[0]?.entry.semester;
  const today = new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const facts = [schoolName, className, semester && t('dash.subjects.semester', { n: semester.ordinal, year: semester.academicYear }), today].filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="text-left">
        <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight select-none">
          {t(greetingKeyFor(new Date().getHours()), { name })}
        </h1>
        {/* One grey line, the slashes lighter (FactLine's look), in place of the icon chips.
            The spaces around a slash are where the line may break on a phone: without them
            the parts, each kept whole, ran off the screen as one word (2026-10-27, 513px). */}
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
      </div>

      {/* Pinned announcements stay at the top (owner, 2026-10-27), the Exam Week line under them. */}
      <PinnedAnnouncements notBuilt />
      <ExamWeekLine reminder={examReminder} />

      {/* Check-in is the one thing here bound to the clock: on now, else next. */}
      {/* Both rows stretch, so the cards side by side end level (owner, 2026-10-27). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TodaySessionsCard focus examWeek={examWeekToday} exams={examsToday} onCheckedIn={() => setRecorded((n) => n + 1)} />
        <ConsistencyCard streak={streak} week={week} handed={handed} celebrate={recorded} onRetry={retry} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 max-sm:gap-3">
        <StatCard
          title={t('dash.stat.attendance')}
          value={attendance.value}
          subtext={attendance.lines.map((line) => t(line.key, line.vars)).join(', ')}
          icon={CalendarCheck}
          onClick={() => navigate('/attendance')}
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
        <StatCard
          title={t('dash.stat.avgScore')}
          value={reportCards === undefined ? '…' : latest ? new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'id-ID', { maximumFractionDigits: 1 }).format(latest.average) : '-'}
          subtext={
            reportCards === null
              ? t('dash.att.failed')
              : reportCards === undefined
                ? ''
                : latest
                  ? t('dash.stat.avgFrom', { n: latest.card.semester.ordinal, year: latest.card.academicYear })
                  : t('dash.stat.avgNone')
          }
          icon={Star}
          onClick={latest ? () => navigate(`/report-cards/${latest.card.id}`, { state: { back: { to: '/dashboard' } } }) : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
        <TodoCard todo={todo} zone={zone} today={schoolToday} onRetry={retry} />
        <SubjectProgressCard
          subjects={subjects}
          subjectsFailed={subjectsFailed}
          progress={progress}
          sessionsById={classes?.sessionsById}
          onRetry={retry}
        />
      </div>
    </div>
  );
};

export default StudentDashboard;
