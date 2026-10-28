import React from 'react';

import { useT } from '../../i18n/LanguageContext';
import { changeOf, changeText, changeToneOf, valueOf, valueText } from './schoolOverview';

/*
  The pieces the overview page and the dashboard's card share: a figure's change,
  a figure as a tile, and a slash line.
*/

const TONE = { good: 'text-emerald-700', bad: 'text-rose-700' };

/** "+3" in green when better, red when worse; nothing when there is no change. */
export const ChangeMark = ({ figureKey, change }) => {
  const { t, lang } = useT();
  const text = changeText(figureKey, change, lang);
  if (!text) return null;
  return (
    <span className={`text-xs font-bold tabular-nums whitespace-nowrap ${TONE[changeToneOf(figureKey, change)] ?? 'text-slate-500'}`}>
      {text}
      <span className="sr-only"> {t('overview.change.sr')}</span>
    </span>
  );
};

/** A figure on its own: the label, the value, its change. */
export const FigureTile = ({ row, figureKey }) => {
  const { t, lang } = useT();
  return (
    <div className="rounded-[14px] border border-slate-100 bg-slate-50 px-3.5 py-3 min-w-0">
      <dt className="text-xs font-semibold text-slate-600">{t(`overview.fig.${figureKey}`)}</dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[22px] font-extrabold tracking-tight tabular-nums text-slate-900">{valueText(figureKey, valueOf(row, figureKey), lang)}</span>
        <ChangeMark figureKey={figureKey} change={changeOf(row, figureKey)} />
      </dd>
    </div>
  );
};

/** Parts of one grey line, a light " / " between them. */
export const SlashLine = ({ parts, small = false, className = '' }) => (
  <p className={`${small ? 'text-xs' : 'text-sm'} font-medium text-slate-500 ${className}`}>
    {parts.map((part, i) => (
      <React.Fragment key={part}>
        {i > 0 && (
          <>
            {' '}
            <span className="mx-1 text-slate-300" aria-hidden="true">
              /
            </span>{' '}
          </>
        )}
        <span className="whitespace-nowrap">{part}</span>
      </React.Fragment>
    ))}
  </p>
);
