import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarCheck, Clock, MapPinOff, RefreshCw, UserCheck } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { attendanceService } from '../../services/attendanceService';
import { formatDay } from '../Classes/format';
import { dayName, timeRange } from '../Subjects/timetable';
import { STATUSES, localOf, summarize, bySubject, historyOf } from './attendance';
import TodaySessionsCard from './TodaySessionsCard';

/*
  A student's own attendance (owner, 2026-10-02), from `GET /attendance/me`
  (backend deb95e8) — see attendance.js for the row and the arithmetic.

  Three parts: the numbers over everything, the same per subject in each class,
  and every meeting newest first with a filter. Since backend 87f2670 the rows
  span every class the student sat in here, so a subject is counted per class
  (`groupKey`, owner 2026-10-03) and each meeting names its class. The calendar this page used to draw
  is gone: one day can hold several meetings, and it was drawn over a summary
  nobody sent. So is the streak, which no data supports.

  - Counted over confirmed meetings only. A check-in the teacher has not
    confirmed shows as waiting and is left out of every number but late/outside.
  - The school's own day and clock, from `/users/me`'s `timeZone`: the sign-in
    membership is thin, so the page reads `/users/me` once on mount, as
    SchoolPlaceCard does.
  - The teacher's note is not shown: `/:id/history` is staff only.
  - Today's meetings and the check-in button sit on top (`TodaySessionsCard`,
    the same card as on the dashboard; backend 87f2670, owner 2026-10-03). A
    check-in reads the history again, so the new record is counted at once.
*/

const STATUS_PILL = {
  PRESENT: 'bg-emerald-50 text-emerald-700',
  SICK: 'bg-amber-50 text-amber-700',
  EXCUSED: 'bg-amber-50 text-amber-700',
  ABSENT: 'bg-rose-50 text-rose-700',
};

const pill = 'px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap';
const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm';

