import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, Clock } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { attendanceService } from '../../services/attendanceService';
import { dayName, timeRange } from '../Subjects/timetable';
import { STATUSES, STATUS_DOT, localOf, summarize, bySubject, historyOf } from './attendance';
import TodaySessionsCard from './TodaySessionsCard';
import AttendanceSummaryCard from './AttendanceSummaryCard';
import Select from '../../components/ui/Select';
import EmptyCard from '../../components/ui/EmptyCard';
import FactLine from '../../components/ui/FactLine';
import { Bone, HomeError } from '../Dashboard/components/HomeCard';

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
  - The look since 2026-10-28 (the mockup the owner reviewed): no padding of its
    own inside MainLayout's (its title sat 32px in from every other page's), the
    slash line, a history row's facts as one grey line with "Terlambat" and "Di luar
    area sekolah" as words, a class named in grey rather than a chip, and the
    dashboards' failed, loading and empty states.
*/

const STATUS_PILL = {
  PRESENT: 'bg-emerald-50 text-emerald-700',
  SICK: 'bg-amber-50 text-amber-700',
  EXCUSED: 'bg-sky-50 text-sky-700',
  ABSENT: 'bg-rose-50 text-rose-700',
};

const pill = 'px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap';
const card = 'bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0';

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
      <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('att.title')}</h1>
      <FactLine
        className="mt-2"
        facts={[
          membership?.school?.name ?? membership?.schoolName,
          membership?.student?.class?.name,
          total.confirmed > 0 && t('att.confirmedCount', { n: total.confirmed }),
        ]}
      />
    </div>
  );

  const today = <TodaySessionsCard onCheckedIn={() => setAttempt((n) => n + 1)} />;

  const shell = (body) => (
    <div className="w-full flex flex-col gap-5 text-left">
      {heading}
      {today}
      {body}
    </div>
  );

  if (failed) {
    return shell(
      <HomeError
        message={`${t('att.error.title')}. ${t('att.error.body')}`}
        retryLabel={t('att.error.retry')}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  }

  if (rows === null) {
    return shell(
      <div className={card} aria-busy="true" aria-label={t('att.loading')}>
        <div className="flex items-center gap-4">
          <Bone className="w-20 h-20 rounded-full shrink-0" />
          <div className="flex-1">
            <Bone className="h-3.5 w-2/5" />
            <Bone className="h-3 w-3/5 mt-2" />
          </div>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return shell(
      <EmptyCard icon={CalendarCheck} title={t('att.empty.title')} body={t('att.empty.body')} />
    );
  }

  /* Most students sit in one class all along: name it only when the rows hold more than one. */
  const manyClasses = new Set(rows.map((row) => row.session.class)).size > 1;

  return shell(
    <>
      <AttendanceSummaryCard total={total} />

      {/* The same per subject: a bar split by status, with the counts in words under it. */}
      <section className={card} aria-labelledby="att-subjects">
        <h2 id="att-subjects" className="text-base font-extrabold text-slate-800 tracking-tight mb-1">
          {t('att.subjects.title')}
        </h2>
        <ul className="divide-y divide-slate-100">
          {subjects.map((group) => (
            <li key={group.key} className="py-4 last:pb-0">
              <div className="flex items-end justify-between gap-3">
                <span className="min-w-0">
                  {group.subject.code && (
                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-brand leading-none">
                      {group.subject.code}
                    </span>
                  )}
                  <span className="block mt-1 text-sm font-extrabold text-slate-800 break-words">
                    {group.subject.name}
                    {manyClasses && group.className && <span className="ml-2 text-xs font-semibold text-slate-500">{group.className}</span>}
                  </span>
                </span>
                <span className="shrink-0 text-lg font-extrabold text-slate-800 tabular-nums leading-none">
                  {group.rate === null ? '-' : `${group.rate}%`}
                </span>
              </div>
              <div className="mt-2.5 h-2 rounded-full bg-slate-100 overflow-hidden flex" aria-hidden="true">
                {group.confirmed > 0 &&
                  STATUSES.map((status) =>
                    group[status] > 0 ? (
                      <span
                        key={status}
                        className={`h-full ${STATUS_DOT[status]}`}
                        style={{ width: `${(group[status] / group.confirmed) * 100}%` }}
                      />
                    ) : null
                  )}
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500 tabular-nums">
                {STATUSES.map((status) => (
                  <span key={status} className="inline-flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
                    {statusLabel(status)} <span className="font-extrabold text-slate-700">{group[status]}</span>
                  </span>
                ))}
                {group.pending > 0 && (
                  <span className="inline-flex items-center gap-1 text-amber-700">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    {t('att.pendingCount', { n: group.pending })}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Every meeting, newest first: a date tile, what it was, and its status. */}
      <section className={card} aria-labelledby="att-history">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-1">
          <h2 id="att-history" className="text-base font-extrabold text-slate-800 tracking-tight">
            {t('att.log.title')}
          </h2>
          {subjects.length > 1 && (
            <div className="w-full sm:w-56">
              <Select
                size="sm"
                aria-label={t('att.filter.label')}
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
              >
                <option value="">{t('att.filter.all')}</option>
                {subjects.map((group) => (
                  <option key={group.key} value={group.key}>
                    {manyClasses && group.className ? `${group.subject.name} (${group.className})` : group.subject.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <ul className="divide-y divide-slate-100">
          {history.map((row) => {
            const start = localOf(row.session.startsAt, zone);
            const end = localOf(row.session.endsAt, zone);
            const checkedIn = row.checkedInAt ? localOf(row.checkedInAt, zone) : null;
            const cancelled = row.session.status !== 'SCHEDULED';
            const tile = start ? dateTile(start.date, lang) : null;
            return (
              <li key={row.id} className="py-3.5 last:pb-0 flex items-start gap-3.5">
                <span className="w-12 shrink-0 rounded-xl bg-slate-100 py-1.5 text-center leading-none">
                  {tile && (
                    <>
                      <span className="block text-[10px] font-extrabold uppercase text-slate-600">{tile.month}</span>
                      <span className="block mt-1 text-lg font-extrabold text-slate-800 tabular-nums">{tile.day}</span>
                      {tile.year && <span className="block mt-0.5 text-[10px] font-bold text-slate-600 tabular-nums">{tile.year}</span>}
                    </>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-slate-800 break-words">{row.session.subject.name}</span>
                  {/* One grey line (the reviewed mockup): the class when there are several,
                      the meeting, its day and time, the check-in. */}
                  <SlashLine
                    className="mt-0.5 tabular-nums"
                    parts={[
                      manyClasses && row.session.class,
                      t('timetable.session.number', { n: row.session.number }),
                      start && `${dayName(start.dayOfWeek, lang, 'short')}, ${timeRange(start.time, end?.time ?? start.time)}`,
                      checkedIn && t('att.checkedInAt', { time: checkedIn.time }),
                    ]}
                  />
                  {/* The flags as words, not chips; late stays amber, as a warning. */}
                  {(row.late || row.outsideSchool) && (
                    <SlashLine
                      className="mt-0.5"
                      parts={[
                        row.late && <span className="font-semibold text-amber-700">{t('att.flag.late')}</span>,
                        row.outsideSchool && t('att.flag.outside'),
                      ]}
                    />
                  )}
                </span>
                <span className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`${pill} ${STATUS_PILL[row.status] ?? 'bg-slate-100 text-slate-600'}`}>{statusLabel(row.status)}</span>
                  {cancelled ? (
                    <span className="text-[10px] font-semibold text-slate-500">{t('att.cancelled')}</span>
                  ) : (
                    !row.session.confirmed && (
                      <span className="text-[10px] font-semibold text-amber-700 text-right max-w-[7rem]">{t('att.pending')}</span>
                    )
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

/* Parts of one grey line, a light " / " between them; a part may be a node (late, in amber). */
const SlashLine = ({ parts, className = '' }) => (
  <span className={`flex flex-wrap items-baseline text-[12.5px] font-medium text-slate-500 ${className}`}>
    {parts.filter(Boolean).map((part, i) => (
      <React.Fragment key={i}>
        {i > 0 && (
          <span className="mx-1.5 text-slate-300" aria-hidden="true">
            /
          </span>
        )}
        <span className="whitespace-nowrap">{part}</span>
      </React.Fragment>
    ))}
  </span>
);

/* A meeting's day as a small tile: month and day, and the year when it is not this one. */
const dateTile = (iso, lang) => {
  const at = new Date(`${iso}T00:00:00Z`);
  return {
    month: at.toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', { month: 'short', timeZone: 'UTC' }).replace('.', ''),
    day: at.getUTCDate(),
    year: at.getUTCFullYear() !== new Date().getFullYear() ? at.getUTCFullYear() : null,
  };
};

export default AttendancePage;
