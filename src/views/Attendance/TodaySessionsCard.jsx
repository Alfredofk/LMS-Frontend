import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CalendarClock, Clock, Loader2, MapPin, MapPinOff, RefreshCw } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { sessionsService } from '../../services/sessionsService';
import { attendanceService } from '../../services/attendanceService';
import { checkInErrorMessage, isStaleCheckIn } from '../../i18n/apiError';
import { localOf } from './attendance';
import { PositionError, focusOf, nextReadIn, readPosition, rowState, withCheckIn } from './checkIn';

/*
  Today's meetings, with the check-in button (owner, 2026-10-03) — on the
  student dashboard and at the top of /attendance. See checkIn.js for what each
  row shows and when the card reads again.

  - One request for the day: `GET /sessions/mine` with nothing, so "today" is the
    school's, not the device's.
  - A check-in asks the browser for a fresh position, then sends it. Outside the
    school's 150 m it is still taken, flagged — the row says so, and why.
  - A refusal (CONFLICT / NOT_FOUND) means the card is behind: it says why and
    reads the day again.
  - `onCheckedIn` lets the page around it count the new record.
  - `focus` (the dashboard, owner 2026-10-03): one meeting — on now, else next
    (`focusOf`) — with "N more today · See all" to open the day in place. A
    day that is over or wholly cancelled folds to one line. /attendance shows
    the whole day.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-left';
const pill = 'px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap';

const STATUS_PILL = {
  PRESENT: 'bg-emerald-50 text-emerald-700',
  SICK: 'bg-amber-50 text-amber-700',
  EXCUSED: 'bg-amber-50 text-amber-700',
  ABSENT: 'bg-rose-50 text-rose-700',
};

/* A reading older than this is taken again when the tab comes back into view. */
const STALE_AFTER = 60 * 1000;

