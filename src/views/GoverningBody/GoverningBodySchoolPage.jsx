import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';

import Button from '../../components/ui/Button';
import { useT } from '../../i18n/LanguageContext';
import { governingBodySeatErrorMessage } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import { GOVERNING_BODY_SCHOOLS } from '../../constants/roles';
import { schoolAddressOf } from '../../constants/subdomain';
import { SCHOOL_TABS, tabOf } from './schoolPeople';
import CopyCode from './CopyCode';
import SchoolApplicationsTab from './SchoolApplicationsTab';
import SchoolManageCard from './SchoolManageCard';
import SchoolStudentsTab from './SchoolStudentsTab';
import SchoolTeachersTab from './SchoolTeachersTab';
import useMoveOn from './useMoveOn';

/*
  /governing-body/schools/:id, one of the body's Schools (owner 2026-10-26, B1 and
  D1-D7), opened from its name on the Schools tab. One read of the School's row
  (`GET /governing-body/schools/:id`, backend f01cd28) and four text tabs in `?tab=`:

  - Ringkasan: the Principal (or none, leading to the applications while any wait), the
    Vice Principals, the counts of Students, Teachers and Vice Principals as one strip,
    the School Code to copy and its own address while addresses are on; under it
    "Kelola sekolah" (ticket 08, SchoolManageCard): the Principal, switching it off and
    on, letting it go.
  - Guru and Siswa (ticket 07, SchoolTeachersTab / SchoolStudentsTab): read the first
    time they are opened and kept for the visit - a tab once opened stays mounted,
    hidden while another is shown.
  - Lamaran Kepala Sekolah (ticket 06, SchoolApplicationsTab), "(2)" while two wait; a
    decision reads the School again.

  A 403 means the seat ended or the body was switched off: the other tabs' "gone". A
  404 is a School not the body's, or none.
*/

const TAB_KEYS = { ringkasan: 'gbsp.tab.summary', guru: 'gbsp.tab.teachers', siswa: 'gbsp.tab.students', lamaran: 'gbsp.tab.applications' };

