import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import GoverningBodyFileViewer from './GoverningBodyFileViewer';
import GoverningBodyCorrectionPanel from './GoverningBodyCorrectionPanel';
import GoverningBodyAdminsPanel from './GoverningBodyAdminsPanel';
import SubdomainPanel from './SubdomainPanel';
import { adminGoverningBodyService } from '../../services/adminGoverningBodyService';
import { governingBodyAdminErrorMessage, isStaleGoverningBody } from '../../i18n/apiError';
import { useT } from '../../i18n/LanguageContext';
import { schoolAddressOf } from '../../constants/subdomain';
import { addressLineOf, kindKeyOf } from '../GoverningBody/governingBody';
import { MAX_REASON, isBodyOff, reasonErrorOf } from './bodyDecisions';
import { HomeError } from '../Dashboard/components/HomeCard';
import { Fact, Facts, SlashFacts } from './adminParts';

/* Where a registration stands, in words and colour, for the header's slash line. */
const STATUS_TONE = { PENDING: 'text-amber-700', APPROVED: 'text-emerald-700', REJECTED: 'text-rose-700' };

const ReasonBox = ({ id, label, hint, value, onChange, error }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="text-sm font-semibold block text-slate-700">
      {label}
    </label>
    <textarea
      id={id}
      rows={3}
      maxLength={MAX_REASON}
      value={value}
      onChange={onChange}
      className="block w-full rounded-xl border bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 border-slate-200 hover:border-slate-300 focus:ring-brand/20 focus:border-brand"
    />
    {error ? (
      <span className="text-xs text-red-600 font-medium" role="alert">
        {error}
      </span>
    ) : (
      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{hint}</p>
    )}
  </div>
);

const CONFIRM = {
  approve: { title: 'gbr.approve.confirm.title', body: 'gbr.approve.confirm.body', label: 'gbr.approve', tone: 'brand', done: 'gbr.approve.done' },
  reject: { title: 'gbr.reject.confirm.title', body: 'gbr.reject.confirm.body', label: 'gbr.reject', tone: 'danger', done: 'gbr.reject.done' },
  deactivate: { title: 'gbr.deactivate.confirm.title', body: 'gbr.deactivate.confirm.body', label: 'gbr.deactivate.action', tone: 'danger', done: 'gbr.deactivate.done' },
  reactivate: { title: 'gbr.reactivate.confirm.title', body: 'gbr.reactivate.confirm.body', label: 'gbr.reactivate.action', tone: 'brand', done: 'gbr.reactivate.done' },
};

