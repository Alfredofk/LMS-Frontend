import React from 'react';
import { useLocation } from 'react-router-dom';

import LanguageSwitch from '../components/ui/LanguageSwitch';
import { useT } from '../i18n/LanguageContext';

/**
 * The purple-and-white shell every signed-out screen wears.
 *
 * It was copied whole into /select-role and /verify-email before this existed —
 * three identical forty-line blocks, about to become five. Every one of them is
 * the same thing: a purple column carrying one sentence of reassurance, and a
 * white card carrying the actual work.
 *
 * ## /login was the copy that got away, and it was mirrored
 *
 * It kept its own shell until somebody testing the app said the moment after
 * signing in made them dizzy, and measured at 1280px the reason was plain: the
 * purple column sat at x=794 on /login and x=0 on /select-role. One navigation
 * threw it 794 pixels across the screen, changed its width from 486 to 448,
 * moved the card's rounded corner to the other side, and on a phone conjured a
 * purple band that /login never had.
 *
 * Folding it in here fixes all four at once, because there is now one shell
 * rather than two that can drift apart.
 *
 * ## Why the content animates and the column does not
 *
 * `transitionKey` re-mounts the heading, the card and the footer whenever it
 * changes, which replays their entrance. The purple column itself never moves.
 * That is the whole trick: a page that keeps its frame and swaps its contents
 * reads as one place, while two pages trading sides read as a lurch — and
 * animating a lurch only makes it easier to watch.
 *
 * @param {string} heading   the large line in the purple column
 * @param {string} [blurb]   one sentence under it; ignored when `aside` is given
 * @param {React.ReactNode} [aside]  richer content for the purple column, in
 *                                   place of `blurb` — /login's bullet list
 * @param {() => void} [onBack]  renders the Back pill at the card's top-left
 * @param {string} [transitionKey]  what replays the entrance; defaults to the
 *                                  pathname. /login passes its step instead, so
 *                                  sign-up → check-email → sign-in animates too
 * @param {React.ReactNode} children  the contents of the white card
 * @param {React.ReactNode} [footer]  pinned to the bottom of the white card
 */
export const AuthLayout = ({
  heading,
  blurb,
  aside,
  onBack,
  transitionKey,
  children,
  footer,
}) => {
  const { pathname } = useLocation();
  const { t } = useT();
  const key = transitionKey ?? pathname;

  return (
    <div className="min-h-screen lg:h-screen w-screen bg-brand flex flex-col lg:flex-row font-sans selection:bg-brand selection:text-white relative lg:overflow-hidden">

      {/* --- PURPLE COLUMN --- */}
      <div className="w-full text-white flex flex-col justify-between p-8 sm:p-12 relative shrink-0 z-0 text-left select-none bg-brand lg:w-[35%] lg:h-full lg:order-1 lg:overflow-hidden">
        {/* The switch lives in this column because it is visible at every width —
            stacked above the card on a phone, beside it on a desktop. */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xl font-extrabold tracking-tight">EduForID</span>
          <LanguageSwitch tone="dark" />
        </div>

        <div key={key} className="relative my-auto space-y-6 max-w-sm z-10 shrink-0 animate-swap-in">
          {/*
            The page h1, and it has to be this one rather than the card's.

            This column renders first, so as an h2 it put every signed-out screen
            in the order h2-then-h1 — and at 36px against the card's 26-30px, the
            bigger line was the lower level. It is also the only heading that is
            always there: ResetPasswordPage's `checking` branch is a lock icon and
            a sentence, with no heading of its own in the card at all.

            The card keeps the same words one level down. That repetition is the
            layout's design, not an accident.
          */}
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
            {heading}
          </h1>

          {aside ?? (
            <p className="text-sm sm:text-base text-violet-100/90 leading-relaxed font-medium">
              {blurb}
            </p>
          )}
        </div>

        {/* Hidden below lg: stacked on a phone this column is a short band, and a
            white disc behind white copy simply erases it. */}
        <div className="hidden lg:block absolute bottom-[-130px] left-[-130px] w-64 h-64 rounded-full bg-white pointer-events-none" />
      </div>

      {/* --- WHITE CARD COLUMN --- */}
      <div className="w-full bg-white min-h-screen lg:h-full lg:overflow-y-auto flex flex-col justify-between p-6 sm:p-8 lg:py-8 lg:px-12 relative shrink-0 z-10 shadow-2xl lg:w-[65%] lg:order-2 lg:rounded-l-[48px] lg:rounded-r-none">

        {/* Decorative shapes */}
        <div className="absolute top-0 left-0 w-28 h-28 bg-brand rounded-br-full pointer-events-none" />
        <div className="absolute top-10 left-36 w-3 h-3 bg-brand rounded-full opacity-60 pointer-events-none" />
        <div className="absolute top-1/4 left-[-16px] w-12 h-12 bg-brand-tint rounded-full pointer-events-none" />
        <div className="absolute top-16 right-10 w-14 h-14 bg-brand-tint rounded-full pointer-events-none opacity-80" />

        {/* Back to wherever the caller came from.

            A white pill rather than bare text: this sits on top of the purple
            corner above, and grey-on-purple was all but invisible. The pill
            reads on either background, and its height and radius are the
            language switch's, so the two corners match. */}
        {onBack && (
          <div className="absolute top-6 left-6 sm:left-12 z-20 flex">
            <button
              type="button"
              onClick={onBack}
              className="group inline-flex items-center gap-1.5 pl-2.5 pr-3.5 py-1.5 rounded-full bg-white shadow-sm ring-1 ring-slate-200 text-xs font-bold text-slate-600 hover:text-brand hover:ring-brand/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
              aria-label={t('auth.backToHome')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 transition-transform group-hover:-translate-x-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              {t('auth.back')}
            </button>
          </div>
        )}

        {/* Balances the card vertically against the decorative corner above */}
        <div className="h-[40px] z-10 shrink-0" />

        <div className="my-auto w-full z-10 py-2 shrink-0">
          {/* The stagger. The heading leads at 0ms; these follow, which is what
              makes it read as a page assembling rather than one block blinking. */}
          <div
            key={key}
            style={{ '--swap-delay': '60ms' }}
            className="w-full max-w-[420px] mx-auto text-center space-y-6 animate-swap-in"
          >
            {children}
          </div>
        </div>

        <div
          key={`footer-${key}`}
          style={{ '--swap-delay': '120ms' }}
          className="mt-4 z-10 text-center space-y-3 shrink-0 animate-swap-in"
        >
          {footer}
        </div>

      </div>

    </div>
  );
};

export default AuthLayout;