export const GoverningBodySchoolPage = () => {
  const { id } = useParams();
  const { t } = useT();
  const { showToast } = useOutletContext() ?? {};
  const moveOn = useMoveOn();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = tabOf(searchParams.get('tab'));

  const [school, setSchool] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  /* The tabs opened so far: each stays mounted, so its read is kept for the visit. */
  const [opened, setOpened] = useState(() => new Set([tab]));
  if (!opened.has(tab)) setOpened(new Set(opened).add(tab));

  const load = useCallback(() => {
    governingBodyService
      .school(id)
      .then((one) => {
        setSchool(one);
        setState('ready');
      })
      .catch((err) => {
        setError(err);
        setState(err?.status === 403 ? 'gone' : err?.status === 404 ? 'missing' : 'failed');
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const gone = useCallback(() => setState('gone'), []);

  /* A change made here (a Principal, switched off or on) also moves who teaches with which role: the people tabs read again. */
  const [version, setVersion] = useState(0);
  const changed = useCallback(() => {
    setVersion((n) => n + 1);
    load();
  }, [load]);

  const checkAgain = async () => {
    setChecking(true);
    try {
      if (!(await moveOn())) load();
    } catch {
      load();
    } finally {
      setChecking(false);
    }
  };

  const goTab = (next) => setSearchParams(next === 'ringkasan' ? {} : { tab: next });

  const backLink = (
    <Link to={GOVERNING_BODY_SCHOOLS} className="text-xs font-extrabold text-brand hover:text-brand-deep underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">
      {t('gbpa.back')}
    </Link>
  );

  const waiting = school?.principalApplicationsWaiting ?? 0;
  const address = school ? schoolAddressOf(school.subdomain ?? null) : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {backLink}
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight break-words">{school?.name ?? t('gbpa.title')}</h1>
        {school && (
          <p className="text-sm font-semibold text-slate-500 break-words">
            {school.schoolType}
            <span className="text-slate-300"> / </span>
            {school.city}
            <span className="text-slate-300"> / </span>
            {t('gbpa.npsn', { npsn: school.npsn })}
          </p>
        )}
        {school?.deactivatedAt && <p className="text-sm font-semibold text-rose-700">{t('gbsp.deactivated')}</p>}
      </div>

      {state === 'loading' && <div className="h-48 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />}

      {state === 'gone' && (
        <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3" role="alert">
          <p className="text-sm font-bold text-slate-900">{t('gb.gone.title')}</p>
          <p className="text-xs font-medium text-slate-500 leading-relaxed">{t('gb.gone.body')}</p>
          <Button variant="outline" size="sm" onClick={checkAgain} isLoading={checking}>
            {t('gb.checkAgain')}
          </Button>
        </section>
      )}

      {state === 'missing' && (
        <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3" role="alert">
          <p className="text-sm font-semibold text-slate-700">{t('gbpa.missing')}</p>
          {backLink}
        </section>
      )}

      {state === 'failed' && (
        <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3" role="alert">
          <p className="text-sm font-semibold text-rose-700">{governingBodySeatErrorMessage(error, t)}</p>
          <Button variant="outline" size="sm" onClick={load}>
            {t('gb.retry')}
          </Button>
        </section>
      )}

      {state === 'ready' && school && (
        <>
          <div className="border-b border-slate-200">
            <div role="tablist" aria-label={t('gbsp.tabs')} className="flex gap-5 sm:gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SCHOOL_TABS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => goTab(key)}
                  className={`shrink-0 whitespace-nowrap px-1 pb-3 text-sm font-extrabold border-b-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-t ${
                    tab === key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t(TAB_KEYS[key])}
                  {key === 'lamaran' && waiting > 0 && ` (${waiting})`}
                </button>
              ))}
            </div>
          </div>

          <div hidden={tab !== 'ringkasan'}>
            <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-5">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold text-slate-500">{t('gbs.col.principal')}</dt>
                  <dd className="text-sm font-bold text-slate-900 mt-0.5 break-words">
                    {school.principal?.fullName ?? (school.hasPrincipal ? t('gbs.principal.yes') : <span className="text-slate-500 font-semibold">{t('gbs.principal.no')}</span>)}
                  </dd>
                  {!school.hasPrincipal && waiting > 0 && (
                    <button
                      type="button"
                      onClick={() => goTab('lamaran')}
                      className="mt-0.5 text-xs font-semibold text-amber-700 hover:text-amber-800 underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                    >
                      {t('gbs.waiting.row', { n: waiting })}
                    </button>
                  )}
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold text-slate-500">{t('roleTitle.VICE_PRINCIPAL')}</dt>
                  <dd className={`text-sm mt-0.5 break-words ${school.vicePrincipals?.length ? 'font-bold text-slate-900' : 'font-semibold text-slate-500'}`}>
                    {school.vicePrincipals?.length ? school.vicePrincipals.map((row) => row.fullName).join(', ') : t('gbs.principal.no')}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-slate-100 pt-4">
                {[
                  ['students', 'gbsp.count.students'],
                  ['teachers', 'gbsp.count.teachers'],
                  ['vicePrincipals', 'gbsp.count.vicePrincipals'],
                ].map(([field, key]) => (
                  <div key={field}>
                    <p className="text-2xl font-extrabold text-slate-900 tabular-nums">{school.counts?.[field] ?? '-'}</p>
                    <p className="text-xs font-semibold text-slate-500">{t(key)}</p>
                  </div>
                ))}
              </div>

              <dl className="grid gap-4 sm:grid-cols-2 border-t border-slate-100 pt-4">
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold text-slate-500">{t('gbs.col.code')}</dt>
                  <dd className="mt-0.5">
                    <CopyCode code={school.schoolCode} />
                  </dd>
                </div>
                {address && (
                  <div className="min-w-0">
                    <dt className="text-[11px] font-semibold text-slate-500">{t('gbsp.address')}</dt>
                    <dd className="text-sm font-semibold text-slate-700 mt-0.5 break-all">{address}</dd>
                  </div>
                )}
              </dl>
              <p className="text-xs font-medium text-slate-500 leading-relaxed">{t('gbs.code.hint')}</p>
            </section>
            <div className="mt-6">
              <SchoolManageCard school={school} showToast={showToast} onChanged={changed} onGone={gone} onReleased={() => navigate(GOVERNING_BODY_SCHOOLS, { replace: true })} />
            </div>
          </div>

          {opened.has('guru') && (
            <div hidden={tab !== 'guru'}>
              <SchoolTeachersTab key={version} schoolId={school.id} onGone={gone} />
            </div>
          )}

          {opened.has('siswa') && (
            <div hidden={tab !== 'siswa'}>
              <SchoolStudentsTab key={version} schoolId={school.id} onGone={gone} />
            </div>
          )}

          {opened.has('lamaran') && (
            <div hidden={tab !== 'lamaran'}>
              <SchoolApplicationsTab school={school} version={version} showToast={showToast} onChanged={changed} onGone={gone} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default GoverningBodySchoolPage;
