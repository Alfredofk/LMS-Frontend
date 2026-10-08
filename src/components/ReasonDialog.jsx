import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XCircle } from 'lucide-react';

import { modalActions, modalCancelClass, modalConfirmClass } from './ui/modalStyles';
import ModalHeading from './ui/ModalHeading';

import { useT } from '../i18n/LanguageContext';
import { validateLeaveReason } from '../utils/validation';

/*
  "Say why", then do it — a rejection with a required reason (3–500 characters,
  the rule every rejection in the backend applies: shared/approval.js
  assertRejectionReason plus a 500 cap in the zod).

  Built like RemoveMemberDialog — portal, alertdialog, focus into the box and
  back to the opener, Escape and the backdrop answering "no" except while the
  request runs — but it makes no call of its own: `onSubmit(reason)` does, and
  closes the dialog itself on success. A throw is shown inside, through
  `describeError`, next to the words that were typed.

  Render it only while open, keyed on what it is about, so each opening starts
  empty. `validate` swaps the 3-500 rule for another one (cancelling an
  assessment takes 1-500, assessment.schema.js cancelBody); it answers
  `{ key, vars? }` or null.
*/
export const ReasonDialog = ({ title, body, label, hint, confirmLabel, onClose, onSubmit, describeError, validate = validateLeaveReason }) => {
  const { t } = useT();
  const baseId = useId();
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

  const handleSubmit = async () => {
    const failed = validate(reason);
    if (failed) {
      setError(t(failed.key, failed.vars));
      fieldRef.current?.focus();
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

  const ids = { title: `${baseId}-title`, body: `${baseId}-body`, field: `${baseId}-field`, hint: `${baseId}-hint` };

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-describedby={ids.body}
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
      >
        <ModalHeading
          tone="danger"
          icon={XCircle}
          titleId={ids.title}
          title={title}
          bodyId={ids.body}
          body={body}
        />

        <div className="space-y-1.5">
          <label htmlFor={ids.field} className="text-sm font-semibold text-slate-700 block">
            {label}
          </label>
          <textarea
            ref={fieldRef}
            id={ids.field}
            rows={3}
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby={ids.hint}
            className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50"
          />
          {error ? (
            <p id={ids.hint} className="text-xs text-red-600 font-semibold leading-relaxed" role="alert">
              {error}
            </p>
          ) : (
            <p id={ids.hint} className="text-[11px] text-slate-500 font-medium leading-relaxed">
              {hint}
            </p>
          )}
        </div>

        <div className={modalActions}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={modalCancelClass(busy)}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className={modalConfirmClass('danger', busy)}
          >
            {busy ? t('common.loading') : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReasonDialog;
