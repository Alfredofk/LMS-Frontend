import React, { Fragment } from 'react';
import { CircleAlert } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { initialsOf } from '../../utils/names';
import { formatDay } from '../Classes/format';
import { STATUSES, STATUS_DOT, STATUS_TEXT, localOf } from './attendance';

/*
  The pieces a meeting's roster shares between the teacher who confirms it
  (TeacherAttendance) and those who read it (SessionRoster: the homeroom teacher's
  class, the Principal's timetable). Mockup kehadiran-guru-wali.html (owner,
  2026-10-30, all thirteen items): a summary of the four statuses over one bar, a
  row per student with initials and one grey slash line, the status a coloured word,
  and a status's changes as a timeline.
*/

const eyebrow = 'block text-[10px] font-bold tracking-wider uppercase text-slate-500';

/**
 * The four statuses as cells with their counts, and a fifth cell (`extra`: `{ label,
 * n }`, the students not checked in or not recorded); under them one bar, each
 * status its share of `total`.
 */
export const AttendanceSummary = ({ counts, extra = null, total }) => {
  const { t } = useT();
  const cells = STATUSES.map((status) => ({ key: status, label: t(`att.status.${status}`), n: counts[status] ?? 0, tone: STATUS_TEXT[status] }));
  if (extra) cells.push({ key: 'extra', label: extra.label, n: extra.n, tone: 'text-slate-700' });
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5">
      <dl className={`grid grid-cols-3 gap-2 ${extra ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
        {cells.map((cell) => (
          <div key={cell.key} className="min-w-0">
            <dt className={eyebrow}>{cell.label}</dt>
            <dd className={`text-[22px] font-extrabold tracking-tight leading-tight tabular-nums ${cell.tone}`}>{cell.n}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-slate-200" aria-hidden="true">
        {total > 0 &&
          STATUSES.map((status) =>
            counts[status] ? <span key={status} className={`h-full ${STATUS_DOT[status]}`} style={{ width: `${(counts[status] / total) * 100}%` }} /> : null
          )}
      </div>
    </div>
  );
};

/** A status as a coloured word after a dot; none yet reads `unmarkedLabel` in grey. */
export const StatusWord = ({ status, unmarkedLabel }) => {
  const { t } = useT();
  const known = STATUS_TEXT[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-extrabold whitespace-nowrap ${known ?? 'text-slate-600'}`}>
      <span className={`w-2 h-2 rounded-full ${known ? STATUS_DOT[status] : 'bg-slate-300'}`} aria-hidden="true" />
      {known ? t(`att.status.${status}`) : unmarkedLabel}
    </span>
  );
};

/** A student's row head: round initials, the name (and `marker` after it), one grey slash line of `facts` (checkInFactsOf); `children` sit at the right. */
export const PersonLine = ({ name, marker = null, facts = [], children }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
    <span className="grid place-items-center w-[34px] h-[34px] shrink-0 rounded-full bg-brand-tint text-brand text-xs font-extrabold" aria-hidden="true">
      {initialsOf(name)}
    </span>
    <span className="min-w-[150px] flex-1">
      <span className="block text-sm font-bold text-slate-900 break-words">
        {name}
        {marker}
      </span>
      {facts.length > 0 && (
        <span className="block mt-px text-[12.5px] font-medium text-slate-500 tabular-nums">
          {facts.map((fact, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <span className="mx-1.5 text-slate-300" aria-hidden="true">
                  /
                </span>
              )}
              <span className={fact.late ? 'font-bold text-amber-700' : ''}>{fact.text}</span>
            </Fragment>
          ))}
        </span>
      )}
    </span>
    {children}
  </div>
);

/** Where a row's opened panel sits: under the name, past the initials. */
export const rowPanel = 'mt-2.5 sm:ml-[46px] rounded-xl border border-slate-200 bg-slate-50 p-3.5';

/** An error in a roster: a rose box with its icon. */
export const RosterError = ({ children, action = null }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-[13px] font-semibold leading-relaxed text-rose-700" role="alert">
    <span className="flex items-start gap-2.5 min-w-0">
      <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
      <span className="break-words">{children}</span>
    </span>
    {action}
  </div>
);

/** A few rows shaped like the roster, while it is read. */
export const RosterSkeleton = () => {
  const { t } = useT();
  return (
    <div className="space-y-3 animate-pulse motion-reduce:animate-none" aria-label={t('common.loading')}>
      <div className="h-[76px] rounded-xl bg-slate-100" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-[34px] h-[34px] rounded-full bg-slate-100" />
          <span className="flex-1 space-y-1.5">
            <span className="block h-3 w-2/5 rounded bg-slate-100" />
            <span className="block h-2.5 w-1/4 rounded bg-slate-100" />
          </span>
          <span className="hidden sm:block w-44 h-8 rounded-lg bg-slate-100" />
        </div>
      ))}
    </div>
  );
};

/**
 * A record's changes (`GET /attendance/:id/history`) as a timeline: "Alpa ke Sakit",
 * who and when, the note. `history` is `{ changes: null | [], error }`.
 */
export const HistoryTimeline = ({ history, zone, id }) => {
  const { t, lang } = useT();
  const when = (instant) => {
    const local = localOf(instant, zone);
    return local ? `${formatDay(local.date, lang)} ${local.time}` : '';
  };
  const word = (status) => (status ? t(`att.status.${status}`) : '-');
  let body;
  if (history.error) body = <p className="text-[13px] font-semibold text-rose-700" role="alert">{history.error}</p>;
  else if (history.changes === null) body = <p className="text-[13px] font-medium text-slate-500">{t('common.loading')}</p>;
  else if (history.changes.length === 0) body = <p className="text-[13px] font-medium text-slate-500">{t('roster.history.none')}</p>;
  else {
    body = (
      <ol className="space-y-3">
        {history.changes.map((change, i) => (
          <li key={change.id} className="relative pl-[22px]">
            <span className="absolute left-1 top-1.5 w-2 h-2 rounded-full bg-brand" aria-hidden="true" />
            {i < history.changes.length - 1 && <span className="absolute left-[7.5px] top-4 -bottom-3 w-px bg-slate-200" aria-hidden="true" />}
            <span className="block text-[13px] font-extrabold text-slate-900">{t('roster.history.change', { from: word(change.fromStatus), to: word(change.toStatus) })}</span>
            <span className="block text-xs font-medium text-slate-500 tabular-nums">
              {change.changedBy?.fullName ?? '-'}
              <span className="mx-1.5 text-slate-300" aria-hidden="true">
                /
              </span>
              {when(change.at)}
            </span>
            {change.note && <span className="block mt-0.5 text-[12.5px] font-medium text-slate-600 break-words">{change.note}</span>}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div id={id} className={rowPanel}>
      {body}
    </div>
  );
};
