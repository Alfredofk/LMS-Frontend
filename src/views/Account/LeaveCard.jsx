import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DoorOpen, FileText } from 'lucide-react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import LeaveSchoolDialog from './LeaveSchoolDialog';
import { membershipService } from '../../services/membershipService';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { leaveErrorMessage } from '../../i18n/apiError';
import { leaveModeOf } from '../../constants/roles';
import { validateLeaveReason, validateLetterFile } from '../../utils/validation';
import { openFileInNewTab } from '../../utils/openFile';

/*
  "Leave the school", on Settings — three ways, by what this member holds
  (leaveModeOf, backend 75e2fdd / ticket 17):

  - **A Principal cannot leave.** The card stays, the button off, with the
    reason (owner, 2026-09-24): a card that vanished would leave them looking.
  - **A teacher or a student asks the Principal**, with a resignation letter
    from the school and a reason (owner, 2026-09-25: "harus approval dari kepala
    sekolah berupa file"). While a request waits it is shown here with its
    letter and a way to take it back; a refused one shows the Principal's reason
    above the way to ask again. Approval ends the membership on the server; the
    member's next request is refused, and MembershipGoneWatcher takes them to
    /select-role.
  - **A guardian leaves at once**, through LeaveSchoolDialog — the school's name
    typed first, since nobody can undo it.

  A letter is shown in a new tab, fetched with the token (openFileInNewTab): the
  route is guarded, so a plain link would carry no Authorization header.
*/

const Shell = ({ children }) => (
  <section
    aria-labelledby="leave-school-card"
    className="border border-rose-200 rounded-2xl p-5 bg-white shadow-sm text-left space-y-4"
  >
    {children}
  </section>
);

