import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ShieldOff, Inbox, ChevronRight, Search, SearchX } from 'lucide-react';

import NotBuiltYet from '../../components/ui/NotBuiltYet';
import Button from '../../components/ui/Button';
import EmptyCard from '../../components/ui/EmptyCard';
import FactLine from '../../components/ui/FactLine';
import { HomeError } from '../Dashboard/components/HomeCard';
import { initialsOf } from '../../utils/names';
import JoinRequestReview from './JoinRequestReview';
import BulkApproveDialog from './BulkApproveDialog';
import { isBulkable } from './bulk';
import { membershipReviewService } from '../../services/membershipReviewService';
import { isNotBuiltYet } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import {
  ROLES,
  heldRolesOf,
  roleTitleKey,
  requestInPov,
  releasableInPov,
  releasableLinksInPov,
} from '../../constants/roles';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { notifyPendingChanged } from '../../hooks/usePendingCounts';

/* Membership statuses, not the admin queue's registration statuses. Three words
   each, and not the same three words — PENDING is waiting, ACTIVE is released. */
const TABS = ['PENDING', 'ACTIVE', 'REJECTED'];

const EMPTY = { PENDING: [], ACTIVE: [], REJECTED: [] };

/* One frozen array, reused. A fresh `[]` fallback on every render would give
   the memo below a new dependency each time and make it memoise nothing. */
const NO_ROWS = Object.freeze([]);

/*
  One box, five fields.

  A reviewer remembers a name, or the NISN on the form in front of them, or the
  NIP a teacher read out over the phone. Which of those they happen to have is
  not their problem, so it is not theirs to choose.
*/
const matches = (row, needle) => {
  if (!needle) return true;
  const q = needle.toLowerCase();
  return [
    row.applicant?.fullName,
    row.applicant?.email,
    row.student?.nisn,
    row.teacher?.nip,
    row.teacher?.nuptk,
  ].some((field) => field?.toLowerCase().includes(q));
};

