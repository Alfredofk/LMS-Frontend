import React, { useState } from 'react';
import { Crown } from 'lucide-react';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { adminService } from '../../services/adminService';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { validateEmail, fieldErrorsFrom } from '../../utils/validation';

/*
  A Platform Admin appointing a school's Principal — backend 1416e24 (owner,
  2026-09-27). For when the Principal cannot hand the school over themselves:
  unreachable, gone, or a school restored without one. The Principal's own way
  is the hand-over card on their Settings.

  The admin sees no member list, so the successor is named by the **email of an
  active teacher** at that school, and the admin gives a reason (3–500), which
  is audited. The server says whether that email is such a teacher; this form
  does not guess. Whoever held PRINCIPAL loses it — one who also teaches stays
  as a teacher, one holding nothing else leaves with this reason — so the
  confirmation says so.
*/
const MIN_REASON = 3;
const MAX_REASON = 500;

const APPOINT_BY_MESSAGE = [
  ['No active teacher of this school uses that email', 'admin.appoint.error.noTeacher'],
  ['already the Principal', 'admin.appoint.error.alreadyPrincipal'],
  ['must be an active teacher', 'admin.appoint.error.noTeacher'],
  ['Only an approved registration', 'admin.appoint.error.notApproved'],
];

const AppointPrincipalPanel = ({ registration, showToast }) => {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [done, setDone] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    const emailFail = validateEmail(email);
    if (emailFail) next.email = t(emailFail.key, emailFail.vars);
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON) next.reason = t('admin.appoint.reason.required');
    else if (trimmed.length > MAX_REASON) next.reason = t('admin.reject.reason.long');
    setErrors(next);
    if (Object.keys(next).length === 0) setConfirming(true);
  };

  const appoint = async () => {
    setIsSending(true);
    try {
      const answer = await adminService.appointPrincipal(registration.id, email.trim().toLowerCase(), reason.trim());
      setConfirming(false);
      setDone(answer?.principal?.fullName ?? '');
      setEmail('');
      setReason('');
      setErrors({});
      showToast?.(t('admin.appoint.done', { name: answer?.principal?.fullName ?? '', school: registration.schoolName }), 'success');
    } catch (err) {
      setConfirming(false);
      const fields = fieldErrorsFrom(err.details, ['email', 'reason']);
      if (Object.keys(fields).length) {
        setErrors(fields);
      } else {
        const hit = APPOINT_BY_MESSAGE.find(([needle]) => String(err?.message ?? '').includes(needle));
        setErrors({ global: hit ? t(hit[1]) : apiErrorMessage(err, t) });
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <Crown className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{t('admin.appoint.section')}</h3>
          <p className="text-xs font-semibold text-slate-500 mt-1 leading-relaxed">{t('admin.appoint.lead')}</p>
        </div>
      </div>

      {done !== null && (
        <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-800" role="status">
          {t('admin.appoint.done', { name: done, school: registration.schoolName })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          id="appointEmail"
          name="email"
          type="email"
          label={t('admin.appoint.email')}
          autoComplete="off"
          value={email}
          error={errors.email || undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            setErrors((prev) => ({ ...prev, email: null, global: null }));
          }}
        />
        <div className="space-y-1.5">
          <label htmlFor="appointReason" className="text-sm font-semibold text-slate-700 block">
            {t('admin.appoint.reason')}
          </label>
          <textarea
            id="appointReason"
            rows={3}
            maxLength={MAX_REASON}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setErrors((prev) => ({ ...prev, reason: null, global: null }));
            }}
            className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
          />
          {errors.reason ? (
            <span className="text-xs text-red-500 font-medium" role="alert">{errors.reason}</span>
          ) : (
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('admin.appoint.reason.hint')}</p>
          )}
        </div>

        {errors.global && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
            {errors.global}
          </div>
        )}

        <Button type="submit" variant="outline" isLoading={isSending} className="w-full justify-center">
          {t('admin.appoint.action')}
        </Button>
      </form>

      <ConfirmDialog
        open={confirming}
        tone="danger"
        title={t('admin.appoint.confirm.title', { school: registration.schoolName })}
        body={t('admin.appoint.confirm.body', { email: email.trim().toLowerCase(), school: registration.schoolName })}
        confirmLabel={t('admin.appoint.action')}
        cancelLabel={t('common.cancel')}
        busy={isSending}
        busyLabel={t('common.loading')}
        onConfirm={appoint}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
};

export default AppointPrincipalPanel;
