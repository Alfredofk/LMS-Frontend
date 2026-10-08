import React from 'react';
import { useLocation, useRouteError } from 'react-router-dom';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { homeFor } from '../../constants/roles';
import { useT } from '../../i18n/LanguageContext';

/*
  What a page shows when it throws while rendering (owner, 2026-10-05). Until then
  the app had no error boundary at all, so one page crashing - the teacher's
  gradebook did, on sample data it no longer had - left the whole window blank,
  sidebar and navbar included.

  - Placed round each layout's <Outlet> (MainLayout, AdminLayout) so the shell
    stays and the person can go elsewhere, and once round <Routes> (App.jsx) for
    the pages with no layout and for a layout that throws itself.
  - It clears itself on the next route: a crash on one page does not follow the
    person to the next.
  - Rose, not the slate "not available yet" panel: here something did fail.
  - Both ways out are full loads, not router navigations: whatever broke may still
    sit in memory, and a fresh load is the one thing sure to drop it.
  - The error itself is shown in development only (`import.meta.env.DEV`); React
    logs it to the console in every build.
*/

const ErrorPanel = ({ error, fullScreen }) => {
  const { t } = useT();
  const { user, activeRole } = useAuth();
  const home = user ? homeFor(activeRole) : '/';

  return (
    <div className={fullScreen ? 'min-h-dvh bg-canvas flex items-center justify-center p-4' : 'py-6'}>
      <div
        role="alert"
        className="w-full max-w-lg mx-auto py-12 px-6 text-center border border-rose-200 rounded-2xl bg-rose-50"
      >
        <div className="w-11 h-11 rounded-2xl bg-white border border-rose-200 flex items-center justify-center mx-auto shadow-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600" aria-hidden="true" />
        </div>
        <h2 className="mt-3.5 text-base font-extrabold text-rose-800">{t('pageError.title')}</h2>
        <p className="mt-1.5 text-xs font-semibold text-rose-800 leading-relaxed max-w-sm mx-auto">{t('pageError.body')}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-extrabold hover:bg-brand-deep cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('pageError.reload')}
          </button>
          <button
            type="button"
            onClick={() => window.location.assign(home)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-rose-200 text-rose-800 text-xs font-extrabold hover:bg-rose-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          >
            <Home className="w-3.5 h-3.5" aria-hidden="true" />
            {t(user ? 'pageError.home' : 'pageError.start')}
          </button>
        </div>
        {import.meta.env.DEV && error && (
          <details className="mt-5 text-left">
            <summary className="text-[11px] font-bold text-rose-800 cursor-pointer">{t('pageError.details')}</summary>
            <pre className="mt-2 p-3 rounded-xl bg-white border border-rose-200 text-[11px] text-rose-800 whitespace-pre-wrap break-words max-h-48 overflow-auto">
              {String(error?.stack ?? error?.message ?? error)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

/** Catches a render error below it; clears when `resetKey` changes. */
export class PageErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (this.state.error) return <ErrorPanel error={this.state.error} fullScreen={this.props.fullScreen} />;
    return this.props.children;
  }
}

/** The boundary keyed on the route, so the next page starts clean. Inside a router only. */
export const RouteErrorBoundary = ({ fullScreen = false, children }) => {
  const { pathname } = useLocation();
  return (
    <PageErrorBoundary resetKey={pathname} fullScreen={fullScreen}>
      {children}
    </PageErrorBoundary>
  );
};

/*
  The data router's own errorElement (App.jsx, 2026-10-08): what it catches
  outside the boundaries above shows the same panel, not React Router's default
  page.
*/
export const RouterErrorPage = () => <ErrorPanel error={useRouteError()} fullScreen />;

export default RouteErrorBoundary;
