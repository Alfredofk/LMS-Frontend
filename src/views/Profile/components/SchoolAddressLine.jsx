import React, { useState } from 'react';

import { useAuth } from '../../../context/AuthContext';
import { useT } from '../../../i18n/LanguageContext';
import { copyText } from '../../../utils/copyText';
import { schoolAddressOf, schoolUrl } from '../../../constants/subdomain';

/*
  The school's own address, on My Profile for every member (backend a577abd; owner
  2026-10-22 E8): one line to hand out - "Alamat sekolah: sma1.eduforid.id" with a
  copy button. Only while school addresses are in use (VITE_BASE_DOMAIN); the label
  is `/users/me`'s `membership.school.subdomain`.
*/
const SchoolAddressLine = () => {
  const { membership } = useAuth();
  const { t } = useT();
  const [copied, setCopied] = useState(null);

  const label = membership?.school?.subdomain ?? null;
  const address = schoolAddressOf(label);
  if (!address) return null;

  const copy = async () => {
    setCopied((await copyText(schoolUrl(label, '/'))) ? 'ok' : 'failed');
    setTimeout(() => setCopied(null), 2500);
  };

  return (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-500">{t('profile.schoolAddress')}</p>
        <p className="text-sm font-bold text-slate-900 break-all">{address}</p>
        <p className="text-xs font-medium text-slate-500 mt-0.5">{t('profile.schoolAddress.hint')}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        aria-live="polite"
      >
        {copied === 'ok' ? t('profile.schoolAddress.copied') : copied === 'failed' ? t('profile.schoolAddress.copyFailed') : t('profile.schoolAddress.copy')}
      </button>
    </section>
  );
};

export default SchoolAddressLine;
