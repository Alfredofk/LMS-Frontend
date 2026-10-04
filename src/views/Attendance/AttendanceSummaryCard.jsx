import React from 'react';
import { Clock, MapPinOff } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import InfoChips from '../../components/ui/InfoChips';
import { STATUSES, STATUS_DOT, STATUS_TILE } from './attendance';

/*
  A student's attendance numbers in one card (owner, 2026-10-04): the rate as a
  ring, a tile per status, and the check-in flags along the bottom. On /attendance
  over every subject, and on a subject's "Kehadiran" tab over that subject alone -
  one card, so the two cannot drift apart.

  @param total  summarize(rows) from attendance.js
*/

const RING = 'M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831';

export const AttendanceSummaryCard = ({ total, headingId = 'att-summary' }) => {
  const { t } = useT();
  const ratio = total.rate ?? 0;

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm" aria-labelledby={headingId}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
        <div className="flex items-center gap-4 lg:w-80 shrink-0">
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
              <path className="text-slate-100" strokeWidth="3.5" stroke="currentColor" fill="none" d={RING} />
              {total.rate !== null && (
                <path className="text-brand" strokeDasharray={`${ratio}, 100`} strokeWidth="3.5" strokeLinecap="round" stroke="currentColor" fill="none" d={RING} />
              )}
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-base font-extrabold text-slate-800 tabular-nums">
              {total.rate === null ? '-' : `${total.rate}%`}
            </span>
          </div>
          <div className="min-w-0">
            <h2 id={headingId} className="text-sm font-extrabold text-slate-800">{t('att.ratio')}</h2>
            <p className="text-xs text-slate-500 font-semibold mt-1 leading-relaxed">
              {total.confirmed > 0 ? t('att.ratio.detail', { n: total.confirmed }) : t('person.att.none')}
            </p>
            {total.pending > 0 && (
              <p className="text-xs text-amber-700 font-semibold mt-0.5">{t('att.pendingCount', { n: total.pending })}</p>
            )}
          </div>
        </div>

        <dl className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label={t('att.breakdown.title')}>
          {STATUSES.map((status) => (
            <div key={status} className={`rounded-xl px-4 py-3 ${STATUS_TILE[status]}`}>
              <dt className="flex items-center gap-1.5 text-[11px] font-bold">
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
                {t(`att.status.${status}`)}
              </dt>
              <dd className="mt-1 text-2xl font-extrabold tabular-nums">{total[status]}</dd>
            </div>
          ))}
        </dl>
      </div>

      {(total.late > 0 || total.outside > 0) && (
        <InfoChips
          className="mt-5 pt-4 border-t border-slate-100"
          items={[
            total.late > 0 && { icon: Clock, label: t('att.flags.late', { n: total.late }), tone: 'amber' },
            total.outside > 0 && { icon: MapPinOff, label: t('att.flags.outside', { n: total.outside }) },
          ]}
        />
      )}
    </section>
  );
};

export default AttendanceSummaryCard;
