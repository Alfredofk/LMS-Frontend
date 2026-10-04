import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, ChevronDown, ClipboardCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useT } from '../../../i18n/LanguageContext';
import { sessionsService } from '../../../services/sessionsService';
import { formatDay } from '../../Classes/format';
import { dayName, timeRange } from '../../Subjects/timetable';
import { byAnswerer, endedTeacherOf } from '../awaiting';

/*
  Meetings waiting for their teacher's answer, school-wide — the Principal's and
  Vice Principal's dashboard (owner, 2026-09-30), from
  `GET /sessions/needs-completion`.

  Such a meeting was created already past (a first timetable set after the
  semester started, or a start date moved back), and only its teacher can say
  whether it happened — by confirming its attendance, or saying it never did. So
  this is for watching, not acting: no sidebar number, since that means "waiting
  on you". Grouped by the teacher who answers (`answeredBy`) — the person the
  reader would ask. A meeting left on an ended assignment goes to the successor
  and says whose it was. Those with no successor yet come first, with the card's
  one link: to Subjects, where the reader assigns one (owner, 2026-10-02). Nothing waiting, or a failed read, draws nothing:
  like NextHolidayCard, it sits beside the page's real content.
*/
const countBadge = 'px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 tabular-nums whitespace-nowrap';

export const AwaitingConfirmationCard = () => {
  const { t, lang } = useT();
  /* null while reading, and for a failed read — both draw nothing. */
  const [sessions, setSessions] = useState(null);
  const [open, setOpen] = useState(() => new Set());
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    sessionsService
      .needsCompletion()
      .then((list) => !cancelled && setSessions(list))
      .catch(() => !cancelled && setSessions(null));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!sessions || sessions.length === 0) return null;
  const groups = byAnswerer(sessions);

  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="mt-5 bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4" aria-labelledby="awaiting-title">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-5 h-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="awaiting-title" className="text-sm font-extrabold text-slate-800">
            {t('awaiting.title', { n: sessions.length })}
          </h2>
          <p className="text-xs font-semibold text-slate-500 leading-relaxed mt-0.5">{t('awaiting.body')}</p>
        </div>
      </div>

      <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
        {groups.map(({ key: id, answeredBy, sessions: list, oldest }) => {
          const expanded = open.has(id);
          const panelId = `awaiting-${id}`;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-expanded={expanded}
                aria-controls={panelId}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
              >
                {/* The count sits under the name on a phone and beside it from 640px:
                    at 320px beside it left the name so narrow that a long one broke
                    mid-word (2026-09-30). */}
                <span className="min-w-0 flex-1">
                  {answeredBy ? (
                    <span className="block text-xs font-extrabold text-slate-800 break-words">{answeredBy.fullName}</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-rose-700 break-words">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {t('awaiting.noSuccessor')}
                    </span>
                  )}
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                    <span className="text-[11px] font-semibold text-slate-500">
                      {t('awaiting.oldest', { date: formatDay(oldest, lang) })}
                    </span>
                    <span className={`sm:hidden ${countBadge}`}>{t('awaiting.count', { n: list.length })}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className={`hidden sm:inline ${countBadge}`}>{t('awaiting.count', { n: list.length })}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </span>
              </button>
              {expanded && (
                <div id={panelId} className="px-4 pb-3 space-y-2">
                  {!answeredBy && (
                    <div className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 space-y-1.5">
                      <p className="text-[11px] font-semibold text-rose-800 leading-relaxed">{t('awaiting.noSuccessorBody')}</p>
                      <button
                        type="button"
                        onClick={() => navigate('/headmaster/subjects')}
                        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-rose-800 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                      >
                        {t('awaiting.assignInSubjects')}
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <ul className="space-y-1.5">
                    {list.map((session) => {
                      const endedTeacher = endedTeacherOf(session);
                      return (
                        <li key={session.id} className="rounded-lg bg-slate-50 px-3 py-2">
                          <span className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-800 break-words">
                            <span className="px-1.5 py-0.5 rounded-md bg-brand-tint text-brand text-[10px] font-extrabold">{session.classSubject.class}</span>
                            <span>{session.classSubject.subject.name}</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-white text-slate-600 text-[10px] font-extrabold border border-slate-200">
                              {t('timetable.session.number', { n: session.number })}
                            </span>
                          </span>
                          <span className="block text-[11px] font-semibold text-slate-500 tabular-nums">
                            {t('timetable.session.when', {
                              day: dayName(session.local.dayOfWeek, lang, 'short'),
                              date: formatDay(session.local.date, lang),
                              time: timeRange(session.local.start, session.local.end),
                            })}
                          </span>
                          {endedTeacher && (
                            <span className="block text-[11px] font-semibold text-slate-500 italic break-words">
                              {t('awaiting.fromEnded', { name: endedTeacher.fullName })}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default AwaitingConfirmationCard;
