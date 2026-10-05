import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, BookOpen, CalendarClock, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { sessionsService } from '../../services/sessionsService';
import { academicsService } from '../../services/academicsService';
import { sessionState } from '../Subjects/timetable';
import { openTeachingSessions, openYearLabels } from './teacherLessons';
import { holidaysService } from '../../services/holidaysService';
import { calendarItems, daysIndex, monthGrid, todayIso } from '../../utils/holidays';
import { KIND_STYLE } from '../../components/holidays/kindStyle';
import { Legend } from '../../components/holidays/HolidayParts';
import { localOf } from '../Attendance/attendance';
import { rowState } from '../Attendance/checkIn';
import { SessionStatusLine } from '../Attendance/TodaySessionsCard';
import { agendaOf, agendaStart, byDay, dayMarks, monthOf, monthRange, shiftMonth } from './lessonCalendar';

/*
  A student's month on /schedule (owner, 2026-10-03, after BINUSMAYA's "My
  Schedule"): lessons and the school's holidays together, as an agenda from
  today to the month's end on the left and a small month on the right. It
  replaced, for a student, both the twelve-month holiday calendar and the
  lesson grid; the Principal keeps the holiday calendar, where holidays are set.

  - Lessons: `GET /sessions/mine?from=&to=` per month (backend 2a281e7) — the
    class the student sat in at the time. Holidays: `GET /holidays?year=`, every
    member's, read once per year shown. A failed holiday read leaves the lessons.
  - Picking a day in the small month starts the list there, past days included,
    with their attendance. "Today" goes back to today.
  - No check-in here: a running meeting leads to /attendance — one place to
    check in, not two.

  A teacher gets the same page (`teacher`, owner 2026-10-03): their meetings come
  from `GET /sessions/teaching` a month at a time, as a student's from /mine
  (backend 1bd81ab; 2026-10-05, it replaced one read per assignment), a closed
  year's left out (teacherLessons.js); each row says the meeting's state as the
  timetable does (`sessionState`) instead of an attendance status. Nobody adds holidays here: that is the
  Principal's and a Vice Principal's, on their Calendar.
*/

/* What a teacher's months share, read once per page and cached in `cache`: which
   years are still open, and whether they teach anything now (for the empty state). */
const readTeaching = (cache) => {
  if (!cache.current) {
    cache.current = (async () => {
      const [years, rows] = await Promise.all([academicsService.academicYears(), academicsService.myClassSubjects()]);
      const openLabels = openYearLabels(years);
      const teaching = rows.filter(
        (row) => row.status === 'ACTIVE' && !row.endedAt && openLabels.has(row.semester?.academicYear)
      ).length;
      return { openLabels, teaching };
    })().catch((err) => {
      cache.current = null;
      throw err;
    });
  }
  return cache.current;
};

const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-left';

const STATUS_PILL = {
  PRESENT: 'bg-emerald-50 text-emerald-700',
  SICK: 'bg-amber-50 text-amber-700',
  EXCUSED: 'bg-sky-50 text-sky-700',
  ABSENT: 'bg-rose-50 text-rose-700',
};

const LEGEND_KINDS = ['NATIONAL', 'JOINT_LEAVE', 'SCHOOL'];

