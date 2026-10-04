import React, { Suspense, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import PageLoading from '../components/ui/PageLoading';
import { LogOut, School } from 'lucide-react';

import BrandMark from '../components/ui/BrandMark';
import LanguageSwitch from '../components/ui/LanguageSwitch';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import Toast from '../components/ui/Toast';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { homeFor } from '../constants/roles';

/*
  The shell for the platform admin, who stands above every school.

  Deliberately not MainLayout. That shell is built around `activeRole` and a
  school name: Sidebar reads the role to decide which menu to draw, and the
  header prints the school. A platform admin has neither — PlatformAdmin is its
  own table, not a `SchoolRole`, and the account reviewing registrations belongs
  to no school at all. Reusing MainLayout would offer them "My Courses" and a
  gradebook, every one of which ProtectedRoute would then refuse.

  So: a thin bar with who they are, the language switch, and a way out — and,
  since the national holiday calendar (backend 9dee2e2), the admin's two pages.
*/

const ADMIN_PAGES = [
  { to: '/admin/school-registrations', key: 'admin.nav.registrations' },
  { to: '/admin/holidays', key: 'admin.nav.holidays' },
];
export const AdminLayout = () => {
  const { user, logout, roles, activeRole } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();

  const [toast, setToast] = useState(null);
  const [isSignOutOpen, setIsSignOutOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const showToast = (message, type = 'info') => setToast({ message, type });

  return (
    <div className="min-h-screen bg-canvas font-sans antialiased text-slate-800 flex flex-col">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <header className="bg-white border-b border-slate-100 shrink-0">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3.5 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandMark />
            <span className="text-base font-extrabold tracking-tight text-slate-900 select-none">
              EduForID
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <span
              className="hidden sm:block text-[11px] font-semibold text-slate-500 truncate max-w-[16rem]"
              title={user?.email}
            >
              {user?.email ? t('admin.signedInAs', { email: user.email }) : ''}
            </span>
            <LanguageSwitch />
            {/* An admin who also works at a school came here from the avatar
                menu; this takes them back to the role they were working as. */}
            {roles.length > 0 && (
              <button
                type="button"
                onClick={() => navigate(homeFor(activeRole ?? roles[0]))}
                aria-label={t('admin.backToSchool')}
                title={t('admin.backToSchool')}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand-tint rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <School className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">{t('admin.backToSchool')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsSignOutOpen(true)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50/60 rounded-lg transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{t('common.signOut')}</span>
            </button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-6 overflow-x-auto select-none" aria-label={t('admin.nav.label')}>
          {ADMIN_PAGES.map((page) => (
            <NavLink
              key={page.to}
              to={page.to}
              className={({ isActive }) =>
                `pb-3 pt-1 text-sm font-extrabold border-b-2 whitespace-nowrap shrink-0 transition-colors focus:outline-none focus-visible:text-brand ${
                  isActive ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`
              }
            >
              {t(page.key)}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto text-left">
          <Suspense fallback={<PageLoading />}>
            <Outlet context={{ showToast }} />
          </Suspense>
        </div>
      </main>

      <ConfirmDialog
        open={isSignOutOpen}
        title={t('confirm.logOut.title')}
        body={t('confirm.logOut.body')}
        confirmLabel={t('shell.logOut')}
        cancelLabel={t('common.cancel')}
        busy={isSigningOut}
        busyLabel={t('shell.loggingOut')}
        onCancel={() => setIsSignOutOpen(false)}
        /*
          Two things here were a flash, and both are gone.

          This used to end in `window.location.assign`, which throws the whole
          document away and builds it again — 99 modules re-fetched in dev before
          React has rendered anything at all. Every other way out of this app
          navigates instead (SelectRolePage, UnauthorizedPage), and nothing here
          needs the harder one: logout() already clears the user, the membership,
          the active role, the platform-admin flag, all three storage keys and
          both tokens, so there is no stale state a reload would rescue us from.
          The soft path is also the one that lets KtpViewer unmount and revoke its
          object URL.

          And the dialog used to close first, which put the admin page back on
          screen for the length of the request before it went white. It now stays
          up, disabled, until there is somewhere else to be.

          The navigate sits in a `finally` because logout() can reject: both it
          and authService.logout() clear their state in a `finally` with no catch
          above it, so a failed request still signs you out — and under the old
          code took the redirect down with it.
        */
        onConfirm={async () => {
          if (isSigningOut) return;
          setIsSigningOut(true);
          try {
            await logout();
          } finally {
            navigate('/login', { replace: true });
          }
        }}
      />
    </div>
  );
};

export default AdminLayout;
