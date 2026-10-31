import React, { startTransition } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import Button from '../../components/ui/Button';
import { useT } from '../../i18n/LanguageContext';
import { roleTitleKey } from '../../constants/roles';
import { unauthorizedViewOf } from './unauthorized';

/*
  Landing here no longer means the wrong account. Somebody may hold several roles and
  simply be working as the wrong one, so signing them out - which is all this page
  used to offer - would be a punishment for a wrong turn.

  Since 2026-10-30 (mockup akses-dialog.html, all ten items; the owner's revision:
  no address for a student or a guardian) ProtectedRoute sends the page asked for and
  the roles it serves, so when another held role may open it the main button is
  "Buka sebagai {role}": it enters that role and opens the page, as the avatar menu's
  "Masuk sebagai" does (one startTransition, see CLAUDE.md). It used to be "Ganti
  Peran" to /select-role, which forwards straight to the default role and so offered
  no choice. The card is the signed-out screens' (a plain white card, the title 26px).
*/
export const UnauthorizedPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { roles, activeRole, selectRole, logout } = useAuth();
  const { t } = useT();

  const { enterAs, page, from } = unauthorizedViewOf({ roles, activeRole, state: location.state });
  const roleWord = (role) => t(roleTitleKey(role));

  const handleBackToHome = () => navigate('/', { replace: true });

  const handleSwitchAccount = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleEnterAs = () => {
    startTransition(() => {
      if (selectRole(enterAs)) navigate(from, { replace: true });
    });
  };

  return (
    /* `w-full`, not `w-screen`: 100vw counts a desktop scrollbar (see AuthLayout). */
    <div className="min-h-screen w-full bg-canvas flex items-center justify-center p-4 sm:p-6 text-center font-sans antialiased text-slate-800">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-8 sm:px-8">
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center" aria-hidden="true">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <h1 className="text-[26px] font-extrabold text-slate-800 tracking-tight">{t('unauthorized.title')}</h1>
        <p className="mt-2 text-sm font-medium text-slate-600 leading-relaxed">
          {enterAs ? t('unauthorized.otherRole', { role: roleWord(enterAs) }) : t(roles.length > 1 ? 'unauthorized.noRole' : 'unauthorized.cannotSwitch')}
        </p>

        {activeRole && (
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3 text-left text-[13px] text-slate-500 space-y-1">
            <p>
              {t('unauthorized.as')} <b className="font-bold text-slate-800">{roleWord(activeRole)}</b>
            </p>
            {page && (
              <p className="break-all">
                {t('unauthorized.page')} <code className="font-mono text-[12.5px] text-slate-700 bg-white border border-slate-200 rounded-md px-1.5 py-px">{page}</code>
              </p>
            )}
          </div>
        )}

        <div className="mt-6 grid gap-2.5">
          {enterAs ? (
            <>
              <Button onClick={handleEnterAs}>{t('unauthorized.enterAs', { role: roleWord(enterAs) })}</Button>
              <Button variant="outline" onClick={handleBackToHome}>
                {t('unauthorized.home')}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleBackToHome}>{t('unauthorized.home')}</Button>
              <Button variant="outline" onClick={handleSwitchAccount}>
                {t('unauthorized.switchAccount')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage;
