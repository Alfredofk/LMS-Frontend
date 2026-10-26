import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { governingBodyService } from '../../services/governingBodyService';
import { GOVERNING_BODY_SCHOOLS } from '../../constants/roles';
import { attentionOf, totalsOf } from './bodyOverview';

/*
  The top of a Governing Body's home (owner 2026-10-26, 1-8): Sekolah / Siswa / Guru as
  one strip, then "Perlu perhatian" (`attentionOf`), each row a way to what it is about.
  Three reads at once: the Schools (without them the card is one line and "Coba lagi"),
  the requests to join and the admins (either failing only leaves its row out). The
  identity and the code below do not wait for any of it.
*/

const ROW_KEY = {
  PRINCIPAL_APPLICATIONS: ['gbo.row.applications.one', 'gbo.row.applications.many'],
  AFFILIATION_REQUESTS: ['gbo.row.affiliation.one', 'gbo.row.affiliation.many'],
  ADMIN_APPLICATIONS: ['gbo.row.admins', 'gbo.row.admins'],
  NO_PRINCIPAL: ['gbo.row.noPrincipal.one', 'gbo.row.noPrincipal.many'],
  SWITCHED_OFF: ['gbo.row.off.one', 'gbo.row.off.many'],
};

export const SchoolsOverview = () => {
  const { t } = useT();
  const [read, setRead] = useState(null);
  const [failed, setFailed] = useState(false);

  /* The three reads; only the Schools failing fails the card. */
  const fetchAll = useCallback(
    () =>
      Promise.allSettled([governingBodyService.schools(), governingBodyService.affiliationRequests(), governingBodyService.admins()]).then(([schools, requests, admins]) => {
        if (schools.status !== 'fulfilled') {
          setFailed(true);
          return;
        }
        setRead({
          schools: schools.value,
          affiliationRequests: requests.status === 'fulfilled' ? requests.value : null,
          admins: admins.status === 'fulfilled' ? admins.value : null,
        });
      }),
    []
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const retry = () => {
    setFailed(false);
    setRead(null);
    fetchAll();
  };

  if (failed) {
    return (
      <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-wrap items-center gap-x-3 gap-y-1" role="alert">
        <p className="text-sm font-semibold text-slate-700">{t('gbo.failed')}</p>
        <button
          type="button"
          onClick={retry}
          className="text-sm font-bold text-brand hover:text-brand-deep underline underline-offset-2 cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          {t('gb.retry')}
        </button>
      </section>
    );
  }

  if (!read) return <div className="h-40 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;

  const totals = totalsOf(read.schools);
  const items = attentionOf(read.schools, read);

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
      <h2 className="text-base font-extrabold text-slate-900">{t('gbo.title')}</h2>

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {[
          ['schools', 'gbo.count.schools'],
          ['students', 'gbo.count.students'],
          ['teachers', 'gbo.count.teachers'],
        ].map(([field, key]) => (
          <div key={field}>
            <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{totals[field]}</p>
            <p className="text-xs font-semibold text-slate-500">{t(key)}</p>
          </div>
        ))}
      </div>

      {totals.schools === 0 && (
        <p className="text-sm font-medium text-slate-600">
          {t('gbo.empty')}{' '}
          <Link to={`${GOVERNING_BODY_SCHOOLS}/new`} className="font-bold text-brand hover:text-brand-deep underline underline-offset-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            {t('gbs.create')}
          </Link>
        </p>
      )}

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-sm font-extrabold text-slate-900">{t('gbo.attention')}</h3>
        {items.length === 0 ? (
          <p className="text-xs font-medium text-slate-500 mt-1">{t('gbo.none')}</p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.kind}>
                <Link
                  to={item.to}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm font-semibold text-slate-800 hover:text-brand rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="min-w-0 break-words">{t(ROW_KEY[item.kind][item.school ? 0 : 1], { n: item.count, school: item.school ?? '', at: item.at ?? 0 })}</span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default SchoolsOverview;
