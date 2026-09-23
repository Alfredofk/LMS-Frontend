import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paperclip } from 'lucide-react';

import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { schoolService } from '../../services/schoolService';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage, registrationErrorMessage } from '../../i18n/apiError';
import { SCHOOL_TYPE_NAMES, choosesDuration, SCHOOL_TYPES } from '../../constants/schoolTypes';
import {
  validateNpsn,
  validateSchoolName,
  validateCity,
  validateApplicantPhone,
  validateDurationYears,
  validateKtpFile,
  fieldErrorsFrom,
} from '../../utils/validation';

/*
  Founding a school. The first form in this app that talks to a real endpoint
  nobody had to invent.

  Two things about it are unlike every other form here:

  It posts **multipart**, because the KTP photo travels in the same request —
  the backend has no separate upload endpoint, so there is no "upload then
  submit" flow to build. `apiClient` passes a FormData through untouched.

  And `durationYears` is conditional. Only an SMK chooses its length; every
  other type has one legal value that the server fills in itself, and sending a
  different one is a 400 rather than a correction. So the selector appears for
  SMK only, and for the other three the field is **not sent at all**.
*/

const OWNED_FIELDS = ['npsn', 'schoolName', 'schoolType', 'city', 'applicantPhone', 'durationYears', 'ktp'];

const TEXT_FIELDS = [
  { name: 'npsn', labelKey: 'reg.field.npsn', hintKey: 'reg.field.npsn.hint', inputMode: 'numeric', validate: validateNpsn },
  { name: 'schoolName', labelKey: 'reg.field.schoolName', validate: validateSchoolName },
  { name: 'city', labelKey: 'reg.field.city', validate: validateCity },
  { name: 'applicantPhone', labelKey: 'reg.field.phone', hintKey: 'reg.field.phone.hint', inputMode: 'tel', validate: validateApplicantPhone },
];

const selectClass =
  'block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 md:py-3 px-4 text-sm md:text-base text-slate-900 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand cursor-pointer';

