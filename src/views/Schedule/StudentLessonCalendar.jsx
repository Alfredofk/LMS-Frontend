import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CalendarClock, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { sessionsService } from '../../services/sessionsService';
import { monthGrid, todayIso } from '../../utils/holidays';
import { localOf } from '../Attendance/attendance';
import { rowState } from '../Attendance/checkIn';
import { SessionStatusLine } from '../Attendance/TodaySessionsCard';
import { byDay, dayMarks, monthOf, monthRange, openingDay, shiftMonth } from './lessonCalendar';

/*
  A student's lessons, a month at a time (owner, 2026-10-03) — the "lesson
  timetable" half of /schedule, which until backend 2a281e7 had no source for
  anybody. See lessonCalendar.js for the arithmetic.

  - The meetings of the class the student sat in at the time (the server's
    choice), so a month across a class move shows each class's own.
  - A cancelled meeting stays on its day, with why. The holidays themselves are
    the calendar above.
  - No check-in here: a meeting running now says so and leads to /attendance,
    where the button is — one place to check in, not two.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-left';

const STATUS_PILL = {
  PRESENT: 'bg-emerald-50 text-emerald-700',
  SICK: 'bg-amber-50 text-amber-700',
  EXCUSED: 'bg-amber-50 text-amber-700',
  ABSENT: 'bg-rose-50 text-rose-700',
};

export const StudentLessonCalendar = () => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const { membership } = useAuth();
  const zone = membership?.school?.timeZone ?? null;
  const hasLocation = membership?.school?.hasLocation;
  const locale = lang === 'en' ? 'en-GB' : 'id-ID';

  /* "Today" is the school's day where its zone is known. */
  const today = useMemo(() => (zone ? localOf(new Date(), zone)?.date : null) ?? todayIso(), [zone]);
  const [shown, setShown] = useState(() => monthOf(today));
  const [selected, setSelected] = useState(today);

  /* `{ key, answer }` once read; `failedKey` names the month whose read failed. */
  const [read, setRead] = useState(null);
  const [failedKey, setFailedKey] = useState(null);
  const [attempt, setAttempt] = useState(0);
  /* A month moved to opens on a day chosen once its meetings are in — the first
     with one — unless the reader picks a day before then. */
  const autoPick = useRef(false);
  const key = `${shown.year}-${shown.month}`;

  useEffect(() => {
    let cancelled = false;
    const { from, to } = monthRange(shown.year, shown.month);
    sessionsService
      .mine({ from, to })
      .then((answer) => {
        if (cancelled) return;
        setRead({ key: `${shown.year}-${shown.month}`, answer });
        setFailedKey(null);
        if (autoPick.current) {
          autoPick.current = false;
          setSelected(openingDay(shown, today, byDay(answer?.sessions)));
        }
      })
      .catch(() => !cancelled && setFailedKey(`${shown.year}-${shown.month}`));
    return () => {
      cancelled = true;
    };
  }, [shown, attempt, today]);

  const current = read?.key === key ? read.answer : null;
  const failed = failedKey === key;
  const days = useMemo(() => byDay(current?.sessions), [current]);
  const weeks = useMemo(() => monthGrid(shown.year, shown.month), [shown]);

  const go = (delta) => {
    const next = shiftMonth(shown, delta);
    setShown(next);
    setSelected(openingDay(next, today, null));
    autoPick.current = true;
  };

  const monthTitle = new Date(Date.UTC(shown.year, shown.month, 1)).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  /* 3 January 2000 was a Monday: the grid's first column. */
  const weekdays = Array.from({ length: 7 }, (_, d) =>
    new Date(Date.UTC(2000, 0, 3 + d)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })
  );
  const selectedTitle = new Date(`${selected}T00:00:00Z`).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

  const list = days.get(selected) ?? [];
  const context = { hasLocation, className: current?.class?.name };
  const navButton = 'w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      <section className={`${card} xl:col-span-3`} aria-labelledby="lesson-month">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 id="lesson-month" className="text-sm font-extrabold text-slate-800 tracking-tight capitalize">
            {monthTitle}
          </h3>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => go(-1)} className={navButton} aria-label={t('lessons.prev')}>
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setShown(monthOf(today));
                setSelected(today);
              }}
              className="px-2.5 h-8 rounded-xl text-[11px] font-bold text-brand hover:bg-brand-tint cursor-pointer"
            >
              {t('lessons.today')}
            </button>
            <button type="button" onClick={() => go(1)} className={navButton} aria-label={t('lessons.next')}>
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center" aria-busy={!current && !failed}>
          {weekdays.map((name) => (
            <div key={name} className="text-[10px] font-bold uppercase text-slate-500 py-1" aria-hidden="true">
              {name}
            </div>
          ))}
          {weeks.flat().map((date, i) => {
            if (!date) return <div key={`pad-${i}`} aria-hidden="true" />;
            const marks = dayMarks(days.get(date));
            const isSelected = date === selected;
            const isToday = date === today;
            const label = [
              new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }),
              marks.held > 0 && t('lessons.count', { n: marks.held }),
              marks.cancelled > 0 && t('lessons.cancelledCount', { n: marks.cancelled }),
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <button
                key={date}
                type="button"
                onClick={() => {
                  autoPick.current = false;
                  setSelected(date);
                }}
                aria-pressed={isSelected}
                aria-label={label}
                className={`relative h-12 sm:h-14 rounded-xl flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors cursor-pointer ${
                  isSelected ? 'bg-brand text-white' : isToday ? 'bg-brand-tint text-brand' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="tabular-nums">{Number(date.slice(8))}</span>
                <span className="flex items-center gap-0.5 h-1.5" aria-hidden="true">
                  {Array.from({ length: Math.min(marks.held, 3) }, (_, n) => (
                    <span key={n} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-brand'}`} />
                  ))}
                  {marks.cancelled > 0 && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/60' : 'bg-slate-300'}`} />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {failed && (
          <div className="mt-4 flex flex-wrap items-center gap-3" role="alert">
            <p className="flex items-center gap-2 text-xs font-extrabold text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              {t('lessons.error')}
            </p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-brand bg-brand-tint hover:bg-brand hover:text-white rounded-xl transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              {t('att.error.retry')}
            </button>
          </div>
        )}
      </section>

      <section className={`${card} xl:col-span-2`} aria-labelledby="lesson-day" aria-live="polite">
        <h3 id="lesson-day" className="text-sm font-extrabold text-slate-800 tracking-tight capitalize">
          {selectedTitle}
        </h3>
        <div className="mt-4">
          {!current && !failed && <p className="text-xs font-semibold text-slate-500 animate-pulse">{t('lessons.loading')}</p>}
          {current && list.length === 0 && (
            <div className="py-8 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
              <CalendarClock className="w-7 h-7 text-slate-300 mb-2" aria-hidden="true" />
              <p className="text-xs font-semibold text-slate-600 max-w-xs leading-relaxed">
                {t(!current.timeZone ? 'checkin.empty.noZone' : !current.class && days.size === 0 ? 'checkin.empty.noClass' : 'lessons.empty.day')}
              </p>
            </div>
          )}
          {list.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {list.map((session) => {
                const state = rowState(session, context);
                const checkedAt = session.attendance?.checkedInAt ? localOf(session.attendance.checkedInAt, current.timeZone) : null;
                return (
                  <li key={session.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                    <span className="w-14 shrink-0 tabular-nums">
                      <span className="block text-xs font-extrabold text-slate-800">{session.local.start}</span>
                      <span className="block text-[11px] font-semibold text-slate-500">{session.local.end}</span>
                    </span>
                    <span className="w-px self-stretch bg-slate-100 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-extrabold text-slate-800 break-words">{session.subject?.name}</span>
                      <span className="block text-[11px] font-semibold text-slate-500 break-words">
                        {t('timetable.session.number', { n: session.number })} · {session.class}
                      </span>
                      <SessionStatusLine state={state} session={session} checkedAt={checkedAt} t={t} />
                      {state === 'open' && (
                        <button
                          type="button"
                          onClick={() => navigate('/attendance')}
                          className="mt-1.5 text-[11px] font-bold text-brand hover:underline cursor-pointer"
                        >
                          {t('lessons.goCheckIn')}
                        </button>
                      )}
                    </span>
                    {session.attendance && (
                      <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap ${STATUS_PILL[session.attendance.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {t(`att.status.${session.attendance.status}`)}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};

export default StudentLessonCalendar;
