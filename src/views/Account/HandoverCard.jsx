import React, { startTransition, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown } from 'lucide-react';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SelectField from '../../components/ui/SelectField';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { academicsService } from '../../services/academicsService';
import { membersService } from '../../services/membersService';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { handoverErrorMessage } from '../../i18n/apiError';
import { heldRolesOf, homeFor, ROLES } from '../../constants/roles';
import { teacherIdErrors, nestedFieldErrors } from '../../utils/validation';

/*
  Handing the school to a new Principal — backend 1416e24 (owner, 2026-09-27).

  Until then a Principal could not leave at all (LeaveCard says why), and a
  school whose Principal moved on had nobody to run it. Now:

  - **The successor is an active teacher here** — `GET /academics/teachers`, the
    same list a homeroom teacher is picked from, minus the reader. The server
    refuses anybody else (a student, a guardian, somebody already Principal).
  - **At once, no approval.** The reader stops being Principal on the spot; the
    successor takes over at their next sign-in.
  - **Stay or leave.** Staying keeps the reader as a teacher — a Principal who
    does not hold TEACHER gives a NIP or NUPTK, as adding that role always asks.
    Leaving ends the membership, and is refused while the reader is homeroom of a
    class in an active year: those classes need another homeroom teacher first.

  Afterwards the token still claims PRINCIPAL, so it is traded in. Staying, the
  reader lands on the dashboard of the role they now hold (TEACHER, by the
  default order); leaving, on /select-role, which says the membership ended.
*/
const HandoverCard = () => {
  const navigate = useNavigate();
  const { membership, refreshMe } = useAuth();
  const { t } = useT();

  const teaches = heldRolesOf(membership).includes(ROLES.TEACHER);
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';

  const [teachers, setTeachers] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [values, setValues] = useState({ successor: '', stay: 'stay', nip: '', nuptk: '' });
  const [errors, setErrors] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    academicsService
      .teachers()
      .then((list) => !cancelled && setTeachers(list))
      .catch((err) => !cancelled && setLoadError(handoverErrorMessage(err, t)));
    return () => {
      cancelled = true;
    };
  }, [t]);

  const candidates = (teachers ?? []).filter((entry) => entry.membershipId !== membership?.id);
  const successor = candidates.find((entry) => entry.membershipId === values.successor) ?? null;
  const staying = values.stay === 'stay';
  const needsIds = staying && !teaches;

  const change = (name) => (e) => {
    const { value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: null, global: null }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const next = {};
    if (!successor) next.successor = t('handover.error.chooseSuccessor');
    if (needsIds) {
      const ids = teacherIdErrors(values.nip, values.nuptk);
      if (ids.nip) next.nip = t(ids.nip.key, ids.nip.vars);
      if (ids.nuptk) next.nuptk = t(ids.nuptk.key, ids.nuptk.vars);
    }
    setErrors(next);
    if (Object.keys(next).length === 0) setConfirming(true);
  };

  const handover = async () => {
    setIsWorking(true);
    try {
      const teacher = {};
      if (values.nip.trim()) teacher.nip = values.nip.trim();
      if (values.nuptk.trim()) teacher.nuptk = values.nuptk.trim();
      await membersService.handover(successor.membershipId, {
        stay: staying,
        ...(needsIds ? { teacher } : {}),
      });

      /* The token still names PRINCIPAL; trade it before going anywhere. */
      try {
        await authService.refresh();
      } catch {
        /* requireActiveMembership reads the database; the old claim grants nothing. */
      }
      if (!staying) {
        navigate('/select-role', { replace: true });
        return;
      }
      const session = await refreshMe().catch(() => null);
      startTransition(() => navigate(homeFor(session?.activeRole ?? ROLES.TEACHER), { replace: true }));
    } catch (err) {
      setConfirming(false);
      setIsWorking(false);
      const fields = nestedFieldErrors(err.details, ['nip', 'nuptk']);
      setErrors(Object.keys(fields).length ? fields : { global: handoverErrorMessage(err, t) });
    }
  };

  return (
    <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4 text-left">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <Crown className="w-4 h-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">{t('handover.title')}</h2>
          <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">
            {t('handover.body', { school: schoolName })}
          </p>
        </div>
      </div>

      {loadError ? (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
          {loadError}
        </div>
      ) : teachers === null ? (
        <div className="h-24 bg-slate-50 rounded-2xl animate-pulse" aria-label={t('common.loading')} />
      ) : candidates.length === 0 ? (
        <p className="text-xs font-semibold text-slate-600 leading-relaxed">{t('handover.noTeachers')}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <SelectField
            id="handoverSuccessor"
            label={t('handover.successor')}
            value={values.successor}
            onChange={change('successor')}
            error={errors.successor}
          >
            <option value="">{t('handover.successor.choose')}</option>
            {candidates.map((entry) => (
              <option key={entry.membershipId} value={entry.membershipId}>
                {entry.fullName}
              </option>
            ))}
          </SelectField>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-slate-700">{t('handover.after')}</legend>
            {['stay', 'leave'].map((option) => (
              <label
                key={option}
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                  values.stay === option ? 'border-brand bg-brand-tint/40' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="handoverAfter"
                  value={option}
                  checked={values.stay === option}
                  onChange={change('stay')}
                  className="mt-0.5 accent-brand"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-slate-800">{t(`handover.after.${option}`)}</span>
                  <span className="block text-xs text-slate-500 font-medium leading-relaxed">
                    {t(`handover.after.${option}.hint`, { school: schoolName })}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {needsIds && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">{t('handover.teacherIds')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  id="handover-nip"
                  name="nip"
                  label={t('getStarted.join.field.nip')}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  value={values.nip}
                  error={errors.nip || undefined}
                  onChange={change('nip')}
                />
                <Input
                  id="handover-nuptk"
                  name="nuptk"
                  label={t('getStarted.join.field.nuptk')}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  value={values.nuptk}
                  error={errors.nuptk || undefined}
                  onChange={change('nuptk')}
                />
              </div>
            </div>
          )}

          {errors.global && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
              {errors.global}
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" variant="outline">
              {t('handover.open')}
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirming}
        tone="danger"
        title={t('handover.confirm.title', { name: successor?.fullName ?? '' })}
        body={`${t('handover.confirm.body', { name: successor?.fullName ?? '' })} ${t(
          staying ? 'handover.confirm.stay' : 'handover.confirm.leave',
          { school: schoolName }
        )}`}
        confirmLabel={t('handover.confirm.go')}
        cancelLabel={t('common.cancel')}
        busy={isWorking}
        busyLabel={t('common.loading')}
        onConfirm={handover}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
};

export default HandoverCard;
