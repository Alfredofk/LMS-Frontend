import React from 'react';

import { useT } from '../../i18n/LanguageContext';
import { FIGURES, changeOf, changeText, changeToneOf, valueOf, valueText } from './schoolOverview';

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

/* Students in trouble: amber once there is any, and said against the students placed. */
const TROUBLE = new Set(['belowKktp', 'withSignal']);

/** A percentage as a thin bar, purple for attendance and green for material (mockup items 2 and 6). */
export const FigureBar = ({ figureKey, value, className = '' }) => (
  <div className={`h-1.5 rounded-full bg-slate-200 overflow-hidden ${className}`} aria-hidden="true">
    {value !== null && value !== undefined && (
      <div
        className={`h-full rounded-full ${figureKey === 'content' ? 'bg-emerald-600' : 'bg-brand'}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    )}
  </div>
);

/** A figure on its own: the label, the value, its change; a bar under a percentage,
    "dari N siswa di kelas" under a count of students in trouble (owner, 2026-10-31). */
export const FigureTile = ({ row, figureKey }) => {
  const { t, lang } = useT();
  const value = valueOf(row, figureKey);
  const placed = valueOf(row, 'studentsPlacedNow');
  const percent = FIGURES.find((figure) => figure.key === figureKey)?.kind === 'percent';
  const trouble = TROUBLE.has(figureKey);
  return (
    <div className="rounded-[14px] border border-slate-100 bg-slate-50 px-3.5 py-3 min-w-0">
      <dt className="text-xs font-semibold text-slate-600">{t(`overview.fig.${figureKey}`)}</dt>
      <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
        <span className={`text-[22px] font-extrabold tracking-tight tabular-nums ${trouble && value > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
          {valueText(figureKey, value, lang)}
        </span>
        <ChangeMark figureKey={figureKey} change={changeOf(row, figureKey)} />
      </dd>
      {percent && value !== null && (
        <dd>
          <FigureBar figureKey={figureKey} value={value} className="mt-1.5" />
        </dd>
      )}
      {trouble && value !== null && placed !== null && <dd className="text-xs text-slate-500">{t('overview.ofPlaced', { n: placed })}</dd>}
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
