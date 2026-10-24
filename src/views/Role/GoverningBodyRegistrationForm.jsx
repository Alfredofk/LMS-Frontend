import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paperclip } from 'lucide-react';

import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { governingBodyService } from '../../services/governingBodyService';
import { useAccountPhone } from '../../hooks/useAccountPhone';
import { useT } from '../../i18n/LanguageContext';
import { bodyRegistrationErrorMessage } from '../../i18n/apiError';
import { fieldErrorsFrom } from '../../utils/validation';
import {
  ADDRESS_FIELDS,
  BODY_KINDS,
  PROVINCES,
  fileError,
  registrationErrors,
  registrationFormData,
  registrationLineOf,
  takesNumbers,
  typeOfFile,
} from './bodyRegistration';

/*
  Registering a yayasan, perkumpulan or dinas (backend b5cfffd, `POST
  /api/governing-body-registrations`; owner 2026-10-24), on /get-started/governing-body.
  SchoolRegistrationForm's shape: multipart, one request carrying both files, checked
  here first by the rules in bodyRegistration.js and by the server again.

  - A foundation or an association gives its NPYP (required since backend c79b56f) and
    its SK number if it has one (optional since then); a government body sends neither
    (the schema refuses one).
  - The province is one of the 38; the postal code is optional.
  - The phone starts as the account's (`useAccountPhone`) until it is typed in.
  - Each file's type is read from its bytes as it is picked, as the server reads it.
  - One registration waits at a time: arriving with one waiting goes back.

  No success toast: the page it goes back to says "sedang ditinjau" in the link's place.
*/

const OWNED_FIELDS = ['kind', 'name', 'npyp', 'skNumber', 'street', 'village', 'district', 'city', 'province', 'postalCode', 'applicantPhone', 'ktp', 'proof'];

const FileField = ({ id, label, hint, accept, file, error, onPick, chooseLabel }) => {
  const ref = useRef(null);
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-slate-700 block">
        {label}
      </label>
      <input ref={ref} id={id} name={id} type="file" accept={accept} className="sr-only" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="w-full flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 hover:border-brand px-4 py-3 text-xs font-bold text-slate-600 hover:text-brand transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Paperclip className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span className="truncate">{file ? file.name : chooseLabel}</span>
      </button>
      {error ? (
        <span className="text-xs text-red-600 font-medium" role="alert">
          {error}
        </span>
      ) : (
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{hint}</p>
      )}
    </div>
  );
};

/* The upload's own refusals carry `details.field`; their sentence says which rule. */
function uploadFieldError(err) {
  const field = err?.details?.field;
  if (field !== 'ktp' && field !== 'proof') return null;
  const message = String(err.message ?? '');
  if (message.includes('at most')) return { field, key: `gbreg.${field}.tooLarge`, vars: { max: field === 'ktp' ? '2 MB' : '5 MB' } };
  if (message.includes('is required')) return { field, key: `gbreg.${field}.required` };
  return { field, key: `gbreg.${field}.type` };
}

