import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserCheck } from 'lucide-react';

import ModalHeading, { BusyLabel, ModalError } from '../../components/ui/ModalHeading';
import SelectField from '../../components/ui/SelectField';
import { modalActions, modalCancelClass, modalConfirmClass } from '../../components/ui/modalStyles';
import { useT } from '../../i18n/LanguageContext';
import { validateLeaveReason } from '../../utils/validation';
import { principalFateOf, successorsOf } from './schoolPowers';

/*
  Making a Teacher the School's Principal (backend 261a9c7, ticket 08; owner 2026-10-26,
  E2): the School's Teachers but the one sitting, from the teacher list (`teachers`, read
  by the caller as the dialog opens), each by name and NIP / NUPTK, and a reason of 3-500.
  It says what follows: the Principal before stays as a teacher or may leave, and the
  applications waiting there close. With no teacher to pick it says the School gets one
  only through an application.

  Built like ReasonDialog: portal, alertdialog, Escape and the backdrop answering "no"
  except while the request runs. `onSubmit(membershipId, reason)` makes the call and
  closes it; a throw is said inside, through `describeError`.
*/
export const AppointPrincipalDialog = ({ school, teachers, onClose, onSubmit, describeError }) => {
  const { t } = useT();
  const baseId = useId();
  const [membershipId, setMembershipId] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const openerRef = useRef(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
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

  const candidates = successorsOf(teachers);
  const fate = principalFateOf(school, teachers);
  const replacing = Boolean(school.hasPrincipal);
  const ids = { title: `${baseId}-title`, body: `${baseId}-body`, reason: `${baseId}-reason`, hint: `${baseId}-hint` };

  const submit = async () => {
    const found = {};
    if (!membershipId) found.membershipId = t('gbpw.appoint.pick');
    const failed = validateLeaveReason(reason);
    if (failed) found.reason = t(failed.key, failed.vars);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await onSubmit(membershipId, reason.trim());
    } catch (err) {
      setBusy(false);
      setErrors({ global: describeError(err) });
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={busy ? undefined : onClose}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-describedby={ids.body}
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
      >
        <ModalHeading
          tone="brand"
          icon={UserCheck}
          titleId={ids.title}
          title={t(replacing ? 'gbpw.appoint.titleReplace' : 'gbpw.appoint.title', { school: school.name })}
          bodyId={ids.body}
          body={
            <>
              {fate && <p>{t(fate.fate === 'STAYS' ? 'gbpw.fate.stays' : 'gbpw.fate.mayLeave', { name: fate.name })}</p>}
              {school.principalApplicationsWaiting > 0 && <p className="mt-1.5">{t('gbpw.appoint.closesApplications', { n: school.principalApplicationsWaiting })}</p>}
            </>
          }
        />

        {candidates.length === 0 ? (
          <p className="text-sm font-medium text-slate-600 leading-relaxed">{t(replacing ? 'gbpw.appoint.noOtherTeacher' : 'gbpw.appoint.noTeacher')}</p>
        ) : (
          <>
            <SelectField
              id={`${baseId}-teacher`}
              label={t('gbpw.appoint.teacher')}
              value={membershipId}
              error={errors.membershipId}
              disabled={busy}
              onChange={(e) => {
                setMembershipId(e.target.value);
                setErrors((prev) => ({ ...prev, membershipId: null, global: null }));
              }}
            >
              <option value="">{t('gbpw.appoint.choose')}</option>
              {candidates.map((teacher) => (
                <option key={teacher.membershipId} value={teacher.membershipId}>
                  {[teacher.fullName, teacher.nip ? `NIP ${teacher.nip}` : teacher.nuptk ? `NUPTK ${teacher.nuptk}` : null].filter(Boolean).join(' - ')}
                </option>
              ))}
            </SelectField>

            <div className="space-y-1.5">
              <label htmlFor={ids.reason} className="text-sm font-semibold text-slate-700 block">
                {t('gba.reason')}
              </label>
              <textarea
                id={ids.reason}
                rows={3}
                maxLength={500}
                value={reason}
                disabled={busy}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (errors.reason || errors.global) setErrors((prev) => ({ ...prev, reason: null, global: null }));
                }}
                aria-invalid={!!errors.reason}
                aria-describedby={ids.hint}
                className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50"
              />
              {errors.reason ? (
                <ModalError id={ids.hint}>{errors.reason}</ModalError>
              ) : (
                <p id={ids.hint} className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  {t('gbpw.reason.hint')}
                </p>
              )}
            </div>
          </>
        )}

        {errors.global && (
          <ModalError>{errors.global}</ModalError>
        )}

        <div className={modalActions}>
          <button type="button" onClick={onClose} disabled={busy} className={modalCancelClass(busy)}>
            {t('common.cancel')}
          </button>
          {candidates.length > 0 && (
            <button type="button" onClick={submit} disabled={busy} className={modalConfirmClass('brand', busy)}>
              <BusyLabel busy={busy}>{t(replacing ? 'gbpw.appoint.confirmReplace' : 'gbpw.appoint.confirm')}</BusyLabel>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default AppointPrincipalDialog;
