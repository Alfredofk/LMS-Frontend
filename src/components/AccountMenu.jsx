import React, { startTransition, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, LogOut, Settings, User } from 'lucide-react';

import ConfirmDialog from './ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { homeFor } from '../constants/roles';

/*
  Everything about "me", behind the avatar in the navbar.

  It replaces the Account group that sat pinned at the foot of the sidebar —
  My Profile, Account & Security, Switch Role, the language switch and Log out.
  That group took so much height that the main menu above it had to scroll with
  only a handful of items in it, and on a phone it lived inside a drawer. The
  avatar is on screen everywhere, at every width.

  **Switching role goes straight to that role's dashboard.** It used to send
  people to /select-role — four cards written for somebody who has no role yet —
  so a Principal who also teaches went through a page about founding schools to
  get to their classes. /select-role stays for the people it was built for: a
  new account, a school switched off, somebody who has left.

  The list is `roles` from AuthContext, which is `activeRolesOf`: only roles with
  a dashboard, so GUARDIAN (no screen yet) is not offered as a door that leads
  nowhere. With fewer than two there is nothing to switch between, and the
  section is not drawn — the role is already on the sidebar's card.

  Built as a disclosure, not an ARIA `menu`: a menu promises arrow-key
  navigation and type-ahead, and a half-kept promise is worse for a screen
  reader than a plain list of buttons reached with Tab.
*/

const initialsOf = (fullName) =>
  fullName
    ? fullName
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : '—';

export const AccountMenu = () => {
  const { user, roles, activeRole, selectRole, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useT();

  const [open, setOpen] = useState(false);
  const [confirmingLogOut, setConfirmingLogOut] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);

  /* Escape and a click anywhere else both close it; Escape hands focus back. */
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  /*
    **Both updates in one transition, or the switch lands on /unauthorized.**
    React Router 7 applies a navigation as a transition, while a plain setState
    is urgent. Called side by side, the role change rendered first — on the page
    still open, whose ProtectedRoute then saw the new role, refused it, and
    redirected before the navigation arrived. Inside one startTransition the
    new role and the new address render together.
  */
  const switchTo = (role) => {
    setOpen(false);
    if (role === activeRole) return;
    startTransition(() => {
      if (selectRole(role)) navigate(homeFor(role));
    });
  };

  const label = user?.fullName ? t('accountMenu.button', { name: user.fullName }) : t('accountMenu.buttonNoName');
  const itemClass =
    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand';

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={label}
        title={label}
        className="flex items-center gap-1 rounded-full pr-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand hover:bg-slate-50 transition-colors"
      >
        <span className="w-8 h-8 rounded-full bg-brand-tint text-brand flex items-center justify-center font-bold text-xs shadow-inner select-none">
          {initialsOf(user?.fullName)}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id="account-menu"
          className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 text-left"
        >
          <div className="px-3 py-2.5">
            <p className="text-sm font-extrabold text-slate-900 truncate" title={user?.fullName}>
              {user?.fullName || t('shell.account.fallback')}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 truncate" title={user?.email}>
              {user?.email}
            </p>
          </div>

          {roles.length > 1 && (
            <div className="border-t border-slate-100 pt-2 mt-1">
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {t('accountMenu.enterAs')}
              </p>
              <ul className="space-y-0.5">
                {roles.map((role) => {
                  const current = role === activeRole;
                  return (
                    <li key={role}>
                      <button
                        type="button"
                        onClick={() => switchTo(role)}
                        aria-current={current ? 'true' : undefined}
                        className={`${itemClass} justify-between ${current ? 'bg-brand-tint text-brand' : ''}`}
                      >
                        {t(`roleTitle.${role}`)}
                        {current && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="border-t border-slate-100 pt-2 mt-2 space-y-0.5">
            <button type="button" onClick={() => go('/profile')} className={itemClass}>
              <User className="w-4 h-4 shrink-0 text-brand" aria-hidden="true" />
              {t('shell.myProfile')}
            </button>
            <button type="button" onClick={() => go('/account')} className={itemClass}>
              <Settings className="w-4 h-4 shrink-0 text-brand" aria-hidden="true" />
              {t('account.title')}
            </button>
          </div>

          <div className="border-t border-slate-100 pt-2 mt-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmingLogOut(true);
              }}
              className={`${itemClass} hover:text-rose-600 hover:bg-rose-50/60`}
            >
              <LogOut className="w-4 h-4 shrink-0 text-brand" aria-hidden="true" />
              {t('shell.logOut')}
            </button>
          </div>
        </div>
      )}

      {/*
        No success toast after this resolves: clearing the session unmounts the
        layout — ProtectedRoute sends the now-signed-out person to /login — so
        anything shown at that point would vanish in the same frame.
      */}
      <ConfirmDialog
        open={confirmingLogOut}
        title={t('confirm.logOut.title')}
        body={t('confirm.logOut.body')}
        confirmLabel={t('shell.logOut')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmingLogOut(false)}
        onConfirm={logout}
      />
    </div>
  );
};

export default AccountMenu;