/*
  The queue of people asking to join this school.

  This is the other half of ticket 05, and the thing that finally makes a
  dashboard reachable by an ordinary account: joining creates a PENDING
  membership, and nothing but this screen turns one into an ACTIVE role.

  Open to PRINCIPAL and TEACHER, which is what the backend's own router allows.
  **A teacher who is neither Principal nor homeroom of anything sees an empty
  list** — the backend answers `[]` rather than 403, deliberately, because there
  is nothing for them to release and nothing leaks either way. That is every
  teacher until the Principal names them homeroom of a class, so the empty state
  here is not a rare corner: it is what most people will see, and it has to read
  as "nothing waiting" rather than as a broken page.
*/
export const JoinRequestsPage = () => {
  const { showToast } = useOutletContext();
  const { membership, activeRole } = useAuth();
  const navigate = useNavigate();
  const { t, lang } = useT();

  /*
    Whether this reader has a School Code to share.

    Holding PRINCIPAL is the same thing today: `school.service.js:468` is the only
    place in the backend that creates a PRINCIPAL role, inside the transaction that
    creates the School itself, so every principal founded theirs. Asking the role
    costs nothing, where asking `/school-registrations/mine` would mean a request on
    every visit to decide whether to show one sentence.

    It stops being the same thing the day a second principal can be added to an
    existing school — they would see this and find no card. When that lands, swap
    this for the answer `SchoolCodeCard` already computes.
  */
  const hasSchoolCode = heldRolesOf(membership).includes(ROLES.PRINCIPAL);

  const [status, setStatus] = useState('PENDING');
  const [byStatus, setByStatus] = useState(EMPTY);
  const [selectedId, setSelectedId] = useState(null);
  /* Ticked for releasing together. Cleared whenever what is on screen changes —
     tab, search, a reload — so nothing is ever released that is not in view. */
  const [ticked, setTicked] = useState(() => new Set());
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  const [query, setQuery] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [denied, setDenied] = useState(false);
  const [notBuilt, setNotBuilt] = useState(false);

  /*
    All three statuses at once, not one per tab — the same trade the admin queue
    makes. The backend takes a single status and offers no counts, so a number
    beside a tab has to be fetched to exist; paying for it once means switching
    tabs stops making requests at all.

    `Promise.all` rather than `allSettled`: all three sit behind the same guard,
    so if one is refused they all are.
  */
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setDenied(false);
    setNotBuilt(false);

    try {
      const answers = await Promise.all(TABS.map((s) => membershipReviewService.list(s)));
      setByStatus(TABS.reduce((acc, s, i) => ({ ...acc, [s]: answers[i].requests ?? [] }), {}));
    } catch (err) {
      /*
        403 here is `requireActiveMembership`, not the role check — ProtectedRoute
        already handled that. It means this account holds no active membership
        any more, which includes the case where the whole school was switched off
        by a platform admin: the token then carries no school at all.
      */
      if (err.status === 403) setDenied(true);
      else if (isNotBuiltYet(err)) setNotBuilt(true);
      else setError(apiErrorMessage(err, t));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  /*
    Split by the desk the reader is sitting at (requestInPov, constants/roles.js):
    as Principal, teacher requests; as Teacher, student and guardian ones. The
    backend answers with everything this person may see from either desk, so the
    split happens here, before the tab counts — a count that includes rows this
    desk will not show is a number that lies.
  */
  const inPov = useMemo(
    () =>
      Object.fromEntries(
        TABS.map((tab) => [tab, (byStatus[tab] ?? NO_ROWS).filter((row) => requestInPov(row, activeRole))])
      ),
    [byStatus, activeRole]
  );
  const povKey = activeRole === ROLES.PRINCIPAL ? 'PRINCIPAL' : 'TEACHER';

  const rows = inPov[status] ?? NO_ROWS;

  const visible = useMemo(() => rows.filter((r) => matches(r, query.trim())), [rows, query]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  /*
    After a decision the row moves between queues, so everything is refetched
    rather than patched — the counts have to move with it. Called with null when
    somebody else decided first; the queue was simply stale, and reloading is the
    whole remedy.
  */
  const handleDecided = () => {
    setSelectedId(null);
    setTicked(new Set());
    load();
    notifyPendingChanged();
  };

  /*
    Boxes only in the waiting tab, only on requests this desk can decide
    (isBulkable, ./bulk.js) — the same test as the "Yours" badge.
  */
  const bulkable = status === 'PENDING' ? visible.filter((row) => isBulkable(row, activeRole)) : NO_ROWS;
  const tickedRows = bulkable.filter((row) => ticked.has(row.id));
  const allTicked = bulkable.length > 0 && tickedRows.length === bulkable.length;

  const toggle = (id) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setTicked(allTicked ? new Set() : new Set(bulkable.map((row) => row.id)));

  if (denied) {
    return (
      <EmptyCard icon={ShieldOff} title={t('requests.denied.title')} body={t('requests.denied.body')} />
    );
  }

  if (notBuilt) return <NotBuiltYet />;

  const locale = lang === 'en' ? 'en-GB' : 'id-ID';

  return (
    <div className="space-y-6">
      {/* The slash line, as on the dashboards (owner, 2026-10-28, the reviewed mockup):
          the school, whose requests this desk decides, how many wait. */}
      <div className="select-none">
        <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {t('requests.title')}
        </h1>
        <FactLine
          className="mt-2"
          facts={[
            membership?.school?.name ?? membership?.schoolName,
            t(`requests.pov.${povKey}`),
            !isLoading && !error && t('requests.waitingCount', { n: (inPov.PENDING ?? NO_ROWS).length }),
          ]}
        />
      </div>

      {/* The School Code used to sit here too. It now lives on the dashboard as a
          slim row and on the profile in full — and a principal reaches the
          dashboard in one click, since their menu has two items. Three copies of
          one code was two too many. */}

      {selected ? (
        <JoinRequestReview
          request={selected}
          onBack={() => setSelectedId(null)}
          onDecided={handleDecided}
          showToast={showToast}
        />
      ) : (
        <>
          {/* Text tabs with a counter, as on the dashboards; the waiting count amber. */}
          <div className="flex gap-0.5 select-none overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
            {TABS.map((tab) => {
              const isActive = status === tab;
              /* The count is of the queue, not of what the search leaves behind.
                 A number that shrinks as you type stops answering the question
                 the reviewer opened this page to ask: is there work waiting? */
              const count = (inPov[tab] ?? NO_ROWS).length;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setStatus(tab);
                    setTicked(new Set());
                  }}
                  className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:text-brand ${
                    isActive ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
                  }`}
                >
                  {t(`requests.tab.${tab}`)}
                  {count > 0 && (
                    <span
                      className={`ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums ${
                        tab === 'PENDING' ? 'bg-amber-50 text-amber-700' : isActive ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'
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
            <HomeError message={error} retryLabel={t('att.error.retry')} onRetry={load} />
          ) : isLoading ? (
            <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse" />
          ) : rows.length === 0 ? (
            /*
              Not a failure, and the wording carries the weight here: for every
              teacher who is not a homeroom teacher this is the only state this
              screen has, and "nothing is waiting" has to be legible as an answer
              rather than as an error nobody explained.
            */
            /* The code's way out is a button now, not a link in a sentence (the reviewed
               mockup): only in the waiting tab, only for somebody who has a code. */
            <EmptyCard
              icon={Inbox}
              title={t(`requests.queue.empty.${status}`)}
              body={t(status === 'PENDING' && hasSchoolCode && povKey === 'PRINCIPAL' ? 'requests.queue.empty.hintCode' : `requests.queue.empty.hint.${povKey}`)}
              action={
                status === 'PENDING' && hasSchoolCode && povKey === 'PRINCIPAL' ? (
                  <Button size="sm" variant="outline" onClick={() => navigate('/profile')}>
                    {t('requests.queue.empty.shareCode.button')}
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              <div className="relative w-full sm:max-w-sm select-none">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setTicked(new Set());
                  }}
                  placeholder={t('requests.search.placeholder')}
                  aria-label={t('requests.search.placeholder')}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none text-xs font-semibold placeholder-slate-500 bg-white shadow-sm transition-all"
                />
              </div>

              {visible.length === 0 ? (
                /* Not the same as an empty queue: there are rows here, the search
                   simply hid them. Without a way back the page looks broken. */
                <EmptyCard
                  icon={SearchX}
                  title={t('requests.search.empty')}
                  action={
                    <Button size="sm" variant="outline" onClick={() => setQuery('')}>
                      {t('requests.search.clear')}
                    </Button>
                  }
                />
              ) : (
                /* One card of rows, as on Members (owner, 2026-10-28, the reviewed mockup):
                   the "N dipilih" bar sits on its top edge, the count under it, and a
                   row's box inside the row, beside the button that opens it (a control
                   inside a <button> is not valid). */
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm min-w-0">
                  {tickedRows.length > 0 && (
                    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-brand-tint rounded-t-2xl border-b border-slate-100 px-[18px] py-2.5" aria-live="polite">
                      <span className="text-[13px] font-bold text-brand">
                        {t('requests.bulk.ticked', { n: tickedRows.length })}
                      </span>
                      <span className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setTicked(new Set())}
                          className="text-xs font-bold text-slate-600 hover:text-slate-800 cursor-pointer focus:outline-none focus-visible:underline"
                        >
                          {t('requests.bulk.clear')}
                        </button>
                        <Button size="sm" onClick={() => setIsBulkOpen(true)}>
                          {t('requests.bulk.open', { n: tickedRows.length })}
                        </Button>
                      </span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 px-[18px] py-3 border-b border-slate-100">
                    <p className="text-[13px] font-extrabold text-slate-900 select-none">
                      {t('requests.queue.count', { n: visible.length })}
                    </p>
                    {bulkable.length > 1 && (
                      <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={allTicked}
                          onChange={toggleAll}
                          className="w-4 h-4 rounded accent-brand cursor-pointer"
                        />
                        {t('requests.bulk.selectAll', { n: bulkable.length })}
                      </label>
                    )}
                  </div>

                  <ul>
                  {visible.map((row) => {
                    const roles = row.roles ?? [];
                    const links = releasableLinksInPov(row, activeRole);
                    const mine = releasableInPov(row, activeRole).length > 0 || links.length > 0;
                    /* A guardian already in the school claiming another child: the
                       membership and its role are ACTIVE, only the link waits. */
                    const furtherChild = row.status !== 'PENDING' && (row.children ?? []).some((link) => link.status === 'PENDING');

                    const canTick = status === 'PENDING' && isBulkable(row, activeRole);

                    return (
                      <li key={row.id} className="flex items-center gap-3 px-[18px] py-3 border-b border-slate-100 last:border-0">
                      {canTick && (
                        <input
                          type="checkbox"
                          checked={ticked.has(row.id)}
                          onChange={() => toggle(row.id)}
                          aria-label={t('requests.bulk.tickOne', { name: row.applicant?.fullName ?? t('requests.applicant.unnamed') })}
                          className="w-4 h-4 shrink-0 rounded accent-brand cursor-pointer"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className="group flex-1 min-w-0 flex items-center justify-between gap-3 text-left rounded-xl p-1.5 -m-1.5 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          <span className="w-10 h-10 rounded-full bg-brand-tint text-brand text-xs font-extrabold flex items-center justify-center shrink-0 select-none">
                            {initialsOf(row.applicant?.fullName)}
                          </span>
                          {/* Plain text like the member rows (owner, 2026-10-07): what is
                              asked for under the name, then grade and date in grey. */}
                          <div className="min-w-0 space-y-0.5">
                            <h3 className="text-sm font-extrabold text-slate-900 truncate">
                              {row.applicant?.fullName ?? t('requests.applicant.unnamed')}
                            </h3>
                            <p className="text-xs font-semibold text-slate-600 break-words">
                              {furtherChild
                                ? t('requests.link.row', {
                                    names: row.children.filter((link) => link.status === 'PENDING').map((link) => link.student?.fullName).join(', '),
                                  })
                                : roles.map((entry) => t(roleTitleKey(entry.role))).join(', ')}
                            </p>
                            <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs font-medium text-slate-500 tabular-nums">
                              {row.student?.gradeLevel != null && <span>{t('requests.field.grade', { n: row.student.gradeLevel })}</span>}
                              <span>
                                {t('requests.list.requested', {
                                  date: new Date(row.requestedAt).toLocaleDateString(locale, {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  }),
                                })}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Only in the waiting tab: once a request is decided,
                              whose decision it was stops being the question. Words,
                              not a chip (the reviewed mockup). */}
                          {mine && status === 'PENDING' && (
                            <span className="text-xs font-bold text-brand whitespace-nowrap">{t('requests.decide.yours')}</span>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                        </div>
                      </button>
                      </li>
                    );
                  })}
                  </ul>
                </div>
              )}
            </>
          )}
        </>
      )}

      {isBulkOpen && (
        <BulkApproveDialog
          requests={tickedRows}
          onClose={() => setIsBulkOpen(false)}
          onDone={() => {
            setIsBulkOpen(false);
            handleDecided();
          }}
        />
      )}
    </div>
  );
};

export default JoinRequestsPage;
