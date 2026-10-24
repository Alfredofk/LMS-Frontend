import React, { Suspense, useState } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';

import PageLoading from '../components/ui/PageLoading';
import RouteErrorBoundary from '../components/ui/PageError';
import BrandMark from '../components/ui/BrandMark';
import LanguageSwitch from '../components/ui/LanguageSwitch';
import Toast from '../components/ui/Toast';
import AccountMenu from '../components/AccountMenu';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { GOVERNING_BODY_ADMINS, GOVERNING_BODY_HOME, signedInHome } from '../constants/roles';

/*
  The shell for a Governing Body's admin (backend b5cfffd; owner, 2026-10-24: "like
  AdminLayout"). Not MainLayout, for AdminLayout's reason: that shell is built
  around a school role, and a seat's sign-in holds none - its token names the body
  and no school. So: the brand, the language switch, the avatar menu (switching to
  another place, settings, log out), and a tab row: the body's page and, since
  backend 3d7d05a, its admins (ticket 04), until its dashboard arrives (ticket 07).

  Only for a sign-in that is for a body; anybody else is sent where they belong.
*/

const PAGES = [
  { to: GOVERNING_BODY_HOME, key: 'gb.nav.home' },
  { to: GOVERNING_BODY_ADMINS, key: 'gb.nav.admins' },
];

export const GoverningBodyLayout = () => {
  const { governingBody, roles, activeRole, isPlatformAdmin } = useAuth();
  const { t } = useT();

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'info') => setToast({ message, type });

  if (!governingBody?.id) return <Navigate to={signedInHome({ roles, activeRole, isPlatformAdmin })} replace />;

  return (
    <div className="min-h-screen bg-canvas font-sans antialiased text-slate-800 flex flex-col">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <header className="bg-white border-b border-slate-100 shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandMark />
            <span className="text-base font-extrabold tracking-tight text-slate-900 select-none">EduForID</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            <LanguageSwitch />
            <AccountMenu />
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-6 overflow-x-auto select-none" aria-label={t('gb.nav.label')}>
          {PAGES.map((page) => (
            <NavLink
              key={page.to}
              to={page.to}
              end
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

      {/* The padding sits inside the max-w-6xl box, as the header's does, so the page
          starts where the logo and the tab start (it sat 24px left of them). */}
      <main className="flex-1 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-left">
          <RouteErrorBoundary>
            <Suspense fallback={<PageLoading />}>
              <Outlet context={{ showToast }} />
            </Suspense>
          </RouteErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default GoverningBodyLayout;
