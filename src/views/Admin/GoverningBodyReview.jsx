import React, { useState } from 'react';
import { ArrowLeft, Check, X, PowerOff, RotateCcw } from 'lucide-react';

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

const Row = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-2 border-b border-slate-100 last:border-0">
    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">{label}</span>
    <span className="text-xs font-semibold text-slate-800 text-right break-words min-w-0">{children ?? '-'}</span>
  </div>
);

const ReasonBox = ({ id, label, hint, value, onChange, error, tone = 'slate' }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className={`text-sm font-semibold block ${tone === 'rose' ? 'text-rose-900' : 'text-slate-700'}`}>
      {label}
    </label>
    <textarea
      id={id}
      rows={3}
      maxLength={MAX_REASON}
      value={value}
      onChange={onChange}
      className={`block w-full rounded-xl border bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 ${
        tone === 'rose' ? 'border-rose-200 hover:border-rose-300 focus:ring-rose-400/20 focus:border-rose-400' : 'border-slate-200 hover:border-slate-300 focus:ring-brand/20 focus:border-brand'
      }`}
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

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-6">
          {body && (
            <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-2">{t('gbr.section.body')}</h3>
              <Row label={t('gbr.field.name')}>{body.name}</Row>
              <Row label={t('gb.kind')}>{kindWord(body.kind)}</Row>
              {/* A foundation or an association from before c79b56f has none until corrected. */}
              <Row label={t('gb.npyp')}>
                {body.npyp ?? (body.kind !== 'GOVERNMENT' ? <span className="text-amber-700 font-extrabold">{t('gbr.npyp.missing')}</span> : null)}
              </Row>
              <Row label={t('gb.skNumber')}>{body.skNumber}</Row>
              <Row label={t('gb.code')}>{body.code}</Row>
              <Row label={t('gbr.field.subdomain')}>{siteAddress ?? body.subdomain}</Row>
              <Row label={t('gbr.field.state')}>
                <span className={isOff ? 'text-rose-600 font-extrabold' : 'text-emerald-600 font-extrabold'}>{t(isOff ? 'gbr.state.off' : 'gbr.state.on')}</span>
              </Row>
            </section>
          )}

          <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-2">{t('gbr.section.registration')}</h3>
            <Row label={t('gb.kind')}>{kindWord(registration.kind)}</Row>
            <Row label={t('gbr.field.name')}>{registration.name}</Row>
            <Row label={t('gb.npyp')}>{registration.npyp}</Row>
            <Row label={t('gb.skNumber')}>{registration.skNumber}</Row>
            <Row label={t('gb.address')}>{addressLineOf(registration.address) || null}</Row>
            <Row label={t('admin.field.status')}>{t(`admin.status.${registration.status}`)}</Row>
            <Row label={t('admin.field.submitted')}>{asDate(registration.createdAt)}</Row>
            {registration.reviewedAt && <Row label={t('admin.field.reviewed')}>{asDate(registration.reviewedAt)}</Row>}
            {registration.rejectionReason && <Row label={t('admin.field.rejectionReason')}>{registration.rejectionReason}</Row>}
          </section>

          <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-900 tracking-tight mb-2">{t('admin.section.applicant')}</h3>
            <Row label={t('admin.field.name')}>{registration.applicant?.fullName}</Row>
            <Row label={t('admin.field.email')}>{registration.applicant?.email}</Row>
            <Row label={t('admin.field.phone')}>{registration.applicantPhone}</Row>
          </section>
        </div>

        <div className="space-y-6">
          <div className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-6">
            <GoverningBodyFileViewer key={`${registration.id}:ktp`} registrationId={registration.id} which="ktp" has={registration.hasKtp} decided={!isPending} />
            <GoverningBodyFileViewer key={`${registration.id}:proof`} registrationId={registration.id} which="proof" has={registration.hasProof} decided={!isPending} />
          </div>

          {isPending && (
            <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4">
              <ReasonBox id="gbReason" label={t('gbr.reject.reason')} hint={t('gbr.reject.reason.hint')} value={reason} onChange={typeReason} error={reasonError} />
              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="button" isLoading={isSending} onClick={() => askFor('approve')} className="flex-1 py-3 rounded-2xl justify-center text-sm gap-1.5">
                  <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {t('gbr.approve')}
                </Button>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => askFor('reject')}
                  className="flex-1 py-3 rounded-2xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <X className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {t('gbr.reject')}
                </button>
              </div>
            </section>
          )}

          {body && <GoverningBodyCorrectionPanel key={`${body.id}:${body.name}:${body.kind}:${body.npyp}:${body.skNumber}`} body={body} showToast={showToast} onSaved={(next) => onChanged({ ...registration, governingBody: next })} onStale={onStale} />}

          {/* Its address and its admins (backend 3d7d05a/8aff4f4; owner 2026-10-24). */}
          {body && <SubdomainPanel key={`${body.id}:subdomain`} body={body} showToast={showToast} onChanged={(subdomain) => onChanged({ ...registration, governingBody: { ...body, subdomain } })} />}
          {body && <GoverningBodyAdminsPanel key={`${body.id}:admins`} bodyId={body.id} showToast={showToast} />}

          {body && !isOff && (
            <section className="border border-rose-200 rounded-2xl p-5 bg-rose-50/40 shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-rose-900 tracking-tight">{t('gbr.deactivate.section')}</h3>
                <p className="text-xs font-semibold text-rose-700/80 mt-1 leading-relaxed">{t('gbr.deactivate.lead')}</p>
              </div>
              <ReasonBox id="gbOffReason" tone="rose" label={t('gbr.deactivate.reason')} hint={t('gbr.deactivate.reason.hint')} value={reason} onChange={typeReason} error={reasonError} />
              <button
                type="button"
                disabled={isSending}
                onClick={() => askFor('deactivate')}
                className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <PowerOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                {t('gbr.deactivate.action')}
              </button>
            </section>
          )}

          {body && isOff && (
            <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{t('gbr.reactivate.section')}</h3>
                <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">{t('gbr.reactivate.lead')}</p>
              </div>
              <div className="rounded-xl border border-rose-200 bg-rose-50/50 px-4 py-3">
                <Row label={t('admin.field.deactivatedAt')}>{asDate(body.deactivatedAt)}</Row>
                <Row label={t('admin.field.deactivationReason')}>{body.deactivationReason}</Row>
              </div>
              <ReasonBox id="gbOnNote" label={t('gbr.reactivate.note')} hint={t('gbr.reactivate.note.hint')} value={reason} onChange={typeReason} error={reasonError} />
              <Button type="button" isLoading={isSending} onClick={() => askFor('reactivate')} className="w-full py-3 rounded-2xl justify-center text-sm gap-1.5">
                <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
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