const headingDate = (iso, lang) =>
  iso
    ? new Date(`${iso}T00:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })
    : '';

export const TodaySessionsCard = ({ onCheckedIn, focus = false }) => {
  const { t, lang } = useT();
  const { membership } = useAuth();
  const hasLocation = membership?.school?.hasLocation;

  /* undefined while first reading; null after a failed first read. */
  const [day, setDay] = useState(undefined);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /* `{ sessionId, step: 'locating' | 'sending' }` while a check-in runs. */
  const [busy, setBusy] = useState(null);
  /* `{ sessionId, tone: 'ok' | 'error', lines: [string] }` — the last check-in's outcome. */
  const [notice, setNotice] = useState(null);
  const readAt = useRef(0);
  /* In focus mode: the whole day opened in place. */
  const [expanded, setExpanded] = useState(false);

  const readAgain = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    sessionsService
      .mine()
      .then((answer) => {
        if (cancelled) return;
        readAt.current = Date.now();
        setDay(answer ?? { sessions: [] });
        setFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        /* A failed refresh keeps what is on screen; only a failed first read says so. */
        setDay((previous) => (previous === undefined ? null : previous));
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  /* Read again at the next start or end, so a button appears when its meeting begins. */
  useEffect(() => {
    if (!day?.sessions) return undefined;
    const wait = nextReadIn(day.sessions, { hasLocation, className: day.class?.name });
    if (wait === null) return undefined;
    const timer = setTimeout(readAgain, wait);
    return () => clearTimeout(timer);
  }, [day, hasLocation, readAgain]);

  /* A tab left open over a break: read again when it is looked at. */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - readAt.current > STALE_AFTER) readAgain();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [readAgain]);

  const checkIn = async (session) => {
    if (busy) return;
    setNotice(null);
    setBusy({ sessionId: session.id, step: 'locating' });
    try {
      const position = await readPosition();
      setBusy({ sessionId: session.id, step: 'sending' });
      const answer = await attendanceService.checkIn(session.id, position);
      const attendance = answer?.attendance;
      if (attendance) setDay((current) => withCheckIn(current, session.id, attendance));
      const at = attendance?.checkedInAt ? localOf(attendance.checkedInAt, day?.timeZone) : null;
      const lines = [t('checkin.done', { time: at?.time ?? '' })];
      if (attendance?.late) lines.push(t('checkin.done.late'));
      if (attendance?.outsideSchool) lines.push(t('checkin.done.outside'));
      setNotice({ sessionId: session.id, tone: 'ok', lines });
      onCheckedIn?.();
    } catch (err) {
      const text =
        err instanceof PositionError ? t(`checkin.position.${err.reason}`) : checkInErrorMessage(err, t);
      setNotice({ sessionId: session.id, tone: 'error', lines: [text] });
      if (isStaleCheckIn(err)) readAgain();
    } finally {
      setBusy(null);
    }
  };

  const heading = (
    <div className="flex items-start justify-between gap-3 pb-4">
      <div className="min-w-0">
        <h2 id="today-sessions" className="text-sm font-extrabold text-slate-800 tracking-tight">{t('checkin.title')}</h2>
        {day && (
          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
            {headingDate(day.from, lang)}
            {day.class?.name ? ` · ${day.class.name}` : ''}
          </p>
        )}
      </div>
      {day && failed && (
        <button
          type="button"
          onClick={readAgain}
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" aria-hidden="true" />
          {t('checkin.refreshFailed')}
        </button>
      )}
    </div>
  );

  if (day === undefined) {
    return (
      <section className={card} aria-busy="true">
        {heading}
        <p className="text-xs font-semibold text-slate-500 animate-pulse">{t('checkin.loading')}</p>
      </section>
    );
  }

  if (day === null) {
    return (
      <section className={card}>
        {heading}
        <div className="flex flex-col items-start gap-3" role="alert">
          <p className="flex items-center gap-2 text-xs font-extrabold text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            {t('checkin.error.read')}
          </p>
          <button
            type="button"
            onClick={readAgain}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-brand bg-brand-tint hover:bg-brand hover:text-white rounded-xl transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('att.error.retry')}
          </button>
        </div>
      </section>
    );
  }

  const sessions = day.sessions ?? [];
  const context = { hasLocation, className: day.class?.name };
  const view = focus && !expanded && sessions.length > 0 ? focusOf(sessions, context) : null;

  /* Folded to one slim row (owner, 2026-10-03): it leads the dashboard, and a
     weekend, a holiday or a day already over should not push everything else down. */
  const slim = (message, action) => (
    <section className="bg-white border border-slate-100 rounded-2xl px-5 py-3.5 shadow-sm text-left flex items-center gap-3" aria-labelledby="today-sessions">
      <span className="w-9 h-9 bg-brand-tint text-brand rounded-xl flex items-center justify-center shrink-0">
        <CalendarClock className="w-4.5 h-4.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-slate-500">
          <h2 id="today-sessions" className="inline text-xs font-extrabold text-slate-800">
            {t('checkin.title')}
          </h2>
          {' · '}
          {headingDate(day.from, lang)}
          {day.class?.name ? ` · ${day.class.name}` : ''}
        </div>
        <p className="text-xs font-semibold text-slate-600 mt-0.5 leading-relaxed">{message}</p>
        {action}
      </div>
      {failed && (
        <button
          type="button"
          onClick={readAgain}
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
          aria-label={t('checkin.refreshFailed')}
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
    </section>
  );

  /* "See all" opens the day in place; "Show less" folds it back to one meeting. */
  const toggle = (label, open) => (
    <button
      type="button"
      onClick={() => setExpanded(open)}
      aria-expanded={!open}
      className="text-[11px] font-bold text-brand hover:underline cursor-pointer"
    >
      {label}
    </button>
  );

  if (sessions.length === 0) {
    const emptyKey = !day.timeZone ? 'checkin.empty.noZone' : !day.class ? 'checkin.empty.noClass' : 'checkin.empty.none';
    return slim(t(emptyKey));
  }
  if (view?.kind === 'done') {
    return slim(
      t('checkin.focus.done', { checked: view.checkedIn, n: view.total }),
      toggle(t('checkin.focus.seeAll', { n: sessions.length }), true)
    );
  }
  if (view?.kind === 'cancelled') {
    return slim(t('checkin.focus.allCancelled'), toggle(t('checkin.focus.seeAll', { n: sessions.length }), true));
  }

  const shown = view ? [view.session] : sessions;

  return (
    <section className={card} aria-labelledby="today-sessions">
      {heading}
      {view && (
        <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand mb-2">
          {t(`checkin.focus.${view.kind}`)}
        </p>
      )}
      <ul className="divide-y divide-slate-100">
        {shown.map((session) => {
          const state = rowState(session, context);
          const attendance = session.attendance;
          const checkedAt = attendance?.checkedInAt ? localOf(attendance.checkedInAt, day.timeZone) : null;
          const running = busy?.sessionId === session.id;
          const own = notice?.sessionId === session.id ? notice : null;
          return (
            <li key={session.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start gap-3">
                <span className="w-14 shrink-0 tabular-nums">
                  <span className="block text-xs font-extrabold text-slate-800">{session.local?.start}</span>
                  <span className="block text-[11px] font-semibold text-slate-500">{session.local?.end}</span>
                </span>
                <span className="w-px self-stretch bg-slate-100 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-extrabold text-slate-800 break-words">{session.subject?.name}</span>
                  <span className="block text-[11px] font-semibold text-slate-500">
                    {t('timetable.session.number', { n: session.number })}
                    {state === 'otherClass' && ` · ${session.class}`}
                  </span>
                  <SessionStatusLine state={state} session={session} checkedAt={checkedAt} t={t} />
                  {state === 'open' && (
                    <button
                      type="button"
                      onClick={() => checkIn(session)}
                      disabled={Boolean(busy)}
                      className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-white bg-brand hover:bg-brand-deep rounded-xl transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {running ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      {running ? t(`checkin.step.${busy.step}`) : t('checkin.action')}
                    </button>
                  )}
                </span>
                <span className="shrink-0 flex flex-col items-end gap-1">
                  {(state === 'final' || state === 'checkedIn') && (
                    <span className={`${pill} ${STATUS_PILL[attendance.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {t(`att.status.${attendance.status}`)}
                    </span>
                  )}
                </span>
              </div>
              {own && (
                <div
                  role={own.tone === 'error' ? 'alert' : 'status'}
                  className={`mt-2 ml-[4.25rem] rounded-xl px-3 py-2 text-[11px] font-semibold leading-relaxed ${
                    own.tone === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'
                  }`}
                >
                  {own.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {view && view.others > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
          {t('checkin.focus.others', { n: view.others })}
          {' · '}
          {toggle(t('checkin.focus.seeAll', { n: sessions.length }), true)}
        </div>
      )}
      {focus && expanded && (
        <div className="mt-3 pt-3 border-t border-slate-100">{toggle(t('checkin.focus.less'), false)}</div>
      )}
    </section>
  );
};

/* The line under a meeting's name: what happened, or what will. Also the lesson calendar's (/schedule). */
export const SessionStatusLine = ({ state, session, checkedAt, t }) => {
  const line = 'block text-[11px] font-semibold mt-0.5';
  const attendance = session.attendance;
  const flags = attendance && (attendance.late || attendance.outsideSchool) && (
    <span className="flex flex-wrap gap-1.5 mt-1">
      {attendance.late && (
        <span className={`${pill} bg-amber-50 text-amber-700 inline-flex items-center gap-1`}>
          <Clock className="w-3 h-3" aria-hidden="true" />
          {t('att.flag.late')}
        </span>
      )}
      {attendance.outsideSchool && (
        <span className={`${pill} bg-slate-100 text-slate-600 inline-flex items-center gap-1`}>
          <MapPinOff className="w-3 h-3" aria-hidden="true" />
          {t('att.flag.outside')}
        </span>
      )}
    </span>
  );

  switch (state) {
    case 'cancelled':
      return (
        <span className={`${line} text-slate-500`}>
          {t(`timetable.session.cancelled.${session.cancelReason ?? 'OTHER'}`)}
        </span>
      );
    case 'checkedIn':
      return (
        <>
          <span className={`${line} text-slate-500 tabular-nums`}>
            {checkedAt && t('att.checkedInAt', { time: checkedAt.time })}
            {checkedAt && ' · '}
            <span className="text-amber-700">{t('att.pending')}</span>
          </span>
          {flags}
        </>
      );
    case 'final':
      return (
        <>
          <span className={`${line} text-slate-500 tabular-nums`}>
            {checkedAt ? `${t('att.checkedInAt', { time: checkedAt.time })} · ` : ''}
            {t('checkin.state.final')}
          </span>
          {flags}
        </>
      );
    case 'open':
      return <span className={`${line} text-brand`}>{t('checkin.state.open')}</span>;
    case 'upcoming':
      return <span className={`${line} text-slate-500 tabular-nums`}>{t('checkin.state.upcoming', { time: session.local?.start ?? '' })}</span>;
    case 'missed':
      return <span className={`${line} text-amber-700`}>{t('checkin.state.missed')}</span>;
    case 'confirmed':
      return <span className={`${line} text-slate-500`}>{t('checkin.state.confirmed')}</span>;
    case 'noLocation':
      return <span className={`${line} text-slate-500`}>{t('checkin.state.noLocation')}</span>;
    case 'otherClass':
      return <span className={`${line} text-slate-500`}>{t('checkin.state.otherClass')}</span>;
    default:
      return <span className={`${line} text-slate-400`}>{t('common.checking')}</span>;
  }
};

export default TodaySessionsCard;
