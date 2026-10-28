import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText } from 'lucide-react';

import FactLine from '../../components/ui/FactLine';
import { useT } from '../../i18n/LanguageContext';
import { reportCardErrorMessage } from '../../i18n/apiError';
import { gradingService } from '../../services/gradingService';
import { formatDay } from '../Classes/format';
import { formatNumber } from '../TeacherAssessment/results';
import { Bone, HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { reportSummaryOf } from './reportCards';

/*
  "Rapor" (/report-cards; owner, 2026-10-20; backend 3a22f90), a student's own: one
  row per closed semester, the latest first, each opening ReportCardPage. The server
  sends only the newest version of each, so no version is named here. Before the
  first semester closes there is none, and the page says when one comes.

  The look since 2026-10-28 (owner, mockup rapor.html): a slash line under the title
  (the student / the newest card's class / "N rapor"), each row "XI IPS / Tanggal
  rapor: 19 Des 2026" with the card's average final grade on the right
  (reportSummaryOf), the dashboards' empty and failed states.
*/

const CARD = 'bg-white border border-slate-100 rounded-2xl shadow-sm min-w-0';

export const MyReportCardsPage = () => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  /* undefined reading · the list · { error } */
  const [list, setList] = useState(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    gradingService
      .myReportCards()
      .then((answer) => !cancelled && setList(answer))
      .catch((err) => !cancelled && setList({ error: reportCardErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [t, attempt]);

  const cards = Array.isArray(list) ? list : [];
  const facts = cards.length > 0 ? [cards[0].student.fullName, cards[0].class.name, t('rc.mine.count', { n: cards.length })] : [];

  let body;
  if (list === undefined) {
    body = (
      <div className={`${CARD} px-5 sm:px-6 py-2`} aria-busy="true" aria-label={t('common.loading')}>
        {[0, 1].map((n) => (
          <div key={n} className="flex items-center gap-3 py-3.5">
            <span className="flex-1">
              <Bone className="h-3.5 w-1/2" />
              <Bone className="h-3 w-1/3 mt-2" />
            </span>
            <Bone className="h-6 w-12" />
          </div>
        ))}
      </div>
    );
  } else if (list.error) {
    body = (
      <div className={`${CARD} p-6 max-sm:p-[18px]`}>
        <HomeError
          message={list.error}
          retryLabel={t('att.error.retry')}
          onRetry={() => {
            setList(undefined);
            setAttempt((n) => n + 1);
          }}
        />
      </div>
    );
  } else if (cards.length === 0) {
    body = (
      <div className={`${CARD} p-6 max-sm:p-[18px]`}>
        <HomeEmpty icon={FileText} title={t('rc.mine.empty.title')} body={t('rc.mine.empty.body')} />
      </div>
    );
  } else {
    body = (
      <ul className={`${CARD} px-3 sm:px-4 py-1.5`}>
        {cards.map((rc) => {
          const { average } = reportSummaryOf(rc);
          return (
            <li key={rc.id} className="border-b border-slate-100 last:border-0">
              <button
                type="button"
                onClick={() => navigate(`/report-cards/${rc.id}`, { state: { back: { to: '/report-cards' } } })}
                className="w-full flex items-center gap-3 px-2 py-3.5 text-left cursor-pointer rounded-xl hover:bg-slate-50 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900 break-words">{t('rc.title', { n: rc.semester.ordinal, year: rc.academicYear })}</span>
                  <FactLine size="xs" className="mt-0.5" facts={[rc.class.name, t('rc.mine.dated', { date: formatDay(rc.reportDate, lang) })]} />
                </span>
                {average !== null && (
                  <span className="shrink-0 text-right">
                    <span className="block text-lg font-extrabold text-slate-900 tabular-nums leading-tight">{formatNumber(average, lang)}</span>
                    <span className="block text-[11px] font-semibold text-slate-500">{t('rc.averageLabel')}</span>
                  </span>
                )}
                <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{t('shell.reportCards')}</h1>
        {facts.length > 0 && <FactLine className="mt-2" wrap facts={facts} />}
      </div>
      {body}
    </div>
  );
};

export default MyReportCardsPage;
