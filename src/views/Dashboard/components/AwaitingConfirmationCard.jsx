import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCheck, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useT } from '../../../i18n/LanguageContext';
import { sessionsService } from '../../../services/sessionsService';
import { formatDay } from '../../Classes/format';
import { dayName, timeRange } from '../../Subjects/timetable';
import { byAnswerer, endedTeacherOf } from '../awaiting';
import { initialsOf } from '../../Homeroom/homeroomSummary';
import { Bone, HomeCard, HomeEmpty, HomeError, Unfold } from './HomeCard';

/*
  Meetings waiting for their teacher's answer, school-wide - the Principal's and
  Vice Principal's dashboard (owner, 2026-09-30), from
  `GET /sessions/needs-completion`.

  Such a meeting was created already past (a first timetable set after the
  semester started, or a start date moved back), and only its teacher can say
  whether it happened - by confirming its attendance, or saying it never did. So
  this is for watching, not acting: no sidebar number, since that means "waiting
  on you". Grouped by the teacher who answers (`answeredBy`) - the person the
  reader would ask. A meeting left on an ended assignment goes to the successor
  and says whose it was. Those with no successor yet come first, with the card's
  one link: to Subjects, where the reader assigns one (owner, 2026-10-02).

  The look since 2026-10-27 (the approved Principal mockup): a row per teacher with
  initials and an amber count, opening in place; nothing waiting is an empty state
  rather than no card, and a failed read says so.
*/

export const AwaitingConfirmationCard = ({ className = '' }) => {
  const { t, lang } = useT();
  /* undefined while reading, null when the read failed. */
  const [sessions, setSessions] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  const [openId, setOpenId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    sessionsService
      .needsCompletion()
      .then((list) => !cancelled && setSessions(list ?? []))
      .catch(() => !cancelled && setSessions(null));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const card = (body) => (
    <HomeCard id="awaiting-title" title={t('awaiting.cardTitle')} className={className}>
      {body}
    </HomeCard>
  );

  if (sessions === undefined) {
    return card(
      <div aria-busy="true">
        {[0, 1].map((n) => (
          <div key={n} className="flex items-center gap-3 mt-3.5 first:mt-0">
            <Bone className="w-[34px] h-[34px] rounded-full shrink-0" />
            <div className="flex-1">
              <Bone className="h-3.5 w-1/2" />
              <Bone className="h-3 w-1/3 mt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (sessions === null) {
    return card(
      <HomeError
        message={t('awaiting.failed')}
        retryLabel={t('att.error.retry')}
        onRetry={() => {
          setSessions(undefined);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (sessions.length === 0) return card(<HomeEmpty icon={CheckCheck} title={t('awaiting.none')} body={t('awaiting.noneBody')} />);

  const groups = byAnswerer(sessions);

  return card(
    <>
      <p className="-mt-2 mb-3 text-xs text-slate-500 leading-relaxed">{t('awaiting.short', { n: sessions.length })}</p>
      <ul>
        {groups.map(({ key: id, answeredBy, sessions: list, oldest }) => {
          const open = openId === id;
          return (
            <li key={id} className="border-b border-slate-100 last:border-0">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : id)}
                aria-expanded={open}
                className={`w-full flex items-center gap-3 px-2 py-3 text-left rounded-xl transition-colors cursor-pointer hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  open ? 'bg-slate-50' : ''
                }`}
              >
                {answeredBy ? (
                  <span className="grid place-items-center w-[34px] h-[34px] rounded-full bg-brand-tint text-brand text-[11px] font-extrabold shrink-0">
                    {initialsOf(answeredBy.fullName)}
                  </span>
                ) : (
                  <span className="grid place-items-center w-[34px] h-[34px] rounded-full bg-rose-50 text-rose-700 shrink-0">
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  </span>
                )}
                <span className="flex-1 min-w-0">
                  <span className={`block text-[13.5px] font-bold break-words ${answeredBy ? 'text-slate-900' : 'text-rose-700'}`}>
                    {answeredBy ? answeredBy.fullName : t('awaiting.noSuccessor')}
                  </span>
                  <span className="block text-xs text-slate-500">{t('awaiting.oldest', { date: formatDay(oldest, lang) })}</span>
                </span>
                <span className="min-w-[26px] px-2 py-0.5 rounded-full text-xs font-extrabold text-center tabular-nums bg-amber-50 text-amber-700">
                  {list.length}
                  <span className="sr-only"> {t('awaiting.count', { n: list.length })}</span>
                </span>
                <ChevronRight className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
              </button>
              <Unfold open={open}>
                <div className="pl-[54px] max-sm:pl-2 pr-2 pt-1 pb-3.5 space-y-2">
                  {!answeredBy && (
                    <div className="rounded-xl bg-rose-50 px-3 py-2.5 space-y-1.5">
                      <p className="text-xs font-semibold text-rose-700 leading-relaxed">{t('awaiting.noSuccessorBody')}</p>
                      <button
                        type="button"
                        onClick={() => navigate('/headmaster/subjects')}
                        className="inline-flex items-center gap-1 text-xs font-extrabold text-rose-700 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
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
                        <li key={session.id} className="text-[12.5px] text-slate-600">
                          <b className="font-bold text-slate-900">
                            {session.classSubject.subject.name} {session.classSubject.class}
                          </b>{' '}
                          <span className="mx-1 text-slate-300" aria-hidden="true">
                            /
                          </span>{' '}
                          {t('timetable.session.number', { n: session.number })}{' '}
                          <span className="mx-1 text-slate-300" aria-hidden="true">
                            /
                          </span>{' '}
                          <span className="tabular-nums">
                            {t('timetable.session.when', {
                              day: dayName(session.local.dayOfWeek, lang, 'short'),
                              date: formatDay(session.local.date, lang),
                              time: timeRange(session.local.start, session.local.end),
                            })}
                          </span>
                          {endedTeacher && <span className="block text-xs text-slate-500">{t('awaiting.fromEnded', { name: endedTeacher.fullName })}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </Unfold>
            </li>
          );
        })}
      </ul>
    </>
  );
};

export default AwaitingConfirmationCard;
