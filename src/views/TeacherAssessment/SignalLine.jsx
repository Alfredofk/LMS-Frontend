import React from 'react';

import { useT } from '../../i18n/LanguageContext';
import { signalParts } from './results';

/*
  One attempt's integrity counts for its staff (backend b5db324, ticket 06; owner
  2026-10-13): one grey line, "Tercatat: Keluar halaman 3 kali / Menempel 1 kali",
  or "Tidak ada aktivitas tercatat". Nothing at all where the assessment records
  none (TUGAS, OFFLINE: `signals` null). Advisory - the student is never shown it
  and nothing is penalised on it.
*/
export const SignalLine = ({ signals, className = '' }) => {
  const { t } = useT();
  const parts = signalParts(signals);
  if (!parts) return null;
  if (parts.length === 0) return <span className={`text-slate-500 ${className}`}>{t('tasm.signals.none')}</span>;
  return (
    <span className={`text-slate-600 ${className}`}>
      {t('tasm.signals.recorded')}{' '}
      {parts.map((part, i) => (
        <React.Fragment key={part.key}>
          {i > 0 && <span className="text-slate-300 font-normal"> / </span>}
          {t(`tasm.signals.${part.key}`, { n: part.n })}
        </React.Fragment>
      ))}
    </span>
  );
};

export default SignalLine;
