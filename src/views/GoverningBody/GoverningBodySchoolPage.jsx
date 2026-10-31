import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';

import { SearchX } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { governingBodySeatErrorMessage } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import { GOVERNING_BODY_SCHOOLS } from '../../constants/roles';
import { schoolAddressOf } from '../../constants/subdomain';
import { SCHOOL_TABS, tabOf } from './schoolPeople';
import { deactivationOf } from './schoolPowers';
import { ADMIN_CARD, Fact, Facts, SlashFacts } from '../Admin/adminParts';
import { HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { RowsLoading, SeatGone } from './bodyParts';
import CopyCode from './CopyCode';
import SchoolApplicationsTab from './SchoolApplicationsTab';
import SchoolManageCard from './SchoolManageCard';
import SchoolStudentsTab from './SchoolStudentsTab';
import SchoolTeachersTab from './SchoolTeachersTab';
import useMoveOn from './useMoveOn';

const localeOf = (lang) => (lang === 'en' ? 'en-GB' : 'id-ID');

/*
  /governing-body/schools/:id, one of the body's Schools (owner 2026-10-26, B1 and
  D1-D7), opened from its name on the Schools tab. One read of the School's row
  (`GET /governing-body/schools/:id`, backend f01cd28) and four text tabs in `?tab=`:

  - Ringkasan: the Principal (or none, leading to the applications while any wait), the
    Vice Principals, the counts of Students, Teachers and Vice Principals as one strip,
    the School Code to copy and its own address while addresses are on; under it
    "Kelola sekolah" (ticket 08, SchoolManageCard): the Principal, switching it off and
    on, letting it go. A School switched off says under its name whose deactivation it is,
    when, and why (backend 227473f).
  - Guru and Siswa (ticket 07, SchoolTeachersTab / SchoolStudentsTab): read the first
    time they are opened and kept for the visit - a tab once opened stays mounted,
    hidden while another is shown.
  - Lamaran Kepala Sekolah (ticket 06, SchoolApplicationsTab), its count amber while
    any wait; a decision reads the School again.

  The look since 2026-10-29 (owner, mockup yayasan-sekolah-admin.html): a slash line
  under the name ("Nonaktif" first in rose), the dashboards' tabs with counts, the
  summary's people and code as eyebrow cells under the numbers, every card the
  dashboards' frame and the dashboards' states.

  A 403 means the seat ended or the body was switched off: the other tabs' "gone". A
  404 is a School not the body's, or none.
*/

const TAB_KEYS = { ringkasan: 'gbsp.tab.summary', guru: 'gbsp.tab.teachers', siswa: 'gbsp.tab.students', lamaran: 'gbsp.tab.applications' };

export const GoverningBodySchoolPage = () => {
  const { id } = useParams();
  const { t, lang } = useT();
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
  /* Whose deactivation and why (backend 227473f; owner 2026-10-26, B): the Platform Admin's reason too. */
  const off = deactivationOf(school);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {backLink}
        <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight break-words">{school?.name ?? t('gbpa.title')}</h1>
        {school && (
          <SlashFacts
            className="block text-sm font-medium text-slate-500"
            parts={[
              school.deactivatedAt && <span className="font-bold text-rose-700">{t('gbs.deactivated')}</span>,
              school.schoolType,
              school.city,
              t('gbs.npsn', { npsn: school.npsn }),
            ]}
          />
        )}
        {off && (
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-rose-700">
              {t(off.by === 'PLATFORM' ? 'gbsp.deactivated.platform' : 'gbsp.deactivated.body', {
                date: new Date(off.at).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'long', year: 'numeric' }),
              })}
            </p>
            {off.reason && <p className="text-sm font-medium text-slate-500 break-words">{t('gbsp.deactivated.reason', { reason: off.reason })}</p>}
          </div>
        )}
      </div>

      {state === 'loading' && <RowsLoading />}

      {state === 'gone' && <SeatGone onCheck={checkAgain} checking={checking} />}

      {state === 'missing' && (
        <div className={ADMIN_CARD} role="alert">
          <HomeEmpty icon={SearchX} title={t('gbpa.missing')} action={backLink} />
        </div>
      )}

      {state === 'failed' && (
        <div className={ADMIN_CARD}>
          <HomeError message={governingBodySeatErrorMessage(error, t)} retryLabel={t('gb.retry')} onRetry={load} />
        </div>
      )}

      {state === 'ready' && school && (
        <>
          {/* The dashboards' text tabs: people counted from the row, applications waiting amber. */}
          <div
            role="tablist"
            aria-label={t('gbsp.tabs')}
            className="flex gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)] select-none"
          >
            {SCHOOL_TABS.map((key) => {
              const on = tab === key;
              const count = key === 'guru' ? school.counts?.teachers : key === 'siswa' ? school.counts?.students : key === 'lamaran' ? waiting : null;
              const amber = key === 'lamaran' && waiting > 0;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => goTab(key)}
                  className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-t-lg ${
                    on ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
                  }`}
                >
                  {t(TAB_KEYS[key])}
                  {count !== null && count !== undefined && (
                    <span
                      className={`ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums ${
                        amber ? 'bg-amber-50 text-amber-700' : on ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div hidden={tab !== 'ringkasan'}>
            <section className={ADMIN_CARD}>
              <div className="flex flex-wrap gap-x-8 gap-y-3">
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

              {/* Eyebrow cells, as on the platform admin's review. */}
              <Facts className="mt-3">
                <Fact label={t('gbs.col.principal')}>
                  {school.principal?.fullName ?? (school.hasPrincipal ? t('gbs.principal.yes') : <span className="text-slate-500">{t('gbs.principal.no')}</span>)}
                  {!school.hasPrincipal && waiting > 0 && (
                    <button
                      type="button"
                      onClick={() => goTab('lamaran')}
                      className="block text-xs font-semibold text-amber-700 hover:text-amber-800 underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                    >
                      {t('gbs.waiting.row', { n: waiting })}
                    </button>
                  )}
                </Fact>
                <Fact label={t('roleTitle.VICE_PRINCIPAL')}>
                  {school.vicePrincipals?.length ? (
                    school.vicePrincipals.map((row) => row.fullName).join(', ')
                  ) : (
                    <span className="text-slate-500">{t('gbs.principal.no')}</span>
                  )}
                </Fact>
                <Fact label={t('gbs.col.code')}>
                  <CopyCode code={school.schoolCode} />
                </Fact>
                {address && (
                  <Fact label={t('gbsp.address')} wide>
                    <span className="break-all">{address}</span>
                  </Fact>
                )}
              </Facts>
              <p className="mt-3 text-[13px] text-slate-500 leading-relaxed">{t('gbsp.code.hint')}</p>
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
