import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ListTodo, Megaphone, Calendar } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import { SampleTag } from './SampleDataNotice';

/*
  The four cards on the student dashboard.

  All four are presentational: they take their data as a prop and fetch nothing.
  That is not a temporary arrangement waiting for endpoints — it is what lets the
  same components render sample data today and a real payload tomorrow without
  being touched.

  Field names are camelCase and follow `prisma/schema.prisma`, which has no
  snake_case column anywhere. They used to read `subject_name`, `total_tasks`,
  `created_at` and friends behind `a || b || c` chains; those chains were not
  tolerance but undecidedness, and they made a missing field render as a blank
  row instead of failing where somebody would notice.
*/

const DAY = 24 * 60 * 60 * 1000;

/** Which locale `toLocaleDateString` should use for the language on screen. */
const localeOf = (lang) => (lang === 'id' ? 'id-ID' : 'en-GB');

/*
  Whole days from now until `iso`, counted midnight to midnight.

  Dividing elapsed milliseconds by a day measured hours, not calendar days: at
  01:00, something due at 23:00 the *same* day is 22 hours away, which rounded up
  to 1 and read as "tomorrow". Zeroing the clock on both ends makes today mean
  today. Returns null for a date that cannot be parsed.
*/
const daysUntil = (iso, now) => {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;

  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.round((to - from) / DAY);
};

/* ---------------------------------------------------------------------- */
/* Shared pieces                                                          */
/* ---------------------------------------------------------------------- */

const WidgetSkeleton = ({ rows = 3 }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm animate-pulse min-h-[260px]">
    <div className="h-4 bg-slate-200 rounded w-1/3 mb-6" />
    <div className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 bg-slate-100 rounded-xl" />
      ))}
    </div>
  </div>
);

const EmptyState = ({ icon: Icon, messageKey }) => {
  const { t } = useT();

  return (
    <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
      {/* The `Icon &&` is load-bearing for the linter, not only for safety:
          there is no eslint-plugin-react here, so a name used *only* inside JSX
          reads as an unused argument. StatCard.jsx is written the same way. */}
      {Icon && <Icon className="w-7 h-7 text-slate-300 mb-2" aria-hidden="true" />}
      <p className="text-xs font-semibold text-slate-600">{t(messageKey)}</p>
    </div>
  );
};

/*
  The card, its heading and its "see all" link — the same markup four times over
  before this existed. `footer` is for the one widget that puts something below
  the list.
*/
const WidgetCard = ({ titleKey, seeAllTo, isSample, footer, children }) => {
  const navigate = useNavigate();
  const { t } = useT();

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200">
      <div>
        <div className="flex items-center justify-between gap-2 pb-4">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-extrabold text-slate-800 tracking-tight truncate">
              {t(titleKey)}
            </h3>
            {isSample && <SampleTag />}
          </div>
          <button
            type="button"
            onClick={() => navigate(seeAllTo)}
            className="shrink-0 text-xs text-brand hover:underline font-semibold cursor-pointer"
          >
            {t('common.seeAll')}
          </button>
        </div>

        {children}
      </div>

      {footer}
    </div>
  );
};

/* ---------------------------------------------------------------------- */
/* 1. Today's activities                                                  */
/* ---------------------------------------------------------------------- */

/**
 * @param {Array<{id, startTime, endTime, subjectName, teacherName, room?}>} activities
 *   `startTime` / `endTime` are "HH:MM".
 */
