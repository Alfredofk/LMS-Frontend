import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { ShieldOff, Inbox, ChevronRight, Search, SearchX } from 'lucide-react';

import Button from '../../components/ui/Button';
import NotBuiltYet from '../../components/ui/NotBuiltYet';
import { Bone, HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { Segments, SlashFacts } from './adminParts';
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

const CARD = 'bg-white border border-slate-100 rounded-2xl shadow-sm min-w-0';

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

  /*
    Opened on one registration from the list of every School ("Lihat pendaftaran",
    backend ed0d304): its tab, searched by its NPSN so it is on the first page, and
    its review open. Read once; the state is dropped from the entry so a reload
    opens the queue as usual.
  */
  const location = useLocation();
  const navigate = useNavigate();
  const [open] = useState(() => location.state?.open ?? null);
  useEffect(() => {
    if (location.state?.open) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const [status, setStatus] = useState(open?.status ?? 'PENDING');
  const [selectedId, setSelectedId] = useState(open?.id ?? null);

  const [query, setQuery] = useState(open?.q ?? '');
  const [needle, setNeedle] = useState(open?.q ?? '');
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
        <p className="mt-1.5 text-xs font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">
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

  const day = (value) => new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  let list;
  if (error) {
    list = (
      <HomeError
        message={error}
        retryLabel={t('att.error.retry')}
        onRetry={() => fetchPage(0)}
      />
    );
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
    /* The queue itself is empty, whatever the filters say. Showing the search box
       here would offer to narrow nothing down. */
    list = (
      <div className={`${CARD} p-6 max-sm:p-[18px]`}>
        <HomeEmpty icon={Inbox} title={t('admin.queue.empty')} body={t('admin.queue.empty.body')} />
      </div>
    );
  } else {
    list = (
      <>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* At least 384px where there is room: the placeholder needs ~281px of text in
              English after the icon's padding (measured; narrower truncated both languages). */}
          <div className="relative flex-1 min-w-[min(100%,24rem)]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('admin.search.placeholder')}
              aria-label={t('admin.search.placeholder')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm font-medium placeholder-slate-500 bg-white transition-colors"
            />
          </div>
          {/* SD / SMP / SMA / SMK from constants/schoolTypes.js, the backend's enum: proper nouns, not translated. */}
          <Segments
            label={t('admin.filter.type')}
            options={[ALL_TYPES, ...SCHOOL_TYPE_NAMES]}
            value={type}
            onChange={setType}
            labelOf={(option) => (option === ALL_TYPES ? t('admin.filter.all') : option)}
          />
          {/* Only where it means something: a PENDING or REJECTED row has no school behind it. */}
          {status === 'APPROVED' && (
            <Segments label={t('admin.filter.state')} options={STATES} value={state} onChange={setState} labelOf={(option) => t(`admin.filter.state.${option}`)} />
          )}
        </div>

        {total === 0 ? (
          /* Not the same as an empty queue: there are rows, the filters hid them. */
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
            <p className="px-2 pt-1.5 pb-1 text-xs font-semibold text-slate-500">
              {rows.length < total ? t('admin.queue.countOf', { n: rows.length, total }) : t('admin.queue.count', { n: total })}
            </p>
            <ul>
              {rows.map((row) => (
                <li key={row.id} className="border-b border-slate-100 last:border-0">
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className="w-full flex items-center gap-3 px-2 py-3.5 text-left rounded-xl hover:bg-slate-50 transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <span className="flex-1 min-w-0 space-y-0.5">
                      <span className="block text-sm font-bold text-slate-900 break-words">{row.schoolName}</span>
                      <SlashFacts
                        parts={[
                          /* The one thing that tells two otherwise identical approved rows apart: first, in words. */
                          isOff(row) && <span className="font-bold text-rose-700">{t('admin.list.deactivated')}</span>,
                          row.schoolType,
                          t('admin.list.npsn', { npsn: row.npsn }),
                          row.city,
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
            {/* The rows past the first page were unreachable before this: `limit` defaults to 50. */}
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

  /* The queue's own counts, unfiltered: what waits, what was decided. */
  const summary = TABS.map((tab) => (
    <span key={tab} className={tab === 'PENDING' && (counts.PENDING ?? 0) > 0 ? 'font-bold text-amber-700' : ''}>
      {t(`admin.summary.${tab}`, { n: counts[tab] ?? 0 })}
    </span>
  ));

  return (
    <div className="space-y-6">
      <div className="select-none">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {t('admin.title')}
        </h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          {summary.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <>
                  {' '}
                  <span className="mx-1 text-slate-300" aria-hidden="true">
                    /
                  </span>{' '}
                </>
              )}
              {part}
            </React.Fragment>
          ))}
        </p>
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
          {/*
            The dashboards' text tabs. The count is of the queue, not of what the
            filters leave behind (`counts`, the backend's, unfiltered): a number that
            shrinks as you type stops answering whether work is waiting. Shown at 0
            too; "Menunggu" amber while anything waits.
          */}
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

export default AdminRegistrationsPage;
