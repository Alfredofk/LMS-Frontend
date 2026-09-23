import React from 'react';
import Button from '../../components/ui/Button';
import { useT } from '../../i18n/LanguageContext';

/*
  The step between registering and signing in.

  It exists because registering does not sign anybody in: the backend sends a
  link and refuses sign-in until it is opened (403 EMAIL_NOT_VERIFIED). Dropping
  somebody onto a login form at this moment tells them nothing about why the
  password they just chose does not work, so this screen says what happened, to
  which address, and what remains to be done.

  "I have verified" simply tries to sign in with the credentials just typed —
  there is no endpoint that reports verification status without authenticating,
  so the attempt is the check.
*/

const EnvelopeMark = () => (
  <div className="w-16 h-16 bg-brand-tint rounded-2xl flex items-center justify-center text-brand mb-5 mx-auto shadow-sm">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  </div>
);

export const CheckEmailStep = ({ formState }) => {
  const {
    registeredEmail,
    email,
    errors,
    isLoading,
    isResending,
    handleVerifiedContinue,
    handleResendVerification,
    setAuthStep,
  } = formState;
  const { t } = useT();

  const target = registeredEmail || email;

  return (
    <div className="w-full max-w-[420px] mx-auto text-center">
      <EnvelopeMark />

      <h2 className="text-[26px] font-extrabold text-slate-800 leading-tight select-none">
        {t('checkEmail.title')} <span className="text-brand">{t('checkEmail.titleAccent')}</span>
      </h2>
      <p className="text-slate-400 text-sm mt-2 mb-6 font-medium select-none">
        {t('checkEmail.subtitle')}
      </p>

      {errors.global && (
        <div className="mb-5 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-2xl text-sm text-amber-800 text-left flex items-start gap-2.5 shadow-sm" role="alert">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{errors.global}</span>
        </div>
      )}

      <div className="border border-slate-200 rounded-2xl p-5 text-left bg-white shadow-sm space-y-3">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {t('checkEmail.sentTo')}
          </span>
          <p className="text-base font-extrabold text-slate-800 mt-0.5 break-all">{target}</p>
        </div>

        <p className="text-xs text-slate-400 font-medium leading-relaxed">
          {t('checkEmail.hint')}
        </p>
      </div>

      <Button
        onClick={handleVerifiedContinue}
        className="w-full py-3 md:py-3.5 rounded-2xl justify-center text-sm md:text-base active:scale-95 transition-transform mt-5 shadow-lg shadow-brand/20 select-none"
        isLoading={isLoading}
      >
        <span className="flex items-center gap-1">
          {t('checkEmail.verified')}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mt-0.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </span>
      </Button>

      <Button
        variant="outline"
        onClick={handleResendVerification}
        isDisabled={isResending}
        className="w-full justify-center gap-2 border border-slate-200 py-3 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm text-slate-700 font-semibold text-sm md:text-base mt-3"
      >
        {isResending ? t('common.sending') : t('checkEmail.resend')}
      </Button>

      <button
        type="button"
        onClick={() => setAuthStep('sign_in')}
        className="mt-5 text-xs text-slate-400 hover:text-brand font-bold transition-colors focus:outline-none cursor-pointer"
      >
        {t('common.backToSignIn')}
      </button>
    </div>
  );
};

export default CheckEmailStep;
