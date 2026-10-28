import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardCheck } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import StateWord from '../../TeacherAssessment/StateWord';
import { DASHBOARD_LIMIT, dashboardAssessments, shortWhen, waitingSinceText, windowText } from '../../TeacherAssessment/teacherAssessment';
import { Bone, HomeCard, HomeEmpty, HomeError } from './HomeCard';

/*
  The teacher's assessments on the dashboard (owner, 2026-10-08), in the place
  "Pengumpulan terbaru" held while it had no route: what waits to be marked or
  released, what is open now, what opens next and drafts not yet published, across
  every subject taught now (dashboardAssessments). The lists come from
  markingQueue.js (one GET /assessments/class-subjects/:id per live assignment, a
  list that fails left out), and what waits from `GET /dashboard/teaching`'s queue
  (owner, 2026-10-10 and 2026-10-27).

  The look since 2026-10-27 (the approved teacher mockup; the skill
  `.claude/skills/eduforid-design`): one text tab per group with its count - "Perlu
  ditinjau" amber while anything waits - opening on the first group that has any.
  A row is the title and its state pill, one grey slash line (class / subject /
  type / how long it has waited), then chips saying what to do: to mark (amber), to
  release now (purple) or from when (grey), or its window. A review row opens on
  the "Hasil" tab. Five rows a tab, the rest counted. The queue failing leaves the
  other groups and says so in one line.

  @param queue      readMarkingQueue's answer: undefined while reading, null when
                    it could not be read
  @param lists      readTeachingLists' answer, the same three states
  @param zone       the school's zone, for the windows
  @param className  the grid placement
*/

const GROUPS = ['review', 'open', 'upcoming', 'draft'];

const chip = 'px-2 py-0.5 rounded-lg text-[11.5px] font-bold';

export const AssessmentsCard = ({ queue, lists, zone, className = '' }) => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  /* Every item, grouped; `{ items, counts }`, or what the lists are: undefined reading, null failed. */
  const data = useMemo(
    () => (lists ? dashboardAssessments(lists, { waitingById: queue?.waitingById ?? {}, limit: Infinity }) : lists),
    [lists, queue]
  );
  const [chosen, setChosen] = useState(null);

  const reading = lists === undefined || queue === undefined;
  const card = (body) => (
    <HomeCard id="teacher-asm-heading" title={t('teacherDash.asm.title')} linkLabel={t('common.seeAll')} linkTo="/teacher/courses" className={className}>
      {queue === null && data && (
        <p className="mb-3 text-xs font-semibold text-rose-700" role="alert">
          {t('teacherDash.asm.queueFailed')}
        </p>
      )}
      {body}
    </HomeCard>
  );

  if (reading) {
    return card(
      <div aria-busy="true">
        <Bone className="h-8 w-4/5" />
        {[0, 1, 2].map((n) => (
          <div key={n} className="mt-4">
            <Bone className="h-3.5 w-3/4" />
            <Bone className="h-3 w-1/2 mt-2" />
            <Bone className="h-4 w-2/5 mt-2" />
          </div>
        ))}
      </div>
    );
  }
  if (data === null) return card(<HomeError message={t('teacherDash.asm.failed')} />);
  if (data.items.length === 0) return card(<HomeEmpty icon={ClipboardCheck} title={t('teacherDash.asm.empty')} body={t('teacherDash.asm.emptyHint')} />);

  /* The chosen tab, else the first group with anything in it. */
  const tab = chosen ?? GROUPS.find((group) => data.counts[group] > 0) ?? 'review';
  const inTab = data.items.filter((item) => item.group === tab);

  return card(
    <>
      <div role="tablist" className="flex gap-0.5 mb-1.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
        {GROUPS.map((group) => {
          const on = tab === group;
          const urgent = group === 'review' && data.counts.review > 0;
          return (
            <button
              key={group}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setChosen(group)}
              className={`px-2 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer rounded-t-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                on ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              {t(`teacherDash.asm.tab.${group}`)}
              <span
                className={`ml-1.5 px-1.5 rounded-full text-[11px] ${
                  urgent ? 'bg-amber-50 text-amber-700' : on ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {data.counts[group]}
              </span>
            </button>
          );
        })}
      </div>

      {inTab.length === 0 ? (
        <HomeEmpty icon={ClipboardCheck} title={t(`teacherDash.asm.none.${tab}`)} />
      ) : (
        <ul className="divide-y divide-slate-100">
          {inTab.slice(0, DASHBOARD_LIMIT).map(({ assessment, row, waiting }) => {
            const since = waiting ? waitingSinceText(waiting.since, zone) : null;
            const facts = [row.class?.name, row.subject?.code, t(`tasm.type.${assessment.type}`), since ? t(since.key, since.vars) : null].filter(Boolean);
            return (
              <li key={assessment.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/teacher/courses/${row.id}/penilaian/${assessment.id}${waiting ? '?tab=hasil' : ''}`)}
                  className="group w-full text-left px-2 py-3 rounded-xl flex items-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 text-sm font-bold text-slate-900 break-words">{assessment.title}</span>
                      <StateWord assessment={assessment} t={t} />
                    </span>
                    <span className="block text-xs text-slate-500">
                      {facts.map((fact, i) => (
                        <React.Fragment key={`${fact}-${i}`}>
                          {i > 0 && (
                            <>
                              {' '}
                              <span className="mx-1 text-slate-300" aria-hidden="true">
                                /
                              </span>{' '}
                            </>
                          )}
                          {fact}
                        </React.Fragment>
                      ))}
                    </span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5">
                      {waiting ? (
                        <>
                          {waiting.marking > 0 && <span className={`${chip} bg-amber-50 text-amber-700`}>{t('teacherDash.asm.toMark', { n: waiting.marking })}</span>}
                          {waiting.release > 0 &&
                            (waiting.releasableAt ? (
                              <span className={`${chip} bg-slate-100 text-slate-600`}>
                                {t('teacherDash.asm.releaseFrom', { n: waiting.release, when: shortWhen(waiting.releasableAt, zone, lang) })}
                              </span>
                            ) : (
                              <span className={`${chip} bg-brand-tint text-brand`}>{t('teacherDash.asm.toRelease', { n: waiting.release })}</span>
                            ))}
                        </>
                      ) : (
                        <span className={`${chip} bg-slate-100 text-slate-600 tabular-nums`}>{windowText(assessment, zone, lang)}</span>
                      )}
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {inTab.length > DASHBOARD_LIMIT && (
        <p className="mt-2 px-2 text-xs font-semibold text-slate-500">{t('teacherDash.asm.moreInTab', { n: inTab.length - DASHBOARD_LIMIT })}</p>
      )}
    </>
  );
};

export default AssessmentsCard;
