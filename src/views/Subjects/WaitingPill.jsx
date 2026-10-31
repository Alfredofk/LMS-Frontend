import React from 'react';

import { useT } from '../../i18n/LanguageContext';

/*
  A teaching request still waiting, as the state pill an assessment wears
  (StateWord): pale amber, capitals at 11px, right after the subject's name
  (owner, 2026-10-31, mockup kelas-mapel-anggota.html items 8 and 9). The capitals
  come from CSS, so the word stays "Menunggu" for a screen reader.
*/
export const WaitingPill = ({ className = '' }) => {
  const { t } = useT();
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase leading-4 whitespace-nowrap bg-amber-50 text-amber-700 align-middle ${className}`}>
      {t('subjects.status.PENDING.short')}
    </span>
  );
};

export default WaitingPill;
