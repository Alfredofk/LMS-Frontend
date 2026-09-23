import React, { useEffect, useState } from 'react';
import { ShieldAlert, FileX } from 'lucide-react';

import { adminService } from '../../services/adminService';
import { isNotBuiltYet } from '../../services/apiClient';
import { useT } from '../../i18n/LanguageContext';

/** What the panel shows instead of a photograph. Defined out here, not inside
 *  the component: a component created during render is a new type on every
 *  pass, so React throws away its subtree and rebuilds it each time. */
const Note = ({ children }) => (
  <div className="py-10 px-5 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/60">
    <FileX className="w-6 h-6 text-slate-300 mx-auto" aria-hidden="true" />
    <p className="mt-2.5 text-xs font-semibold text-slate-500 leading-relaxed max-w-sm mx-auto">
      {children}
    </p>
  </div>
);

/*
  The applicant's KTP photograph.

  This is a national identity document, and the whole design follows from that.

  **It cannot be an `<img src="/api/…">`.** The endpoint sits behind
  requireAuth, and a browser fetching an `src` sends no Authorization header. So
  the bytes are fetched with the token, turned into an object URL, and shown
  from memory.

  **The object URL is revoked on unmount.** An object URL outlives the component
  that made it — the browser keeps the blob alive until it is revoked — and
  leaving somebody's ID card reachable through a stale `blob:` link for the rest
  of the session is exactly what the backend's `Cache-Control: no-store` is
  trying to prevent.

  **A 404 is the end of this document's life, not a failure.** Approving or
  rejecting deletes the file inside the same transaction, which UU PDP 27/2022
  requires and `schema.prisma` records. So an already-decided registration
  cannot show a photo, and the panel says why rather than showing an error.

  Callers pass `key={registration.id}` so switching registrations remounts this
  rather than resetting state inside an effect.
*/
export const KtpViewer = ({ registrationId, hasKtp }) => {
  const { t } = useT();
  const [url, setUrl] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    if (!hasKtp) return undefined;

    let objectUrl = null;
    let cancelled = false;

    adminService
      .ktp(registrationId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        setState('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        /* Gone because a decision was made — the normal end, not a fault. */
        setState(isNotBuiltYet(err) ? 'deleted' : 'failed');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [registrationId, hasKtp]);

  /* Derived rather than written into state from inside the effect: whether a
     file exists at all is already known before anything is fetched. */
  const shown = hasKtp ? state : 'none';

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
        {t('admin.ktp.title')}
      </h3>

      {shown === 'loading' && (
        <div className="h-56 rounded-2xl bg-slate-100 animate-pulse" aria-label={t('admin.ktp.loading')} />
      )}

      {shown === 'ready' && (
        <>
          <img
            src={url}
            alt={t('admin.ktp.title')}
            className="w-full max-h-[26rem] object-contain rounded-2xl border border-slate-200 bg-slate-900/5"
          />
          {/*
            Said next to the document, not in a policy page: whoever is looking
            at it is the person who could misuse it.
          */}
          <p className="flex items-start gap-2 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3 leading-relaxed">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-500 mt-px" aria-hidden="true" />
            {t('admin.ktp.privacy')}
          </p>
        </>
      )}

      {shown === 'deleted' && <Note>{t('admin.ktp.deleted')}</Note>}
      {shown === 'none' && <Note>{t('admin.ktp.none')}</Note>}
      {shown === 'failed' && <Note>{t('admin.ktp.failed')}</Note>}
    </section>
  );
};

export default KtpViewer;