/*
  One Governing Body registration, and what the Platform Admin decides about it
  (backend b5cfffd; owner 2026-10-24, the school review's shape).

  - Waiting: the registration, the applicant, the KTP and the proof of office
    (GoverningBodyFileViewer), and approve or reject - a rejection with a reason of
    3-500. Each asks first; approving founds the body (its code, its subdomain, the
    applicant's active admin seat) and both answers discard the two files.
  - Approved: the body as it is now (`registration.governingBody`, the registration
    keeping what the applicant wrote), its correction (GoverningBodyCorrectionPanel)
    and switching it off with a reason, or back on with an optional note - keyed by
    the body's id, not the registration's. Since backend 3d7d05a/8aff4f4 also its
    address label (SubdomainPanel, `body`) and its admins (GoverningBodyAdminsPanel:
    the brake, and the applications of a body left with none).

  Several sentences share CONFLICT here (`governingBodyAdminErrorMessage`); one
  saying the row is out of date - decided, switched or changed elsewhere - reads the
  queue again (`onStale`) instead of standing as an error. A decision or a change
  answers with the newer row, handed up through `onChanged`.
*/
export const GoverningBodyReview = ({ registration, onBack, onChanged, onStale, showToast }) => {
  const { t, lang } = useT();

  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  const asDate = (value) => (value ? new Date(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : null);

  const isPending = registration.status === 'PENDING';
  const body = registration.status === 'APPROVED' ? (registration.governingBody ?? null) : null;
  const isOff = isBodyOff(registration);
  const kindWord = (kind) => (kindKeyOf(kind) ? t(kindKeyOf(kind)) : kind);

  const askFor = (kind) => {
    const found = kind === 'approve' ? null : reasonErrorOf(kind, reason);
    setReasonError(found ? t(found) : null);
    if (!found) setConfirming(kind);
  };

  const typeReason = (e) => {
    setReason(e.target.value);
    if (reasonError) setReasonError(null);
  };

  const decide = async (kind) => {
    setIsSending(true);
    setError(null);
    const note = reason.trim();
    const CALL = {
      approve: () => adminGoverningBodyService.approve(registration.id),
      reject: () => adminGoverningBodyService.reject(registration.id, note),
      deactivate: () => adminGoverningBodyService.deactivate(body.id, note),
      reactivate: () => adminGoverningBodyService.reactivate(body.id, note),
    };
    try {
      const answer = await CALL[kind]();
      setConfirming(null);
      setReason('');
      showToast?.(t(CONFIRM[kind].done), 'success');
      onChanged(answer.registration ?? { ...registration, governingBody: answer.governingBody });
    } catch (err) {
      setConfirming(null);
      if (isStaleGoverningBody(err)) {
        showToast?.(governingBodyAdminErrorMessage(err, t), 'info');
        onStale();
        return;
      }
      setError(governingBodyAdminErrorMessage(err, t));
    } finally {
      setIsSending(false);
    }
  };

  const confirm = CONFIRM[confirming] ?? CONFIRM.approve;
  const name = body?.name ?? registration.name;
  const siteAddress = schoolAddressOf(body?.subdomain ?? null);

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
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight break-words">{name}</h2>
        <SlashFacts
          className="block mt-1.5 text-sm font-medium text-slate-500"
          parts={[
            <span className={`font-bold ${STATUS_TONE[registration.status] ?? ''}`}>{t(`admin.status.${registration.status}`)}</span>,
            body && <span className={`font-bold ${isOff ? 'text-rose-700' : 'text-emerald-700'}`}>{t(isOff ? 'gbr.state.off' : 'gbr.state.on')}</span>,
            body?.code && t('gbr.review.code', { code: body.code }),
          ]}
        />
      </div>

      {error && <HomeError message={error} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          {body && (
            <section className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('gbr.section.body')}</h3>
              <Facts>
                <Fact label={t('gb.kind')}>{kindWord(body.kind)}</Fact>
                {/* A foundation or an association from before c79b56f has none until corrected. */}
                <Fact label={t('gb.npyp')}>
                  {body.npyp ?? (body.kind !== 'GOVERNMENT' ? <span className="text-amber-700 font-extrabold">{t('gbr.npyp.missing')}</span> : null)}
                </Fact>
                <Fact label={t('gbr.field.subdomain')}>{siteAddress ?? body.subdomain}</Fact>
                <Fact label={t('gb.skNumber')} wide>
                  {body.skNumber}
                </Fact>
              </Facts>
            </section>
          )}

          <section className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('gbr.section.registration')}</h3>
            {/* What the applicant wrote: it may differ from the body once corrected. */}
            <Facts>
              <Fact label={t('gb.kind')}>{kindWord(registration.kind)}</Fact>
              <Fact label={t('gbr.field.name')}>{registration.name}</Fact>
              <Fact label={t('gb.npyp')}>{registration.npyp}</Fact>
              <Fact label={t('gb.skNumber')} wide>
                {registration.skNumber}
              </Fact>
              <Fact label={t('gb.address')} wide>
                {addressLineOf(registration.address) || null}
              </Fact>
              <Fact label={t('admin.field.submitted')}>{asDate(registration.createdAt)}</Fact>
              {registration.reviewedAt && <Fact label={t('admin.field.reviewed')}>{asDate(registration.reviewedAt)}</Fact>}
              {registration.rejectionReason && (
                <Fact label={t('admin.field.rejectionReason')} wide>
                  {registration.rejectionReason}
                </Fact>
              )}
            </Facts>
          </section>

          <section className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0">
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('admin.section.applicant')}</h3>
            <Facts>
              <Fact label={t('admin.field.name')}>{registration.applicant?.fullName}</Fact>
              <Fact label={t('admin.field.email')}>{registration.applicant?.email}</Fact>
              <Fact label={t('admin.field.phone')}>{registration.applicantPhone}</Fact>
            </Facts>
          </section>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0 space-y-6">
            <GoverningBodyFileViewer key={`${registration.id}:ktp`} registrationId={registration.id} which="ktp" has={registration.hasKtp} decided={!isPending} />
            <GoverningBodyFileViewer key={`${registration.id}:proof`} registrationId={registration.id} which="proof" has={registration.hasProof} decided={!isPending} />
          </div>

          {isPending && (
            <section className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0 space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('admin.decision.title')}</h3>
              <ReasonBox id="gbReason" label={t('gbr.reject.reason')} hint={t('gbr.reject.reason.hint')} value={reason} onChange={typeReason} error={reasonError} />
              <div className="flex flex-wrap gap-2.5">
                <Button type="button" isLoading={isSending} onClick={() => askFor('approve')}>
                  {t('gbr.approve')}
                </Button>
                <Button type="button" variant="dangerOutline" disabled={isSending} onClick={() => askFor('reject')}>
                  {t('gbr.reject')}
                </Button>
              </div>
            </section>
          )}

          {body && <GoverningBodyCorrectionPanel key={`${body.id}:${body.name}:${body.kind}:${body.npyp}:${body.skNumber}`} body={body} showToast={showToast} onSaved={(next) => onChanged({ ...registration, governingBody: next })} onStale={onStale} />}

          {/* Its address and its admins (backend 3d7d05a/8aff4f4; owner 2026-10-24). */}
          {body && <SubdomainPanel key={`${body.id}:subdomain`} body={body} showToast={showToast} onChanged={(subdomain) => onChanged({ ...registration, governingBody: { ...body, subdomain } })} />}
          {body && <GoverningBodyAdminsPanel key={`${body.id}:admins`} bodyId={body.id} showToast={showToast} />}

          {body && !isOff && (
            <section className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0 space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('gbr.deactivate.section')}</h3>
                <p className="text-[13px] font-medium text-slate-500 mt-1 leading-relaxed">{t('gbr.deactivate.lead')}</p>
              </div>
              <ReasonBox id="gbOffReason" label={t('gbr.deactivate.reason')} hint={t('gbr.deactivate.reason.hint')} value={reason} onChange={typeReason} error={reasonError} />
              <Button type="button" variant="dangerOutline" disabled={isSending} onClick={() => askFor('deactivate')}>
                {t('gbr.deactivate.action')}
              </Button>
            </section>
          )}

          {body && isOff && (
            <section className="bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm min-w-0 space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{t('gbr.reactivate.section')}</h3>
                <p className="text-[13px] font-medium text-slate-500 mt-1 leading-relaxed">{t('gbr.reactivate.lead')}</p>
              </div>
              <Facts className="-mt-1">
                <Fact label={t('admin.field.deactivatedAt')}>{asDate(body.deactivatedAt)}</Fact>
                <Fact label={t('admin.field.deactivationReason')} wide>
                  {body.deactivationReason}
                </Fact>
              </Facts>
              <ReasonBox id="gbOnNote" label={t('gbr.reactivate.note')} hint={t('gbr.reactivate.note.hint')} value={reason} onChange={typeReason} error={reasonError} />
              <Button type="button" isLoading={isSending} onClick={() => askFor('reactivate')}>
                {t('gbr.reactivate.action')}
              </Button>
            </section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirming !== null}
        title={t(confirm.title, { name })}
        body={t(confirm.body, { name })}
        confirmLabel={t(confirm.label)}
        cancelLabel={t('common.cancel')}
        tone={confirm.tone}
        busy={isSending}
        busyLabel={t('gbr.saving')}
        onCancel={() => setConfirming(null)}
        onConfirm={() => decide(confirming)}
      />
    </div>
  );
};

export default GoverningBodyReview;