export const AttendancePage = () => {
  const { t, lang } = useT();
  const { membership, refreshMe } = useAuth();
  const zone = membership?.school?.timeZone ?? null;

  /* null while reading and after a failed read; `failed` tells the two apart. */
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [groupFilter, setGroupFilter] = useState('');
  const [attempt, setAttempt] = useState(0);

  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    refreshMe().catch(() => {});
  }, [refreshMe]);

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
  }, [attempt]);

  const total = useMemo(() => summarize(rows), [rows]);
  const subjects = useMemo(() => bySubject(rows), [rows]);
  const history = useMemo(() => historyOf(rows, groupFilter), [rows, groupFilter]);

  const statusLabel = (status) => t(`att.status.${status}`);

  const heading = (
    <div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{t('att.title')}</h1>
      <p className="text-sm text-slate-500 font-semibold mt-1">{t('att.subtitle')}</p>
    </div>
  );

  const today = <TodaySessionsCard onCheckedIn={() => setAttempt((n) => n + 1)} />;

  const shell = (body) => (
    <div className="flex-1 overflow-y-auto bg-canvas p-4 sm:p-8 font-sans flex flex-col gap-5">
      {heading}
      {today}
      {body}
    </div>
  );

  if (failed) {
    return shell(
      <div className={`${card} flex flex-col items-start gap-3`} role="alert">
        <p className="flex items-center gap-2 text-sm font-extrabold text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t('att.error.title')}
        </p>
        <p className="text-xs font-semibold text-slate-500">{t('att.error.body')}</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-brand bg-brand-tint hover:bg-brand hover:text-white rounded-xl transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          {t('att.error.retry')}
        </button>
      </div>
    );
  }

  if (rows === null) {
    return shell(<p className="text-xs font-semibold text-slate-500 animate-pulse">{t('att.loading')}</p>);
  }

  if (rows.length === 0) {
    return shell(
      <div className={`${card} py-12 flex flex-col items-center text-center`}>
        <span className="w-12 h-12 bg-brand-tint text-brand rounded-2xl flex items-center justify-center mb-3">
          <CalendarCheck className="w-6 h-6" aria-hidden="true" />
        </span>
        <h2 className="text-sm font-extrabold text-slate-800">{t('att.empty.title')}</h2>
        <p className="text-xs font-semibold text-slate-500 mt-1 max-w-sm leading-relaxed">{t('att.empty.body')}</p>
      </div>
    );
  }

  const ratio = total.rate ?? 0;

  return shell(
    <>
      {/* The numbers over everything */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <section className={`${card} flex items-center gap-4`} aria-label={t('att.ratio')}>
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <path className="text-slate-100" strokeWidth="3.5" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              {total.rate !== null && (
                <path className="text-brand" strokeDasharray={`${ratio}, 100`} strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              )}
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-800 tabular-nums">
              {total.rate === null ? '—' : `${total.rate}%`}
            </span>
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-extrabold text-slate-700">{t('att.ratio')}</h2>
            <p className="text-[11px] text-slate-500 font-semibold mt-1 leading-relaxed">
              {t('att.ratio.detail', { n: total.confirmed })}
            </p>
            {total.pending > 0 && (
              <p className="text-[11px] text-amber-700 font-semibold mt-0.5">{t('att.pendingCount', { n: total.pending })}</p>
            )}
          </div>
        </section>

        <section className={`${card} flex items-center gap-4`} aria-label={t('att.breakdown.title')}>
          <span className="w-12 h-12 bg-brand-tint text-brand rounded-2xl flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xs font-extrabold text-slate-700">{t('att.breakdown.title')}</h2>
            <dl className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
              {STATUSES.map((status) => (
                <div key={status} className="flex items-baseline gap-1">
                  <dt className="text-[11px] font-semibold text-slate-500">{statusLabel(status)}</dt>
                  <dd className="text-sm font-extrabold text-slate-800 tabular-nums">{total[status]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className={`${card} flex items-center gap-4`} aria-label={t('att.flags.title')}>
          <span className="w-12 h-12 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-xs font-extrabold text-slate-700">{t('att.flags.title')}</h2>
            <p className="text-sm font-extrabold text-slate-800 mt-1 tabular-nums">{t('att.flags.late', { n: total.late })}</p>
            <p className="text-[11px] font-semibold text-slate-500 tabular-nums">{t('att.flags.outside', { n: total.outside })}</p>
          </div>
        </section>
      </div>

      {/* The same per subject */}
      <section className={card} aria-labelledby="att-subjects">
        <h2 id="att-subjects" className="text-base font-extrabold text-slate-800 tracking-tight mb-3">
          {t('att.subjects.title')}
        </h2>
        <ul className="divide-y divide-slate-100">
          {subjects.map((group) => (
            <li key={group.key} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-slate-800 break-words">{group.subject.name}</span>
                <span className="block text-[11px] font-semibold text-slate-500">
                  {group.className && `${group.className} · `}
                  {t('att.subjects.confirmed', { n: group.confirmed })}
                  {group.pending > 0 && ` · ${t('att.pendingCount', { n: group.pending })}`}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {STATUSES.map((status) => (
                  <span key={status} className={`${pill} ${STATUS_PILL[status]} tabular-nums`}>
                    {t(`att.short.${status}`)} {group[status]}
                  </span>
                ))}
                <span className="ml-1 text-sm font-extrabold text-slate-800 tabular-nums w-12 text-right">
                  {group.rate === null ? '—' : `${group.rate}%`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Every meeting, newest first */}
      <section className={card} aria-labelledby="att-history">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 id="att-history" className="text-base font-extrabold text-slate-800 tracking-tight">
            {t('att.log.title')}
          </h2>
          {subjects.length > 1 && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span className="sr-only">{t('att.filter.label')}</span>
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="w-full sm:w-56 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand cursor-pointer"
              >
                <option value="">{t('att.filter.all')}</option>
                {subjects.map((group) => (
                  <option key={group.key} value={group.key}>
                    {group.className ? `${group.subject.name} · ${group.className}` : group.subject.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <ul className="space-y-2">
          {history.map((row) => {
            const start = localOf(row.session.startsAt, zone);
            const end = localOf(row.session.endsAt, zone);
            const checkedIn = row.checkedInAt ? localOf(row.checkedInAt, zone) : null;
            const cancelled = row.session.status !== 'SCHEDULED';
            return (
              <li key={row.id} className="rounded-xl border border-slate-100 px-4 py-3 flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-xs font-extrabold text-slate-800 break-words">
                    {row.session.subject.name} · {t('timetable.session.number', { n: row.session.number })}
                  </span>
                  {row.session.class && (
                    <span className="block text-[11px] font-semibold text-slate-500 break-words">{row.session.class}</span>
                  )}
                  {start && (
                    <span className="block text-[11px] font-semibold text-slate-500 tabular-nums">
                      {t('timetable.session.when', {
                        day: dayName(start.dayOfWeek, lang, 'short'),
                        date: formatDay(start.date, lang),
                        time: timeRange(start.time, end?.time ?? start.time),
                      })}
                    </span>
                  )}
                  {checkedIn && (
                    <span className="block text-[11px] font-semibold text-slate-500 tabular-nums">
                      {t('att.checkedInAt', { time: checkedIn.time })}
                    </span>
                  )}
                  {(row.late || row.outsideSchool) && (
                    <span className="flex flex-wrap gap-1.5 mt-1">
                      {row.late && (
                        <span className={`${pill} bg-amber-50 text-amber-700 inline-flex items-center gap-1`}>
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {t('att.flag.late')}
                        </span>
                      )}
                      {row.outsideSchool && (
                        <span className={`${pill} bg-slate-100 text-slate-600 inline-flex items-center gap-1`}>
                          <MapPinOff className="w-3 h-3" aria-hidden="true" />
                          {t('att.flag.outside')}
                        </span>
                      )}
                    </span>
                  )}
                </span>
                <span className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`${pill} ${STATUS_PILL[row.status] ?? 'bg-slate-100 text-slate-600'}`}>{statusLabel(row.status)}</span>
                  {cancelled ? (
                    <span className="text-[10px] font-semibold text-slate-500">{t('att.cancelled')}</span>
                  ) : (
                    !row.session.confirmed && <span className="text-[10px] font-semibold text-amber-700 text-right">{t('att.pending')}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
};

export default AttendancePage;