export const SchoolRegistrationForm = () => {
  const navigate = useNavigate();
  const { t } = useT();
  const fileRef = useRef(null);

  const [values, setValues] = useState({ schoolType: 'SMA' });
  const [ktp, setKtp] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSending, setIsSending] = useState(false);

  const needsDuration = choosesDuration(values.schoolType);

  const setError = (name, fail) =>
    setErrors((prev) => ({ ...prev, [name]: fail ? t(fail.key, fail.vars) : null }));

  const checkAll = () => {
    const next = {};
    for (const field of TEXT_FIELDS) {
      const fail = field.validate(values[field.name] ?? '');
      if (fail) next[field.name] = t(fail.key, fail.vars);
    }

    const durationFail = validateDurationYears(values.schoolType, values.durationYears);
    if (durationFail) next.durationYears = t(durationFail.key, durationFail.vars);

    const ktpFail = validateKtpFile(ktp);
    if (ktpFail) next.ktp = t(ktpFail.key, ktpFail.vars);

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSending) return;

    setTouched(Object.fromEntries(OWNED_FIELDS.map((name) => [name, true])));
    if (!checkAll()) return;

    const body = new FormData();
    body.append('npsn', values.npsn.trim());
    body.append('schoolName', values.schoolName.trim());
    body.append('schoolType', values.schoolType);
    body.append('city', values.city.trim());
    body.append('applicantPhone', values.applicantPhone.trim());
    /* Omitted entirely for SD, SMP and SMA — see the note at the top. */
    if (needsDuration) body.append('durationYears', String(values.durationYears));
    body.append('ktp', ktp);

    setIsSending(true);
    try {
      await schoolService.submitRegistration(body);
      /*
        No success toast: the navigation below unmounts this form, so a toast
        would vanish in the same frame. /select-role reads the registration back
        and shows the Organization card as pending — a state that stays put is a
        better confirmation than a flash that does not.
      */
      navigate('/select-role', { replace: true });
    } catch (err) {
      /*
        A zod failure names its fields; every other failure is one sentence for
        the whole form. CONFLICT needs its own reading — four unrelated things
        share that code here, see i18n/apiError.js.
      */
      const fieldErrors = fieldErrorsFrom(err.details, OWNED_FIELDS);
      if (Object.keys(fieldErrors).length) {
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      } else {
        setErrors((prev) => ({
          ...prev,
          global:
            err.code === 'CONFLICT'
              ? registrationErrorMessage(err, t)
              : apiErrorMessage(err, t),
        }));
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-slate-200 rounded-2xl p-5 text-left bg-white shadow-sm space-y-4"
    >
      {errors.global && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700 flex items-start gap-2.5" role="alert">
          <span>{errors.global}</span>
        </div>
      )}

      {TEXT_FIELDS.map((field) => (
        <div key={field.name} className="space-y-1">
          <Input
            id={field.name}
            name={field.name}
            label={t(field.labelKey)}
            type="text"
            inputMode={field.inputMode}
            autoComplete="off"
            spellCheck={false}
            value={values[field.name] ?? ''}
            error={errors[field.name] || undefined}
            onChange={(e) => {
              const next = e.target.value;
              setValues((prev) => ({ ...prev, [field.name]: next }));
              if (touched[field.name]) setError(field.name, field.validate(next));
            }}
            onBlur={(e) => {
              setTouched((prev) => ({ ...prev, [field.name]: true }));
              setError(field.name, field.validate(e.target.value));
            }}
          />
          {field.hintKey && !errors[field.name] && (
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              {t(field.hintKey)}
            </p>
          )}
        </div>
      ))}

      <div className="space-y-1.5">
        <label htmlFor="schoolType" className="text-sm font-semibold text-slate-700 block">
          {t('reg.field.schoolType')}
        </label>
        <select
          id="schoolType"
          name="schoolType"
          value={values.schoolType}
          onChange={(e) => {
            const schoolType = e.target.value;
            /* Changing type can make a previously valid duration illegal, and
               can make the field disappear entirely. Clear it either way. */
            setValues((prev) => ({ ...prev, schoolType, durationYears: '' }));
            setErrors((prev) => ({ ...prev, durationYears: null }));
          }}
          className={selectClass}
        >
          {SCHOOL_TYPE_NAMES.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {needsDuration && (
        <div className="space-y-1.5">
          <label htmlFor="durationYears" className="text-sm font-semibold text-slate-700 block">
            {t('reg.field.duration')}
          </label>
          <select
            id="durationYears"
            name="durationYears"
            value={values.durationYears ?? ''}
            onChange={(e) => {
              const next = e.target.value;
              setValues((prev) => ({ ...prev, durationYears: next }));
              setError('durationYears', validateDurationYears(values.schoolType, next));
            }}
            className={selectClass}
          >
            <option value="">—</option>
            {SCHOOL_TYPES[values.schoolType].allowedDurationYears.map((years) => (
              <option key={years} value={years}>{t('reg.field.duration.years', { n: years })}</option>
            ))}
          </select>
          {errors.durationYears ? (
            <span className="text-xs text-red-500 font-medium" role="alert">{errors.durationYears}</span>
          ) : (
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              {t('reg.field.duration.hint')}
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="ktp" className="text-sm font-semibold text-slate-700 block">
          {t('reg.field.ktp')}
        </label>

        <input
          ref={fileRef}
          id="ktp"
          name="ktp"
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            setKtp(file);
            setTouched((prev) => ({ ...prev, ktp: true }));
            setError('ktp', validateKtpFile(file));
          }}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 hover:border-brand px-4 py-3 text-xs font-bold text-slate-600 hover:text-brand transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <Paperclip className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{ktp ? ktp.name : t('reg.field.ktp.choose')}</span>
        </button>

        {errors.ktp ? (
          <span className="text-xs text-red-500 font-medium" role="alert">{errors.ktp}</span>
        ) : (
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
            {t('reg.field.ktp.hint')}
          </p>
        )}

        {/*
          Somebody is about to upload a photo of their identity card. They are
          entitled to know what happens to it before they choose the file, not
          in a policy page afterwards — the backend deletes it the moment a
          decision is made (schema.prisma, citing UU PDP 27/2022).
        */}
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3">
          {t('reg.field.ktp.privacy')}
        </p>
      </div>

      <Button
        type="submit"
        isLoading={isSending}
        className="w-full py-3.5 rounded-2xl justify-center text-base active:scale-95 transition-transform select-none"
      >
        {isSending ? t('reg.submitting') : t('reg.submit')}
      </Button>
    </form>
  );
};

export default SchoolRegistrationForm;
