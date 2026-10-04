import React from 'react';
import { Award, BookOpenCheck, CheckCircle2, Eye, Trophy, Wrench } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import { localOf } from '../../Attendance/attendance';
import { formatDay } from '../../Classes/format';

/*
  The student's own progress beside today's schedule (owner, 2026-10-03; on real
  data 2026-10-04).

  - Materials opened and completed, out of those published in this semester's
    subjects, from `GET /tracking/me/progress` (backend 0dd8b44) added up by
    progressTotals (views/Classroom/myProgress.js), and the last activity.
  - Assignments on time and the average score have no backend yet, so their rows
    say "not available yet" instead of drawing an empty bar.
  - The "Top 3 in class" tab is gone (owner, 2026-10-04): the backend shows a
    student their own row only - no peer, no average, no rank (tracking.service.js,
    spec invariant 7) - so it could never have had data.

  @param totals  progressTotals(...); undefined while reading, null when the read failed
  @param zone    the school's time zone (WIB/WITA/WIT), for the last activity
*/

const NOT_BUILT = [
  { key: 'onTime', icon: CheckCircle2, labelKey: 'dash.board.metric.onTime' },
  { key: 'average', icon: Award, labelKey: 'dash.board.metric.average' },
];

export const ProgressBoard = ({ totals, zone = null }) => {
  const { t, lang } = useT();
  const loading = totals === undefined;
  const failed = totals === null;

  const metrics = [
    { key: 'completed', icon: BookOpenCheck, labelKey: 'dash.board.metric.completed', bar: 'bg-emerald-500', done: totals?.completed, rate: totals?.completedRate },
    { key: 'opened', icon: Eye, labelKey: 'dash.board.metric.opened', bar: 'bg-brand', done: totals?.opened, rate: totals?.openedRate },
  ];

  let note = null;
  if (failed) note = <span className="text-amber-700">{t('dash.board.failed')}</span>;
  else if (!loading && totals.published === 0) note = t('dash.board.noMaterials');
  else if (!loading && totals.lastActivityAt) {
    /* The school's zone is WIB/WITA/WIT, not an IANA name, so it goes through localOf. */
    const at = localOf(totals.lastActivityAt, zone);
    note = at ? t('dash.board.lastActivity', { when: `${formatDay(at.date, lang)}, ${at.time}` }) : null;
  } else if (!loading) note = t('dash.board.noActivity');

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col" aria-labelledby="board-title" aria-busy={loading}>
      <div className="flex items-center gap-2.5 mb-5">
        <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <Trophy className="w-4.5 h-4.5" aria-hidden="true" />
        </span>
        <h2 id="board-title" className="text-base font-extrabold text-slate-800 tracking-tight">
          {t('dash.board.title')}
        </h2>
      </div>

      <ul className="space-y-4">
        {metrics.map(({ key, icon, labelKey, bar, done, rate }) => {
          const Icon = icon;
          const shown = !loading && !failed && rate !== null && rate !== undefined;
          return (
            <li key={key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5 min-w-0">
                  <Icon className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t(labelKey)}</span>
                </span>
                {loading ? (
                  <span className="block h-3 w-16 rounded bg-slate-100 animate-pulse" />
                ) : (
                  <span className="tabular-nums text-slate-800 whitespace-nowrap">
                    {shown ? t('dash.board.of', { done, total: totals.published }) : '-'}
                  </span>
                )}
              </div>
              <div
                className="h-2.5 rounded-full bg-slate-100 overflow-hidden"
                role="meter"
                aria-label={t(labelKey)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={shown ? rate : undefined}
              >
                <div className={`h-full rounded-full ${bar}`} style={{ width: `${shown ? rate : 0}%` }} />
              </div>
            </li>
          );
        })}

        {NOT_BUILT.map(({ key, icon, labelKey }) => {
          const Icon = icon;
          return (
            <li key={key} className="flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
              <span className="flex items-center gap-1.5 min-w-0">
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="leading-snug">{t(labelKey)}</span>
              </span>
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-extrabold">
                <Wrench className="w-3 h-3" aria-hidden="true" />
                {t('dash.board.notYet')}
              </span>
            </li>
          );
        })}
      </ul>

      {note && <p className="mt-auto pt-4 text-[11px] font-semibold text-slate-500 leading-relaxed">{note}</p>}
    </section>
  );
};

export default ProgressBoard;
