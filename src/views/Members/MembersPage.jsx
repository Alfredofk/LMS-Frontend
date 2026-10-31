import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { ChevronRight, DoorOpen, Search, ShieldCheck, ShieldOff, ShieldX, UserMinus, Users } from 'lucide-react';
import { roleGroupsOf, sortByRole } from './members';

import NotBuiltYet from '../../components/ui/NotBuiltYet';
import FactLine from '../../components/ui/FactLine';
import EmptyCard from '../../components/ui/EmptyCard';
import { Bone, HomeError } from '../Dashboard/components/HomeCard';
import RemoveMemberDialog from '../../components/RemoveMemberDialog';
import PersonDetailDialog from '../../components/PersonDetailDialog';
import { initialsOf } from '../../utils/names';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import LeaveRequestsPanel from './LeaveRequestsPanel';
import { membersService } from '../../services/membersService';
import { leaveRequestsService } from '../../services/leaveRequestsService';
import { isNotBuiltYet } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { membersErrorMessage, leaveDecisionErrorMessage, viceErrorMessage } from '../../i18n/apiError';
import { ROLES } from '../../constants/roles';
import { notifyPendingChanged } from '../../hooks/usePendingCounts';

/*
  The school's people — the Principal's list, backend `7a91eaf`.

  `GET /api/members` answers either the people here now (ACTIVE) or the people
  who were (LEFT, with when and why). Both are asked for at once, so every tab
  carries its count from the start and switching tabs asks nothing.

  The role tabs are filtered here from the one ACTIVE list rather than asked for
  one role at a time: a teacher who is also a guardian belongs under both, and
  one list read twice says so without a second request.

  **Removal is revocation, not deletion** — the dialog says so before anybody
  presses it. Afterwards the person moves to "Left" with the reason; nothing of
  theirs is gone, and they may ask to join again.

  Who cannot be removed is not offered the button: any Principal (the backend
  refuses with 409), and the reader themselves (404 — leaving is a different
  act, done by the person leaving). Everything else the server may still refuse
  — chiefly a homeroom teacher who still holds a class in an active year — is
  said inside the dialog, with the classes named.

  This page replaced the Teachers and Students tabs on the principal dashboard,
  which asked `/api/headmaster/*` — routes that were never written.

  **Leave requests have a tab of their own** (owner, 2026-09-26) — a teacher or
  a student asking to leave with a letter, backend `75e2fdd`. It sits apart from
  TABS because it lists requests, not members: no search, its own rows, and its
  own fetch, which may fail without taking the members down with it. It is read
  on arrival so its count shows, and re-read — with the members — after every
  decision, because approving one moves the person to "Left".

  **A Vice Principal reads this page too** (backend `89a5666`, ticket 19), and
  everything that changes who is in the school stays the Principal's: removing,
  the leave-request tab and appointing or revoking a Vice Principal are not
  rendered for them at all (owner, 2026-09-29) — the server would answer 403.

  **The Principal appoints a Vice Principal from a teacher's row**, and revokes
  from theirs. Either takes effect at that person's next token, which the
  confirmation says; revoking leaves them a teacher.
*/

const TABS = ['ALL', 'VICE_PRINCIPAL', 'TEACHER', 'STUDENT', 'GUARDIAN', 'LEFT'];

/* Name, and every number a school might search by. */
const matches = (member, needle) => {
  if (!needle) return true;
  const hay = [member.fullName, member.nisn, member.nip, member.nuptk]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle.toLowerCase());
};

