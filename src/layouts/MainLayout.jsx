import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../views/Dashboard/components/Sidebar';
import Navbar from '../views/Dashboard/components/Navbar';
import Toast from '../components/ui/Toast';

/*
  The shell every signed-in screen wears.

  ## The sidebar is a drawer below `md`, and unchanged above it

  It used to be neither: `w-64 shrink-0` with no responsive class anywhere in
  the file, inside a root that was `w-screen overflow-hidden`. Measured on a
  375px phone, that left the content **71px** — one word per line, with no way
  to scroll the rest into view, on every authenticated screen in the app.

  Above `md` nothing here changed. The drawer only exists below it.
*/
export const MainLayout = () => {
  const [toast, setToast] = useState(null);
  const { pathname } = useLocation();

  /*
    The drawer remembers which route it was opened on, and is open only while
    that is still the route.

    So navigating closes it without anything having to remember to: a menu
    entry, the profile card and the browser back button all change `pathname`,
    and all three close it by the same line. The obvious version of this is an
    effect on `pathname` that calls setState, which is a cascading render and
    is what the lint rule objects to. Derived state needs neither.
  */
  const [nav, setNav] = useState({ open: false, path: '' });
  const isNavOpen = nav.open && nav.path === pathname;

  const openNav = () => setNav({ open: true, path: pathname });
  const closeNav = () => setNav({ open: false, path: pathname });

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  useEffect(() => {
    if (!isNavOpen) return undefined;
    const onKeyDown = (e) => {
      /* The functional form keeps `setNav` the only dependency, and React
         guarantees that one is stable — so the listener is not rebound on
         every render just to read a fresh `pathname`. */
      if (e.key === 'Escape') setNav((n) => ({ ...n, open: false }));
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isNavOpen]);

  return (
    /* `w-full`, not `w-screen`: 100vw ignores the scrollbar and overflows by its
       width on every platform that reserves one.

       `h-dvh`, not `h-screen`: on a phone `100vh` is the height of the screen
       *without* the address bar, and the address bar is there. Paired with the
       `overflow-hidden` on this same element, the bottom of the app would sit
       behind that bar with no way to scroll it into view. `dvh` is the height
       that is actually visible, and it follows the bar as it hides and returns.

       Written alone rather than `h-screen h-dvh` as a fallback pair. Both emit
       `height`, Tailwind sorts a tie alphabetically, and `h-screen` sorts after
       `h-dvh` — so the fallback would win and the fix would vanish silently.
       `dvh` has been in Safari since 15.4 and Chrome since 108. */
    <div className="h-dvh w-full flex flex-row overflow-hidden bg-canvas font-sans antialiased text-slate-800">
      {/* Toast Alert Notifier container */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}

      {/* 1. Sidebar — static from `md` up, a drawer below it */}
      <Sidebar showToast={showToast} isOpen={isNavOpen} onClose={closeNav} />

      {/* The drawer's backdrop. Below the drawer (z-40), above everything else. */}
      {isNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={closeNav}
          aria-hidden="true"
        />
      )}

      {/* 2. Main content container */}
      {/* min-w-0: a flex child defaults to min-content width, so one wide table
          inside a page would otherwise push the whole shell sideways. */}
      <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden bg-canvas">
        {/* Navbar */}
        <Navbar showToast={showToast} onOpenNav={openNav} />

        {/* Scrollable Content Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-canvas">
          <div className="max-w-7xl mx-auto text-left">
            {/* Child routes rendered here */}
            <Outlet context={{ showToast }} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
