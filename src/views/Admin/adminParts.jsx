import React from 'react';

/*
  The pieces the platform admin's screens share since their restyle (owner,
  2026-10-28: mockups pendaftaran-sekolah.html and daftar-sekolah.html): the
  dashboards' card frame, grey facts with light slashes, a small segmented
  choice, and facts as eyebrow cells.
*/

export const ADMIN_CARD = 'bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0';

/* A card heading, the dashboards' size. */
export const CARD_TITLE = 'text-base font-extrabold text-slate-900 tracking-tight';

/* Grey facts with light slashes, in spans: they may sit inside a row's <button>. Empty parts are left out. */
export const SlashFacts = ({ parts, className = 'block text-xs font-semibold text-slate-500' }) => (
  <span className={className}>
    {parts.filter(Boolean).map((part, i) => (
      <React.Fragment key={i}>
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
  </span>
);

/* A small segmented choice (SemesterSegments' look): the one chosen pale purple. */
export const Segments = ({ label, options, value, onChange, labelOf }) => (
  <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 select-none" role="group" aria-label={label}>
    {options.map((option) => {
      const on = value === option;
      return (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={on}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            on ? 'bg-brand-tint text-brand' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          {labelOf(option)}
        </button>
      );
    })}
  </div>
);

/* An eyebrow on its value, ruled off below. `wide` takes the whole row. */
export const Fact = ({ label, children, wide = false }) => (
  <div className={`min-w-0 py-2.5 pr-4 border-b border-slate-100 ${wide ? 'col-span-2 sm:col-span-3' : ''}`}>
    <dt className="text-[10px] font-bold tracking-wider uppercase text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-sm font-bold text-slate-900 [overflow-wrap:anywhere]">{children ?? '-'}</dd>
  </div>
);

export const Facts = ({ children, className = 'mt-2' }) => <dl className={`grid grid-cols-2 sm:grid-cols-3 ${className}`}>{children}</dl>;
