import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { reportCardErrorMessage } from '../../i18n/apiError';
import { gradingService } from '../../services/gradingService';
import { formatDay } from '../Classes/format';

/*
  "Rapor" (/report-cards; owner, 2026-10-20; backend 3a22f90), a student's own: one
  row per closed semester, the latest first, each opening ReportCardPage. The server
  sends only the newest version of each, so no version is named here. Before the
  first semester closes there is none, and the page says when one comes.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';

export const MyReportCardsPage = () => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  /* undefined reading · the list · { error } */
  const [list, setList] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    gradingService
      .myReportCards()
      .then((answer) => !cancelled && setList(answer))
      .catch((err) => !cancelled && setList({ error: reportCardErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{t('shell.reportCards')}</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">{t('rc.mine.intro')}</p>
      </div>

      {list === undefined ? (
        <div className="h-32 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />
      ) : list.error ? (
        <p className={`${card} text-sm font-semibold text-amber-700`} role="alert">
          {list.error}
        </p>
      ) : list.length === 0 ? (
        <p className={`${card} text-sm font-semibold text-slate-600`}>{t('rc.mine.none')}</p>
      ) : (
        <ul className="bg-white border border-slate-100 rounded-2xl px-5 sm:px-6 py-2 shadow-sm divide-y divide-slate-100">
          {list.map((rc) => (
            <li key={rc.id}>
              <button
                type="button"
                onClick={() => navigate(`/report-cards/${rc.id}`, { state: { back: { to: '/report-cards' } } })}
                className="w-full flex items-center justify-between gap-3 py-3 text-left cursor-pointer rounded-lg hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-900 break-words">{t('rc.title', { n: rc.semester.ordinal, year: rc.academicYear })}</span>
                  <span className="block text-xs font-semibold text-slate-500 break-words">{t('rc.mine.row', { className: rc.class.name, date: formatDay(rc.reportDate, lang) })}</span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-slate-500" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MyReportCardsPage;
