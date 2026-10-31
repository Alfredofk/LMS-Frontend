import React, { useCallback, useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ChevronRight, School } from 'lucide-react';

import Button from '../../components/ui/Button';
import EmptyCard from '../../components/ui/EmptyCard';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { bodySchoolsErrorMessage, governingBodySeatErrorMessage, isHadPrincipal } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import { GOVERNING_BODY_SCHOOLS } from '../../constants/roles';
import { schoolAddressOf } from '../../constants/subdomain';
import { ADMIN_CARD, SlashFacts } from '../Admin/adminParts';
import { HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { matchesSchool } from './bodySchools';
import { waitingSummary } from './principalApplications';
import GoverningBodySchoolFixForm from './GoverningBodySchoolFixForm';
import CopyCode from './CopyCode';
import AffiliationRequestsCard from './AffiliationRequestsCard';
import { RowsLoading, SearchBox, SeatGone } from './bodyParts';
import useMoveOn from './useMoveOn';

/*
  /governing-body/schools, the body's Schools tab (backend ed0d304, governing-body
  ticket 05; owner 2026-10-25: a tab of its own between the body and its admins).
  One read, `GET /governing-body/schools`, by name: each School's NPSN, type, city,
  its School Code to copy, and whether a Principal sits there now.

  - One card of rows (owner, 2026-10-29, mockup yayasan-sekolah-admin.html, as the
    platform admin's list): the name opening the School, a grey slash line ("Nonaktif"
    first in rose, type, city, NPSN, the address), a second one (the Principal, the
    applications waiting in amber, students and teachers), the code with Salin and
    "Ubah" on the right. A search box over the name, NPSN and city, in the browser
    (the read has no paging); the waiting total is in the slash line under the title.
  - "Buat sekolah" opens /governing-body/schools/new.
  - "Ubah" opens `GoverningBodySchoolFixForm` under the row, for a School that never
    had a Principal (`hadPrincipal`, backend f669e3e; the rule is ever: 9697362). One
    that gained one meanwhile is still learnt from the 409, said, and the button goes
    for this visit.
  - A School's name opens its own page, /governing-body/schools/:id, where the Principal
    applications are decided (backend e206bd9, ticket 06; owner 2026-10-26, B1-B2).
  - Above the list, independent Schools asking to join, while one waits
    (AffiliationRequestsCard, ticket 08, E7).
  - A 403 means the seat ended or the body was switched off: the other tabs' "gone".
*/

export const GoverningBodySchoolsPage = () => {
  const { governingBody: cached } = useAuth();
  const { t } = useT();
  const { showToast } = useOutletContext() ?? {};
  const moveOn = useMoveOn();

  const [schools, setSchools] = useState([]);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [needle, setNeedle] = useState('');
  const [fixing, setFixing] = useState(null);
  /* Schools a fix was refused for, having had a Principal: their "Ubah" goes. */
  const [locked, setLocked] = useState(() => new Set());

  const load = useCallback(() => {
    governingBodyService
      .schools()
      .then((answer) => {
        setSchools(answer);
        setState('ready');
      })
      .catch((err) => {
        setError(err);
        setState(err?.status === 403 ? 'gone' : 'failed');
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Stable, as a child's read depends on it. */
  const gone = useCallback(() => setState('gone'), []);

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

  const saved = (school) => {
    setFixing(null);
    if (!school) return;
    setSchools((prev) => prev.map((row) => (row.id === school.id ? school : row)).sort((a, b) => a.name.localeCompare(b.name)));
    showToast?.(t('gbs.fix.done', { name: school.name }), 'success');
  };

  const refused = (school) => (err) => {
    setFixing(null);
    if (err?.status === 403) {
      setState('gone');
      return;
    }
    if (isHadPrincipal(err)) {
      setLocked((prev) => new Set(prev).add(school.id));
      showToast?.(t('gbs.error.hadPrincipal'), 'error');
      return;
    }
    showToast?.(bodySchoolsErrorMessage(err, t), 'info');
    load();
  };

  const name = cached?.name ?? '';
  const shown = schools.filter((school) => matchesSchool(school, needle));
  const waiting = waitingSummary(schools);
  const createLink = (
    <Link
      to={`${GOVERNING_BODY_SCHOOLS}/new`}
      className="inline-flex items-center px-4 py-2 text-sm rounded-xl font-bold bg-brand hover:bg-brand-deep text-white shadow-md shadow-brand/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      {t('gbs.create')}
    </Link>
  );

  const summary = [
    name,
    state === 'ready' && t('gbs.count', { n: schools.length }),
    state === 'ready' && waiting.applications > 0 && (
      <span className="font-bold text-amber-700">{t('gbs.waiting.subtitle', { n: waiting.applications })}</span>
    ),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('gbs.title')}</h1>
          <SlashFacts className="block mt-2 text-sm font-medium text-slate-500" parts={summary} />
        </div>
        {state === 'ready' && schools.length > 0 && createLink}
      </div>

      {state === 'loading' && <RowsLoading />}

      {state === 'gone' && <SeatGone onCheck={checkAgain} checking={checking} />}

      {state === 'failed' && (
        <div className={ADMIN_CARD}>
          <HomeError message={governingBodySeatErrorMessage(error, t)} retryLabel={t('gb.retry')} onRetry={load} />
        </div>
      )}

      {/* Independent Schools asking to join (backend 261a9c7, ticket 08): only while one waits. */}
      {state === 'ready' && <AffiliationRequestsCard showToast={showToast} onJoined={load} onGone={gone} />}

      {state === 'ready' && schools.length === 0 && (
        <EmptyCard icon={School} title={t('gbs.empty.title')} body={t('gbs.empty.body')} action={createLink} />
      )}

      {state === 'ready' && schools.length > 0 && (
        <div className="space-y-4">
          <SearchBox
            id="gbsSearch"
            label={t('gbs.search.label')}
            placeholder={t('gbs.search.placeholder')}
            value={needle}
            onChange={setNeedle}
          />

          {shown.length === 0 ? (
            <div className={ADMIN_CARD}>
              <HomeEmpty
                icon={School}
                title={t('gbs.noMatch')}
                action={
                  <Button size="sm" variant="outline" onClick={() => setNeedle('')}>
                    {t('admin.search.clear')}
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm min-w-0">
              <p className="px-4 sm:px-5 pt-3.5 text-xs font-semibold text-slate-500" aria-live="polite">
                {needle.trim() ? t('gbs.count.filtered', { shown: shown.length, n: schools.length }) : t('gbs.count', { n: schools.length })}
              </p>
              <ul>
                {shown.map((school) => {
                  const address = schoolAddressOf(school.subdomain ?? null);
                  const canFix = !school.hadPrincipal && !school.hasPrincipal && !locked.has(school.id);
                  const to = `${GOVERNING_BODY_SCHOOLS}/${encodeURIComponent(school.id)}`;
                  const principal = school.principal?.fullName ?? (school.hasPrincipal ? t('gbs.principal.yes') : t('gbs.principal.no'));
                  return (
                    <li key={school.id} className="px-4 sm:px-5 py-3.5 border-b border-slate-100 last:border-0 space-y-3">
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2.5">
                        <div className="min-w-0 flex-1 basis-64">
                          <Link
                            to={to}
                            className="group inline-flex items-center gap-1 text-sm font-bold text-slate-900 hover:text-brand break-words focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                          >
                            {school.name}
                            <ChevronRight className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-brand transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                          </Link>
                          <SlashFacts
                            className="block mt-0.5 text-xs font-medium text-slate-500"
                            parts={[
                              school.deactivatedAt && <span className="font-bold text-rose-700">{t('gbs.deactivated')}</span>,
                              school.schoolType,
                              school.city,
                              school.schoolType === 'SMK' && school.durationYears && t('reg.field.duration.years', { n: school.durationYears }),
                              t('gbs.npsn', { npsn: school.npsn }),
                              address && <span className="break-all whitespace-normal">{address}</span>,
                            ]}
                          />
                          <SlashFacts
                            className="block mt-0.5 text-xs font-medium text-slate-500"
                            parts={[
                              t('gbs.principal.line', { name: principal }),
                              school.principalApplicationsWaiting > 0 && (
                                <Link
                                  to={to}
                                  className="font-semibold text-amber-700 hover:text-amber-800 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                                >
                                  {t('gbs.waiting.row', { n: school.principalApplicationsWaiting })}
                                </Link>
                              ),
                              school.counts && t('gbs.count.students', { n: school.counts.students }),
                              school.counts && t('gbs.count.teachers', { n: school.counts.teachers }),
                            ]}
                          />
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <CopyCode code={school.schoolCode} />
                          {canFix && fixing !== school.id && (
                            <Button size="sm" variant="outline" onClick={() => setFixing(school.id)} ariaLabel={t('gbs.fix.aria', { name: school.name })}>
                              {t('gbs.fix')}
                            </Button>
                          )}
                        </div>
                      </div>
                      {fixing === school.id && (
                        <GoverningBodySchoolFixForm key={school.id} school={school} onCancel={() => setFixing(null)} onSaved={saved} onRefused={refused(school)} />
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="px-4 sm:px-5 py-3 border-t border-slate-100 text-[13px] text-slate-500 leading-relaxed">{t('gbs.code.hint')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GoverningBodySchoolsPage;