export const LeaveCard = ({ onToast }) => {
  const navigate = useNavigate();
  const { membership } = useAuth();
  const { t, lang } = useT();

  const mode = leaveModeOf(membership);
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';

  /* The member's own requests, newest first — only for those who ask. */
  const [requests, setRequests] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const asked = useRef(false);

  const [isDirectOpen, setIsDirectOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [letter, setLetter] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSending, setIsSending] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const load = () =>
    membershipService
      .leaveRequests()
      .then((list) => {
        setRequests(list);
        setLoadError(null);
      })
      .catch((err) => setLoadError(leaveErrorMessage(err, t)));

  useEffect(() => {
    if (mode !== 'REQUEST' || asked.current) return;
    asked.current = true;
    load();
    // Once, on arrival; every change below reloads it itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  if (!mode) return null;

  const asDate = (value) =>
    value
      ? new Date(value).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';

  const heading = (
    <h2 id="leave-school-card" className="text-sm font-extrabold text-slate-900 tracking-tight">
      {t('account.leave.title')}
    </h2>
  );

  /* ---- a Principal ---- */
  if (mode === 'NONE') {
    return (
      <Shell>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0 space-y-1">
            {heading}
            <p className="text-xs text-slate-500 font-medium leading-relaxed break-words">
              {t('account.leave.principal', { school: schoolName })}
            </p>
          </div>
          <button
            type="button"
            disabled
            className="self-start sm:self-auto shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold border border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed"
          >
            <DoorOpen className="w-4 h-4" aria-hidden="true" />
            {t('account.leave.open')}
          </button>
        </div>
      </Shell>
    );
  }

  /* ---- a guardian: at once ---- */
  if (mode === 'DIRECT') {
    /* The token still names the school and leaving revokes nothing, so it is
       traded in before /select-role reads /users/me and says "you left". */
    const handleLeft = async () => {
      try {
        await authService.refresh();
      } catch {
        /* requireActiveMembership reads the database; the old token is refused anyway. */
      }
      navigate('/select-role', { replace: true });
    };

    return (
      <Shell>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0 space-y-1">
            {heading}
            <p className="text-xs text-slate-500 font-medium leading-relaxed break-words">
              {t('account.leave.hint', { school: schoolName })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsDirectOpen(true)}
            className="self-start sm:self-auto shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
          >
            <DoorOpen className="w-4 h-4" aria-hidden="true" />
            {t('account.leave.open')}
          </button>
        </div>
        {isDirectOpen && (
          <LeaveSchoolDialog
            schoolName={schoolName}
            onClose={() => setIsDirectOpen(false)}
            onLeft={handleLeft}
          />
        )}
      </Shell>
    );
  }

  /* ---- a teacher or a student: ask, with a letter ---- */
  const pending = requests?.find((entry) => entry.status === 'PENDING') ?? null;
  const latest = requests?.[0] ?? null;
  const refused = !pending && latest?.status === 'REJECTED' ? latest : null;

  const showLetter = (id) =>
    openFileInNewTab(() => membershipService.leaveLetter(id)).catch((err) =>
      onToast(leaveErrorMessage(err, t), 'error')
    );

  const closeForm = () => {
    setIsFormOpen(false);
    setReason('');
    setLetter(null);
    setErrors({});
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (isSending) return;
    const next = {};
    const reasonFail = validateLeaveReason(reason);
    const letterFail = validateLetterFile(letter);
    if (reasonFail) next.reason = t(reasonFail.key, reasonFail.vars);
    if (letterFail) next.letter = t(letterFail.key, letterFail.vars);
    setErrors(next);
    if (Object.keys(next).length) return;

    setIsSending(true);
    try {
      await membershipService.submitLeaveRequest({ reason: reason.trim(), letter });
      closeForm();
      onToast(t('account.leave.request.sent'), 'success');
      await load();
    } catch (err) {
      setErrors({ global: leaveErrorMessage(err, t) });
    } finally {
      setIsSending(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await membershipService.cancelLeaveRequest();
      onToast(t('account.leave.request.cancelled'), 'success');
    } catch (err) {
      onToast(leaveErrorMessage(err, t), 'error');
    } finally {
      await load();
      setIsCancelling(false);
      setIsCancelOpen(false);
    }
  };

  return (
    <Shell>
      <div className="space-y-1">
        {heading}
        <p className="text-xs text-slate-500 font-medium leading-relaxed break-words">
          {t('account.leave.request.hint', { school: schoolName })}
        </p>
      </div>

      {loadError && requests === null ? (
        <p className="text-xs font-semibold text-red-600" role="alert">{loadError}</p>
      ) : requests === null ? (
        <div className="h-12 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />
      ) : pending ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-xs font-extrabold text-amber-800">
            {t('account.leave.request.pending', { date: asDate(pending.requestedAt) })}
          </p>
          <p className="text-[11px] font-semibold text-amber-800 break-words">
            {t('account.leave.request.yourReason')} “{pending.reason}”
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="button"
              onClick={() => showLetter(pending.id)}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-brand hover:text-brand-deep cursor-pointer focus:outline-none focus-visible:underline"
            >
              <FileText className="w-4 h-4" aria-hidden="true" />
              {t('account.leave.request.viewLetter')}
            </button>
            <button
              type="button"
              onClick={() => setIsCancelOpen(true)}
              className="text-xs font-extrabold text-rose-600 hover:text-rose-700 underline underline-offset-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
            >
              {t('account.leave.request.cancel')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* The Principal's own words, marked as a quotation. */}
          {refused && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 space-y-1">
              <p className="text-xs font-extrabold text-rose-700">
                {t('account.leave.request.refused', { date: asDate(refused.decidedAt) })}
              </p>
              {refused.rejectionReason && (
                <p className="text-[11px] font-semibold text-rose-700 break-words">“{refused.rejectionReason}”</p>
              )}
            </div>
          )}

          {!isFormOpen ? (
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold border border-rose-200 text-rose-600 hover:bg-rose-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2"
            >
              <DoorOpen className="w-4 h-4" aria-hidden="true" />
              {t('account.leave.request.open')}
            </button>
          ) : (
            <form onSubmit={handleSend} noValidate className="space-y-4 max-w-xl">
              <div className="space-y-1.5">
                <label htmlFor="leave-reason" className="text-sm font-semibold text-slate-700 block">
                  {t('account.leave.request.reason')}
                </label>
                <textarea
                  id="leave-reason"
                  name="reason"
                  rows={3}
                  maxLength={500}
                  value={reason}
                  disabled={isSending}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (errors.reason || errors.global) setErrors((prev) => ({ ...prev, reason: null, global: null }));
                  }}
                  aria-invalid={!!errors.reason}
                  aria-describedby={errors.reason ? 'leave-reason-error' : undefined}
                  className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50"
                />
                {errors.reason && (
                  <p id="leave-reason-error" className="text-xs text-red-500 font-medium">{errors.reason}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="leave-letter" className="text-sm font-semibold text-slate-700 block">
                  {t('account.leave.request.letter')}
                </label>
                <input
                  id="leave-letter"
                  name="letter"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  disabled={isSending}
                  onChange={(e) => {
                    setLetter(e.target.files?.[0] ?? null);
                    if (errors.letter || errors.global) setErrors((prev) => ({ ...prev, letter: null, global: null }));
                  }}
                  aria-invalid={!!errors.letter}
                  aria-describedby="leave-letter-hint"
                  className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-tint file:text-brand file:font-extrabold file:cursor-pointer cursor-pointer"
                />
                <p id="leave-letter-hint" className={`text-xs font-medium ${errors.letter ? 'text-red-500' : 'text-slate-500'}`}>
                  {errors.letter || t('account.leave.request.letterHint')}
                </p>
              </div>

              {errors.global && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
                  {errors.global}
                </div>
              )}

              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('account.leave.request.after')}</p>

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                <Button type="button" variant="outline" onClick={closeForm} isDisabled={isSending}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" isLoading={isSending}>
                  {t('account.leave.request.send')}
                </Button>
              </div>
            </form>
          )}
        </>
      )}

      <ConfirmDialog
        open={isCancelOpen}
        title={t('account.leave.request.cancelTitle')}
        body={t('account.leave.request.cancelBody')}
        confirmLabel={t('selectRole.cancel.confirm')}
        cancelLabel={t('selectRole.cancel.keep')}
        busy={isCancelling}
        busyLabel={t('common.loading')}
        onCancel={() => setIsCancelOpen(false)}
        onConfirm={handleCancel}
      />
    </Shell>
  );
};

export default LeaveCard;
