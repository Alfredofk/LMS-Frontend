import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShieldOff, Inbox, ChevronRight, Search, SearchX, PowerOff } from 'lucide-react';

import NotBuiltYet from '../../components/ui/NotBuiltYet';
import RegistrationReview from './RegistrationReview';
import { adminService } from '../../services/adminService';
import { isNotBuiltYet } from '../../services/apiClient';
import { SCHOOL_TYPE_NAMES } from '../../constants/schoolTypes';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';

const TABS = ['PENDING', 'APPROVED', 'REJECTED'];
const ALL_TYPES = 'ALL';

/*
  Whether an approved school is still running.

  It is not a fourth status: deactivating leaves the registration APPROVED and
  sets `school.deactivatedAt`, so live and switched-off schools sit in the same
  tab looking identical. Without this the only way back to a school somebody
  turned off last week is remembering its name.

  Applied on the APPROVED tab only — a PENDING registration has no school, so
  every value of this would hide all of them.
*/
const STATES = ['ALL', 'ON', 'OFF'];
const isOff = (row) => Boolean(row.school?.deactivatedAt);

/* One frozen array and one frozen object, reused rather than rebuilt — a fresh
   literal each render is a fresh dependency each render. */
const NO_ROWS = Object.freeze([]);
const NO_COUNTS = Object.freeze({ PENDING: 0, APPROVED: 0, REJECTED: 0 });

/*
  The same number the backend defaults to, and that matters.

  Anything smaller would put a "load more" button in front of admins who never
  had one, for queues that already fitted. At 50 the screen behaves exactly as
  it did for every database this project has ever run against, and the button
  appears only where rows used to be silently unreachable.
*/
const PAGE = 50;

/* Long enough that a typed word is one request, short enough that the list does
   not feel stuck. There is no debounce utility in this project and one caller
   does not earn one. */
const TYPING_PAUSE = 300;

