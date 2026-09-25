import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ShieldOff, Inbox, ChevronRight, Search, SearchX } from 'lucide-react';

import NotBuiltYet from '../../components/ui/NotBuiltYet';
import JoinRequestReview from './JoinRequestReview';
import BulkApproveDialog from './BulkApproveDialog';
import { isBulkable } from './bulk';
import { membershipReviewService } from '../../services/membershipReviewService';
import { isNotBuiltYet } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import {
  ROLES,
  ROLE_LABEL_KEY,
  heldRolesOf,
  requestInPov,
  releasableInPov,
  releasableLinksInPov,
} from '../../constants/roles';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';

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
      <div className="py-16 px-6 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
        <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto">
          <ShieldOff className="w-5 h-5 text-slate-400" aria-hidden="true" />
        </div>
        <h2 className="mt-3.5 text-sm font-extrabold text-slate-700">{t('requests.denied.title')}</h2>
        <p className="mt-1.5 text-xs font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">
          {t('requests.denied.body')}
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
          {t('requests.title')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">{t(`requests.subtitle.${povKey}`)}</p>
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
          <div className="border-b border-slate-100 flex gap-6 select-none">
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
                  className={`pb-3 text-sm font-extrabold transition-all border-b-2 cursor-pointer focus:outline-none flex items-center gap-2 ${
                    isActive
                      ? 'border-brand text-brand'
                      : 'border-transparent text-slate-500 hover:text-slate-600'
                  }`}
                >
                  {t(`requests.tab.${tab}`)}
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
            /*
              Not a failure, and the wording carries the weight here: for every
              teacher who is not a homeroom teacher this is the only state this
              screen has, and "nothing is waiting" has to be legible as an answer
              rather than as an error nobody explained.
            */
            <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-white select-none">
              <Inbox className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="mt-2.5 text-xs font-extrabold text-slate-500">
                {t(`requests.queue.empty.${status}`)}
              </p>
              <p className="mt-1.5 text-[11px] font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">
                {t(`requests.queue.empty.hint.${povKey}`)}
              </p>

              {/*
                Only in the waiting tab, and only for somebody who has a code.

                This is where "why has nobody asked?" occurs to a principal who has
                just had their school approved — and the answer is that they have not
                handed the code out yet. An empty Accepted or Turned down tab is a
                different question, and a teacher has no code to share, so neither
                gets the sentence.
              */}
              {status === 'PENDING' && hasSchoolCode && povKey === 'PRINCIPAL' && (
                <p className="mt-3 text-[11px] font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">
                  {t('requests.queue.empty.shareCode')}{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/profile')}
                    className="font-extrabold text-brand hover:text-brand-deep underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                  >
                    {t('requests.queue.empty.shareCode.link')}
                  </button>
                </p>
              )}
            </div>
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
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none text-xs font-semibold placeholder-slate-400 bg-white shadow-sm transition-all"
                />
              </div>

              {visible.length === 0 ? (
                /* Not the same as an empty queue: there are rows here, the search
                   simply hid them. Without a way back the page looks broken. */
                <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-white select-none">
                  <SearchX className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
                  <p className="mt-2.5 text-xs font-extrabold text-slate-500">{t('requests.search.empty')}</p>
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="mt-3 text-xs font-bold text-brand hover:text-brand-deep underline underline-offset-4 cursor-pointer focus:outline-none"
                  >
                    {t('requests.search.clear')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
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

                  {/* The action, once something is ticked. Sticky, so it stays in
                      reach at the bottom of a long list. */}
                  {tickedRows.length > 0 && (
                    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-brand-tint border border-brand/30 rounded-2xl px-4 py-2.5" aria-live="polite">
                      <span className="text-xs font-extrabold text-brand">
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
                        <button
                          type="button"
                          onClick={() => setIsBulkOpen(true)}
                          className="px-4 py-2 rounded-xl text-xs font-extrabold text-white bg-brand hover:bg-brand-deep shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                        >
                          {t('requests.bulk.open', { n: tickedRows.length })}
                        </button>
                      </span>
                    </div>
                  )}

                  {visible.map((row) => {
                    const roles = row.roles ?? [];
                    const links = releasableLinksInPov(row, activeRole);
                    const mine = releasableInPov(row, activeRole).length > 0 || links.length > 0;
                    /* A guardian already in the school claiming another child: the
                       membership and its role are ACTIVE, only the link waits. */
                    const furtherChild = row.status !== 'PENDING' && (row.children ?? []).some((link) => link.status === 'PENDING');

                    const canTick = status === 'PENDING' && isBulkable(row, activeRole);

                    /* The box sits beside the row, not inside it: the row is a
                       <button>, and a control inside a button is not valid. */
                    return (
                      <div key={row.id} className="flex items-stretch gap-2">
                      {canTick && (
                        <label className="shrink-0 flex items-center px-3.5 bg-white border border-slate-100 rounded-2xl shadow-sm cursor-pointer hover:border-brand/40">
                          <input
                            type="checkbox"
                            checked={ticked.has(row.id)}
                            onChange={() => toggle(row.id)}
                            aria-label={t('requests.bulk.tickOne', { name: row.applicant?.fullName ?? t('requests.applicant.unnamed') })}
                            className="w-4 h-4 rounded accent-brand cursor-pointer"
                          />
                        </label>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className="flex-1 min-w-0 bg-white border border-slate-100 hover:border-brand/40 hover:shadow-md rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold text-slate-900 truncate">
                            {row.applicant?.fullName ?? t('requests.applicant.unnamed')}
                          </h3>
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">
                            {furtherChild
                              ? t('requests.link.row', {
                                  names: row.children.filter((link) => link.status === 'PENDING').map((link) => link.student?.fullName).join(', '),
                                })
                              : roles.map((entry) => t(ROLE_LABEL_KEY[entry.role] ?? 'requests.role.unknown')).join(' · ')}
                            {row.student?.gradeLevel != null
                              ? ` · ${t('requests.field.grade', { n: row.student.gradeLevel })}`
                              : ''}
                          </p>
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">
                            {t('requests.list.requested', {
                              date: new Date(row.requestedAt).toLocaleDateString(locale, {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              }),
                            })}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Only in the waiting tab: once a request is decided,
                              whose decision it was stops being the question. */}
                          {mine && status === 'PENDING' && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-brand-tint text-brand">
                              {t('requests.role.yours')}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4 text-slate-300" aria-hidden="true" />
                        </div>
                      </button>
                      </div>
                    );
                  })}
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
