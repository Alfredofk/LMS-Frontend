import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { BookOpen, ListTodo, Star, FileText } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { buildSampleStudentData } from './sampleStudentData';
import StatCard from './components/StatCard';
import { SampleDataBanner } from './components/SampleDataNotice';
import {
  TodayActivities,
  ActiveAssessment,
  CourseProgress,
  SchoolAnnouncement,
} from './components/Widgets';

/*
  A student's home screen, built entirely from sample data.

  Nothing on it is fetched, because nothing can be: `server.js` mounts only
  `auth` and `users`, and there is no model anywhere in the schema for a lesson,
  an assignment, a grade, a material or an announcement. Rather than show four
  empty cards, the page shows what it is for and says plainly that the numbers
  are invented — see components/SampleDataNotice.jsx.

  Two things on screen are real and are not marked: the person's name and their
  school, both of which come from `/users/me` through AuthContext.

  Only two states are worth rendering. A member still waiting on approval never
  arrives here — `activeRolesOf` returns no roles for a membership that is not
  ACTIVE (constants/roles.js), and ProtectedRoute sends anybody with no usable
  role to /select-role. A "waiting for approval" panel here would be unreachable
  code, which is exactly what the error branch this file used to carry was.
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
  const { showToast } = useOutletContext();
  const { t, lang } = useT();

  const [isLoading, setIsLoading] = useState(true);

  /* Built once per mount, relative to now — the dates in it are all relative. */
  const data = useMemo(() => buildSampleStudentData(), []);

  /*
    A placeholder for the request that will eventually live here. Short enough
    not to feel broken, long enough that the skeleton below is actually seen
    rather than being dead code. Delete it along with the sample data.
  */
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const handleStatCardClick = (labelKey) => {
    if (showToast) showToast(t('shell.underConstruction', { feature: t(labelKey) }), 'info');
  };

  if (isLoading) {
    return (
      <div className="space-y-6 text-left animate-pulse">
        <div className="space-y-2 select-none">
          <div className="h-8 bg-slate-200 rounded-lg w-2/3 md:w-1/3" />
          <div className="h-4 bg-slate-200 rounded-lg w-1/2 md:w-1/4" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-100 rounded-2xl p-6 h-32 flex items-center justify-between shadow-sm"
            >
              <div className="space-y-2.5 w-1/2">
                <div className="h-3 bg-slate-200 rounded w-3/4" />
                <div className="h-6 bg-slate-200 rounded w-1/2" />
                <div className="h-3 bg-slate-200 rounded w-2/3" />
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-200 shrink-0" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="bg-white border border-slate-100 rounded-2xl p-6 h-60 shadow-sm space-y-4"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="h-4 bg-slate-200 rounded w-1/3" />
                <div className="h-4 bg-slate-200 rounded w-1/6" />
              </div>
              <div className="space-y-3 pt-2">
                <div className="h-3.5 bg-slate-200 rounded w-full" />
                <div className="h-3.5 bg-slate-200 rounded w-5/6" />
                <div className="h-3.5 bg-slate-200 rounded w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const name = user?.fullName || t('dash.greeting.fallback');
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';

  /*
    Semester has no name column in the schema — only `ordinal`, 1 or 2 — so the
    phrase is composed here rather than read from a field that will never exist.
  */
  const term = t('dash.subline.term', {
    school: schoolName,
    year: data.context.academicYearLabel,
    n: data.context.semesterOrdinal,
  });

  const today = new Date().toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const stats = [
    {
      key: 'dash.stat.subjects',
      sub: 'dash.stat.subjects.sub',
      value: data.stats.subjectCount,
      icon: BookOpen,
      iconBg: 'bg-brand-tint text-brand',
    },
    {
      key: 'dash.stat.todo',
      sub: 'dash.stat.todo.sub',
      value: data.stats.todoCount,
      icon: ListTodo,
      iconBg: 'bg-amber-50 text-amber-500',
    },
    {
      key: 'dash.stat.avgScore',
      sub: 'dash.stat.avgScore.sub',
      value: data.stats.avgScore,
      icon: Star,
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      key: 'dash.stat.newMaterials',
      sub: 'dash.stat.newMaterials.sub',
      value: data.stats.newMaterialCount,
      icon: FileText,
      iconBg: 'bg-rose-50 text-rose-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="select-none text-left">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {t(greetingKeyFor(new Date().getHours()), { name })}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">
          {schoolName ? `${term} · ` : ''}
          {today}
        </p>
      </div>

      <SampleDataBanner />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => (
          <StatCard
            key={stat.key}
            title={t(stat.key)}
            value={stat.value ?? '—'}
            subtext={t(stat.sub)}
            icon={stat.icon}
            iconBg={stat.iconBg}
            onClick={() => handleStatCardClick(stat.key)}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TodayActivities activities={data.activities} isSample />
        <ActiveAssessment assessments={data.assessments} isSample />
        <CourseProgress courseProgress={data.courseProgress} isSample />
        <SchoolAnnouncement announcements={data.announcements} isSample />
      </div>
    </div>
  );
};

export default StudentDashboard;
