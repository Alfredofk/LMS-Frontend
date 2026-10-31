import React from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { formatDay } from '../Classes/format';
import { dayName, rosterOpenable, sessionState, timeRange } from './timetable';

/*
  A ClassSubject's meetings (`GET /sessions/class-subjects/:id/sessions`), each
  with its state. A meeting that has begun and was not cancelled (`rosterOpenable`)
  is a button that opens its attendance (`onOpen`); the rest are plain rows.

  Shared by ScheduleDialog (the Principal's timetable) and HomeroomAttendance (the
  homeroom teacher's class), so both say the same thing about a meeting.
*/
/* A meeting's state as a coloured word on its grey line (mockup kehadiran-guru-wali.html, item 11). */
const STATE_TONE = {
  'timetable.session.scheduled': 'text-brand',
  'timetable.session.past': 'text-slate-600',
  'timetable.session.completed': 'text-emerald-700',
  'timetable.session.needsCompletion': 'text-amber-700',
};
const CANCELLED_TONE = 'text-rose-700';

/* `onOpenContent` (optional): a button beside each row for the meeting's materials
   (backend bf6e9b5, owner 2026-10-03). Beside, not inside: the row may be a button.
   The list is shown whole (owner 2026-10-30; it scrolled inside a 256px box). */
export const SessionList = ({ sessions, onOpen, onOpenContent }) => {
  const { t, lang } = useT();
  return (
    <ol className="divide-y divide-slate-100">
      {sessions.map((session) => {
        const state = sessionState(session);
        const openable = rosterOpenable(session);
        const Row = openable ? 'button' : 'div';
        return (
          <li key={session.id} className="flex items-stretch gap-1">
            <Row
              {...(openable ? { type: 'button', onClick: () => onOpen(session) } : {})}
              className={`group flex-1 min-w-0 px-2 py-2.5 flex items-center gap-3 text-left rounded-xl ${
                openable ? 'hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand' : ''
              }`}
            >
              <span className="grid place-items-center w-[34px] h-[34px] shrink-0 rounded-[10px] bg-slate-100 text-[13px] font-extrabold text-slate-700 tabular-nums" aria-hidden="true">
                {session.number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-bold text-slate-900">{t('timetable.session.number', { n: session.number })}</span>
                <span className="block text-[12.5px] font-medium text-slate-500 tabular-nums">
                  <span className={`font-bold ${STATE_TONE[state] ?? CANCELLED_TONE}`}>{t(state)}</span>
                  <span className="mx-1.5 text-slate-300" aria-hidden="true">
                    /
                  </span>
                  {t('timetable.session.when', {
                    day: dayName(session.local.dayOfWeek, lang, 'short'),
                    date: formatDay(session.local.date, lang),
                    time: timeRange(session.local.start, session.local.end),
                  })}
                </span>
              </span>
              {openable && (
                <>
                  <span className="sr-only">{t('roster.open')}</span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                </>
              )}
            </Row>
            {onOpenContent && (
              <button
                type="button"
                onClick={() => onOpenContent(session)}
                aria-label={t('content.openMeeting', { n: session.number })}
                title={t('content.open')}
                className="shrink-0 my-1.5 px-3 rounded-xl text-brand hover:bg-brand-tint flex items-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default SessionList;