/*
  The platform admin's queue.

  Guarded by RequireAuth and by nothing else, because there is nothing else to
  guard it with: PlatformAdmin is its own table, not a `SchoolRole`, so it does
  not appear in `constants/roles.js` and ProtectedRoute cannot see it. The
  server decides, and a 403 is rendered as what it is — this account is not a
  platform administrator — rather than as a failure.

  Approving one row here is the only path in the whole backend that creates a
  School, a SchoolMembership and an ACTIVE PRINCIPAL role.
*/
export const AdminRegistrationsPage = () => {
  const { showToast } = useOutletContext();
  const { t, lang } = useT();

  const [status, setStatus] = useState('PENDING');
  const [selectedId, setSelectedId] = useState(null);

  const [query, setQuery] = useState('');
  const [needle, setNeedle] = useState('');
  const [type, setType] = useState(ALL_TYPES);
  const [state, setState] = useState('ALL');

  const [rows, setRows] = useState(NO_ROWS);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState(NO_COUNTS);

  const [isFetching, setIsFetching] = useState(true);
  const [isAppending, setIsAppending] = useState(false);
  const [error, setError] = useState(null);
  const [denied, setDenied] = useState(false);
  const [notBuilt, setNotBuilt] = useState(false);

  /* The box updates on every keystroke; the server hears the pause. */
  useEffect(() => {
    const id = setTimeout(() => setNeedle(query.trim()), TYPING_PAUSE);
    return () => clearTimeout(id);
  }, [query]);

  /*
    One request, and the database does the sifting.

    This used to fire three — one per tab — and filter the answers in the
    browser, because the backend took a status and nothing else. It takes nine
    parameters now and returns the counts as well, so all of that moved to where
    the rows are.

    `seq` drops a late answer on the floor. Typing produces overlapping
    requests, and without this the slowest one wins whatever was typed last.
  */
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
        const answer = await adminService.list({
          status,
          q: needle || undefined,
          schoolType: type === ALL_TYPES ? undefined : type,
          /* Only where it means anything — a PENDING registration has no school
             to be switched off, so sending this there would hide every row. */
          deactivated:
            status === 'APPROVED' && state !== 'ALL' ? String(state === 'OFF') : undefined,
          limit: PAGE,
          offset,
        });
        if (mine !== seq.current) return;

        const page = answer.registrations ?? [];
        setRows((prev) => {
          if (!append) return page.length ? page : NO_ROWS;
          /* Rows can be decided between two pages, which slides everything up by
             one and would hand React the same key twice. */
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...page.filter((r) => !seen.has(r.id))];
        });
        setTotal(answer.total ?? page.length);
        setCounts(answer.counts ?? NO_COUNTS);
      } catch (err) {
        if (mine !== seq.current) return;
        if (err.status === 403) setDenied(true);
        else if (isNotBuiltYet(err)) setNotBuilt(true);
        /* Through apiErrorMessage, not err.message: the server speaks English
           only, and a 401 here means the session ran out — which the dictionary
           already has a sentence for in both languages. */
        else setError(apiErrorMessage(err, t));
      } finally {
        if (mine === seq.current) {
          if (append) setIsAppending(false);
          else setIsFetching(false);
        }
      }
    },
    [status, needle, type, state, t]
  );

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const clearFilters = () => {
    setQuery('');
    setType(ALL_TYPES);
    setState('ALL');
  };

  /*
    Rows belong to the tab that fetched them, so they go when the tab does.
    Keeping them would show one queue's rows under another's heading for as long
    as the request takes.
  */
  const openTab = (tab) => {
    setStatus(tab);
    setRows(NO_ROWS);
    setTotal(0);
    setSelectedId(null);
  };

  /*
    After a decision the row moves between queues, so everything is refetched
    rather than patched — the counts have to move with it. Called with null when
    somebody else decided first; the queue was simply stale, and reloading is
    the whole remedy.

    Back to the first page deliberately: `total` has just changed, and the page
    that was open may now begin past the end of it.
  */
  const handleDecided = () => {
    setSelectedId(null);
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
        <p className="mt-1.5 text-xs font-semibold text-slate-400 leading-relaxed max-w-sm mx-auto">
          {t('admin.notAdmin.body')}
        </p>
      </div>
    );
  }

  if (notBuilt) return <NotBuiltYet />;

  const locale = lang === 'en' ? 'en-GB' : 'id-ID';

  /* A first load has nothing to show and gets the skeleton. A refine already has
     rows on screen, and replacing them with a grey block on every keystroke is
     worse than letting them sit for a moment. */
  const isFirstLoad = isFetching && rows.length === 0;
  const isRefining = isFetching && rows.length > 0;

  return (
    <div className="space-y-6">
      <div className="select-none">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {t('admin.title')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 font-bold mt-1">{t('admin.subtitle')}</p>
      </div>

      {selected ? (
        <RegistrationReview
          registration={selected}
          onBack={() => setSelectedId(null)}
          onDecided={handleDecided}
          showToast={showToast}
        />
      ) : (
        <>
          <div className="border-b border-slate-100 flex gap-6 select-none">
            {TABS.map((tab) => {
              const isActive = status === tab;
              /*
                The count is of the queue, not of what the filters leave behind.
                A number that shrinks as you type stops answering the question
                the admin opened this page to ask: is there work waiting?

                It used to be the length of a fetched array, which said the same
                thing only while the queue was under fifty. `counts` is the
                backend's, computed over the whole table and deliberately not
                filtered.
              */
              const count = counts[tab] ?? 0;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => openTab(tab)}
                  className={`pb-3 text-sm font-extrabold transition-all border-b-2 cursor-pointer focus:outline-none flex items-center gap-2 ${
                    isActive
                      ? 'border-brand text-brand'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {t(`admin.tab.${tab}`)}
                  {count > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${
                        isActive ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
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
            /* The queue itself is empty, whatever the filters say. Showing the
               search box here would offer to narrow nothing down. */
            <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-white select-none">
              <Inbox className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="mt-2.5 text-xs font-extrabold text-slate-400">{t('admin.queue.empty')}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between select-none">
                {/*
                  `sm` and not `xs`, and that is measured rather than chosen.
                  At max-w-xs the box is 320px, of which 56px goes to padding —
                  40 for the icon, 16 on the right — leaving 264px for text. The
                  placeholder renders at 281px in English and 275px in
                  Indonesian, so **both** languages were truncated, English by
                  17px and Indonesian by 11.

                  384px leaves 47px to spare in the worse of the two. The row
                  still has roughly 300px of slack between this and the level
                  buttons, so nothing else moves. Do not shrink it back.
                */}
                <div className="relative w-full sm:max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('admin.search.placeholder')}
                    aria-label={t('admin.search.placeholder')}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none text-xs font-semibold placeholder-slate-400 bg-white shadow-sm transition-all"
                  />
                </div>

                {/*
                  SD · SMP · SMA · SMK come from constants/schoolTypes.js, which
                  mirrors the backend's SchoolType enum. Writing the four names
                  again here would make a second list, and a second list is the
                  one that goes stale.

                  Their names are not translated: like NPSN and NIP, they are
                  proper nouns rather than words.
                */}
                <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label={t('admin.filter.type')}>
                  {[ALL_TYPES, ...SCHOOL_TYPE_NAMES].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setType(option)}
                      aria-pressed={type === option}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        type === option
                          ? 'bg-brand text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {option === ALL_TYPES ? t('admin.filter.all') : option}
                    </button>
                  ))}
                </div>
              </div>

              {/* Only where it means something. On PENDING and REJECTED there is no
                  school behind the row for it to describe. */}
              {status === 'APPROVED' && (
                <div
                  className="flex items-center gap-1.5 select-none"
                  role="group"
                  aria-label={t('admin.filter.state')}
                >
                  {STATES.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setState(option)}
                      aria-pressed={state === option}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        state === option
                          ? 'bg-brand text-white shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {t(`admin.filter.state.${option}`)}
                    </button>
                  ))}
                </div>
              )}

              {total === 0 ? (
                /*
                  Not the same as an empty queue, and saying so matters: there
                  are rows here, the filters simply hid them. Without a way back
                  the page looks broken.
                */
                <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-white select-none">
                  <SearchX className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
                  <p className="mt-2.5 text-xs font-extrabold text-slate-400">{t('admin.search.empty')}</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-3 text-xs font-bold text-brand hover:text-brand-deep underline underline-offset-4 cursor-pointer focus:outline-none"
                  >
                    {t('admin.search.clear')}
                  </button>
                </div>
              ) : (
                <div
                  className={`space-y-2.5 transition-opacity ${isRefining ? 'opacity-50' : 'opacity-100'}`}
                  aria-busy={isRefining}
                >
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
                    {rows.length < total
                      ? t('admin.queue.countOf', { n: rows.length, total })
                      : t('admin.queue.count', { n: total })}
                  </p>

                  {rows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className="w-full bg-white border border-slate-100 hover:border-brand/40 hover:shadow-md rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="text-sm font-extrabold text-slate-900 truncate">{row.schoolName}</h3>
                          {/* The one thing that separates two otherwise identical
                              approved rows, so it sits beside the name rather than
                              below it where the other details are. */}
                          {isOff(row) && (
                            <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-600 border border-rose-200">
                              <PowerOff className="w-3 h-3 shrink-0" aria-hidden="true" />
                              {t('admin.list.deactivated')}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-semibold text-slate-400 mt-0.5 truncate">
                          {row.schoolType} · NPSN {row.npsn}
                          {row.city ? ` · ${row.city}` : ''}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-400 mt-0.5 truncate">
                          {row.applicant?.fullName} ·{' '}
                          {t('admin.list.submitted', {
                            date: new Date(row.createdAt).toLocaleDateString(locale, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            }),
                          })}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" aria-hidden="true" />
                    </button>
                  ))}

                  {/* The rows past the first page were unreachable before this —
                      `limit` defaults to 50 and nothing ever asked for page two. */}
                  {rows.length < total && (
                    <button
                      type="button"
                      onClick={() => fetchPage(rows.length)}
                      disabled={isAppending}
                      className="w-full py-3 rounded-2xl border border-dashed border-slate-200 bg-white text-xs font-extrabold text-brand hover:border-brand/40 hover:bg-brand-tint/40 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-default"
                    >
                      {/* `common.loading` rather than a key of its own — it already
                          says exactly this in both dictionaries. */}
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

export default AdminRegistrationsPage;