export const StudentLessonCalendar = ({ teacher = false }) => {
  const teachingCache = useRef(null);
  const { t, lang } = useT();
  const navigate = useNavigate();
  const { membership } = useAuth();
  const zone = membership?.school?.timeZone ?? null;
  const hasLocation = membership?.school?.hasLocation;
  const locale = lang === 'en' ? 'en-GB' : 'id-ID';

  /* "Today" is the school's day where its zone is known. */
  const today = useMemo(() => (zone ? localOf(new Date(), zone)?.date : null) ?? todayIso(), [zone]);
  const [shown, setShown] = useState(() => monthOf(today));
  /* A day picked in the small month; null follows agendaStart's default. */
  const [picked, setPicked] = useState(null);
  /* One day at a time unless "whole month" was asked for (owner, 2026-10-05). */
  const [wholeMonth, setWholeMonth] = useState(false);

  /* `{ key, answer }` once read; `failedKey` names the month whose read failed. */
  const [read, setRead] = useState(null);
  const [failedKey, setFailedKey] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${shown.year}-${shown.month}`;

  /* Holidays by year: `{ [year]: items }`, or `false` for a year whose read failed. */
  const [holidayYears, setHolidayYears] = useState({});

  useEffect(() => {
    let cancelled = false;
    const { from, to } = monthRange(shown.year, shown.month);
    const reading = teacher
      ? Promise.all([readTeaching(teachingCache), sessionsService.teaching({ from, to })]).then(
          ([{ openLabels, teaching }, answer]) => ({
            from,
            to,
            timeZone: answer?.timeZone ?? null,
            class: null,
            teaching,
            sessions: openTeachingSessions(answer?.sessions, openLabels),
          })
        )
      : sessionsService.mine({ from, to });
    reading
      .then((answer) => {
        if (cancelled) return;
        setRead({ key: `${shown.year}-${shown.month}`, answer });
        setFailedKey(null);
      })
      .catch(() => !cancelled && setFailedKey(`${shown.year}-${shown.month}`));
    return () => {
      cancelled = true;
    };
  }, [shown, attempt, teacher, zone]);

  const year = shown.year;
  const haveYear = holidayYears[year] !== undefined;
  useEffect(() => {
    if (haveYear) return undefined;
    let cancelled = false;
    holidaysService
      .calendar(year)
      .then((data) => !cancelled && setHolidayYears((prev) => ({ ...prev, [year]: calendarItems(data) })))
      .catch(() => !cancelled && setHolidayYears((prev) => ({ ...prev, [year]: false })));
    return () => {
      cancelled = true;
    };
  }, [year, haveYear]);

  const current = read?.key === key ? read.answer : null;
  const failed = failedKey === key;
  const holidayItems = holidayYears[year];
  const days = useMemo(() => byDay(current?.sessions), [current]);
  const holidays = useMemo(() => daysIndex(holidayItems || []), [holidayItems]);
  const weeks = useMemo(() => monthGrid(shown.year, shown.month), [shown]);

  const start = agendaStart(shown, today, picked);
  const { from: monthFirst } = monthRange(shown.year, shown.month);
  const agendaFrom = wholeMonth ? monthFirst : start;
  const agenda = useMemo(() => agendaOf(shown, agendaFrom, days, holidays), [shown, agendaFrom, days, holidays]);

  /* The day view (owner, 2026-10-05): the chosen day alone - today unless one was
     picked - and a centred "no activity" when it holds nothing. */
  const focusEntry = { date: start, holidays: holidays.get(start) ?? [], sessions: days.get(start) ?? [] };

  /* The agenda sits above the month on a phone: picking a day down there brings it into view. */
  const agendaRef = useRef(null);
  const pickDay = (date) => {
    setPicked(date);
    setWholeMonth(false);
    if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 1023px)').matches) {
      agendaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const go = (delta) => {
    setShown(shiftMonth(shown, delta));
    setPicked(null);
    setWholeMonth(false);
  };
  const goToday = () => {
    setShown(monthOf(today));
    setPicked(null);
    setWholeMonth(false);
  };

  const dayLabel = (date, style = 'long') =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, {
      weekday: style,
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  const monthTitle = new Date(Date.UTC(shown.year, shown.month, 1)).toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  /* 3 January 2000 was a Monday: the grid's first column. Short names, not
     one letter: "S S" for Saturday and Sunday was ambiguous (owner, 2026-10-03). */
  const weekdays = Array.from({ length: 7 }, (_, d) =>
    new Date(Date.UTC(2000, 0, 3 + d)).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }).replace(/\.$/, '')
  );

  const context = { hasLocation, className: current?.class?.name };
  const navButton =
    'w-9 h-9 shrink-0 flex items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand';

  const emptyKey = !current?.timeZone
    ? 'checkin.empty.noZone'
    : teacher
      ? current.teaching === 0
        ? 'lessons.teacher.none'
        : null
      : !current.class && days.size === 0
        ? 'checkin.empty.noClass'
        : null;

  /* One day of the agenda: its holidays and its meetings. */
  const renderDay = (entry) => (
    <li key={entry.date}>
      <h3 className="flex items-center gap-2 text-xs font-extrabold text-slate-800 capitalize">
        {dayLabel(entry.date)}
        {entry.date === today && (
          <span className="px-2 py-0.5 rounded-md bg-brand text-white text-[10px] font-extrabold normal-case">
            {t('lessons.today')}
          </span>
        )}
      </h3>
      <ul className="mt-2 space-y-2">
        {entry.holidays.map((holiday) => (
          <li
            key={`h-${holiday.id}`}
            className={`rounded-xl px-3 py-2 text-xs font-bold ${KIND_STYLE[holiday.kind]?.soft ?? 'bg-slate-100 text-slate-600'}`}
          >
            <span className="block break-words">{holiday.name}</span>
            <span className="block text-[10px] font-semibold opacity-80">{t(`holiday.kind.${holiday.kind}`)}</span>
          </li>
        ))}
        {entry.sessions.map((session) => {
          /* A teacher reads the meeting's own state; a student, their check-in. */
          const state = teacher ? null : rowState(session, context);
          const checkedAt = session.attendance?.checkedInAt
            ? localOf(session.attendance.checkedInAt, current.timeZone)
            : null;
          return (
            <li key={session.id} className="rounded-xl border border-slate-100 px-3 py-2.5 flex items-start gap-3">
              <span className="w-12 shrink-0 tabular-nums">
                <span className="block text-xs font-extrabold text-slate-800">{session.local.start}</span>
                <span className="block text-[11px] font-semibold text-slate-500">{session.local.end}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold text-slate-800 break-words">{session.subject?.name}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-bold">
                    {t('timetable.session.number', { n: session.number })}
                  </span>
                  {session.class && (
                    <span className="px-1.5 py-0.5 rounded-md bg-brand-tint text-brand font-extrabold">{session.class}</span>
                  )}
                </span>
                {teacher ? (
                  <span className="block text-[11px] font-semibold mt-1 text-slate-500">{t(sessionState(session))}</span>
                ) : (
                  <SessionStatusLine state={state} session={session} checkedAt={checkedAt} t={t} />
                )}
                {state === 'open' && (
                  <button
                    type="button"
                    onClick={() => navigate('/attendance')}
                    className="mt-1.5 text-[11px] font-bold text-brand hover:underline cursor-pointer"
                  >
                    {t('lessons.goCheckIn')}
                  </button>
                )}
                {/* The meeting's materials (backend bf6e9b5). Not for a meeting of a
                    class the student left: the server answers that one 404. */}
                {!teacher && state !== 'otherClass' && (
                  <button
                    type="button"
                    onClick={() => navigate(`/classroom/${session.classSubjectId}?pertemuan=${session.id}`)}
                    aria-label={t('content.openNamed', { subject: session.subject?.name ?? '', n: session.number })}
                    className="mt-2 flex w-fit items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-brand-tint text-brand text-[11px] font-extrabold hover:bg-brand hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('content.open')}
                  </button>
                )}
              </span>
              {session.attendance && (
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap ${STATUS_PILL[session.attendance.status] ?? 'bg-slate-100 text-slate-600'}`}
                >
                  {t(`att.status.${session.attendance.status}`)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </li>
  );

  return (
    <div className="space-y-4">
      {/* ‹ month › with Today beside it: the month sits between its two
          arrows (owner, 2026-10-03), at a fixed width so they do not jump. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go(-1)} className={navButton} aria-label={t('lessons.prev')}>
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <h2
            id="lesson-month"
            className="w-40 sm:w-48 text-center text-lg font-extrabold text-slate-800 tracking-tight capitalize"
          >
            {monthTitle}
          </h2>
          <button type="button" onClick={() => go(1)} className={navButton} aria-label={t('lessons.next')}>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          onClick={goToday}
          className="px-4 h-9 rounded-xl bg-slate-100 text-xs font-extrabold text-slate-700 hover:bg-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {t('lessons.today')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* The agenda */}
        <section ref={agendaRef} className={`${card} lg:col-span-2 scroll-mt-4 flex flex-col`} aria-labelledby="lesson-month" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <p className="text-[11px] font-semibold text-slate-500">
              {wholeMonth ? t('lessons.range', { date: dayLabel(monthFirst, 'short') }) : t('lessons.dayView')}
            </p>
            <button
              type="button"
              onClick={() => setWholeMonth((on) => !on)}
              className="text-[11px] font-bold text-brand hover:underline cursor-pointer"
            >
              {t(wholeMonth ? 'lessons.byDay' : 'lessons.wholeMonth')}
            </button>
          </div>

          {holidayItems === false && (
            <p className="mb-3 text-[11px] font-semibold text-amber-700">{t('lessons.holidayError')}</p>
          )}

          {failed && (
            <div className="flex flex-wrap items-center gap-3" role="alert">
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

          {!current && !failed && <p className="text-xs font-semibold text-slate-500 animate-pulse">{t('lessons.loading')}</p>}

          {current && (wholeMonth || emptyKey) && agenda.length === 0 && (
            <div className="py-14 flex flex-col items-center justify-center text-center">
              <span className="w-14 h-14 bg-brand-tint text-brand rounded-2xl flex items-center justify-center mb-3">
                <CalendarClock className="w-7 h-7" aria-hidden="true" />
              </span>
              <h3 className="text-sm font-extrabold text-slate-800">{t('lessons.empty.title')}</h3>
              <p className="text-xs font-semibold text-slate-500 mt-1 max-w-sm leading-relaxed">
                {emptyKey ? t(emptyKey) : t('lessons.empty.body', { date: dayLabel(agendaFrom, 'short') })}
              </p>
            </div>
          )}

          {current && wholeMonth && agenda.length > 0 && (
            <ol className="space-y-5">{agenda.map(renderDay)}</ol>
          )}

          {/* One day (owner, 2026-10-05): the chosen day, or a centred "no activity". */}
          {current && !wholeMonth && !(emptyKey && agenda.length === 0) && (
            focusEntry.holidays.length + focusEntry.sessions.length > 0 ? (
              <ol>{renderDay(focusEntry)}</ol>
            ) : (
              /* Fills the card, which the month beside it makes tall on a desktop, so
                 the empty state sits in the middle rather than under the date with a
                 blank half below (owner, 2026-10-05). */
              <div className="flex-1 flex flex-col">
                <h3 className="flex items-center gap-2 text-xs font-extrabold text-slate-800 capitalize">
                  {dayLabel(start)}
                  {start === today && (
                    <span className="px-2 py-0.5 rounded-md bg-brand text-white text-[10px] font-extrabold normal-case">
                      {t('lessons.today')}
                    </span>
                  )}
                </h3>
                <div className="flex-1 py-12 flex flex-col items-center justify-center text-center">
                  <span className="w-14 h-14 bg-brand-tint text-brand rounded-2xl flex items-center justify-center mb-3">
                    <CalendarClock className="w-7 h-7" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-extrabold text-slate-800">{t('lessons.noActivity')}</p>
                  <p className="mt-1 max-w-xs text-xs font-semibold text-slate-500 leading-relaxed">{t('lessons.noActivity.body')}</p>
                </div>
              </div>
            )
          )}
        </section>

        {/* The small month. Under the agenda on a phone since 2026-10-04 (owner: today
            first); picking a day there scrolls back up to it. */}
        <section className={`${card} self-start`} aria-label={monthTitle}>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdays.map((name, i) => (
              <div key={i} className="text-[10px] font-bold uppercase text-slate-500 py-1" aria-hidden="true">
                {name}
              </div>
            ))}
            {weeks.flat().map((date, i) => {
              if (!date) return <div key={`pad-${i}`} aria-hidden="true" />;
              const marks = dayMarks(days.get(date));
              const off = holidays.get(date)?.[0];
              const isStart = date === start;
              const isToday = date === today;
              const label = [
                dayLabel(date),
                off && off.name,
                marks.held > 0 && t('lessons.count', { n: marks.held }),
                marks.cancelled > 0 && t('lessons.cancelledCount', { n: marks.cancelled }),
              ]
                .filter(Boolean)
                .join(', ');
              /* The colour sits on a 36px square mark with rounded corners, not on
                 the whole cell: a cell is as wide as its column, so painting it drew
                 a tall oblong. A square, not a circle (owner, 2026-10-03: "rounded
                 rectangle, simetris"). The meeting dots sit under the mark. */
              const tone = isStart
                ? 'bg-brand text-white'
                : off
                  ? KIND_STYLE[off.kind]?.solid ?? 'bg-slate-200 text-slate-600'
                  : 'text-slate-700 group-hover:bg-slate-100';
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => pickDay(date)}
                  aria-pressed={isStart}
                  aria-label={label}
                  className="group h-12 flex flex-col items-center justify-start gap-1 text-xs font-bold cursor-pointer focus:outline-none [&:focus-visible>span:first-child]:ring-2 [&:focus-visible>span:first-child]:ring-brand"
                >
                  <span
                    className={`w-9 h-9 rounded-xl flex items-center justify-center tabular-nums transition-colors ${tone} ${
                      isToday && !isStart ? 'ring-2 ring-brand ring-inset' : ''
                    }`}
                  >
                    {Number(date.slice(8))}
                  </span>
                  <span className="flex items-center gap-0.5 h-1" aria-hidden="true">
                    {Array.from({ length: Math.min(marks.held, 3) }, (_, n) => (
                      <span key={n} className="w-1 h-1 rounded-full bg-brand" />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" aria-hidden="true" />
              {t('lessons.legend.lesson')}
            </p>
            <Legend kinds={LEGEND_KINDS} />
          </div>
        </section>
      </div>

    </div>
  );
};

export default StudentLessonCalendar;
