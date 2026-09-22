import React, { useCallback, useEffect, useMemo, useState } from 'react';
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

const EMPTY = { PENDING: [], APPROVED: [], REJECTED: [] };

/* One frozen array, reused. A fresh `[]` fallback on every render would give
   the memo below a new dependency each time and make it memoise nothing. */
const NO_ROWS = Object.freeze([]);

/*
  One box, five fields.

  An admin remembers *something* about a school — its name, the NPSN they were
  reading a minute ago, the town, who applied. Which field that something lives
  in is not their problem, so it is not theirs to choose.
*/
const matches = (row, needle) => {
  if (!needle) return true;
  const q = needle.toLowerCase();
  return [row.schoolName, row.npsn, row.city, row.applicant?.fullName, row.applicant?.email].some(
    (field) => field?.toLowerCase().includes(q)
  );
};

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
  const [byStatus, setByStatus] = useState(EMPTY);
  const [selectedId, setSelectedId] = useState(null);

  const [query, setQuery] = useState('');
  const [type, setType] = useState(ALL_TYPES);
  const [state, setState] = useState('ALL');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [denied, setDenied] = useState(false);
  const [notBuilt, setNotBuilt] = useState(false);

  /*
    All three statuses at once, not one per tab.

    The backend takes a single status and offers no counts, so the only way to
    show "3 waiting" beside a tab is to have asked for it. Fetching all three
    pays for that once and buys two more things: switching tabs stops making
    requests at all, and anybody who looks at more than one tab now makes fewer
    requests than before, not more.

    `Promise.all` rather than `allSettled` on purpose — all three sit behind the
    same `requirePlatformAdmin`, so if one is refused they all are, and there is
    no partial state worth rendering.
  */
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setDenied(false);
    setNotBuilt(false);

    try {
      const answers = await Promise.all(TABS.map((s) => adminService.list(s)));
      setByStatus(
        TABS.reduce((acc, s, i) => ({ ...acc, [s]: answers[i].registrations ?? [] }), {})
      );
    } catch (err) {
      if (err.status === 403) setDenied(true);
      else if (isNotBuiltYet(err)) setNotBuilt(true);
      /* Through apiErrorMessage, not err.message: the server speaks English
         only, and a 401 here means the session ran out — which the dictionary
         already has a sentence for in both languages. */
      else setError(apiErrorMessage(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = byStatus[status] ?? NO_ROWS;

  const visible = useMemo(
    () =>
      rows.filter(
        (r) =>
          (type === ALL_TYPES || r.schoolType === type) &&
          (status !== 'APPROVED' || state === 'ALL' || (state === 'OFF') === isOff(r)) &&
          matches(r, query.trim())
      ),
    [rows, type, state, status, query]
  );

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const clearFilters = () => {
    setQuery('');
    setType(ALL_TYPES);
    setState('ALL');
  };

  /*
    After a decision the row moves between queues, so everything is refetched
    rather than patched — the counts have to move with it. Called with null when
    somebody else decided first; the queue was simply stale, and reloading is
    the whole remedy.
  */
  const handleDecided = () => {
    setSelectedId(null);
    load();
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
              */
              const count = (byStatus[tab] ?? []).length;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStatus(tab)}
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
          ) : isLoading ? (
            <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse" />
          ) : rows.length === 0 ? (
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

              {visible.length === 0 ? (
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
                <div className="space-y-2.5">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider select-none">
                    {t('admin.queue.count', { n: visible.length })}
                  </p>

                  {visible.map((row) => (
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
