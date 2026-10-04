import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock3, ClipboardCheck, MapPin, Users } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { buildSampleTeacherData } from './sampleTeacherData';
import { SampleDataBanner } from './components/SampleDataNotice';
import StatCard from './components/StatCard';

const greetingKeyFor = (hour) => {
  if (hour >= 5 && hour < 12) return 'dash.greeting.morning';
  if (hour >= 12 && hour < 15) return 'dash.greeting.midday';
  if (hour >= 15 && hour < 19) return 'dash.greeting.afternoon';
  return 'dash.greeting.evening';
};

const weekdayFor = (dayOfWeek, locale) =>
  new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(
    new Date(2026, 0, dayOfWeek + 4),
  );

const timeAgo = (timestamp, t) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (minutes < 1) return t('shell.time.justNow');
  if (minutes < 60) return t('shell.time.minutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('shell.time.hours', { n: hours });
  return t('shell.time.days', { n: Math.floor(hours / 24) });
};

export const TeacherDashboard = () => {
  const { user, membership } = useAuth();
  const { t, lang } = useT();
  const data = useMemo(() => buildSampleTeacherData(), []);
  const locale = lang === 'id' ? 'id-ID' : 'en-GB';
  const now = new Date();
  const today = now.toLocaleDateString(locale, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';
  const academicContext = data.classSubjects[0];
  const name = user?.fullName || t('teacherDash.greeting.fallback');

  const stats = [
    {
      key: 'teacherDash.stat.classes',
      subtext: 'teacherDash.stat.classes.sub',
      value: data.stats.classCount,
      icon: CalendarDays,
      iconBg: 'bg-brand-tint text-brand',
    },
    {
      key: 'teacherDash.stat.students',
      subtext: 'teacherDash.stat.students.sub',
      value: data.stats.studentCount,
      icon: Users,
      iconBg: 'bg-emerald-50 text-emerald-600',
    },
    {
      key: 'teacherDash.stat.review',
      subtext: 'teacherDash.stat.review.sub',
      value: data.stats.pendingSubmissionCount,
      icon: ClipboardCheck,
      iconBg: 'bg-amber-50 text-amber-600',
    },
  ];

  return (
    <div className="space-y-6 text-left">
      <header className="select-none">
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900">
          {t(greetingKeyFor(now.getHours()), { name })}
        </h1>
        <p className="mt-1 text-sm font-bold text-slate-500">
          {schoolName ? `${schoolName} · ` : ''}
          {t('teacherDash.academicContext', {
            year: academicContext.academicYearLabel,
            n: academicContext.semesterOrdinal,
          })}
          {' · '}{today}
        </p>
      </header>

      <SampleDataBanner />

      <section aria-label={t('teacherDash.stats.label')} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <StatCard
            key={stat.key}
            title={t(stat.key)}
            value={stat.value}
            subtext={t(stat.subtext)}
            icon={stat.icon}
            iconBg={stat.iconBg}
          />
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="space-y-3 lg:col-span-7" aria-labelledby="teacher-schedule-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="teacher-schedule-heading" className="text-sm font-extrabold text-slate-700">
              {t('teacherDash.schedule.title')}
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {t('teacherDash.schedule.classSubjectCount', { n: data.stats.classSubjectCount })}
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm divide-y divide-slate-100">
            {data.classSubjects
              .slice()
              .sort((left, right) => left.schedule.dayOfWeek - right.schedule.dayOfWeek
                || left.schedule.startTime.localeCompare(right.schedule.startTime))
              .map((item) => (
                <Link
                  key={item.id}
                  to={`/teacher/courses?view=assignments&classId=${item.classId}`}
                  className="flex gap-4 px-4 py-4 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:px-5"
                >
                  <div className="w-20 shrink-0">
                    <p className="text-xs font-bold text-slate-700">{weekdayFor(item.schedule.dayOfWeek, locale)}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />{item.schedule.startTime}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1 border-l-2 border-brand pl-4">
                    <h3 className="truncate text-sm font-extrabold text-slate-800">{item.subjectName}</h3>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {t('teacherDash.schedule.class', { className: item.className, grade: item.gradeLevel })}
                    </p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      {t('teacherDash.schedule.locationTime', {
                        room: item.schedule.room,
                        endTime: item.schedule.endTime,
                      })}
                    </p>
                  </div>
                </Link>
              ))}
          </div>
        </section>

        <section className="space-y-3 lg:col-span-5" aria-labelledby="teacher-review-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="teacher-review-heading" className="text-sm font-extrabold text-slate-700">
              {t('teacherDash.review.title')}
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {t('teacherDash.review.count', { n: data.submissions.length })}
            </span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm divide-y divide-slate-100">
            {data.submissions.map((submission) => (
              <Link
                key={submission.id}
                to={`/teacher/courses?view=assignments&classId=${submission.classId}&q=${encodeURIComponent(submission.subjectName)}`}
                className="flex items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand sm:px-5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-extrabold text-brand" aria-hidden="true">
                  {submission.studentName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-800">{submission.studentName}</span>
                  <span className="mt-1 block truncate text-xs font-semibold text-slate-700">{submission.assessmentTitle}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {t('teacherDash.review.classSubject', {
                      className: submission.className,
                      subject: submission.subjectName,
                    })}
                  </span>
                  <span className="mt-2 block text-xs text-slate-500">{timeAgo(submission.submittedAt, t)}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default TeacherDashboard;
