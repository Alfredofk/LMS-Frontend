import React, { useState } from 'react';
import { ArrowLeft, Check, X, Trash2, RotateCcw } from 'lucide-react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import KtpViewer from './KtpViewer';
import { adminService } from '../../services/adminService';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';

const CONFIRM_TITLE = {
  approve: 'admin.approve.confirm.title',
  reject: 'admin.reject.confirm.title',
  deactivate: 'admin.deactivate.confirm.title',
  reactivate: 'admin.reactivate.confirm.title',
};
const CONFIRM_BODY = {
  approve: 'admin.approve.confirm.body',
  reject: 'admin.reject.confirm.body',
  deactivate: 'admin.deactivate.confirm.body',
  reactivate: 'admin.reactivate.confirm.body',
};
const CONFIRM_LABEL = {
  approve: 'admin.approve',
  reject: 'admin.reject',
  deactivate: 'admin.deactivate.action',
  reactivate: 'admin.reactivate.action',
};

/* The two that restore or grant wear the brand colour; the two that take
   something away wear the danger one. */
const BRAND_TONED = ['approve', 'reactivate'];

const MIN_REASON = 3;
const MAX_REASON = 500;

const Row = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
      {label}
    </span>
    <span className="text-xs font-semibold text-slate-800 text-right break-words min-w-0">
      {children ?? '—'}
    </span>
  </div>
);

