import React from 'react';
import { Check } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import { Bone, HomeCard, HomeError } from './HomeCard';

/*
  Konsistensi (owner, 2026-10-27): the dashboard's light game, from recorded
  things only - this week's graded assessments handed in (a ring), meetings
  attended in a row (counted per meeting, owner's choice), and a dot for each day
  Monday to Saturday. No points, no rank. One small celebration when a check-in
  lands: the number swells and dots burst once from the ring.

  @param streak     meetings in a row (streakOf), undefined while reading, null when it failed
  @param week       Monday to Saturday (weekOf)
  @param handed     { done, total } (weekAssessmentsOf), undefined while reading, null when it failed
  @param celebrate  a number that changes when a check-in lands; 0 for none yet
  @param onRetry    reads attendance again
*/

const R = 42;
const C = 2 * Math.PI * R;

const DOT = {
  present: 'bg-brand border-brand text-white',
  missed: 'border-slate-300 text-transparent',
  today: 'border-brand border-dashed text-transparent',
  none: 'bg-slate-100 border-slate-100 text-transparent',
  future: 'border-slate-200 text-transparent',
};

export const ConsistencyCard = ({ streak, week, handed, celebrate = 0, onRetry }) => {
  const { t, lang } = useT();
  const locale = lang === 'en' ? 'en-GB' : 'id-ID';

  const card = (body) => (
    <HomeCard id="home-streak" title={t('dash.streak.title')} linkLabel={t('dash.stat.attendance')} linkTo="/attendance">
      {body}
    </HomeCard>
  );

  if (streak === undefined || handed === undefined) {
    return card(
      <div className="flex items-center gap-5" aria-busy="true">
        <Bone className="w-[104px] h-[104px] rounded-full shrink-0" />
        <div className="flex-1">
          <Bone className="h-4 w-3/4" />
          <Bone className="h-3 w-full mt-2" />
          <Bone className="h-7 w-4/5 mt-4" />
        </div>
      </div>
    );
  }
  if (streak === null) return card(<HomeError message={t('dash.streak.failed')} retryLabel={t('att.error.retry')} onRetry={onRetry} />);

  const known = handed && handed.total > 0;
  const offset = known ? C * (1 - handed.done / handed.total) : C;
  const ringLabel = known ? t('dash.streak.ringLabel', { done: handed.done, total: handed.total }) : t('dash.streak.ringNone');
  const line = !handed
    ? t('dash.todo.failed')
    : !known
      ? t('dash.streak.ringNone')
      : handed.done >= handed.total
        ? t('dash.streak.allDone')
        : t('dash.streak.left', { n: handed.total - handed.done });

  return card(
    /* Centred in the height the card beside it gives this one. */
    <div className="flex-1 flex items-center gap-5 max-sm:gap-3.5">
      <div className="relative w-[104px] h-[104px] max-sm:w-[88px] max-sm:h-[88px] shrink-0" role="img" aria-label={ringLabel}>
        <svg viewBox="0 0 104 104" className="w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="52" cy="52" r={R} fill="none" strokeWidth="10" className="stroke-slate-100" />
          <circle
            cx="52"
            cy="52"
            r={R}
            fill="none"
            strokeWidth="10"
            strokeLinecap="round"
            className="stroke-brand transition-[stroke-dashoffset] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
            strokeDasharray={C}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <b className="block text-[22px] font-extrabold leading-none tracking-tight tabular-nums text-slate-900">
              {known ? `${handed.done}/${handed.total}` : '-'}
            </b>
            <small className="text-[10px] font-semibold text-slate-500">{t('dash.streak.ringUnit')}</small>
          </div>
        </div>
        {celebrate > 0 && (
          <div key={celebrate} className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {Array.from({ length: 10 }, (_, i) => (
              <i
                key={i}
                className="absolute left-1/2 top-1/2 -m-[3px] w-1.5 h-1.5 rounded-full bg-brand opacity-0 animate-burst"
                style={{ '--a': `${i * 36}deg` }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-[15px] font-extrabold text-slate-900">
          {streak > 0 ? (
            <>
              {t('dash.streak.runPre')}{' '}
              <span key={celebrate} className={`text-brand ${celebrate > 0 ? 'animate-bump' : ''}`}>
                {streak}
              </span>{' '}
              {t('dash.streak.runPost')}
            </>
          ) : (
            t('dash.streak.zero')
          )}
        </p>
        <p className="mt-1 text-xs text-slate-500">{line}</p>
        {week.length > 0 && (
          <ul className="flex gap-2 mt-3.5" aria-label={t('dash.streak.week')}>
            {week.map((day) => (
              <li key={day.date} className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-500">
                <span className={`grid place-items-center w-[26px] h-[26px] rounded-full border-2 transition-colors duration-300 ${DOT[day.state]}`}>
                  <Check className="w-[13px] h-[13px]" strokeWidth={3} aria-hidden="true" />
                </span>
                <span>
                  <span aria-hidden="true">
                    {new Date(`${day.date}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }).replace('.', '')}
                  </span>
                  <span className="sr-only">
                    {t(`dash.streak.day.${day.state}`, {
                      day: new Date(`${day.date}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' }),
                    })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ConsistencyCard;
