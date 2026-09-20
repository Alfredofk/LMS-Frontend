import React from 'react';
import { Info } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';

/*
  Two ways of saying "none of this is real", for a dashboard whose numbers are
  invented because no endpoint serves them yet.

  Both are deliberately quiet. A marker loud enough to dominate the screen would
  defeat the reason the sample data is there at all — showing what the dashboard
  is for — and one placed on every element would train people to stop reading it.
  So: one banner for the page, one small pill per widget, and nothing on the
  greeting line, because the name and the school on it are genuinely real.
*/

/** One line under the greeting, above the stat cards. */
export const SampleDataBanner = () => {
  const { t } = useT();

  return (
    <div
      role="note"
      className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left"
    >
      <Info className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" aria-hidden="true" />
      <p className="text-xs font-semibold text-amber-800 leading-relaxed">
        {t('sample.notice')}
      </p>
    </div>
  );
};

/** A pill for a widget heading, beside the title. */
export const SampleTag = () => {
  const { t } = useT();

  return (
    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-600 select-none">
      {t('sample.tag')}
    </span>
  );
};

export default SampleDataBanner;
