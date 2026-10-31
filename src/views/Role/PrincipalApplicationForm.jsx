import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Building2, Check } from 'lucide-react';

import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { FileField } from './GoverningBodyRegistrationForm';
import { membershipService } from '../../services/membershipService';
import { principalApplicationService } from '../../services/principalApplicationService';
import { useAccountPhone } from '../../hooks/useAccountPhone';
import { useT } from '../../i18n/LanguageContext';
import { joinErrorMessage, principalApplicationErrorMessage } from '../../i18n/apiError';
import { fieldErrorsFrom, normaliseSchoolCode, validateSchoolCode } from '../../utils/validation';
import { fileError, typeOfFile } from './bodyRegistration';
import { applicationErrors, applicationFormData, takesApplication } from './principalApplication';
import AuthMessageIcon from '../../components/ui/AuthMessageIcon';

/*
  Applying to be the Principal of a Governing Body's School (backend e206bd9,
  governing-body ticket 06; owner 2026-10-26, A1-A8): /get-started/principal, linked
  from /select-role and My Profile, and from the join form when a code turns out to
  take only this (`state.schoolCode`, looked up at once).

  Two steps, as joining: `POST /memberships/lookup` names the School and its body
  first; a School that takes no application (`principalWanted` false: independent, or
  one with a Principal) says so and points at the teacher's way in. Then the phone
  (the account's, until typed in) and the KTP, one multipart
  `POST /principal-applications`. Any admin of the body decides, and sees the name,
  email, phone and KTP - the second step says so.
*/
export const PrincipalApplicationForm = ({ doneTo = '/select-role', teacherPath = '/get-started/teacher' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useT();
  const accountPhone = useAccountPhone();

  const handed = location.state?.schoolCode ?? '';
  const [code, setCode] = useState(handed);
  const [school, setSchool] = useState(null);
  const [phoneTyped, setPhoneTyped] = useState(null);
  const [ktp, setKtp] = useState(null);
  const [ktpType, setKtpType] = useState(null);
  const [errors, setErrors] = useState({});
  const [isWorking, setIsWorking] = useState(false);

  const phone = phoneTyped ?? accountPhone ?? '';
  const say = (fail) => (fail ? t(fail.key, fail.vars) : null);

  const lookup = async (typed) => {
    const fail = validateSchoolCode(typed);
    if (fail) {
      setErrors({ schoolCode: say(fail) });
      return;
    }
    setErrors({});
    setIsWorking(true);
    try {
      const found = await membershipService.lookupSchool(normaliseSchoolCode(typed));
      if (!found?.name) setErrors({ schoolCode: t('error.unknown') });
      else setSchool(found);
    } catch (err) {
      setErrors({ schoolCode: joinErrorMessage(err, t) });
    } finally {
      setIsWorking(false);
    }
  };

  /* A code handed over by the join form is looked up once, without a second press. */
  const lookedUp = useRef(false);
  useEffect(() => {
    if (!handed || lookedUp.current) return;
    lookedUp.current = true;
    lookup(handed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, for the code handed over
  }, [handed]);

  const pickKtp = async (file) => {
    setKtp(file);
    const type = file ? await typeOfFile(file).catch(() => null) : null;
    setKtpType(type);
    setErrors((prev) => ({ ...prev, ktp: say(fileError('ktp', file, type)) }));
  };

  const apply = async (e) => {
    e.preventDefault();
    if (isWorking) return;

    const found = applicationErrors({ applicantPhone: phone });
    const ktpFail = fileError('ktp', ktp, ktpType);
    if (ktpFail) found.ktp = ktpFail;
    const shown = Object.fromEntries(Object.entries(found).map(([name, fail]) => [name, say(fail)]));
    setErrors(shown);
    if (Object.keys(shown).length > 0) return;

    setIsWorking(true);
    try {
      await principalApplicationService.apply(applicationFormData(code, phone, ktp));
      navigate(doneTo, { replace: true });
    } catch (err) {
      const field = err?.details?.field;
      const fieldErrors = fieldErrorsFrom(err.details, ['applicantPhone']);
      if (field === 'ktp') {
        const message = String(err.message ?? '');
        const key = message.includes('at most') ? 'gbreg.ktp.tooLarge' : message.includes('is required') ? 'gbreg.ktp.required' : 'gbreg.ktp.type';
        setErrors({ ktp: t(key, { max: '2 MB' }) });
      } else if (Object.keys(fieldErrors).length) {
        setErrors(fieldErrors);
      } else {
        setErrors({ global: principalApplicationErrorMessage(err, t) });
      }
      setIsWorking(false);
    }
  };

  const changeCode = () => {
    setSchool(null);
    setErrors({});
  };

  if (!school) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!isWorking) lookup(code);
        }}
        className="space-y-5 text-left"
        noValidate
      >
        <Input
          id="schoolCode"
          name="schoolCode"
          label={t('pa.need.code')}
          type="text"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
          placeholder={t('getStarted.join.field.codePlaceholder')}
          value={code}
          error={errors.schoolCode || undefined}
          onChange={(e) => {
            setCode(e.target.value);
            if (errors.schoolCode) setErrors({});
          }}
        />
        <p className="text-xs text-slate-500 font-medium leading-relaxed">{t('pa.code.hint')}</p>
        <Button type="submit" size="lg" className="w-full" isLoading={isWorking}>
          {t('pa.lookup')}
        </Button>
      </form>
    );
  }

  const schoolCard = (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-brand-tint/60 border border-brand/20">
      <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm">
        <Building2 className="w-4 h-4 text-brand" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-slate-900 leading-tight break-words">{school.name}</p>
        <p className="mt-1 flex flex-wrap gap-x-2.5 text-xs font-semibold text-slate-600">
          <span>{school.schoolType}</span>
          {school.city && <span>{school.city}</span>}
        </p>
        {school.governingBody?.name && <p className="mt-0.5 text-xs font-semibold text-slate-600 break-words">{t('pa.underBody', { body: school.governingBody.name })}</p>}
        <button
          type="button"
          onClick={changeCode}
          className="mt-1.5 text-[11px] font-extrabold text-brand hover:text-brand-deep underline underline-offset-2 cursor-pointer focus:outline-none"
        >
          {t('getStarted.join.action.changeCode')}
        </button>
      </div>
      <Check className="w-4 h-4 text-brand shrink-0 mt-2.5" aria-hidden="true" />
    </div>
  );

  if (!takesApplication(school)) {
    return (
      <div className="space-y-5 text-left">
        {schoolCard}
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-900 font-semibold leading-relaxed" role="status">
          <p>{t('pa.notWanted')}</p>
          <p className="mt-1.5 text-xs">
            {t('pa.notWanted.teacher')}{' '}
            <Link
              to={teacherPath}
              className="font-extrabold text-brand hover:text-brand-deep underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
            >
              {t('pa.notWanted.teacherLink')}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={apply} className="space-y-5 text-left" noValidate>
      {schoolCard}

      {errors.global && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700 text-left flex items-start gap-2.5" role="alert">
          <AuthMessageIcon tone="error" />
          <span>{errors.global}</span>
        </div>
      )}

      <div className="space-y-1">
        <Input
          id="applicantPhone"
          name="applicantPhone"
          label={t('reg.field.phone')}
          type="text"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          error={errors.applicantPhone || undefined}
          onChange={(e) => {
            setPhoneTyped(e.target.value);
            if (errors.applicantPhone) setErrors((prev) => ({ ...prev, applicantPhone: say(applicationErrors({ applicantPhone: e.target.value }).applicantPhone) }));
          }}
          onBlur={() => setErrors((prev) => ({ ...prev, applicantPhone: say(applicationErrors({ applicantPhone: phone }).applicantPhone) }))}
        />
        {!errors.applicantPhone && <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('pa.phone.hint')}</p>}
      </div>

      <FileField
        id="ktp"
        label={t('reg.field.ktp')}
        hint={t('gbreg.ktp.hint')}
        accept="image/jpeg,image/png"
        file={ktp}
        error={errors.ktp}
        chooseLabel={t('reg.field.ktp.choose')}
        onPick={pickKtp}
      />

      <p className="text-xs text-slate-500 font-medium leading-relaxed">{t('pa.privacy')}</p>

      <Button type="submit" size="lg" className="w-full" isLoading={isWorking}>
        {t('pa.submit')}
      </Button>
    </form>
  );
};

export default PrincipalApplicationForm;
