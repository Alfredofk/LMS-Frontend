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
const STATE_BADGE = {
  'timetable.session.scheduled': 'bg-brand-tint text-brand',
  'timetable.session.past': 'bg-slate-100 text-slate-600',
  'timetable.session.completed': 'bg-emerald-100 text-emerald-800',
  'timetable.session.needsCompletion': 'bg-amber-100 text-amber-800',
};
const CANCELLED_BADGE = 'bg-rose-100 text-rose-800';

/* `onOpenContent` (optional): a button beside each row for the meeting's materials
   (backend bf6e9b5, owner 2026-10-03). Beside, not inside: the row may be a button. */
export const SessionList = ({ sessions, onOpen, onOpenContent }) => {
  const { t, lang } = useT();
  return (
    <ol className="max-h-64 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
      {sessions.map((session) => {
        const state = sessionState(session);
        const openable = rosterOpenable(session);
        const Row = openable ? 'button' : 'div';
        return (
          <li key={session.id} className="flex items-stretch">
            <Row
              {...(openable ? { type: 'button', onClick: () => onOpen(session) } : {})}
              className={`flex-1 min-w-0 px-3 py-2 flex items-center justify-between gap-2 text-left ${
                openable ? 'hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand' : ''
              }`}
            >
              <span className="min-w-0">
                <span className="block text-xs font-bold text-slate-800">{t('timetable.session.number', { n: session.number })}</span>
                <span className="block text-[11px] font-semibold text-slate-500 tabular-nums">
                  {t('timetable.session.when', {
                    day: dayName(session.local.dayOfWeek, lang, 'short'),
                    date: formatDay(session.local.date, lang),
                    time: timeRange(session.local.start, session.local.end),
                  })}
                </span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold text-right ${STATE_BADGE[state] ?? CANCELLED_BADGE}`}>
                  {t(state)}
                </span>
                {openable && (
                  <>
                    <span className="sr-only">{t('roster.open')}</span>
                    <ChevronRight className="w-4 h-4 text-slate-500" aria-hidden="true" />
                  </>
                )}
              </span>
            </Row>
            {onOpenContent && (
              <button
                type="button"
                onClick={() => onOpenContent(session)}
                aria-label={t('content.openMeeting', { n: session.number })}
                title={t('content.open')}
                className="shrink-0 px-3 border-l border-slate-100 text-brand hover:bg-brand-tint flex items-center cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
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
