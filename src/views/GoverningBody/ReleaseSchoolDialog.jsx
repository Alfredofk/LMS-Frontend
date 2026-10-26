import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Unlink } from 'lucide-react';

import ModalHeading from '../../components/ui/ModalHeading';
import { modalActions, modalCancelClass, modalConfirmClass } from '../../components/ui/modalStyles';
import { useT } from '../../i18n/LanguageContext';
import { confirmsName, validateLeaveReason } from '../../utils/validation';

/*
  Letting a School go (backend 261a9c7, ticket 08; owner 2026-10-26, E6): the body cannot
  take it back unless the School asks again, so the button stays off until the School's
  name is typed (`confirmsName`, as leaving a school asks), with a reason of 3-500.
  Built like LeaveSchoolDialog. `onSubmit(reason)` makes the call; a throw is said inside.
*/
export const ReleaseSchoolDialog = ({ schoolName, onClose, onSubmit, describeError }) => {
  const { t } = useT();
  const baseId = useId();
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fieldRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    fieldRef.current?.focus();
    return () => {
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (busy || e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const confirmed = confirmsName(typed, schoolName);
  const ids = { title: `${baseId}-title`, body: `${baseId}-body`, name: `${baseId}-name`, reason: `${baseId}-reason` };

  const submit = async (e) => {
    e.preventDefault();
    if (!confirmed || busy) return;
    const failed = validateLeaveReason(reason);
    if (failed) {
      setError(t(failed.key, failed.vars));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      setBusy(false);
      setError(describeError(err));
    }
  };

  const fieldClass =
    'block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 disabled:bg-slate-50';

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={busy ? undefined : onClose}>
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-describedby={ids.body}
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
      >
        <ModalHeading tone="danger" icon={Unlink} titleId={ids.title} title={t('gbpw.release.title', { school: schoolName })} bodyId={ids.body} body={t('gbpw.release.body')} />

        <div className="space-y-1.5">
          <label htmlFor={ids.name} className="text-sm font-semibold text-slate-700 block break-words">
            {t('gbpw.release.type', { school: schoolName })}
          </label>
          <input ref={fieldRef} id={ids.name} type="text" autoComplete="off" spellCheck={false} value={typed} disabled={busy} onChange={(e) => setTyped(e.target.value)} className={fieldClass} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={ids.reason} className="text-sm font-semibold text-slate-700 block">
            {t('gba.reason')}
          </label>
          <textarea
            id={ids.reason}
            rows={3}
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            className={fieldClass}
          />
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('gbpw.reason.hint')}</p>
        </div>

        {error && (
          <p className="text-xs text-red-600 font-semibold leading-relaxed" role="alert">
            {error}
          </p>
        )}

        <div className={modalActions}>
          <button type="button" onClick={onClose} disabled={busy} className={modalCancelClass(busy)}>
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={!confirmed || busy} className={modalConfirmClass('danger', !confirmed || busy)}>
            {busy ? t('common.loading') : t('gbpw.release.confirm')}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};

export default ReleaseSchoolDialog;
