import React, { useState } from 'react';
import { ArrowLeft, Check, X, Trash2 } from 'lucide-react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import KtpViewer from './KtpViewer';
import { adminService } from '../../services/adminService';
import { isNotBuiltYet } from '../../services/apiClient';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';

const CONFIRM_TITLE = {
  approve: 'admin.approve.confirm.title',
  reject: 'admin.reject.confirm.title',
  deactivate: 'admin.deactivate.confirm.title',
};
const CONFIRM_BODY = {
  approve: 'admin.approve.confirm.body',
  reject: 'admin.reject.confirm.body',
  deactivate: 'admin.deactivate.confirm.body',
};
const CONFIRM_LABEL = { approve: 'admin.approve', reject: 'admin.reject', deactivate: 'admin.deactivate.action' };

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
  const [confirming, setConfirming] = useState(null); // 'approve' | 'reject' | null
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  const asDate = (value) =>
    value ? new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  const isPending = registration.status === 'PENDING';
  const isApproved = registration.status === 'APPROVED';

  const checkReason = () => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON) {
      setReasonError(t(isApproved ? 'admin.deactivate.reason.required' : 'admin.reject.reason.required'));
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
  };

  const decide = async (kind) => {
    setConfirming(null);
    setIsSending(true);
    setError(null);

    try {
      let answer;
      if (kind === 'approve') answer = await adminService.approve(registration.id);
      else if (kind === 'reject') answer = await adminService.reject(registration.id, reason.trim());
      else answer = await adminService.deactivate(registration.id, reason.trim());

      showToast?.(t(DONE_KEY[kind]), 'success');
      onDecided(answer.registration);
    } catch (err) {
      if (err.code === 'CONFLICT') {
        /* Somebody decided first. Nothing is wrong; the queue is just stale. */
        showToast?.(t('admin.alreadyDecided'), 'info');
        onDecided(null);
        return;
      }
      /*
        Removal has no route behind it yet. Saying "something went wrong" would
        blame the reader for a feature nobody has written, and a success message
        would be a lie about a school that is still very much approved. So it
        says what is true and leaves the registration alone.
      */
      if (kind === 'deactivate' && isNotBuiltYet(err)) {
        setError(t('admin.deactivate.notBuilt'));
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
                  onClick={() => { if (checkReason()) setConfirming('reject'); }}
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
          */}
          {isApproved && (
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
                onClick={() => { if (checkReason()) setConfirming('deactivate'); }}
                className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                {t('admin.deactivate.action')}
              </button>
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
        tone={confirming === 'approve' ? 'brand' : 'danger'}
        onCancel={() => setConfirming(null)}
        onConfirm={() => decide(confirming)}
      />
    </div>
  );
};

export default RegistrationReview;
