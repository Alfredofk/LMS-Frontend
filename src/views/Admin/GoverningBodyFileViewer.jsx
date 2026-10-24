import React, { useEffect, useState } from 'react';
import { ShieldAlert, FileX } from 'lucide-react';

import { adminGoverningBodyService } from '../../services/adminGoverningBodyService';
import { isNotBuiltYet } from '../../services/apiClient';
import { useT } from '../../i18n/LanguageContext';

const Note = ({ children }) => (
  <div className="py-10 px-5 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/60">
    <FileX className="w-6 h-6 text-slate-300 mx-auto" aria-hidden="true" />
    <p className="mt-2.5 text-xs font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">{children}</p>
  </div>
);

/*
  One of a Governing Body registration's two files (backend b5cfffd): the KTP (JPG or
  PNG) or the proof of office (PDF, JPG or PNG), owner 2026-10-24: both shown in the
  panel. KtpViewer's reasoning holds for both - fetched with the token (an `src` would
  carry none), shown from an object URL revoked on unmount, and a 404 after the
  decision is the file's normal end (both are discarded then). A PDF is drawn in an
  <iframe> of the blob, the browser's own viewer; the blob's type is the server's
  Content-Type.

  Callers pass `key={registration.id + which}` so another registration remounts it.
*/
export const GoverningBodyFileViewer = ({ registrationId, which, has, decided = false }) => {
  const { t } = useT();
  const [file, setFile] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    if (!has) return undefined;

    let objectUrl = null;
    let cancelled = false;
    const read = which === 'proof' ? adminGoverningBodyService.proof : adminGoverningBodyService.ktp;

    read(registrationId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setFile({ url: objectUrl, pdf: blob.type === 'application/pdf' });
        setState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setState(isNotBuiltYet(err) ? 'deleted' : 'failed');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [registrationId, which, has]);

  /* A decided registration carries no file at all (`hasKtp`/`hasProof` false): discarded, not missing. */
  const shown = has ? state : decided ? 'deleted' : 'none';
  const title = t(which === 'proof' ? 'gbr.file.proof' : 'gbr.file.ktp');

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{title}</h3>

      {shown === 'loading' && <div className="h-56 rounded-2xl bg-slate-100 animate-pulse" aria-label={t('common.loading')} />}

      {shown === 'ready' &&
        (file.pdf ? (
          <iframe src={file.url} title={title} className="w-full h-[32rem] rounded-2xl border border-slate-200 bg-white" />
        ) : (
          <img src={file.url} alt={title} className="w-full max-h-[26rem] object-contain rounded-2xl border border-slate-200 bg-slate-900/5" />
        ))}

      {shown === 'ready' && which === 'ktp' && (
        <p className="flex items-start gap-2 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3 leading-relaxed">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500 mt-px" aria-hidden="true" />
          {t('admin.ktp.privacy')}
        </p>
      )}

      {shown === 'deleted' && <Note>{t('gbr.file.deleted')}</Note>}
      {shown === 'none' && <Note>{t('gbr.file.none')}</Note>}
      {shown === 'failed' && <Note>{t('gbr.file.failed')}</Note>}
    </section>
  );
};

export default GoverningBodyFileViewer;
