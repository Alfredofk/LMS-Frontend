import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { membershipService } from '../../services/membershipService';
import { useT } from '../../i18n/LanguageContext';
import { leaveErrorMessage } from '../../i18n/apiError';
import { confirmsName } from '../../utils/validation';

/*
  Leaving the school, with the school's name typed first.

  `POST /api/memberships/me/leave`. Nobody can undo it alone — coming back means
  asking to join and waiting to be released — so the button stays off until the
  name is typed (`confirmsName`: case and spacing forgiven). The owner chose that
  over a plain confirm (2026-09-24).

  Built like RemoveMemberDialog: portal, alertdialog, focus into the field and
  back to the opener, Escape and the backdrop answering "no" except while the
  request runs. The call is made here; every refusal stays inside the dialog —
  the one that matters is a homeroom teacher of a class in an active year, whose
  classes are named, because handing them on is the Principal's to do first.

  Render it only while open (`{open && <LeaveSchoolDialog … />}`), so each
  opening starts with an empty field.
*/
export const LeaveSchoolDialog = ({ schoolName, onClose, onLeft }) => {
  const { t } = useT();
  const [typed, setTyped] = useState('');
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

  const handleLeave = async (e) => {
    e.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await membershipService.leaveSchool();
      onLeft();
    } catch (err) {
      setBusy(false);
      setError(leaveErrorMessage(err, t));
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={busy ? undefined : onClose}
    >
      <form
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-school-title"
        aria-describedby="leave-school-body"
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleLeave}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-4 text-left"
      >
        <div className="space-y-2">
          <h2 id="leave-school-title" className="text-base font-extrabold text-slate-900 tracking-tight break-words">
            {t('account.leave.dialog.title', { school: schoolName })}
          </h2>
          <p id="leave-school-body" className="text-xs text-slate-500 font-medium leading-relaxed">
            {t('account.leave.dialog.body')}
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="leave-school-name" className="text-sm font-semibold text-slate-700 block break-words">
            {t('account.leave.dialog.type', { school: schoolName })}
          </label>
          <input
            ref={fieldRef}
            id="leave-school-name"
            name="schoolName"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            disabled={busy}
            onChange={(e) => {
              setTyped(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby={error ? 'leave-school-error' : undefined}
            className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 px-4 text-base text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 disabled:bg-slate-50"
          />
          {error && (
            <p id="leave-school-error" className="text-xs text-red-600 font-semibold leading-relaxed" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold text-slate-600 border border-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              busy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'
            }`}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!confirmed || busy}
            className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 bg-rose-600 focus-visible:ring-rose-500 ${
              !confirmed || busy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-rose-700 cursor-pointer'
            }`}
          >
            {busy ? t('common.loading') : t('account.leave.confirm')}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
};

export default LeaveSchoolDialog;
