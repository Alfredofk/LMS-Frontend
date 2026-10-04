import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { CalendarCheck, ChevronRight, DoorOpen, IdCard, LogOut, Search, ShieldCheck, ShieldOff, ShieldX, UserMinus, Users } from 'lucide-react';

import NotBuiltYet from '../../components/ui/NotBuiltYet';
import RemoveMemberDialog from '../../components/RemoveMemberDialog';
import PersonDetailDialog from '../../components/PersonDetailDialog';
import InfoChips from '../../components/ui/InfoChips';
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
  const [tab, setTab] = useState(() => (TABS.includes(location.state?.tab) ? location.state.tab : 'ALL'));
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
      if (name === 'ALL') return active ?? [];
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

  const title = (
    <div className="select-none">
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('members.title')}</h1>
      <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">
        {t('members.subtitle', { school: membership?.school?.name ?? membership?.schoolName ?? '' })}
      </p>
    </div>
  );

  if (denied) {
    return (
      <div className="space-y-6">
        {title}
        <div className="py-16 px-6 text-center border border-dashed border-slate-200 rounded-2xl bg-white">
          <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto">
            <ShieldOff className="w-5 h-5 text-slate-400" aria-hidden="true" />
          </div>
          <h2 className="mt-3.5 text-sm font-extrabold text-slate-700">{t('classes.denied.title')}</h2>
          <p className="mt-1.5 text-xs font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">
            {t('classes.denied.body')}
          </p>
        </div>
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

      <div className="border-b border-slate-100 flex gap-6 select-none overflow-x-auto">
        {TABS.map((name) => {
          const isActive = tab === name;
          const count = inTab(name).length;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setTab(name)}
              aria-pressed={isActive}
              className={`pb-3 text-sm font-extrabold transition-all border-b-2 cursor-pointer focus:outline-none flex items-center gap-2 shrink-0 whitespace-nowrap ${
                isActive ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-600'
              }`}
            >
              {t(`members.tab.${name}`)}
              {!loading && count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${
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
          aria-pressed={tab === 'LEAVE'}
          className={`pb-3 text-sm font-extrabold transition-all border-b-2 cursor-pointer focus:outline-none flex items-center gap-2 shrink-0 whitespace-nowrap ${
            tab === 'LEAVE' ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-600'
          }`}
        >
          <DoorOpen className="w-4 h-4" aria-hidden="true" />
          {t('members.tab.leave')}
          {leaveRequests?.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums bg-amber-100 text-amber-800">
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
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : loading ? (
        <div className="h-48 bg-white border border-slate-100 rounded-2xl animate-pulse" aria-label={t('common.loading')} />
      ) : rows.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-white select-none">
          <Users className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
          <p className="mt-2.5 text-xs font-extrabold text-slate-500">
            {query.trim() ? t('members.empty.search') : t(tab === 'LEFT' ? 'members.empty.left' : 'members.empty.active')}
          </p>
        </div>
      ) : (
        <ul className="bg-white border border-slate-100 rounded-2xl shadow-sm divide-y divide-slate-100">
          {rows.map((member) => {
            const isSelf = member.membershipId === membership?.id;
            const here = tab !== 'LEFT';
            const removable = isPrincipal && here && !isSelf && !member.roles.includes(ROLES.PRINCIPAL);
            const isVice = member.roles.includes(ROLES.VICE_PRINCIPAL);
            /* The server's own rule: an active teacher, not the Principal. */
            const appointable =
              isPrincipal && here && !isVice && member.roles.includes(ROLES.TEACHER) && !member.roles.includes(ROLES.PRINCIPAL);
            const revocable = isPrincipal && here && isVice;
            const facts = [
              member.nisn && { icon: IdCard, label: `${t('profile.nisn')} ${member.nisn}` },
              member.nip && { icon: IdCard, label: `${t('profile.nip')} ${member.nip}` },
              member.nuptk && { icon: IdCard, label: `${t('profile.nuptk')} ${member.nuptk}` },
              tab === 'LEFT'
                ? { icon: LogOut, label: t('members.leftOn', { date: day(member.endedAt) }) }
                : { icon: CalendarCheck, label: t('members.joinedOn', { date: day(member.joinedAt) }) },
            ];

            return (
              <li key={member.membershipId} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setViewing(member)}
                  aria-label={t('members.openMember', { name: member.fullName })}
                  className="group min-w-0 flex-1 flex items-start gap-3 text-left rounded-xl p-1.5 -m-1.5 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                <span className="w-10 h-10 rounded-xl bg-brand-tint text-brand text-xs font-extrabold flex items-center justify-center shrink-0 select-none">
                  {initialsOf(member.fullName)}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-extrabold text-slate-800 break-words group-hover:text-brand transition-colors">{member.fullName}</span>
                    {isSelf && (
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-600">
                        {t('members.you')}
                      </span>
                    )}
                    {member.roles.map((role) => (
                      <span key={role} className="px-2 py-0.5 bg-brand-tint text-brand text-[10px] font-extrabold rounded-md">
                        {t(`roleTitle.${role}`)}
                      </span>
                    ))}
                  </div>
                  <InfoChips size="xs" items={facts} />
                  {tab === 'LEFT' && (
                    /* The reason somebody else wrote, so marked as a quotation;
                       none means they left on their own. */
                    <p className="mt-1 pl-2 border-l-2 border-slate-200 text-[11px] text-slate-600 font-semibold break-words">
                      {member.endReason ?? t('members.leftThemselves')}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 self-center sm:hidden" aria-hidden="true" />
                </button>

                {(removable || appointable || revocable) && (
                <div className="self-start sm:self-center shrink-0 flex flex-wrap gap-2">
                {appointable && (
                  <button
                    type="button"
                    onClick={() => setViceChange({ member, action: 'appoint' })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-brand hover:bg-brand-tint text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {t('members.vice.appoint')}
                  </button>
                )}
                {revocable && (
                  <button
                    type="button"
                    onClick={() => setViceChange({ member, action: 'revoke' })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <ShieldX className="w-4 h-4 shrink-0" aria-hidden="true" />
                    {t('members.vice.revoke')}
                  </button>
                )}
                {removable && (
                  <button
                    type="button"
                    onClick={() => setRemoving(member)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
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
