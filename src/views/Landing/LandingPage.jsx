import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';
import BrandMark from '../../components/ui/BrandMark';
import LanguageSwitch from '../../components/ui/LanguageSwitch';
import { useT } from '../../i18n/LanguageContext';

/*
  Outside the page component on purpose. Declared inside it, React treats every
  render as a brand-new component type and rebuilds the subtree from scratch —
  which is what `react-hooks/static-components` was flagging here twice.
*/
const Logo = () => (
  <div className="flex items-center gap-2 select-none">
    <BrandMark size="sm" tone="solid" />
    <span className="text-base font-extrabold tracking-tight text-slate-900">
      EduForID
    </span>
  </div>
);

export const LandingPage = () => {
  const navigate = useNavigate();
  const { t } = useT();
  const [toast, setToast] = useState(null);

  // Dynamic Toast trigger
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const closeToast = () => {
    setToast(null);
  };

  const handleUnderConstruction = (labelKey) => {
    showToast(t('landing.underConstruction', { feature: t(labelKey) }), 'info');
  };

  /* Keys, not sentences — the same six cards read in either language. */
  const features = [
    {
      key: 'builder',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-500',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      )
    },
    {
      key: 'quiz',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-500',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 21l8.97-4.485L15 12l-5.187 3.904zM18 3.75a.75.75 0 00-1.5 0v3.75H12a.75.75 0 000 1.5h4.5V13a.75.75 0 001.5 0V3.75z" />
        </svg>
      )
    },
    {
      key: 'progress',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-500',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v5.25c0 .621-.504 1.125-1.125 1.125h-2.25A1.125 1.125 0 013 18.375v-5.25zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125v-9.75zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v14.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      )
    },
    {
      key: 'forum',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-500',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.083.185.125.39.125.603V15.75a2.25 2.25 0 01-2.25 2.25h-1.5c-.05 0-.1.015-.149.043l-3.416 1.95a.75.75 0 01-1.06-.65V18a2.25 2.25 0 01-2.25-2.25H6.75A2.25 2.25 0 014.5 13.5V9.114c0-.213.042-.418.125-.603m15.625 0A2.25 2.25 0 0018 6.75H6c-.722 0-1.372.34-1.875.877m16.125 0a3.374 3.374 0 00-3-1.877h-6A3.375 3.375 0 006.75 6.75m0 0a3.375 3.375 0 016-1.877h3a3.375 3.375 0 013 1.877" />
        </svg>
      )
    },
    {
      key: 'insights',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-500',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
        </svg>
      )
    },
    {
      key: 'chatbot',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-500',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a.75.75 0 01-1.074-.765 6 6 0 013.01-4.702C5.076 14.226 5 13.167 5 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
        </svg>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased overflow-x-hidden selection:bg-brand selection:text-white">
      
      {/* Toast notifier container */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}

      {/* ========================================== */}
      {/* 1. NAVBAR SECTION                          */}
      {/* ========================================== */}
      {/*
        Below `sm` this header is two rows: the logo on one, the controls on the
        next. Measured on a 375px phone, the controls need 288px and the space
        left beside the logo is 218px, so "Daftar" ended 46px past the right edge
        — and nothing on this page scrolls sideways, so the one button that asks
        somebody to sign up could not be pressed at all.

        Wrapping rather than hiding the language switch or shortening it to
        "ID/EN": both were measured too. Hiding it fits with 82px to spare but
        leaves an English reader on a phone with no way to change language on the
        first page they see. "ID/EN" still missed by 6px on its own, and only fit
        once the padding and gaps were tightened as well — a crowded row, and it
        would have to break LanguageSwitch's own rule that a language is written
        the way its speakers write it.

        Two rows costs height and nothing else: 76px becomes 120px, on phones
        only. From `sm` up `flex-nowrap` turns the wrapping off outright, which
        matters at 768px: that is where the nav links appear, and measured, the row
        still fits there by compressing the nav from 338px to 308px. Left to wrap it
        would have broken into two rows instead — a change on a screen that was
        never broken.
        `gap-y-3` does nothing while everything fits on one
        line, so from `sm` up this header is unchanged.
      */}
      <header className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-y-3 select-none relative z-30">
        <Logo />

        {/* Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500">
          {/* This nav only ever serves the landing page, so Home is always the
              current one. aria-current carries that to a screen reader, which
              the colour alone cannot. */}
          <button
            aria-current="page"
            onClick={() => showToast(t('landing.onHomeAlready'), 'info')}
            className="text-brand font-bold cursor-pointer"
          >
            {t('landing.nav.home')}
          </button>
          <button onClick={() => handleUnderConstruction('landing.nav.course')} className="hover:text-slate-900 transition-colors cursor-pointer">{t('landing.nav.course')}</button>
          <button onClick={() => handleUnderConstruction('landing.nav.mentor')} className="hover:text-slate-900 transition-colors cursor-pointer">{t('landing.nav.mentor')}</button>
          <button onClick={() => handleUnderConstruction('landing.nav.about')} className="hover:text-slate-900 transition-colors cursor-pointer">{t('landing.nav.about')}</button>
        </nav>

        {/* Action Buttons */}
        {/* `w-full` is what forces the wrap below `sm`; `sm:w-auto` puts it back
            beside the logo above it, where the header's own justify-between takes
            over and this one stops mattering.

            Three values of `justify` were tried on a phone before the real problem
            turned out not to be the value at all. `end` left the language switch 39px
            past the logo at 375px and 76px past it at 412px — the gap grew with the
            screen. `start` lined it up with the logo but hung all that space off the
            right instead. `between` squared both edges and then opened 54px between
            every control, which set Sign In adrift in the middle.

            All three were right about the value and wrong about the structure: this
            row had three equal children, so spreading it evenly is exactly what it
            was asked to do. Sign In and Register are one thing — two doors to the
            same /login, differing only in which step they open on. Wrapped into one
            child, `justify-between` now has two things to place, and puts them where
            the page already has edges. */}
        <div className="flex items-center gap-4 w-full justify-between sm:w-auto">
          <LanguageSwitch />

          {/* The pair, kept together. `gap-4` matches the gap outside it, so from
              `sm` up — where the row is content-sized and nothing is being spread —
              all three controls still sit 16px apart, exactly as before. */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/login', { state: { step: 'sign_in' } })}
              className="text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              {t('landing.nav.signIn')}
            </button>
            <Button
              size="sm"
              onClick={() => navigate('/login', { state: { step: 'sign_up' } })}
              className="rounded-xl px-4 py-2 text-sm font-bold shadow-md shadow-brand/10 cursor-pointer"
            >
              {t('landing.nav.register')}
            </Button>
          </div>
        </div>
      </header>

      {/* ========================================== */}
      {/* 2. HERO SECTION                            */}
      {/* ========================================== */}
      <section className="max-w-6xl mx-auto px-6 pt-8 pb-16 lg:pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-20">
        <div className="lg:col-span-7 space-y-6 text-left">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-tight">
            {t('landing.hero.lead')} <span className="text-brand">{t('landing.hero.accentOne')}</span> <br />
            <span className="text-brand">{t('landing.hero.accentTwo')}</span> {t('landing.hero.trail')}
          </h1>
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-lg font-medium">
            {t('landing.hero.subtitle')}
          </p>

          <div className="flex items-center gap-4 pt-2">
            <Button
              onClick={() => navigate('/login', { state: { step: 'sign_up' } })}
              className="py-3 px-6 rounded-xl font-bold bg-brand hover:bg-brand-deep shadow-lg shadow-brand/20 active:scale-95 transition-transform text-white cursor-pointer"
            >
              {t('landing.hero.getStarted')}
            </Button>
            <button
              type="button"
              onClick={() => handleUnderConstruction('landing.hero.contact')}
              className="py-3 px-6 rounded-xl font-bold bg-white text-brand border border-slate-200 hover:bg-slate-50 active:scale-95 transition-transform shadow-sm cursor-pointer"
            >
              {t('landing.hero.contact')}
            </button>
          </div>
        </div>

        {/* Right Illustration Column (Reverted to the original clean circular chart illustration) */}
        <div className="lg:col-span-5 flex items-center justify-center relative">
          
          <div className="w-72 h-72 sm:w-80 sm:h-80 lg:w-96 lg:h-96 rounded-full relative overflow-hidden bg-brand-tint/40 border-8 border-white shadow-xl flex items-center justify-center">
            
            <svg viewBox="0 0 100 100" className="w-full h-full transform scale-95 select-none pointer-events-none">
              <circle cx="50" cy="50" r="46" fill="#F1EEFF" />
              <path 
                d="M 50 4 A 46 46 0 0 1 96 50 L 50 50 Z" 
                fill="var(--color-brand)" 
                transform="rotate(135 50 50)" 
              />
            </svg>
            
          </div>

          <div className="absolute top-10 right-4 w-4 h-4 bg-brand rounded-full pointer-events-none opacity-85 shadow-sm" />
          <div className="absolute bottom-12 left-6 w-5 h-5 bg-brand rounded-full pointer-events-none opacity-85 shadow-sm" />
          <div className="absolute top-1/2 left-[-10px] w-2.5 h-2.5 bg-violet-400 rounded-full pointer-events-none opacity-60" />
        </div>
      </section>

      {/* ========================================== */}
      {/* 3. METRICS SECTION                         */}
      {/* ========================================== */}
      <section className="max-w-6xl mx-auto px-6 relative z-30">
        <div className="bg-white rounded-3xl border border-slate-100/60 shadow-xl py-6 px-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          
          <div className="flex items-center text-left md:border-r border-slate-100 last:border-0 py-2">
            <div className="w-12 h-12 bg-brand-tint text-brand rounded-2xl flex items-center justify-center shrink-0 mr-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-extrabold text-slate-800">17k+</div>
              <div className="text-xs text-slate-400 font-bold mt-0.5">{t('landing.stats.classes')}</div>
            </div>
          </div>

          <div className="flex items-center text-left md:border-r border-slate-100 last:border-0 py-2">
            <div className="w-12 h-12 bg-brand-tint text-brand rounded-2xl flex items-center justify-center shrink-0 mr-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12v18H3V3z" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-extrabold text-slate-800">20+</div>
              <div className="text-xs text-slate-400 font-bold mt-0.5">{t('landing.stats.schools')}</div>
            </div>
          </div>

          <div className="flex items-center text-left py-2">
            <div className="w-12 h-12 bg-brand-tint text-brand rounded-2xl flex items-center justify-center shrink-0 mr-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.231-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 017.918 5.841 50.58 50.58 0 00-2.658.814m-13.002 0L12 14.583l8.742-4.436M12 14.583v6.32" />
              </svg>
            </div>
            <div>
              <div className="text-xl font-extrabold text-slate-800">350k+</div>
              <div className="text-xs text-slate-400 font-bold mt-0.5">{t('landing.stats.users')}</div>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================== */}
      {/* 4. FEATURES SECTION                        */}
      {/* ========================================== */}
      <section className="max-w-6xl mx-auto px-6 py-16 text-center">
        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold text-slate-900 leading-tight">
            {t('landing.features.title')} <span className="text-brand">{t('landing.features.titleAccent')}</span>
          </h2>
          <p className="text-sm text-slate-400 font-semibold select-none">
            {t('landing.features.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
          {features.map((feature) => (
            <div
              key={feature.key}
              className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow flex items-center text-left"
            >
              <div className={`w-14 h-14 ${feature.bgColor} ${feature.textColor} rounded-2xl flex items-center justify-center shrink-0 mr-4`}>
                {feature.icon}
              </div>
              <div className="space-y-0.5">
                <h4 className="text-base font-extrabold text-slate-800">{t(`landing.feature.${feature.key}.title`)}</h4>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">{t(`landing.feature.${feature.key}.desc`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================== */}
      {/* 5. FOOTER SECTION                          */}
      {/* ========================================== */}
      <footer className="bg-brand-tint pt-16 pb-8 px-6 sm:px-12 relative z-10 select-none">
        <div className="max-w-6xl mx-auto bg-white rounded-[32px] p-8 sm:p-12 shadow-xl flex flex-col gap-12">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 text-left">
            <div className="lg:col-span-4 space-y-4">
              <Logo />
              <p className="text-xs text-slate-400 leading-relaxed font-semibold max-w-xs">
                {t('landing.footer.tagline')}
              </p>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <h5 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">{t('landing.footer.platform')}</h5>
              <ul className="space-y-2 text-xs text-slate-400 font-semibold">
                <li><button onClick={() => handleUnderConstruction('landing.footer.features')} className="hover:text-brand transition-colors cursor-pointer">{t('landing.footer.features')}</button></li>
                <li><button onClick={() => handleUnderConstruction('landing.footer.pricing')} className="hover:text-brand transition-colors cursor-pointer">{t('landing.footer.pricing')}</button></li>
                <li><button onClick={() => handleUnderConstruction('landing.footer.integrations')} className="hover:text-brand transition-colors cursor-pointer">{t('landing.footer.integrations')}</button></li>
                <li><button onClick={() => handleUnderConstruction('landing.footer.updates')} className="hover:text-brand transition-colors cursor-pointer">{t('landing.footer.updates')}</button></li>
              </ul>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <h5 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">{t('landing.footer.support')}</h5>
              <ul className="space-y-2 text-xs text-slate-400 font-semibold">
                <li><button onClick={() => handleUnderConstruction('landing.footer.helpCenter')} className="hover:text-brand transition-colors cursor-pointer">{t('landing.footer.helpCenter')}</button></li>
                <li><button onClick={() => handleUnderConstruction('landing.footer.contact')} className="hover:text-brand transition-colors cursor-pointer">{t('landing.footer.contact')}</button></li>
                <li><button onClick={() => handleUnderConstruction('landing.footer.faq')} className="hover:text-brand transition-colors cursor-pointer">{t('landing.footer.faq')}</button></li>
              </ul>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <h5 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">{t('landing.footer.resources')}</h5>
              <ul className="space-y-2 text-xs text-slate-400 font-semibold">
                <li><button onClick={() => handleUnderConstruction('landing.footer.guides')} className="hover:text-brand transition-colors cursor-pointer">{t('landing.footer.guides')}</button></li>
                <li><button onClick={() => handleUnderConstruction('landing.footer.apiDocs')} className="hover:text-brand transition-colors cursor-pointer">{t('landing.footer.apiDocs')}</button></li>
                <li><button onClick={() => handleUnderConstruction('landing.footer.webinars')} className="hover:text-brand transition-colors cursor-pointer">{t('landing.footer.webinars')}</button></li>
                <li><button onClick={() => handleUnderConstruction('landing.footer.community')} className="hover:text-brand transition-colors cursor-pointer">{t('landing.footer.community')}</button></li>
              </ul>
            </div>

            <div className="lg:col-span-2 space-y-3">
              <h5 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">{t('landing.footer.legal')}</h5>
              <ul className="space-y-2 text-xs text-slate-400 font-semibold">
                <li><button onClick={() => handleUnderConstruction('landing.footer.terms')} className="hover:text-brand transition-colors cursor-pointer">{t('landing.footer.terms')}</button></li>
                <li><button onClick={() => handleUnderConstruction('landing.footer.privacy')} className="hover:text-brand transition-colors cursor-pointer">{t('landing.footer.privacy')}</button></li>
                <li><button onClick={() => handleUnderConstruction('landing.footer.cookies')} className="hover:text-brand transition-colors cursor-pointer">{t('landing.footer.cookies')}</button></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400 font-semibold text-center md:text-left">
            <div>
              {t('landing.footer.rights')}
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 text-slate-500">
              <a href="mailto:support@lms.com" className="flex items-center gap-1.5 hover:text-brand transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                support@lms.com
              </a>
              <a href="https://www.lms.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-brand transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9s2.015-9 4.5-9m0 0a9.015 9.015 0 018.72 6.253M12 3a9.015 9.015 0 00-8.72 6.253M4.27 13.75h15.46M5.22 8.75h13.56" />
                </svg>
                www.lms.com
              </a>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => handleUnderConstruction('Instagram')} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-brand hover:border-violet-200 hover:bg-violet-50 transition-all cursor-pointer" aria-label="Instagram">
                <svg fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.779-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </button>
              <button onClick={() => handleUnderConstruction('Facebook')} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-brand hover:border-violet-200 hover:bg-violet-50 transition-all cursor-pointer" aria-label="Facebook">
                <svg fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                  <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
                </svg>
              </button>
              <button onClick={() => handleUnderConstruction('Twitter')} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-brand hover:border-violet-200 hover:bg-violet-50 transition-all cursor-pointer" aria-label="Twitter">
                <svg fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </button>
              <button onClick={() => handleUnderConstruction('LinkedIn')} className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-brand hover:border-violet-200 hover:bg-violet-50 transition-all cursor-pointer" aria-label="LinkedIn">
                <svg fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
                  <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h4.969v-8.399c0-4.67 6.029-5.052 6.029 0v8.399h4.988v-10.131c0-7.88-8.922-7.593-11.018-3.714v-2.155z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
