import React from 'react';

/*
  A row of small facts, each in its own pill with an icon (owner, 2026-10-03:
  "semester: 1 · classes: 3 · students: 4" read as one run-on line; polish it).

  Replaces the "a · b · c" lines: each fact keeps its own box, so the row wraps
  between facts on a phone instead of in the middle of one.

  @param {{ icon?: import('react').ComponentType, label: React.ReactNode, tone?: 'slate'|'brand'|'amber'|'sky'|'emerald'|'rose' }[]} items
         falsy entries are skipped, so a caller can write `cond && { ... }`
  @param {'sm'|'xs'} [size]
*/
const TONES = {
  slate: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-tint text-brand',
  amber: 'bg-amber-50 text-amber-700',
  sky: 'bg-sky-50 text-sky-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  rose: 'bg-rose-50 text-rose-700',
};

export const InfoChips = ({ items, size = 'sm', className = '' }) => {
  const shown = (items ?? []).filter(Boolean);
  if (shown.length === 0) return null;
  const box = size === 'xs' ? 'px-1.5 py-0.5 text-[10px] gap-1 rounded-md' : 'px-2 py-1 text-[11px] gap-1.5 rounded-lg';
  const iconBox = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  return (
    <span className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {shown.map(({ icon: Icon, label, tone = 'slate' }, i) => (
        <span key={i} className={`inline-flex items-center font-bold whitespace-nowrap ${box} ${TONES[tone] ?? TONES.slate}`}>
          {Icon && <Icon className={`${iconBox} shrink-0`} aria-hidden="true" />}
          {label}
        </span>
      ))}
    </span>
  );
};

export default InfoChips;
