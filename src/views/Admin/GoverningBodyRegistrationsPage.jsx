import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShieldOff, Inbox, ChevronRight, Search, SearchX } from 'lucide-react';

import Button from '../../components/ui/Button';
import NotBuiltYet from '../../components/ui/NotBuiltYet';
import { Bone, HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { Segments, SlashFacts } from './adminParts';
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
const CARD = 'bg-white border border-slate-100 rounded-2xl shadow-sm min-w-0';
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
  const day = (value) => new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  /* The look since 2026-10-28 (owner, mockup pendaftaran-yayasan.html): the school queue's. */
  let list;
  if (error) {
    list = <HomeError message={error} retryLabel={t('att.error.retry')} onRetry={() => fetchPage(0)} />;
  } else if (isFirstLoad) {
    list = (
      <div className={`${CARD} px-4 sm:px-5 py-2`} aria-busy="true" aria-label={t('common.loading')}>
        {[0, 1, 2].map((n) => (
          <div key={n} className="py-3.5">
            <Bone className="h-3.5 w-2/5" />
            <Bone className="h-3 w-3/4 mt-2" />
          </div>
        ))}
      </div>
    );
  } else if (counts[status] === 0) {
    list = (
      <div className={`${CARD} p-6 max-sm:p-[18px]`}>
        <HomeEmpty icon={Inbox} title={t('admin.queue.empty')} body={t('gbr.queue.empty.body')} />
      </div>
    );
  } else {
    list = (
      <>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[min(100%,22rem)]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('gbr.search.placeholder')}
              aria-label={t('gbr.search.placeholder')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm font-medium placeholder-slate-500 bg-white transition-colors"
            />
          </div>
          <Segments
            label={t('gb.kind')}
            options={[ALL_KINDS, ...GOVERNING_BODY_KINDS]}
            value={kind}
            onChange={setKind}
            labelOf={(option) => (option === ALL_KINDS ? t('admin.filter.all') : t(`gb.kind.${option}`))}
          />
          {status === 'APPROVED' && (
            <Segments label={t('gbr.filter.state')} options={STATES} value={state} onChange={setState} labelOf={(option) => t(`admin.filter.state.${option}`)} />
          )}
        </div>

        {total === 0 ? (
          <div className={`${CARD} p-6 max-sm:p-[18px]`}>
            <HomeEmpty
              icon={SearchX}
              title={t('admin.search.empty')}
              action={
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  {t('admin.search.clear')}
                </Button>
              }
            />
          </div>
        ) : (
          <div className={`${CARD} px-3 sm:px-4 py-2 transition-opacity ${isRefining ? 'opacity-50' : 'opacity-100'}`} aria-busy={isRefining}>
            <p className="px-2 pt-1.5 pb-1 text-xs font-semibold text-slate-500 select-none">
              {rows.length < total ? t('admin.queue.countOf', { n: rows.length, total }) : t('admin.queue.count', { n: total })}
            </p>
            <ul>
              {rows.map((row) => (
                <li key={row.id} className="border-b border-slate-100 last:border-0">
                  <button
                    type="button"
                    onClick={() => setSelected(row)}
                    className="w-full flex items-center gap-3 px-2 py-3.5 text-left rounded-xl hover:bg-slate-50 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <span className="flex-1 min-w-0 space-y-0.5">
                      <span className="block text-sm font-bold text-slate-900 break-words">{row.governingBody?.name ?? row.name}</span>
                      <SlashFacts
                        parts={[
                          isBodyOff(row) && <span className="font-bold text-rose-700">{t('gbr.state.off')}</span>,
                          t(`gb.kind.${row.kind}`),
                          /* The body's NPYP once approved: a Platform Admin may have added or corrected it (c79b56f). */
                          (row.governingBody?.npyp ?? row.npyp) && t('gbr.row.npyp', { npyp: row.governingBody?.npyp ?? row.npyp }),
                          row.skNumber && <span className="whitespace-normal break-all">{t('gbr.row.sk', { sk: row.skNumber })}</span>,
                          row.address?.city,
                          row.applicant?.fullName,
                          t('admin.list.submitted', { date: day(row.createdAt) }),
                        ]}
                      />
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {rows.length < total && (
              <div className="px-2 pt-2 pb-2.5">
                <Button size="sm" variant="outline" onClick={() => fetchPage(rows.length)} isLoading={isAppending} className="w-full">
                  {isAppending ? t('common.loading') : t('admin.queue.loadMore')}
                </Button>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="select-none">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('gbr.title')}</h1>
        <SlashFacts
          className="block mt-2 text-sm font-medium text-slate-500"
          parts={TABS.map((tab) => (
            <span className={tab === 'PENDING' && (counts.PENDING ?? 0) > 0 ? 'font-bold text-amber-700' : ''}>{t(`admin.summary.${tab}`, { n: counts[tab] ?? 0 })}</span>
          ))}
        />
      </div>

      {selected ? (
        <GoverningBodyReview registration={selected} onBack={() => setSelected(null)} onChanged={handleChanged} onStale={handleStale} showToast={showToast} />
      ) : (
        <>
          <div role="tablist" className="flex gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)] select-none">
            {TABS.map((tab) => {
              const on = status === tab;
              const count = counts[tab] ?? 0;
              const waiting = tab === 'PENDING' && count > 0;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => openTab(tab)}
                  className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-t-lg ${
                    on ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
                  }`}
                >
                  {t(`admin.tab.${tab}`)}
                  <span
                    className={`ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums ${
                      waiting ? 'bg-amber-50 text-amber-700' : on ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          {list}
        </>
      )}
    </div>
  );
};

export default GoverningBodyRegistrationsPage;
