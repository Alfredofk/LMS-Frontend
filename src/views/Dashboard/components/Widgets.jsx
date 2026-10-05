import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ListTodo, Calendar, UserRound, Wrench } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';

/*
  Two cards on the student dashboard, still waiting for their endpoints. Today's
  activities became TodaySessionsCard on real data, and school announcements became
  PinnedAnnouncements at the top of the page (owner, 2026-10-03).

  Both are presentational: they take their data as a prop and fetch nothing.
  That is not a temporary arrangement waiting for endpoints — it is what lets the
  same components render sample data today and a real payload tomorrow without
  being touched.

  `notBuilt` is the third state, beside loading and a payload: the endpoint
  behind the card does not exist yet. It keeps the card's heading, so the
  dashboard still shows what it will hold, and replaces the body with "not
  available yet" — never the card's own empty message, because "no activities
  today" is a claim about the student that nobody has made.

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
const WidgetCard = ({ titleKey, seeAllTo, notBuilt, footer, children }) => {
  const navigate = useNavigate();
  const { t } = useT();

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200">
      <div>
        <div className="flex items-center justify-between gap-2 pb-4">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-extrabold text-slate-800 tracking-tight leading-snug">
              {t(titleKey)}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => navigate(seeAllTo)}
            className="shrink-0 text-xs text-brand hover:underline font-semibold cursor-pointer"
          >
            {t('common.seeAll')}
          </button>
        </div>

        {notBuilt ? <EmptyState icon={Wrench} messageKey="common.notBuilt.title" /> : children}
      </div>

      {!notBuilt && footer}
    </div>
  );
};

/* ---------------------------------------------------------------------- */
/* 1. Active assessment                                                   */
/* ---------------------------------------------------------------------- */

/**
 * @param {Array<{id, title, subjectName, dueAt}>} assessments  `dueAt` is ISO.
 */
export const ActiveAssessment = ({ assessments = [], isLoading, notBuilt }) => {
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
    if (daysLeft === null) return t('dash.assessment.dueOn', { date: '-' });
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
      notBuilt={notBuilt}
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
                : task.date ?? '-';

            const open = () => navigate(`/assignment/${task.id}`);

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
                      {task.subjectName || t('dash.assessment.subjectFallback')}, {dueTextOf(task)}
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
/* 2. Subjects and progress                                               */
/* ---------------------------------------------------------------------- */

/**
 * @param {Array<{classSubjectId, subjectName, teacherName, totalTasks, submittedTasks}>} courseProgress
 */
/*
  The subjects of the student's class this semester and how far each has come,
  in meetings held (owner, 2026-10-04) - the data "Kelas Saya" reads
  (views/Classroom/readMyClasses.js). A row opens the subject.

  @param subjects  [{ entry, progress }] from currentSubjects, or null while reading
  @param failed    the read failed
*/
export const CourseProgress = ({ subjects, failed }) => {
  const { t } = useT();
  const navigate = useNavigate();

  if (subjects === null && !failed) return <WidgetSkeleton rows={3} />;

  return (
    <WidgetCard titleKey="dash.progress.title" seeAllTo="/classroom">
      {failed ? (
        <EmptyState icon={BookOpen} messageKey="dash.progress.failed" />
      ) : subjects.length === 0 ? (
        <EmptyState icon={BookOpen} messageKey="dash.progress.empty" />
      ) : (
        <ul className="space-y-1">
          {subjects.slice(0, 5).map(({ entry, progress }) => {
            const total = progress?.total ?? 0;
            const done = progress?.held ?? 0;
            const percent = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/classroom/${entry.id}`)}
                  className="w-full flex items-center justify-between gap-3 rounded-xl px-2 py-2 -mx-2 text-left hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 rounded-xl bg-brand-tint text-brand flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5" aria-hidden="true" />
                    </span>
                    {/* Code above the name, as on "Kelas Saya" (owner, 2026-10-04). */}
                    <span className="min-w-0">
                      {entry.subject.code && (
                        <span className="block text-[10px] font-extrabold uppercase tracking-wider text-brand leading-none">
                          {entry.subject.code}
                        </span>
                      )}
                      <span className="block mt-1 text-sm font-extrabold text-slate-900 leading-tight break-words">
                        {entry.subject.name}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500 min-w-0">
                        <UserRound className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span className="break-words min-w-0">{entry.teacher?.fullName}</span>
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="text-[11px] font-bold text-slate-800 tabular-nums">
                      {progress ? t('dash.progress.value', { done, total }) : '-'}
                    </span>
                    <span className="block w-24 sm:w-28 h-1 bg-slate-100 rounded-full overflow-hidden mt-1" aria-hidden="true">
                      <span className="block h-full bg-brand rounded-full" style={{ width: `${percent}%` }} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
};