export const TodayActivities = ({ activities = [], isLoading, isSample }) => {
  const { t } = useT();

  if (isLoading) return <WidgetSkeleton />;

  return (
    <WidgetCard titleKey="dash.today.title" seeAllTo="/schedule" isSample={isSample}>
      {activities.length === 0 ? (
        <EmptyState icon={Calendar} messageKey="dash.today.empty" />
      ) : (
        <div className="space-y-4">
          {activities.map((act) => (
            <div key={act.id} className="flex items-center gap-4">
              <div className="w-16 shrink-0 text-left">
                <div className="text-xs font-bold text-slate-800 leading-tight">
                  {act.startTime}
                </div>
                <div className="text-[11px] font-medium text-slate-500 leading-tight mt-0.5">
                  {act.endTime}
                </div>
              </div>

              <div className="w-px h-7 bg-slate-100 shrink-0" />

              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-900 truncate">
                  {act.subjectName}
                </div>
                <div className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                  {act.room ? `${act.room} · ` : ''}
                  {act.teacherName || t('dash.progress.teacherFallback')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
};

/* ---------------------------------------------------------------------- */
/* 2. Active assessment                                                   */
/* ---------------------------------------------------------------------- */

/**
 * @param {Array<{id, title, subjectName, dueAt}>} assessments  `dueAt` is ISO.
 * @param {boolean} isSample  sample rows do not navigate — see below.
 */
export const ActiveAssessment = ({ assessments = [], isLoading, isSample }) => {
  const navigate = useNavigate();
  const { t, lang } = useT();

  if (isLoading) return <WidgetSkeleton rows={2} />;

  const now = new Date();

  /*
    Slice first, then look for something urgent. Scanning the whole list and
    rendering only three of it meant the banner could warn about a deadline that
    was not on screen.
  */
  const shown = assessments.slice(0, 3).map((task) => {
    const daysLeft = daysUntil(task.dueAt, now);
    const due = new Date(task.dueAt);
    const date = Number.isNaN(due.getTime())
      ? null
      : due.toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'short' });

    return { ...task, daysLeft, date };
  });

  const urgent = shown.find((task) => task.daysLeft !== null && task.daysLeft <= 1);

  /*
    Colour by the date and nothing else. It used to read
    `daysLeft <= 1 || idx === 0`, which painted the first row red and the second
    amber whatever their deadlines said — so an assignment three weeks out wore a
    red badge showing its own distant date.
  */
  const toneOf = (daysLeft) => {
    if (daysLeft === null) return 'far';
    if (daysLeft <= 1) return 'soon';
    if (daysLeft <= 3) return 'near';
    return 'far';
  };

  const TONES = {
    soon: { dot: 'bg-rose-500', badge: 'bg-[#FEECEC] text-[#EF4444]' },
    near: { dot: 'bg-amber-500', badge: 'bg-[#FEF5E7] text-[#D97706]' },
    far: { dot: 'bg-emerald-500', badge: 'bg-[#EBFBF2] text-[#059669]' },
  };

  const dueTextOf = ({ daysLeft, date }) => {
    if (daysLeft === null) return t('dash.assessment.dueOn', { date: '—' });
    if (daysLeft <= 0) return t('dash.assessment.dueToday');
    if (daysLeft === 1) return t('dash.assessment.dueTomorrow');
    return t('dash.assessment.dueOn', { date });
  };

  const footer = urgent ? (
    <div className="bg-[#FFF0F0] border border-[#FFE0E0] rounded-xl p-3 mt-4 text-left">
      <div className="text-xs font-semibold text-rose-600 leading-tight">
        {t('dash.assessment.urgent', {
          title: urgent.title,
          when: t(urgent.daysLeft <= 0 ? 'dash.assessment.whenToday' : 'dash.assessment.whenTomorrow'),
        })}
      </div>
      <div className="text-[11px] text-rose-500 font-normal mt-0.5">
        {t('dash.assessment.urgentSub')}
      </div>
    </div>
  ) : null;

  return (
    <WidgetCard
      titleKey="dash.assessment.title"
      seeAllTo="/assessment"
      isSample={isSample}
      footer={footer}
    >
      {shown.length === 0 ? (
        <EmptyState icon={ListTodo} messageKey="dash.assessment.empty" />
      ) : (
        <div className="space-y-3.5">
          {shown.map((task) => {
            const tone = TONES[toneOf(task.daysLeft)];
            const badge =
              task.daysLeft !== null && task.daysLeft <= 1
                ? t('dash.assessment.badgeSoon')
                : task.date ?? '—';

            /*
              A sample row must not navigate. /assignment/:id is a real route
              whose page 404s against the API, and a made-up row that carries
              somebody to a broken page is the one place sample data stops being
              decorative and starts misleading.
            */
            const open = isSample ? undefined : () => navigate(`/assignment/${task.id}`);

            return (
              <div
                key={task.id}
                onClick={open}
                role={open ? 'button' : undefined}
                tabIndex={open ? 0 : undefined}
                onKeyDown={open ? (e) => (e.key === 'Enter' || e.key === ' ') && open() : undefined}
                className={`flex items-center justify-between gap-3 ${
                  open ? 'cursor-pointer group hover:opacity-85 transition-opacity' : ''
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${tone.dot}`} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate group-hover:text-brand transition-colors">
                      {task.title}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                      {task.subjectName || t('dash.assessment.subjectFallback')} · {dueTextOf(task)}
                    </div>
                  </div>
                </div>

                <span className={`shrink-0 text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${tone.badge}`}>
                  {badge}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
};

/* ---------------------------------------------------------------------- */
/* 3. Subjects and progress                                               */
/* ---------------------------------------------------------------------- */

/**
 * @param {Array<{classSubjectId, subjectName, teacherName, totalTasks, submittedTasks}>} courseProgress
 */
export const CourseProgress = ({ courseProgress = [], isLoading, isSample }) => {
  const { t } = useT();

  if (isLoading) return <WidgetSkeleton rows={2} />;

  return (
    <WidgetCard titleKey="dash.progress.title" seeAllTo="/classroom" isSample={isSample}>
      {courseProgress.length === 0 ? (
        <EmptyState icon={BookOpen} messageKey="dash.progress.empty" />
      ) : (
        <div className="space-y-4">
          {courseProgress.slice(0, 4).map((course) => {
            const total = Number(course.totalTasks) || 0;
            const done = Number(course.submittedTasks) || 0;
            const percent = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <div key={course.classSubjectId} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#EDF3FF] text-[#4F46E5] flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 opacity-80" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {course.subjectName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                      {course.teacherName || t('dash.progress.teacherFallback')}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <span className="text-[11px] font-bold text-slate-800">
                    {t('dash.progress.value', { done, total })}
                  </span>
                  <div className="w-24 sm:w-28 h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-brand rounded-full transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
};

/* ---------------------------------------------------------------------- */
/* 4. School announcements                                                */
/* ---------------------------------------------------------------------- */

/**
 * @param {Array<{id, title, body, createdAt, authorName}>} announcements
 */
export const SchoolAnnouncement = ({ announcements = [], isLoading, isSample }) => {
  const { t } = useT();

  if (isLoading) return <WidgetSkeleton rows={2} />;

  const now = new Date();

  /* Same vocabulary the navbar uses for its notifications, so the two agree. */
  const timeAgo = (iso) => {
    const days = daysUntil(iso, now);
    if (days === null) return t('shell.time.justNow');
    return days >= 0 ? t('dash.time.today') : t('shell.time.days', { n: -days });
  };

  return (
    <WidgetCard titleKey="dash.announcement.title" seeAllTo="/announcements" isSample={isSample}>
      {announcements.length === 0 ? (
        <EmptyState icon={Megaphone} messageKey="dash.announcement.empty" />
      ) : (
        <div className="space-y-3">
          {announcements.slice(0, 3).map((ann, idx) => {
            const meta = `${timeAgo(ann.createdAt)} · ${ann.authorName || t('dash.announcement.authorFallback')}`;

            // The newest one is worth looking at first, so it gets the card.
            if (idx === 0) {
              return (
                <div
                  key={ann.id}
                  className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-xl p-3.5 space-y-1 text-left"
                >
                  <div className="text-xs font-bold text-blue-700 leading-tight">{ann.title}</div>
                  <p className="text-[11px] text-blue-600/90 leading-relaxed font-normal">
                    {ann.body}
                  </p>
                  <div className="text-[9px] text-blue-400 font-medium pt-0.5">{meta}</div>
                </div>
              );
            }

            return (
              <div key={ann.id} className="space-y-0.5 text-left pt-1">
                <div className="text-xs font-bold text-slate-800 leading-tight">{ann.title}</div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-normal line-clamp-1">
                  {ann.body}
                </p>
                <div className="text-[9px] text-slate-500 font-medium">{meta}</div>
              </div>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
};
