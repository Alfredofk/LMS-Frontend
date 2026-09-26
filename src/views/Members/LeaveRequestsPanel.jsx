import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, DoorOpen, FileText, X } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { leaveRequestsService } from '../../services/leaveRequestsService';
import { useT } from '../../i18n/LanguageContext';
import { leaveDecisionErrorMessage } from '../../i18n/apiError';
import { validateLeaveReason } from '../../utils/validation';
import { openFileInNewTab } from '../../utils/openFile';

/*
  The Principal's queue of leave requests — the "Pengajuan keluar" tab on the
  members page (owner, 2026-09-26), backend `75e2fdd` / ticket 17.

  Each row is what the letter in hand is checked against: who, as what, where a
  student sits, their NISN or NIP, the reason they gave and when. The letter
  opens in a new tab, fetched with the token (the route is guarded).

  **Approving ends the membership** in the same transaction — LEFT, with the
  request's own reason as endReason — so the confirmation says so. It is refused
  for a homeroom teacher still holding a class in an active year, with the
  classes named, exactly as removal is. **Rejecting needs a reason**, 3–500
  characters, which the member reads on Settings.

  The list itself is loaded by MembersPage, which needs its length for the tab
  and has to re-read the members after an approval moves somebody to "Left".
*/

/* Decided or withdrawn elsewhere: the row is gone, so the queue is re-read and
   the dialog closes — a message left inside it would vanish with the row. */
const isStale = (err) =>
  err?.code === 'NOT_FOUND' || (err?.code === 'CONFLICT' && !err.details?.classes?.length);

