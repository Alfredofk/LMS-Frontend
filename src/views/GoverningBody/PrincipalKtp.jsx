import React, { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';

import { governingBodyService } from '../../services/governingBodyService';
import { isNotBuiltYet } from '../../services/apiClient';
import { useT } from '../../i18n/LanguageContext';

/*
  A Principal applicant's KTP for the body's admins (backend e206bd9; owner 2026-10-26,
  B4): fetched only on "Lihat KTP", with the token (an <img src> sends none), shown from
  an object URL that is revoked when it is hidden again or the card goes. The file is on
  the server only until the application is decided, so a 404 says it was deleted.
  `load` reads it another way (the Platform Admin's route, ticket 06c).
*/
const bodysKtp = (applicationId) => governingBodyService.principalApplicationKtp(applicationId);

export const PrincipalKtp = ({ applicationId, name, load = bodysKtp }) => {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    if (!open) return undefined;
    let objectUrl = null;
    let cancelled = false;
    load(applicationId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setState('ready');
      })
      .catch((err) => {
        if (!cancelled) setState(isNotBuiltYet(err) ? 'deleted' : 'failed');
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
      setState('loading');
    };
  }, [open, applicationId, load]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="text-xs font-extrabold text-brand hover:text-brand-deep underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
      >
        {open ? t('gbpa.ktp.hide') : t('gbpa.ktp.show')}
      </button>
      {open && state === 'loading' && <div className="h-48 rounded-2xl bg-slate-100 animate-pulse" aria-busy="true" aria-label={t('admin.ktp.loading')} />}
      {open && state === 'ready' && url && (
        <>
          <img src={url} alt={t('gbpa.ktp.alt', { name })} className="w-full max-h-[22rem] object-contain rounded-2xl border border-slate-200 bg-slate-900/5" />
          <p className="flex items-start gap-2 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3 leading-relaxed">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500 mt-px" aria-hidden="true" />
            {t('admin.ktp.privacy')}
          </p>
        </>
      )}
      {open && state === 'deleted' && <p className="text-xs font-semibold text-slate-500">{t('admin.ktp.deleted')}</p>}
      {open && state === 'failed' && <p className="text-xs font-semibold text-rose-700">{t('admin.ktp.failed')}</p>}
    </div>
  );
};

export default PrincipalKtp;