/*
  One registration, and the decision about it.

  Two things here are the backend's rules rather than choices:

  **A rejection must carry a reason.** `rejectBody` marks it optional in zod,
  but `assertRejectionReason` refuses anything under three characters after
  trimming. The rule is right — a rejection nobody explained leaves the
  applicant unable to tell whether to fix something and re-apply. So the field
  is validated here too, before a request goes out.

  **A decision happens once.** The row is claimed with
  `updateMany({ status: 'PENDING' })` inside the transaction, so two admins
  clicking together both pass the earlier read and only one wins; the other gets
  409. That is not an error to complain about — it means somebody else already
  did the work — so it reloads and says so.
*/
export const RegistrationReview = ({ registration, onBack, onDecided, showToast }) => {
  const { t, lang } = useT();

  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const [confirming, setConfirming] = useState(null); // 'approve' | 'reject' | 'deactivate' | 'reactivate' | null
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  const asDate = (value) =>
    value ? new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  const isPending = registration.status === 'PENDING';
  const isApproved = registration.status === 'APPROVED';

  /*
    Deactivation does **not** move the registration: it stays APPROVED, and what
    changes is `school.deactivatedAt`. So the approved branch has two faces, and
    this is the flag that picks between them — a school still running gets the
    switch-off panel, one already off gets the way back.
  */
  const school = registration.school ?? null;
  const isDeactivated = Boolean(school?.deactivatedAt);

  /*
    Three actions need a reason and one does not. Reactivating is the exception
    the backend makes on purpose: there is nobody waiting to be told why their
    access came back, so the note is recorded if given and never demanded.
  */
  const checkReason = (kind) => {
    if (kind === 'reactivate') {
      if (reason.trim().length > MAX_REASON) {
        setReasonError(t('admin.reject.reason.long'));
        return false;
      }
      setReasonError(null);
      return true;
    }

    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON) {
      setReasonError(t(kind === 'deactivate' ? 'admin.deactivate.reason.required' : 'admin.reject.reason.required'));
      return false;
    }
    if (trimmed.length > MAX_REASON) {
      setReasonError(t('admin.reject.reason.long'));
      return false;
    }
    setReasonError(null);
    return true;
  };

  const DONE_KEY = {
    approve: 'admin.approve.done',
    reject: 'admin.reject.done',
    deactivate: 'admin.deactivate.done',
    reactivate: 'admin.reactivate.done',
  };

  const decide = async (kind) => {
    setConfirming(null);
    setIsSending(true);
    setError(null);

    try {
      /* Named branches rather than a catch-all `else`: with four actions the
         fallthrough stopped being obvious, and a mislabelled one would send a
         reactivation to the endpoint that switches a school off. */
      const CALL = {
        approve: () => adminService.approve(registration.id),
        reject: () => adminService.reject(registration.id, reason.trim()),
        deactivate: () => adminService.deactivate(registration.id, reason.trim()),
        reactivate: () => adminService.reactivate(registration.id, reason.trim()),
      };
      const answer = await CALL[kind]();

      showToast?.(t(DONE_KEY[kind]), 'success');
      onDecided(answer.registration);
    } catch (err) {
      if (err.code === 'CONFLICT') {
        /* Somebody decided first. Nothing is wrong; the queue is just stale. */
        showToast?.(t('admin.alreadyDecided'), 'info');
        onDecided(null);
        return;
      }
      setError(apiErrorMessage(err, t));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-400 hover:text-brand transition-colors cursor-pointer focus:outline-none focus-visible:text-brand"
      >
        <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
        {t('admin.back')}
      </button>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-2">
              {t('admin.section.school')}
            </h3>
            <Row label={t('admin.field.schoolName')}>{registration.schoolName}</Row>
            <Row label={t('admin.field.npsn')}>{registration.npsn}</Row>
            <Row label={t('admin.field.schoolType')}>{registration.schoolType}</Row>
            <Row label={t('admin.field.duration')}>
              {registration.durationYears
                ? t('admin.field.duration.years', { n: registration.durationYears })
                : null}
            </Row>
            <Row label={t('admin.field.city')}>{registration.city}</Row>
            <Row label={t('admin.field.status')}>{t(`admin.status.${registration.status}`)}</Row>
            <Row label={t('admin.field.submitted')}>{asDate(registration.createdAt)}</Row>
            {registration.reviewedAt && (
              <Row label={t('admin.field.reviewed')}>{asDate(registration.reviewedAt)}</Row>
            )}
            {registration.createdSchoolId && (
              <Row label={t('admin.field.schoolCreated')}>{registration.createdSchoolId}</Row>
            )}
            {/* The code is here so an admin can read it back to whoever lost it —
                which is the reason the backend puts it in this response at all. */}
            {school?.schoolCode && (
              <Row label={t('admin.field.schoolCode')}>{school.schoolCode}</Row>
            )}
            {school && (
              <Row label={t('admin.field.schoolState')}>
                <span className={isDeactivated ? 'text-rose-600 font-extrabold' : 'text-emerald-600 font-extrabold'}>
                  {t(isDeactivated ? 'admin.school.off' : 'admin.school.on')}
                </span>
              </Row>
            )}
            {registration.rejectionReason && (
              <Row label={t('admin.field.rejectionReason')}>{registration.rejectionReason}</Row>
            )}
          </section>

          <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-2">
              {t('admin.section.applicant')}
            </h3>
            <Row label={t('admin.field.name')}>{registration.applicant?.fullName}</Row>
            <Row label={t('admin.field.email')}>{registration.applicant?.email}</Row>
            <Row label={t('admin.field.phone')}>{registration.applicantPhone}</Row>
          </section>
        </div>

        <div className="space-y-6">
          <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
            {/* Keyed: switching registrations remounts the viewer, so its
                object URL is revoked by the unmount rather than by an effect
                racing the next fetch. */}
            <KtpViewer
              key={registration.id}
              registrationId={registration.id}
              hasKtp={registration.hasKtp}
            />
          </div>

          {isPending && (
            <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="reason" className="text-sm font-semibold text-slate-700 block">
                  {t('admin.reject.reason')}
                </label>
                <textarea
                  id="reason"
                  rows={3}
                  maxLength={MAX_REASON}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (reasonError) setReasonError(null);
                  }}
                  className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
                {reasonError ? (
                  <span className="text-xs text-red-500 font-medium" role="alert">{reasonError}</span>
                ) : (
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                    {t('admin.reject.reason.hint')}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  isLoading={isSending}
                  onClick={() => setConfirming('approve')}
                  className="flex-1 py-3 rounded-2xl justify-center text-sm gap-1.5"
                >
                  <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {t('admin.approve')}
                </Button>

                {/* Not a Button: the danger action should not wear the primary
                    colour beside the one it is the opposite of. */}
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => { if (checkReason('reject')) setConfirming('reject'); }}
                  className="flex-1 py-3 rounded-2xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <X className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {t('admin.reject')}
                </button>
              </div>
            </section>
          )}

          {/*
            Taking an approved school back out.

            Two situations, and the wording covers both: a school approved by
            mistake, and one that has stopped using EduForID. Only shown once a
            registration is APPROVED — there is nothing to remove before that,
            and Reject already covers the pending case.

            Kept visually apart from approve and reject: those two are the daily
            work, this one undoes something that already happened to real people.

            Only while the school is still running. Deactivating does not move the
            registration out of APPROVED — it sets `school.deactivatedAt` — so this
            branch and the one below it are the two faces of the same status.
          */}
          {isApproved && !isDeactivated && (
            <section className="border border-rose-200 rounded-2xl p-5 bg-rose-50/40 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-rose-900 tracking-tight">
                  {t('admin.deactivate.section')}
                </h3>
                <p className="text-xs font-semibold text-rose-700/80 mt-1 leading-relaxed">
                  {t('admin.deactivate.lead')}
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="deactivateReason" className="text-sm font-semibold text-rose-900 block">
                  {t('admin.deactivate.reason')}
                </label>
                <textarea
                  id="deactivateReason"
                  rows={3}
                  maxLength={MAX_REASON}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (reasonError) setReasonError(null);
                  }}
                  className="block w-full rounded-xl border border-rose-200 hover:border-rose-300 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-rose-400/20 focus:border-rose-400"
                />
                {reasonError ? (
                  <span className="text-xs text-red-600 font-medium" role="alert">{reasonError}</span>
                ) : (
                  <p className="text-[11px] text-rose-700/70 font-medium leading-relaxed">
                    {t('admin.deactivate.reason.hint')}
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={isSending}
                onClick={() => { if (checkReason('deactivate')) setConfirming('deactivate'); }}
                className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                {t('admin.deactivate.action')}
              </button>
            </section>
          )}

          {/*
            The way back.

            It exists because the alternative to a button is editing the database by
            hand — a school switched off by a misclick would otherwise stay off. It
            leads with **why** and **when** it was switched off, because that is what
            an admin arriving here a month later needs before deciding anything.

            Not styled as danger: this one gives access back. The note under it is
            genuinely optional, which is the only reason field on this screen that is.
          */}
          {isApproved && isDeactivated && (
            <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  {t('admin.reactivate.section')}
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">
                  {t('admin.reactivate.lead')}
                </p>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3">
                <Row label={t('admin.field.deactivatedAt')}>{asDate(school.deactivatedAt)}</Row>
                <Row label={t('admin.field.deactivationReason')}>{school.deactivationReason}</Row>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reactivateNote" className="text-sm font-semibold text-slate-700 block">
                  {t('admin.reactivate.note')}
                </label>
                <textarea
                  id="reactivateNote"
                  rows={3}
                  maxLength={MAX_REASON}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (reasonError) setReasonError(null);
                  }}
                  className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
                {reasonError ? (
                  <span className="text-xs text-red-500 font-medium" role="alert">{reasonError}</span>
                ) : (
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                    {t('admin.reactivate.note.hint')}
                  </p>
                )}
              </div>

              <Button
                type="button"
                isLoading={isSending}
                onClick={() => { if (checkReason('reactivate')) setConfirming('reactivate'); }}
                className="w-full py-3 rounded-2xl justify-center text-sm gap-1.5"
              >
                <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
                {t('admin.reactivate.action')}
              </Button>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={t(CONFIRM_TITLE[confirming] ?? 'admin.approve.confirm.title', { name: registration.schoolName })}
        body={t(CONFIRM_BODY[confirming] ?? 'admin.approve.confirm.body', {
          name: registration.schoolName,
        })}
        confirmLabel={t(CONFIRM_LABEL[confirming] ?? 'admin.approve')}
        cancelLabel={t('common.cancel')}
        tone={BRAND_TONED.includes(confirming) ? 'brand' : 'danger'}
        onCancel={() => setConfirming(null)}
        onConfirm={() => decide(confirming)}
      />
    </div>
  );
};

export default RegistrationReview;
