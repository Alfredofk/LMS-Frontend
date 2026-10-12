import React, { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, ListTodo, UserRound, Wrench } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import { localOf } from '../../Attendance/attendance';
import { shortWhen, typeModeText } from '../../TeacherAssessment/teacherAssessment';
import { pathOf, whenOf, wordOf } from '../../StudentAssessment/studentMenu';

/*
  Two cards on the student dashboard. The assessments one is real since backend
  113ae37 (2026-10-12). Today's
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
/* 1. Assessments to do                                                   */
/* ---------------------------------------------------------------------- */

const MAX_TODO = 3;

/* The word after a row's facts; a plain "not started" says nothing here. */
const TODO_WORD_TONE = {
  IN_PROGRESS: 'text-sky-700',
  VOIDED: 'text-amber-700',
  LATE: 'text-amber-700',
};

/*
  What waits to be done across every subject (backend 113ae37; owner 2026-10-12),
  from the default semester's menu (readMyMenu): soonest deadline first, at most
  three and "+N more", each row as on a subject's "Penilaian" tab - the title, then
  "Matematika / Kuis daring / ditutup 19 Des 23:59", the deadline in red when it is
  today in the school's zone. A row opens the outline, or the attempt running.
  Nothing to do says so, and names the next one to open when there is one.

  @param todo   entries (todoAcross), undefined while reading, null when it failed
  @param next   the next one to open (nextUpcoming), or null
  @param zone   the school's zone
*/
export const ActiveAssessment = ({ todo, next = null, zone }) => {
  const navigate = useNavigate();
  const { t, lang } = useT();

  if (todo === undefined) return <WidgetSkeleton rows={2} />;

  const today = localOf(new Date().toISOString(), zone)?.date ?? null;
  const factsOf = (entry) => {
    const { assessment } = entry;
    const when = whenOf(entry);
    const closesToday = when.key === 'closes' && today && localOf(when.instant, zone)?.date === today;
    return [
      { text: assessment.classSubject.subject.name },
      { text: typeModeText(t, assessment) },
      { text: t(`smenu.when.${when.key}`, { when: shortWhen(when.instant, zone, lang) }), tone: closesToday ? 'text-rose-700' : '' },
    ];
  };

  return (
    <WidgetCard titleKey="dash.assessment.title" seeAllTo="/assessment">
      {todo === null ? (
        <EmptyState icon={ListTodo} messageKey="dash.att.failed" />
      ) : todo.length === 0 ? (
        <div className="space-y-3">
          <EmptyState icon={ListTodo} messageKey="dash.assessment.empty" />
          {next && (
            <p className="text-xs font-semibold text-slate-500">
              {t('dash.assessment.next', {
                title: next.assessment.title,
                when: t(`smenu.when.${whenOf(next).key}`, { when: shortWhen(whenOf(next).instant, zone, lang) }),
              })}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <ul className="divide-y divide-slate-100">
            {todo.slice(0, MAX_TODO).map((entry) => {
              const word = wordOf(entry);
              return (
                <li key={entry.assessment.id}>
                  <button
                    type="button"
                    onClick={() => navigate(pathOf(entry))}
                    className="group w-full text-left py-2.5 flex items-center gap-3 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <span className="min-w-0 flex-1 space-y-0.5">
                      <span className="block text-xs font-bold text-slate-800 break-words group-hover:text-brand transition-colors">{entry.assessment.title}</span>
                      {/* FactLine's look - grey, light slashes - in spans: a button takes no <p>. */}
                      <span className="block text-[11px] font-semibold text-slate-500">
                        {factsOf(entry).map((part, i) => (
                          <Fragment key={part.text}>
                            {i > 0 && (
                              <>
                                {' '}
                                <span className="mx-1 text-slate-300" aria-hidden="true">
                                  /
                                </span>{' '}
                              </>
                            )}
                            <span className={`whitespace-nowrap ${part.tone ?? ''}`}>{part.text}</span>
                          </Fragment>
                        ))}
                      </span>
                    </span>
                    {TODO_WORD_TONE[word] && <span className={`shrink-0 text-[11px] font-bold ${TODO_WORD_TONE[word]}`}>{t(`smenu.status.${word}`)}</span>}
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:text-brand" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
          {todo.length > MAX_TODO && <p className="text-xs font-semibold text-slate-500">{t('dash.assessment.more', { n: todo.length - MAX_TODO })}</p>}
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
                    {/* Code above the name, as on "Kelas Saya" (owner, 2026-10-04); no
                        icon tile since 2026-10-07. */}
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
