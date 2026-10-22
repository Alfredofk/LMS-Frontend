import React from 'react';

import { useT } from '../../i18n/LanguageContext';
import { LANGUAGES } from '../../i18n/languages';

/*
  Two languages, so a segmented pair rather than a dropdown: both options are
  visible at once, and choosing is one click instead of two.

  The labels are the languages' own names — "Indonesia" and "English" — never
  translated. Somebody looking for their language should find it written the way
  they write it, not the way the current language spells it.
*/
const TONES = {
  // On the landing page and inside the app: dark on light.
  light: {
    wrap: 'bg-slate-100',
    on: 'bg-white text-brand shadow-sm',
    // slate-600: slate-500 on the slate-100 track measured 4.35:1 (audit 2026-10-08).
    off: 'text-slate-600 hover:text-slate-800',
  },
  // On the purple auth panels. A brand-deep track with white: white/80 on a white/15
  // track measured 3.31:1 at 11px (audit 2026-10-22); this is 6.93:1.
  dark: {
    wrap: 'bg-brand-deep',
    on: 'bg-white text-brand shadow-sm',
    off: 'text-white hover:bg-white/10',
  },
};

export const LanguageSwitch = ({ tone = 'light', className = '' }) => {
  const { t, lang, setLang } = useT();
  const style = TONES[tone] ?? TONES.light;

  return (
    <div
      role="group"
      aria-label={t('lang.switch')}
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-full select-none ${style.wrap} ${className}`}
    >
      {LANGUAGES.map((code) => {
        const active = code === lang;

        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={active}
            /* lang on the button itself, so a screen reader pronounces each
               label in its own language rather than in the page's. */
            lang={code}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
              active ? style.on : style.off
            }`}
          >
            {t(`lang.${code}`)}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitch;
