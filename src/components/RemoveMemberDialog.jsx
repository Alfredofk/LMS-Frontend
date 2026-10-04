import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserMinus } from 'lucide-react';

import { modalActions, modalCancelClass, modalConfirmClass } from './ui/modalStyles';
import ModalHeading from './ui/ModalHeading';

import { membersService } from '../services/membersService';
import { useT } from '../i18n/LanguageContext';
import { membersErrorMessage } from '../i18n/apiError';

const MIN_REASON = 3;
const MAX_REASON = 500;

/*
  Taking somebody out of the school, with the reason they will be shown.

  `POST /api/members/:id/remove` — the Principal for anyone but a Principal, a
  homeroom teacher for a student in one of their classes. Used from the members
  page and from a class roster, so it lives beside SchoolCodeCard rather than in
  either.

  Built like ConfirmDialog — portal, alertdialog, focus handed back on close,
  Escape and the backdrop answering "no" except while the request runs — plus the
  one thing it cannot hold: a reason. The same 3–500 characters every rejection
  in this app asks for, because the server applies the same rule and the person
  removed reads it on /select-role.

  It says what removal is before anybody presses it: access ends, nothing is
  deleted, and they may ask to join again. That is the backend's own design
  (revocation, ADR-0004), and "remove" alone reads as "delete".

  The call is made here, and the owner only hears about success — every refusal
  is shown inside the dialog, next to the reason that was typed.

  **Render it only while it is open, keyed on the person** —
  `{target && <RemoveMemberDialog key={target.membershipId} … />}`. Mounting is
  what starts it empty, so the next person removed never finds the last one's
  reason already typed, and nothing has to be reset by hand.
*/
export const RemoveMemberDialog = ({ member, onClose, onRemoved }) => {
  const { t } = useT();
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fieldRef = useRef(null);
  const openerRef = useRef(null);
  /* Once per mount: remember who opened this, start in the reason, and hand
     focus back on the way out. */
  useEffect(() => {
    openerRef.current = document.activeElement;
    fieldRef.current?.focus();
    return () => {
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, []);

  /* Escape answers "no" — except while the removal is running. */
  useEffect(() => {
    const onKeyDown = (e) => {
      if (busy || e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  if (!member) return null;

  const handleRemove = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON) {
      setError(t('members.remove.reason.required'));
      fieldRef.current?.focus();
      return;
    }
    if (trimmed.length > MAX_REASON) {
      setError(t('members.remove.reason.long'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await membersService.remove(member.membershipId, trimmed);
      onRemoved(member);
    } catch (err) {
      setBusy(false);
      setError(membersErrorMessage(err, t));
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="remove-member-title"
        aria-describedby="remove-member-body"
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
      >
        <ModalHeading
          tone="danger"
          icon={UserMinus}
          titleId="remove-member-title"
          title={t('members.remove.title', { name: member.fullName })}
          bodyId="remove-member-body"
          body={t('members.remove.body')}
        />

        <div className="space-y-1.5">
          <label htmlFor="remove-member-reason" className="text-sm font-semibold text-slate-700 block">
            {t('members.remove.reason')}
          </label>
          <textarea
            ref={fieldRef}
            id="remove-member-reason"
            rows={3}
            maxLength={MAX_REASON}
            value={reason}
            disabled={busy}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby="remove-member-hint"
            className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50"
          />
          {error ? (
            <p id="remove-member-hint" className="text-xs text-red-600 font-semibold leading-relaxed" role="alert">
              {error}
            </p>
          ) : (
            <p id="remove-member-hint" className="text-[11px] text-slate-500 font-medium leading-relaxed">
              {t('members.remove.reason.hint')}
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
            onClick={handleRemove}
            disabled={busy}
            className={modalConfirmClass('danger', busy)}
          >
            {busy ? t('common.loading') : t('members.remove.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RemoveMemberDialog;