const RejectLeaveDialog = ({ request, onClose, onRejected, onStale }) => {
  const { t } = useT();
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

  const handleReject = async () => {
    const failed = validateLeaveReason(reason);
    if (failed) {
      setError(t(failed.key, failed.vars));
      fieldRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await leaveRequestsService.reject(request.id, reason.trim());
      onRejected(request);
    } catch (err) {
      if (isStale(err)) return onStale(leaveDecisionErrorMessage(err, t));
      setBusy(false);
      setError(leaveDecisionErrorMessage(err, t));
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
        aria-labelledby="reject-leave-title"
        aria-describedby="reject-leave-body"
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-4 text-left"
      >
        <div className="space-y-2">
          <h2 id="reject-leave-title" className="text-base font-extrabold text-slate-900 tracking-tight break-words">
            {t('members.leave.reject.title', { name: request.member.fullName })}
          </h2>
          <p id="reject-leave-body" className="text-xs text-slate-500 font-medium leading-relaxed">
            {t('members.leave.reject.body')}
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reject-leave-reason" className="text-sm font-semibold text-slate-700 block">
            {t('members.leave.reject.reason')}
          </label>
          <textarea
            ref={fieldRef}
            id="reject-leave-reason"
            rows={3}
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby="reject-leave-hint"
            className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50"
          />
          {error ? (
            <p id="reject-leave-hint" className="text-xs text-red-600 font-semibold leading-relaxed" role="alert">
              {error}
            </p>
          ) : (
            <p id="reject-leave-hint" className="text-[11px] text-slate-500 font-medium leading-relaxed">
              {t('members.leave.reject.hint')}
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
            type="button"
            onClick={handleReject}
            disabled={busy}
            className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500 ${
              busy ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            {busy ? t('common.loading') : t('members.leave.reject.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const LeaveRequestsPanel = ({ requests, error, onChanged, showToast }) => {
  const { t, lang } = useT();
  const [approving, setApproving] = useState(null);
  const [approveError, setApproveError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(null);

  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  const day = (value) =>
    value ? new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const showLetter = (id) =>
    openFileInNewTab(() => leaveRequestsService.letter(id)).catch((err) =>
      showToast(leaveDecisionErrorMessage(err, t), 'error')
    );

  const closeApprove = () => {
    setApproving(null);
    setApproveError(null);
  };

  const handleApprove = async () => {
    setBusy(true);
    try {
      await leaveRequestsService.approve(approving.id);
      showToast(t('members.leave.approve.done', { name: approving.member.fullName }), 'success');
      closeApprove();
      onChanged();
    } catch (err) {
      /* The homeroom refusal stays inside the dialog, naming the classes to
         hand on first. Anything decided elsewhere closes it and reloads. */
      if (isStale(err)) {
        closeApprove();
        showToast(leaveDecisionErrorMessage(err, t), 'error');
        onChanged();
      } else {
        setApproveError(leaveDecisionErrorMessage(err, t));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRejected = (request) => {
    setRejecting(null);
    showToast(t('members.leave.reject.done', { name: request.member.fullName }), 'success');
    onChanged();
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
        {error}
      </div>
    );
  }

  if (requests === null) {
    return <div className="h-48 bg-white border border-slate-100 rounded-2xl animate-pulse" aria-label={t('common.loading')} />;
  }

  if (requests.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-white select-none">
        <DoorOpen className="w-9 h-9 text-slate-300 mx-auto" aria-hidden="true" />
        <p className="mt-2.5 text-xs font-extrabold text-slate-500">{t('members.leave.empty')}</p>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs text-slate-500 font-medium leading-relaxed">{t('members.leave.hint')}</p>

      <ul className="bg-white border border-slate-100 rounded-2xl shadow-sm divide-y divide-slate-100">
        {requests.map((request) => {
          const { member } = request;
          const ids = [
            member.nisn && `${t('profile.nisn')} ${member.nisn}`,
            member.currentClass && t('members.leave.class', { name: member.currentClass.name }),
            member.nip && `${t('profile.nip')} ${member.nip}`,
            member.nuptk && `${t('profile.nuptk')} ${member.nuptk}`,
          ].filter(Boolean);

          return (
            <li key={request.id} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-extrabold text-slate-800 break-words">{member.fullName}</span>
                  {member.roles.map((role) => (
                    <span key={role} className="px-2 py-0.5 bg-brand-tint text-brand text-[10px] font-extrabold rounded-md">
                      {t(`roleTitle.${role}`)}
                    </span>
                  ))}
                </div>
                {ids.length > 0 && (
                  <p className="text-[11px] font-semibold text-slate-500 tabular-nums break-words">{ids.join(' · ')}</p>
                )}
                <p className="text-[11px] font-semibold text-slate-500">
                  {t('members.leave.requestedOn', { date: day(request.requestedAt) })}
                </p>
                {/* Their own words, marked as a quotation. */}
                <p className="mt-1 pl-2 border-l-2 border-slate-200 text-[11px] text-slate-600 font-semibold break-words">
                  {request.reason}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => showLetter(request.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {t('members.leave.letter')}
                </button>
                <button
                  type="button"
                  onClick={() => setRejecting(request)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <X className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {t('members.leave.reject')}
                </button>
                <button
                  type="button"
                  onClick={() => setApproving(request)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand hover:bg-brand-deep text-white text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {t('members.leave.approve')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={!!approving}
        title={approving ? t('members.leave.approve.title', { name: approving.member.fullName }) : ''}
        body={approveError ?? t('members.leave.approve.body')}
        confirmLabel={t('members.leave.approve')}
        cancelLabel={t('common.cancel')}
        tone="brand"
        busy={busy}
        busyLabel={t('common.loading')}
        onCancel={closeApprove}
        onConfirm={handleApprove}
      />

      {rejecting && (
        <RejectLeaveDialog
          key={rejecting.id}
          request={rejecting}
          onClose={() => setRejecting(null)}
          onRejected={handleRejected}
          onStale={(message) => {
            setRejecting(null);
            showToast(message, 'error');
            onChanged();
          }}
        />
      )}
    </>
  );
};

export default LeaveRequestsPanel;
