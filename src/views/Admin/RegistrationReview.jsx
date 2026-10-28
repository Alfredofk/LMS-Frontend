import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import KtpViewer from './KtpViewer';
import AppointPrincipalPanel from './AppointPrincipalPanel';
import SubdomainPanel from './SubdomainPanel';
import { adminService } from '../../services/adminService';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { HomeError } from '../Dashboard/components/HomeCard';
import { ADMIN_CARD as CARD, Fact, Facts } from './adminParts';

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

/* Where a registration stands, in words and colour, for the header's slash line. */
const STATUS_TONE = { PENDING: 'text-amber-700', APPROVED: 'text-emerald-700', REJECTED: 'text-rose-700' };

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
        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-500 hover:text-brand transition-colors cursor-pointer focus:outline-none focus-visible:text-brand"
      >
        <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
        {t('admin.back')}
      </button>

      <div className="min-w-0">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight break-words">{registration.schoolName}</h2>
        <p className="mt-1.5 text-sm font-medium text-slate-500">
          {[
            <span key="status" className={`font-bold ${STATUS_TONE[registration.status] ?? ''}`}>
              {t(`admin.status.${registration.status}`)}
            </span>,
            school && (
              <span key="state" className={`font-bold ${isDeactivated ? 'text-rose-700' : 'text-emerald-700'}`}>
                {t(isDeactivated ? 'admin.school.off' : 'admin.school.on')}
              </span>
            ),
            /* The code is here so an admin can read it back to whoever lost it. */
            school?.schoolCode && <span key="code">{t('admin.review.code', { code: school.schoolCode })}</span>,
          ]
            .filter(Boolean)
            .map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && (
                  <>
                    {' '}
                    <span className="mx-1 text-slate-300" aria-hidden="true">
                      /
                    </span>{' '}
                  </>
                )}
                {part}
              </React.Fragment>
            ))}
        </p>
      </div>

      {error && <HomeError message={error} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          <section className={CARD}>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('admin.section.school')}</h3>
            {/* The name, status, state and code are the header's; the created School's id is the database's, not a reader's. */}
            <Facts>
              <Fact label={t('admin.field.npsn')}>{registration.npsn}</Fact>
              <Fact label={t('admin.field.schoolType')}>{registration.schoolType}</Fact>
              <Fact label={t('admin.field.duration')}>
                {registration.durationYears ? t('admin.field.duration.years', { n: registration.durationYears }) : null}
              </Fact>
              <Fact label={t('admin.field.city')}>{registration.city}</Fact>
              {/* The point and zone (backend 431513b, 0ad658f), absent on a registration made before them.
                  A map link, so the admin can see the point is where the school says it is. */}
              <Fact label={t('admin.field.location')}>
                {registration.latitude != null && registration.longitude != null ? (
                  <a
                    href={`https://www.google.com/maps?q=${registration.latitude},${registration.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand hover:underline tabular-nums"
                  >
                    {registration.latitude}, {registration.longitude}
                  </a>
                ) : null}
              </Fact>
              <Fact label={t('admin.field.timeZone')}>{registration.timeZone}</Fact>
              <Fact label={t('admin.field.submitted')}>{asDate(registration.createdAt)}</Fact>
              {registration.reviewedAt && <Fact label={t('admin.field.reviewed')}>{asDate(registration.reviewedAt)}</Fact>}
              {school?.schoolCode && <Fact label={t('admin.field.schoolCode')}>{school.schoolCode}</Fact>}
              {registration.rejectionReason && (
                <Fact label={t('admin.field.rejectionReason')} wide>
                  {registration.rejectionReason}
                </Fact>
              )}
            </Facts>
          </section>

          <section className={CARD}>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('admin.section.applicant')}</h3>
            <Facts>
              <Fact label={t('admin.field.name')}>{registration.applicant?.fullName}</Fact>
              <Fact label={t('admin.field.email')}>{registration.applicant?.email}</Fact>
              <Fact label={t('admin.field.phone')}>{registration.applicantPhone}</Fact>
            </Facts>
          </section>
        </div>

        <div className="space-y-6">
          <div className={CARD}>
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
            <section className={`${CARD} space-y-4`}>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('admin.decision.title')}</h3>
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
                  <span className="text-xs text-red-600 font-medium" role="alert">{reasonError}</span>
                ) : (
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    {t('admin.reject.reason.hint')}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2.5">
                <Button type="button" isLoading={isSending} onClick={() => setConfirming('approve')}>
                  {t('admin.approve')}
                </Button>
                <Button
                  type="button"
                  variant="dangerOutline"
                  disabled={isSending}
                  onClick={() => {
                    if (checkReason('reject')) setConfirming('reject');
                  }}
                >
                  {t('admin.reject')}
                </Button>
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
          {isApproved && <AppointPrincipalPanel registration={registration} showToast={showToast} />}
          {/* The school's own address (backend a577abd), the admin's to change. */}
          {isApproved && <SubdomainPanel key={registration.id} registration={registration} showToast={showToast} />}

          {isApproved && !isDeactivated && (
            <section className={`${CARD} space-y-4`}>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('admin.deactivate.section')}</h3>
                <p className="text-[13px] font-medium text-slate-500 mt-1 leading-relaxed">
                  {t('admin.deactivate.lead')}
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="deactivateReason" className="text-sm font-semibold text-slate-700 block">
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
                  className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
                {reasonError ? (
                  <span className="text-xs text-red-600 font-medium" role="alert">{reasonError}</span>
                ) : (
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    {t('admin.deactivate.reason.hint')}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="dangerOutline"
                disabled={isSending}
                onClick={() => {
                  if (checkReason('deactivate')) setConfirming('deactivate');
                }}
              >
                {t('admin.deactivate.action')}
              </Button>
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
            <section className={`${CARD} space-y-4`}>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('admin.reactivate.section')}</h3>
                <p className="text-[13px] font-medium text-slate-500 mt-1 leading-relaxed">
                  {t('admin.reactivate.lead')}
                </p>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-3 -mt-1">
                <Fact label={t('admin.field.deactivatedAt')}>{asDate(school.deactivatedAt)}</Fact>
                <Fact label={t('admin.field.deactivationReason')} wide>
                  {school.deactivationReason}
                </Fact>
              </dl>

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
                  <span className="text-xs text-red-600 font-medium" role="alert">{reasonError}</span>
                ) : (
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    {t('admin.reactivate.note.hint')}
                  </p>
                )}
              </div>

              <Button
                type="button"
                isLoading={isSending}
                onClick={() => {
                  if (checkReason('reactivate')) setConfirming('reactivate');
                }}
              >
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