export const GoverningBodyRegistrationForm = ({ doneTo = '/select-role' }) => {
  const navigate = useNavigate();
  const { t } = useT();
  const accountPhone = useAccountPhone();

  const [values, setValues] = useState({ kind: 'FOUNDATION', province: '' });
  const [files, setFiles] = useState({ ktp: null, proof: null });
  const [types, setTypes] = useState({ ktp: null, proof: null });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSending, setIsSending] = useState(false);
  const [checked, setChecked] = useState(false);

  /* One waiting at a time: the server would refuse a second, so the form is not offered. */
  useEffect(() => {
    let cancelled = false;
    governingBodyService
      .listMine()
      .then((mine) => {
        if (!cancelled && registrationLineOf(mine).state === 'WAITING') navigate(doneTo, { replace: true });
      })
      .catch(() => {})
      .finally(() => !cancelled && setChecked(true));
    return () => {
      cancelled = true;
    };
  }, [doneTo, navigate]);

  /* The account's number, until the box is typed in. */
  const phone = values.applicantPhone ?? accountPhone ?? '';

  const current = { ...values, applicantPhone: phone };
  const say = (fail) => (fail ? t(fail.key, fail.vars) : null);
  const recheck = (next, name) => {
    if (!touched[name] && !errors[name]) return;
    setErrors((prev) => ({ ...prev, [name]: say(registrationErrors(next)[name]) }));
  };

  const setField = (name, value) => {
    const next = { ...current, [name]: value };
    setValues((prev) => ({ ...prev, [name]: value }));
    recheck(next, name);
  };

  const blur = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    setErrors((prev) => ({ ...prev, [name]: say(registrationErrors(current)[name]) }));
  };

  const pick = async (field, file) => {
    setFiles((prev) => ({ ...prev, [field]: file }));
    const type = file ? await typeOfFile(file).catch(() => null) : null;
    setTypes((prev) => ({ ...prev, [field]: type }));
    setErrors((prev) => ({ ...prev, [field]: say(fileError(field, file, type)) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSending) return;

    setTouched(Object.fromEntries(OWNED_FIELDS.map((name) => [name, true])));
    const found = registrationErrors(current);
    for (const field of ['ktp', 'proof']) {
      const fail = fileError(field, files[field], types[field]);
      if (fail) found[field] = fail;
    }
    const shown = Object.fromEntries(Object.entries(found).map(([name, fail]) => [name, say(fail)]));
    setErrors(shown);
    if (Object.keys(shown).length > 0) return;

    setIsSending(true);
    try {
      await governingBodyService.submitRegistration(registrationFormData(current, files));
      navigate(doneTo, { replace: true });
    } catch (err) {
      const upload = uploadFieldError(err);
      const fieldErrors = fieldErrorsFrom(err.details, OWNED_FIELDS);
      if (upload) setErrors((prev) => ({ ...prev, [upload.field]: t(upload.key, upload.vars) }));
      else if (Object.keys(fieldErrors).length) setErrors((prev) => ({ ...prev, ...fieldErrors }));
      else setErrors((prev) => ({ ...prev, global: bodyRegistrationErrorMessage(err, t) }));
    } finally {
      setIsSending(false);
    }
  };

  if (!checked) return <div className="h-64 rounded-2xl bg-slate-50 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;

  const textInput = (name, labelKey, extra = {}) => (
    <Input
      id={`gb-${name}`}
      name={name}
      label={t(labelKey)}
      type="text"
      autoComplete="off"
      value={current[name] ?? ''}
      error={errors[name] || undefined}
      onChange={(e) => setField(name, e.target.value)}
      onBlur={() => blur(name)}
      {...extra}
    />
  );

  return (
    <form onSubmit={handleSubmit} className="border border-slate-200 rounded-2xl p-5 text-left bg-white shadow-sm space-y-4" noValidate>
      {errors.global && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700" role="alert">
          {errors.global}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="gb-kind" className="text-sm font-semibold text-slate-700 block">
          {t('gb.kind')}
        </label>
        <Select
          id="gb-kind"
          name="kind"
          value={current.kind}
          onChange={(e) => {
            setField('kind', e.target.value);
            setErrors((prev) => ({ ...prev, npyp: null, skNumber: null }));
          }}
        >
          {BODY_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`gb.kind.${kind}`)}
            </option>
          ))}
        </Select>
      </div>

      {textInput('name', 'gbreg.field.name')}

      {takesNumbers(current.kind) ? (
        <>
          <div className="space-y-1">
            {textInput('npyp', 'gb.npyp', { spellCheck: false, maxLength: 6, autoCapitalize: 'characters' })}
            {!errors.npyp && <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('gbreg.field.npyp.hint')}</p>}
          </div>
          <div className="space-y-1">
            {textInput('skNumber', 'gbreg.field.skNumber.optional', { spellCheck: false })}
            {!errors.skNumber && <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('gbreg.field.skNumber.hint')}</p>}
          </div>
        </>
      ) : (
        <p className="text-xs font-medium text-slate-500 leading-relaxed">{t('gbreg.field.noSk')}</p>
      )}

      <fieldset className="space-y-4 rounded-2xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-700">{t('gb.address')}</legend>
        {ADDRESS_FIELDS.map((field) => (
          <React.Fragment key={field.name}>{textInput(field.name, `gbreg.field.${field.name}`)}</React.Fragment>
        ))}
        <div className="space-y-1.5">
          <label htmlFor="gb-province" className="text-sm font-semibold text-slate-700 block">
            {t('gbreg.field.province')}
          </label>
          <Select
            id="gb-province"
            name="province"
            value={current.province}
            invalid={!!errors.province}
            onChange={(e) => {
              setField('province', e.target.value);
              setErrors((prev) => ({ ...prev, province: null }));
            }}
          >
            <option value="">{t('gbreg.field.province.choose')}</option>
            {PROVINCES.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </Select>
          {errors.province && (
            <span className="text-xs text-red-600 font-medium" role="alert">
              {errors.province}
            </span>
          )}
        </div>
        {textInput('postalCode', 'gbreg.field.postalCode', { inputMode: 'numeric', maxLength: 5 })}
      </fieldset>

      <div className="space-y-1">
        {textInput('applicantPhone', 'reg.field.phone', { inputMode: 'tel' })}
        {!errors.applicantPhone && <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('gbreg.field.phone.hint')}</p>}
      </div>

      <FileField
        id="ktp"
        label={t('gbr.file.ktp')}
        hint={t('gbreg.ktp.hint')}
        accept="image/jpeg,image/png"
        file={files.ktp}
        error={errors.ktp}
        chooseLabel={t('reg.field.ktp.choose')}
        onPick={(file) => pick('ktp', file)}
      />
      <FileField
        id="proof"
        label={t('gbr.file.proof')}
        hint={t('gbreg.proof.hint')}
        accept="application/pdf,image/jpeg,image/png"
        file={files.proof}
        error={errors.proof}
        chooseLabel={t('gbreg.proof.choose')}
        onPick={(file) => pick('proof', file)}
      />

      <p className="text-[11px] text-slate-500 font-medium leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3">{t('gbreg.privacy')}</p>

      <Button type="submit" isLoading={isSending} className="w-full py-3.5 rounded-2xl justify-center text-base active:scale-95 transition-transform select-none">
        {isSending ? t('reg.submitting') : t('gbreg.submit')}
      </Button>
    </form>
  );
};

export default GoverningBodyRegistrationForm;
