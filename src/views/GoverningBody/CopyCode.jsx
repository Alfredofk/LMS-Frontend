import React, { useState } from 'react';

import { useT } from '../../i18n/LanguageContext';
import { copyText } from '../../utils/copyText';

/* A School Code with a copy button (the Schools tab and a School's own page). */
export const CopyCode = ({ code }) => {
  const { t } = useT();
  const [copied, setCopied] = useState(null);
  const copy = async () => {
    setCopied((await copyText(code)) ? 'ok' : 'failed');
    setTimeout(() => setCopied(null), 2500);
  };
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-sm font-bold tracking-wider text-slate-900">{code}</span>
      <button
        type="button"
        onClick={copy}
        aria-live="polite"
        aria-label={copied ? undefined : t('gbs.copyCode', { code })}
        className="px-2 py-0.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {copied === 'ok' ? t('gb.copied') : copied === 'failed' ? t('gb.copyFailed') : t('gb.copy')}
      </button>
    </span>
  );
};

export default CopyCode;
