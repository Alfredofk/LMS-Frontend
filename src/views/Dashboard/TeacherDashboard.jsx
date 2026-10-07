import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ClipboardCheck, GraduationCap, School, Users, Wrench } from 'lucide-react';

import InfoChips from '../../components/ui/InfoChips';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { academicsService } from '../../services/academicsService';
import { sessionsService } from '../../services/sessionsService';
import { trackingService } from '../../services/trackingService';
import { localOf } from '../Attendance/attendance';
import StatCard from './components/StatCard';
import TeachingDayCard from './components/TeachingDayCard';
import { openYearLabels } from '../Schedule/teacherLessons';
import {
  DAYS_AHEAD, addDays, classCount, currentSemester, dayMeetings, liveAssignments, openSemesterIds, uniqueStudentCount,
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
  - To review and recent submissions: no assignment or submission module in the
    backend yet.
*/

const greetingKeyFor = (hour) => {
  if (hour >= 5 && hour < 12) return 'dash.greeting.morning';
  if (hour >= 12 && hour < 15) return 'dash.greeting.midday';
  if (hour >= 15 && hour < 19) return 'dash.greeting.afternoon';
  return 'dash.greeting.evening';
};

const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-left';

const CardHeading = ({ id, icon: Icon, tile, title, aside }) => (
  <div className="flex items-center justify-between gap-3 mb-4">
    <div className="flex items-center gap-2.5 min-w-0">
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tile}`}>
        {Icon && <Icon className="w-4.5 h-4.5" aria-hidden="true" />}
      </span>
      <h2 id={id} className="text-base font-extrabold text-slate-800 tracking-tight">{title}</h2>
    </div>
    {aside}
  </div>
);

const EmptyBox = ({ icon: Icon, children }) => (
  <div className="py-10 px-4 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
    {Icon && <Icon className="w-7 h-7 text-slate-300 mb-2" aria-hidden="true" />}
    <div className="text-xs font-semibold text-slate-600">{children}</div>
  </div>
);

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

  const now = new Date();
  const today = now.toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';
  const name = user?.fullName || t('teacherDash.greeting.fallback');
  const semester = currentSemester(live);

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
          value="-"
          subtext={t('common.notBuilt.title')}
          icon={ClipboardCheck}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <TeachingDayCard
          live={teaching === undefined ? undefined : live}
          meetings={meetings}
          today={todayLocal}
          className="lg:col-span-7"
        />

        <section className={`${card} lg:col-span-5`} aria-labelledby="teacher-review-heading">
          <CardHeading
            id="teacher-review-heading"
            icon={ClipboardCheck}
            tile="bg-amber-50 text-amber-600"
            title={t('teacherDash.review.title')}
          />
          <EmptyBox icon={Wrench}>{t('common.notBuilt.title')}</EmptyBox>
        </section>
      </div>
    </div>
  );
};

export default TeacherDashboard;
