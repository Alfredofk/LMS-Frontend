import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShieldOff, Inbox, ChevronRight, Search, SearchX } from 'lucide-react';

import NotBuiltYet from '../../components/ui/NotBuiltYet';
import GoverningBodyReview from './GoverningBodyReview.jsx';
import { adminGoverningBodyService } from '../../services/adminGoverningBodyService';
import { isNotBuiltYet } from '../../services/apiClient';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { GOVERNING_BODY_KINDS } from '../GoverningBody/governingBody';
import { isBodyOff } from './bodyDecisions';

const TABS = ['PENDING', 'APPROVED', 'REJECTED'];
const ALL_KINDS = 'ALL';
/* Live or switched off - not a status: a body switched off leaves its registration APPROVED. */
const STATES = ['ALL', 'ON', 'OFF'];
const NO_ROWS = Object.freeze([]);
const NO_COUNTS = Object.freeze({ PENDING: 0, APPROVED: 0, REJECTED: 0 });
const PAGE = 50;
const TYPING_PAUSE = 300;

/*
  "Pendaftaran yayasan" (/admin/governing-body-registrations; backend b5cfffd, owner
  2026-10-24): the platform admin's queue of Governing Body registrations, a page of
  its own beside the schools' and in the same shape - AdminRegistrationsPage
  explains the parts (one filtered request, `counts` unfiltered for the badges,
  `total` filtered, a late answer dropped by `seq`, load more past 50). The filters
  are the body's: a needle (name, SK number, city, applicant), the kind, and on the
  approved tab live or switched off.

  The backend lists no bodies apart from their registrations, so a body is managed
  from its approved registration (GoverningBodyReview). The row opened is kept here
  as an object, replaced by each answer, so a decision shows its outcome - an
  approval its code and subdomain - while the queue is read again behind it.

  A row's facts are one grey line (no pills, owner 2026-10-07).
*/
export const GoverningBodyRegistrationsPage = () => {
  const { showToast } = useOutletContext();
  const { t, lang } = useT();

  const [status, setStatus] = useState('PENDING');
  const [selected, setSelected] = useState(null);

  const [query, setQuery] = useState('');
  const [needle, setNeedle] = useState('');
  const [kind, setKind] = useState(ALL_KINDS);
  const [state, setState] = useState('ALL');

  const [rows, setRows] = useState(NO_ROWS);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState(NO_COUNTS);

  const [isFetching, setIsFetching] = useState(true);
  const [isAppending, setIsAppending] = useState(false);
  const [error, setError] = useState(null);
  const [denied, setDenied] = useState(false);
  const [notBuilt, setNotBuilt] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setNeedle(query.trim()), TYPING_PAUSE);
    return () => clearTimeout(id);
  }, [query]);

  const seq = useRef(0);

  const fetchPage = useCallback(
    async (offset) => {
      const mine = ++seq.current;
      const append = offset > 0;

      if (append) setIsAppending(true);
      else setIsFetching(true);
      setError(null);
      setDenied(false);
      setNotBuilt(false);

      try {
        const answer = await adminGoverningBodyService.list({
          status,
          q: needle || undefined,
          kind: kind === ALL_KINDS ? undefined : kind,
          /* `deactivated` implies APPROVED on the server, so only that tab sends it. */
          deactivated: status === 'APPROVED' && state !== 'ALL' ? String(state === 'OFF') : undefined,
          limit: PAGE,
          offset,
        });
        if (mine !== seq.current) return;

        const page = answer.registrations ?? [];
        setRows((prev) => {
          if (!append) return page.length ? page : NO_ROWS;
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...page.filter((r) => !seen.has(r.id))];
        });
        setTotal(answer.total ?? page.length);
        setCounts(answer.counts ?? NO_COUNTS);
      } catch (err) {
        if (mine !== seq.current) return;
        if (err.status === 403) setDenied(true);
        else if (isNotBuiltYet(err)) setNotBuilt(true);
        else setError(apiErrorMessage(err, t));
      } finally {
        if (mine === seq.current) {
          if (append) setIsAppending(false);
          else setIsFetching(false);
        }
      }
    },
    [status, needle, kind, state, t]
  );

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  const clearFilters = () => {
    setQuery('');
    setKind(ALL_KINDS);
    setState('ALL');
  };

  const openTab = (tab) => {
    setStatus(tab);
    setRows(NO_ROWS);
    setTotal(0);
    setSelected(null);
  };

  /* A decision or a change: the newer row stays open, the queue and its counts are read again. */
  const handleChanged = (next) => {
    setSelected(next);
    fetchPage(0);
  };

  /* The row was out of date: back to the queue, read again. */
  const handleStale = () => {
    setSelected(null);
    setRows(NO_ROWS);
    fetchPage(0);
  };

  if (denied) {
    return (
      <div className="py-16 px-6 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
        <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto">
          <ShieldOff className="w-5 h-5 text-slate-400" aria-hidden="true" />
        </div>
        <h2 className="mt-3.5 text-sm font-extrabold text-slate-700">{t('admin.notAdmin.title')}</h2>
        <p className="mt-1.5 text-xs font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">{t('admin.notAdmin.body')}</p>
      </div>
    );
  }

  if (notBuilt) return <NotBuiltYet />;

  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  const isFirstLoad = isFetching && rows.length === 0;
  const isRefining = isFetching && rows.length > 0;
  const chip = (active) =>
    `px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
      active ? 'bg-brand text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
    }`;

  return (
    <div className="space-y-6">
      <div className="select-none">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('gbr.title')}</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">{t('gbr.subtitle')}</p>
      </div>

      {selected ? (
        <GoverningBodyReview registration={selected} onBack={() => setSelected(null)} onChanged={handleChanged} onStale={handleStale} showToast={showToast} />
      ) : (
        <>
          <div className="border-b border-slate-100 flex gap-6 select-none">
            {TABS.map((tab) => {
              const isActive = status === tab;
              const count = counts[tab] ?? 0;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => openTab(tab)}
                  className={`pb-3 text-sm font-extrabold transition-all border-b-2 cursor-pointer focus:outline-none flex items-center gap-2 ${
                    isActive ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-600'
                  }`}
                >
                  {t(`admin.tab.${tab}`)}
                  {count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${isActive ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {error ? (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
              {error}
            </div>
          ) : isFirstLoad ? (
            <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse" />
          ) : counts[status] === 0 ? (
            <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-white select-none">
              <Inbox className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="mt-2.5 text-xs font-extrabold text-slate-500">{t('admin.queue.empty')}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between select-none">
                <div className="relative w-full lg:max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('gbr.search.placeholder')}
                    aria-label={t('gbr.search.placeholder')}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none text-xs font-semibold placeholder-slate-500 bg-white shadow-sm transition-all"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('gb.kind')}>
                  {[ALL_KINDS, ...GOVERNING_BODY_KINDS].map((option) => (
                    <button key={option} type="button" onClick={() => setKind(option)} aria-pressed={kind === option} className={chip(kind === option)}>
                      {option === ALL_KINDS ? t('admin.filter.all') : t(`gb.kind.${option}`)}
                    </button>
                  ))}
                </div>
              </div>

              {status === 'APPROVED' && (
                <div className="flex items-center gap-1.5 select-none" role="group" aria-label={t('gbr.filter.state')}>
                  {STATES.map((option) => (
                    <button key={option} type="button" onClick={() => setState(option)} aria-pressed={state === option} className={chip(state === option)}>
                      {t(`admin.filter.state.${option}`)}
                    </button>
                  ))}
                </div>
              )}

              {total === 0 ? (
                <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-white select-none">
                  <SearchX className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
                  <p className="mt-2.5 text-xs font-extrabold text-slate-500">{t('admin.search.empty')}</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-3 text-xs font-bold text-brand hover:text-brand-deep underline underline-offset-4 cursor-pointer focus:outline-none"
                  >
                    {t('admin.search.clear')}
                  </button>
                </div>
              ) : (
                <div className={`space-y-2.5 transition-opacity ${isRefining ? 'opacity-50' : 'opacity-100'}`} aria-busy={isRefining}>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
                    {rows.length < total ? t('admin.queue.countOf', { n: rows.length, total }) : t('admin.queue.count', { n: total })}
                  </p>

                  {rows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelected(row)}
                      className="w-full bg-white border border-slate-100 hover:border-brand/40 hover:shadow-md rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <h3 className="text-sm font-extrabold text-slate-900 truncate">{row.governingBody?.name ?? row.name}</h3>
                          {isBodyOff(row) && <span className="shrink-0 text-xs font-bold text-rose-600">{t('gbr.state.off')}</span>}
                        </div>
                        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs font-medium text-slate-500">
                          <span>{t(`gb.kind.${row.kind}`)}</span>
                          {row.skNumber && <span className="break-all">{row.skNumber}</span>}
                          {row.address?.city && <span>{row.address.city}</span>}
                          {row.applicant?.fullName && <span>{row.applicant.fullName}</span>}
                          <span>
                            {t('admin.list.submitted', {
                              date: new Date(row.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
                            })}
                          </span>
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" aria-hidden="true" />
                    </button>
                  ))}

                  {rows.length < total && (
                    <button
                      type="button"
                      onClick={() => fetchPage(rows.length)}
                      disabled={isAppending}
                      className="w-full py-3 rounded-2xl border border-dashed border-slate-200 bg-white text-xs font-extrabold text-brand hover:border-brand/40 hover:bg-brand-tint/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-default"
                    >
                      {isAppending ? t('common.loading') : t('admin.queue.loadMore')}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default GoverningBodyRegistrationsPage;
