import React from 'react';
import { Search, UserX } from 'lucide-react';

import Button from '../../components/ui/Button';
import { useT } from '../../i18n/LanguageContext';
import { initialsOf } from '../../utils/names';
import { ADMIN_CARD } from '../Admin/adminParts';
import { Bone, HomeEmpty } from '../Dashboard/components/HomeCard';

/*
  The pieces the Governing Body screens share since their restyle (owner,
  2026-10-29, mockup yayasan-sekolah-admin.html): a search box with its icon and
  no label, rows loading, the seat-ended state, and a person's round initials.
*/

export const SearchBox = ({ id, label, placeholder, value, onChange }) => (
  <div className="relative flex-1 min-w-[min(100%,16rem)]">
    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
    <input
      id={id}
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      autoComplete="off"
      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-brand focus:ring-1 focus:ring-brand outline-none text-sm font-medium placeholder-slate-500 bg-white transition-colors"
    />
  </div>
);

/** Rows still loading, shaped like a name over a grey line. */
export const RowsLoading = ({ rows = 3, card = true }) => {
  const { t } = useT();
  return (
    <div className={card ? `${ADMIN_CARD} px-4 sm:px-5 py-2` : 'py-1'} aria-busy="true" aria-label={t('common.loading')}>
      {Array.from({ length: rows }, (_, n) => (
        <div key={n} className="py-3.5">
          <Bone className="h-3.5 w-2/5" />
          <Bone className="h-3 w-3/4 mt-2" />
        </div>
      ))}
    </div>
  );
};

/** The seat ended or the body was switched off (a 403). */
export const SeatGone = ({ onCheck, checking }) => {
  const { t } = useT();
  return (
    <div className={ADMIN_CARD} role="alert">
      <HomeEmpty
        icon={UserX}
        title={t('gb.gone.title')}
        body={t('gb.gone.body')}
        action={
          <Button variant="outline" size="sm" onClick={onCheck} isLoading={checking}>
            {t('gb.checkAgain')}
          </Button>
        }
      />
    </div>
  );
};

/** A person's round initials, brand purple. */
export const Initials = ({ name }) => (
  <span className="w-9 h-9 shrink-0 rounded-full bg-brand-tint text-brand grid place-items-center text-xs font-extrabold select-none" aria-hidden="true">
    {initialsOf(name ?? '')}
  </span>
);
