import React from 'react';
import { Clock } from 'lucide-react';

import Button from '../../components/ui/Button';
import { useT } from '../../i18n/LanguageContext';
import { initialsOf } from '../../utils/names';

/*
  What the homeroom teacher's Notes and Promotions cards share (mockup
  catatan-kenaikan-wali.html, owner 2026-10-30, all thirteen items): a student's row
  head (round initials, the name, a coloured word at the right), and the save bar,
  which sticks to the bottom of the screen while anything waits unsaved so a long
  class needs no scrolling back to it.
*/

/** One line of a coloured word after a dot: `tone` is 'emerald' | 'amber' | 'rose' | 'brand'. */
const TONE = {
  emerald: { text: 'text-emerald-700', dot: 'bg-emerald-500' },
  amber: { text: 'text-amber-700', dot: 'bg-amber-400' },
  rose: { text: 'text-rose-700', dot: 'bg-rose-500' },
  brand: { text: 'text-brand', dot: 'bg-brand' },
};

export const ToneWord = ({ tone, children }) => {
  const style = TONE[tone] ?? TONE.amber;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-extrabold whitespace-nowrap ${style.text}`}>
      <span className={`w-2 h-2 rounded-full ${style.dot}`} aria-hidden="true" />
      {children}
    </span>
  );
};

/** A student's row head: initials, the name (as `nameAs`, a label for a box), `below` under it, `children` at the right. */
export const StudentHead = ({ name, nameAs = 'p', nameProps = {}, marker = null, below = null, children }) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
    <span className="grid place-items-center w-[34px] h-[34px] shrink-0 rounded-full bg-brand-tint text-brand text-xs font-extrabold" aria-hidden="true">
      {initialsOf(name)}
    </span>
    <span className="min-w-[150px] flex-1">
      {React.createElement(nameAs, { ...nameProps, className: 'block text-sm font-bold text-slate-900 break-words' }, name, marker)}
      {below}
    </span>
    {children}
  </div>
);

/**
 * "N belum disimpan", Batal and the save button, under a rule; while `count` > 0 it
 * sticks to the bottom of the scrolling page, spanning the card's padding.
 */
export const SaveBar = ({ count, saveLabel, onCancel, onSave, saving }) => {
  const { t } = useT();
  const waiting = count > 0;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 ${
        waiting
          ? 'sticky bottom-0 z-10 -mx-5 sm:-mx-6 -mb-5 sm:-mb-6 px-5 sm:px-6 py-3 rounded-b-2xl border-t border-slate-200 bg-white shadow-[0_-6px_14px_-10px_rgba(15,23,42,0.25)]'
          : 'border-t border-slate-100 pt-4'
      }`}
    >
      <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-amber-700">
        {waiting && (
          <>
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            {t('homeroom.unsaved', { n: count })}
          </>
        )}
      </span>
      <span className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} isDisabled={saving || !waiting}>
          {t('common.cancel')}
        </Button>
        <Button size="sm" onClick={onSave} isLoading={saving} isDisabled={!waiting}>
          {saveLabel}
        </Button>
      </span>
    </div>
  );
};

/** Rows shaped like the card's, while it is read. */
export const CardSkeleton = () => {
  const { t } = useT();
  return (
    <div className="space-y-3 animate-pulse motion-reduce:animate-none" aria-busy="true" aria-label={t('common.loading')}>
      <div className="h-[62px] rounded-xl bg-slate-100" />
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-[34px] h-[34px] rounded-full bg-slate-100" />
            <span className="h-3 w-2/5 rounded bg-slate-100" />
          </div>
          <div className="h-16 rounded-xl bg-slate-100 sm:ml-[46px]" />
        </div>
      ))}
    </div>
  );
};