export const MembersPage = () => {
  const { showToast } = useOutletContext();
  const { membership, activeRole } = useAuth();
  const { t, lang } = useT();
  /* Removing, leave requests and the Vice Principal switch: the Principal's alone. */
  const isPrincipal = activeRole === ROLES.PRINCIPAL;

  const [active, setActive] = useState(null);
  const [left, setLeft] = useState(null);
  /* A dashboard card can open a tab directly (`state.tab`, owner 2026-10-03). */
  const location = useLocation();
  /* 'LEAVE' too: the dashboard's "Perlu tindakan" opens the leave requests. */
  const [tab, setTab] = useState(() =>
    TABS.includes(location.state?.tab) || location.state?.tab === 'LEAVE' ? location.state.tab : 'ALL'
  );
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);
  const [denied, setDenied] = useState(false);
  const [notBuilt, setNotBuilt] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState(null);
  const [leaveError, setLeaveError] = useState(null);
  /* { member, action: 'appoint'|'revoke' } while the question is on screen. */
  const [viceChange, setViceChange] = useState(null);
  /* The member opened in PersonDetailDialog (owner, 2026-10-03). */
  const [viewing, setViewing] = useState(null);
  const [viceBusy, setViceBusy] = useState(false);

  const fetchBoth = () =>
    Promise.all([membersService.list({ status: 'ACTIVE' }), membersService.list({ status: 'LEFT' })]);

  const apply = ([now, before]) => {
    setError(null);
    setActive(now);
    setLeft(before);
  };

  const fail = useCallback(
    (err) => {
      if (err.status === 403) setDenied(true);
      else if (isNotBuiltYet(err)) setNotBuilt(true);
      else setError(membersErrorMessage(err, t));
    },
    [t]
  );

  const loadLeaveRequests = useCallback(
    () =>
      leaveRequestsService
        .list('PENDING')
        .then((list) => {
          setLeaveRequests(list);
          setLeaveError(null);
        })
        .catch((err) => setLeaveError(leaveDecisionErrorMessage(err, t))),
    [t]
  );

  useEffect(() => {
    if (isPrincipal) loadLeaveRequests();
  }, [loadLeaveRequests, isPrincipal]);

  const handleLeaveChanged = () => {
    loadLeaveRequests();
    notifyPendingChanged();
    fetchBoth().then(apply).catch(fail);
  };

  useEffect(() => {
    let cancelled = false;
    fetchBoth()
      .then((answer) => !cancelled && apply(answer))
      .catch((err) => !cancelled && fail(err));
    return () => {
      cancelled = true;
    };
  }, [fail]);

  const inTab = useCallback(
    (name) => {
      if (name === 'LEFT') return left ?? [];
      /* By role, then A-Z (owner, 2026-10-07); the one-role tabs keep the backend's A-Z. */
      if (name === 'ALL') return sortByRole(active);
      return (active ?? []).filter((member) => member.roles.includes(name));
    },
    [active, left]
  );

  const rows = useMemo(() => inTab(tab).filter((member) => matches(member, query.trim())), [inTab, tab, query]);

  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  const day = (value) =>
    value ? new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  const handleRemoved = (member) => {
    setRemoving(null);
    showToast(t('members.remove.done', { name: member.fullName }), 'success');
    /* They move from a role tab to "Left", with the reason — read back rather
       than patched, since the server is what wrote endedAt and endReason. */
    fetchBoth().then(apply).catch(fail);
  };

  const handleViceConfirm = async () => {
    const { member, action } = viceChange;
    setViceBusy(true);
    try {
      if (action === 'appoint') await membersService.appointVicePrincipal(member.membershipId);
      else await membersService.revokeVicePrincipal(member.membershipId);
      showToast(t(`members.vice.${action}.done`, { name: member.fullName }), 'success');
    } catch (err) {
      showToast(viceErrorMessage(err, t), 'error');
    } finally {
      setViceBusy(false);
      setViceChange(null);
      /* Read back either way: a 409 or 404 means it changed elsewhere. */
      fetchBoth().then(apply).catch(fail);
    }
  };

  /* The slash line, as on the dashboards (owner, 2026-10-28): the school, who is here,
     who has left; the roles are counted on the tabs. */
  const title = (
    <div className="select-none">
      <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('members.title')}</h1>
      <FactLine
        className="mt-2"
        facts={[
          membership?.school?.name ?? membership?.schoolName,
          active && t('members.subtitle.active', { n: active.length }),
          left && t('members.subtitle.left', { n: left.length }),
        ]}
      />
    </div>
  );

  if (denied) {
    return (
      <div className="space-y-6">
        {title}
        <EmptyCard icon={ShieldOff} title={t('classes.denied.title')} body={t('classes.denied.body')} />
      </div>
    );
  }

  if (notBuilt) {
    return (
      <div className="space-y-6">
        {title}
        <NotBuiltYet />
      </div>
    );
  }

  const loading = active === null && !error;

  return (
    <div className="space-y-6">
      {title}

      {/* Text tabs with a counter, as on the dashboards (the skill's recipe): no icon in a
          tab, and the leave count amber while anything waits. */}
      <div role="tablist" aria-label={t('shell.members')} className="flex gap-0.5 select-none overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
        {TABS.map((name) => {
          const isActive = tab === name;
          const count = inTab(name).length;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              role="tab"
              aria-selected={isActive}
              className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:text-brand ${
                isActive ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              {t(`members.tab.${name}`)}
              {!loading && count > 0 && (
                <span
                  className={`ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums ${
                    isActive ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
        {isPrincipal && (
        <button
          type="button"
          onClick={() => setTab('LEAVE')}
          role="tab"
          aria-selected={tab === 'LEAVE'}
          className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:text-brand ${
            tab === 'LEAVE' ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
          }`}
        >
          {t('members.tab.leave')}
          {leaveRequests?.length > 0 && (
            <span className="ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums bg-amber-50 text-amber-700">
              {leaveRequests.length}
            </span>
          )}
        </button>
        )}
      </div>

      {tab === 'LEAVE' && isPrincipal ? (
        <LeaveRequestsPanel
          requests={leaveRequests}
          error={leaveError}
          onChanged={handleLeaveChanged}
          showToast={showToast}
        />
      ) : (
      <>
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('members.search')}
          aria-label={t('members.search')}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
        />
      </div>

      {error ? (
        <HomeError message={error} />
      ) : loading ? (
        /* Rows shaped like the members' (owner, 2026-10-31, mockup item 16). */
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm divide-y divide-slate-100" aria-busy="true" aria-label={t('common.loading')}>
          {[0, 1, 2].map((n) => (
            <div key={n} className="px-5 py-4 flex items-center gap-3">
              <span className="w-10 h-10 rounded-full shrink-0 animate-pulse bg-slate-100" aria-hidden="true" />
              <div className="flex-1">
                <Bone className="h-3.5 w-2/5" />
                <Bone className="h-3 w-3/5 mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyCard
          icon={query.trim() ? Search : Users}
          title={query.trim() ? t('members.empty.search') : t(tab === 'LEFT' ? 'members.empty.left' : 'members.empty.active')}
        />
      ) : (
        /* On "Semua" a small heading per role (owner, 2026-10-31, mockup item 14): the
           order was by role already, the heading shows where one ends. */
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm">
          {(tab === 'ALL' ? roleGroupsOf(rows) : [{ role: undefined, members: rows }]).map((group) => (
            <div key={group.role ?? 'rest'}>
              {group.role !== undefined && (
                <div className="flex items-baseline justify-between gap-2 px-5 pt-3.5 pb-2 border-b border-slate-100">
                  <h2 className="text-[13px] font-extrabold text-slate-700">{t(group.role ? `roleTitle.${group.role}` : 'roleTitle.fallback')}</h2>
                  <span className="text-xs font-semibold text-slate-500 tabular-nums">{group.members.length}</span>
                </div>
              )}
        <ul className="divide-y divide-slate-100">
          {group.members.map((member) => {
            const isSelf = member.membershipId === membership?.id;
            const here = tab !== 'LEFT';
            const removable = isPrincipal && here && !isSelf && !member.roles.includes(ROLES.PRINCIPAL);
            const isVice = member.roles.includes(ROLES.VICE_PRINCIPAL);
            /* The server's own rule: an active teacher, not the Principal. */
            const appointable =
              isPrincipal && here && !isVice && member.roles.includes(ROLES.TEACHER) && !member.roles.includes(ROLES.PRINCIPAL);
            const revocable = isPrincipal && here && isVice;
            /* Plain text, no pills or icons (owner, 2026-10-07: the coloured chips were "pusing");
               labelled with a colon, the value bolder (owner, 2026-10-31, mockup item 13). */
            const facts = [
              member.nisn && [t('profile.nisn'), member.nisn],
              member.nip && [t('profile.nip'), member.nip],
              member.nuptk && [t('profile.nuptk'), member.nuptk],
              tab === 'LEFT' ? [t('members.leftLabel'), day(member.endedAt)] : [t('members.joinedLabel'), day(member.joinedAt)],
            ].filter(Boolean);

            return (
              <li key={member.membershipId} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setViewing(member)}
                  aria-label={t('members.openMember', { name: member.fullName })}
                  className="group min-w-0 flex-1 flex items-center gap-3 text-left rounded-xl p-1.5 -m-1.5 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                <span className="w-10 h-10 rounded-full bg-brand-tint text-brand text-xs font-extrabold flex items-center justify-center shrink-0 select-none">
                  {initialsOf(member.fullName)}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-sm font-extrabold text-slate-800 break-words group-hover:text-brand transition-colors">
                    {member.fullName}
                    {isSelf && <span className="ml-1.5 text-xs font-semibold text-slate-500">({t('members.you')})</span>}
                  </p>
                  <p className="text-xs font-semibold text-slate-600 break-words">
                    {member.roles.map((role) => t(`roleTitle.${role}`)).join(', ')}
                  </p>
                  <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs font-medium text-slate-500 tabular-nums">
                    {facts.map(([label, value]) => (
                      <span key={label}>
                        {label}: <b className="font-bold text-slate-700">{value}</b>
                      </span>
                    ))}
                  </p>
                  {tab === 'LEFT' &&
                    /* The reason somebody else wrote, in a pale box as on /select-role; none
                       means they left on their own, one grey sentence (mockup item 15). */
                    (member.endReason ? (
                      <p className="mt-1.5 rounded-[10px] bg-slate-50 border border-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 break-words">
                        {t('members.leftReason', { reason: member.endReason })}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-medium text-slate-500">{t('members.leftThemselves')}</p>
                    ))}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 self-center sm:hidden" aria-hidden="true" />
                </button>

                {(removable || appointable || revocable) && (
                /* Text buttons, no frames (owner, 2026-10-28): the list was a wall of boxes. */
                <div className="self-start sm:self-center shrink-0 flex flex-wrap gap-1">
                {appointable && (
                  <button
                    type="button"
                    onClick={() => setViceChange({ member, action: 'appoint' })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand text-brand hover:bg-brand-tint"
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {t('members.vice.appoint')}
                  </button>
                )}
                {revocable && (
                  <button
                    type="button"
                    onClick={() => setViceChange({ member, action: 'revoke' })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand text-slate-600 hover:bg-slate-100"
                  >
                    <ShieldX className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {t('members.vice.revoke')}
                  </button>
                )}
                {removable && (
                  <button
                    type="button"
                    onClick={() => setRemoving(member)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand text-rose-700 hover:bg-rose-50"
                  >
                    <UserMinus className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {t('members.remove')}
                  </button>
                )}
                </div>
                )}
              </li>
            );
          })}
        </ul>
            </div>
          ))}
        </div>
      )}
      </>
      )}

      <ConfirmDialog
        open={Boolean(viceChange)}
        tone={viceChange?.action === 'revoke' ? 'danger' : 'brand'}
        title={viceChange ? t(`members.vice.${viceChange.action}.title`, { name: viceChange.member.fullName }) : ''}
        body={viceChange ? t(`members.vice.${viceChange.action}.body`, { name: viceChange.member.fullName }) : ''}
        confirmLabel={viceChange ? t(`members.vice.${viceChange.action}`) : ''}
        cancelLabel={t('common.cancel')}
        busy={viceBusy}
        onConfirm={handleViceConfirm}
        onCancel={() => setViceChange(null)}
      />

      {viewing && (
        <PersonDetailDialog key={viewing.membershipId} person={viewing} onClose={() => setViewing(null)} />
      )}

      {removing && (
        <RemoveMemberDialog
          key={removing.membershipId}
          member={removing}
          onClose={() => setRemoving(null)}
          onRemoved={handleRemoved}
        />
      )}
    </div>
  );
};

export default MembersPage;
