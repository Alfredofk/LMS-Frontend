import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import AuthLayout from '../../layouts/AuthLayout';
import { authService } from '../../services/authService';
import { validateEmail } from '../../utils/validation';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

/*
  Ask for a reset link.

  The backend answers this endpoint identically whether or not the address has an
  account (auth.controller.js:56-59, the SILENT_REPLY). That silence is the whole
  point, and this page has to keep it: writing "We sent you an email" would tell
  anybody willing to type addresses into a form which of them are registered.

  So the confirmation below never confirms. It says what would have happened if
  the address has an account, and stops there.
*/

const KeyMark = () => (
  <div className="w-16 h-16 bg-brand-tint rounded-2xl flex items-center justify-center text-brand mx-auto shadow-sm">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  </div>
);

const SentMark = () => (
  <div className="w-16 h-16 bg-brand-tint rounded-2xl flex items-center justify-center text-brand mx-auto shadow-sm">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  </div>
);

export const ForgotPasswordPage = () => {
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const invalid = validateEmail(email);
    if (invalid) {
      setError(t(invalid.key, invalid.vars));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authService.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      /*
        A failure here is the network or the server, never "no such account" —
        that case is a success as far as this endpoint is concerned.
      */
      setError(apiErrorMessage(err, t));
    } finally {
      setIsLoading(false);
    }
  };

  const footer = (
    <Link
      to="/login"
      className="text-xs text-slate-500 hover:text-brand font-bold transition-colors focus:outline-none"
    >
      {t('common.backToSignIn')}
    </Link>
  );

  if (sent) {
    return (
      /*
        Both halves of this page live at /forgot-password, so the pathname —
        which is what `transitionKey` falls back to — cannot tell them apart.
        Without a key of its own, pressing "send the link" swapped the whole
        panel and card in one frame, with none of the entrance the rest of the
        auth screens have. Same reason /login passes its step.
      */
      <AuthLayout
        transitionKey="sent"
        heading={t('forgot.sent.panelHeading')}
        blurb={t('forgot.sent.panelBlurb')}
        footer={footer}
      >
        <SentMark />

        <div>
          <h2 className="text-3xl sm:text-[34px] font-extrabold text-slate-800 leading-tight select-none">
            {t('forgot.sent.title')} <span className="text-brand">{t('forgot.sent.titleAccent')}</span>
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-2 font-semibold break-all">
            {email.trim()}
          </p>
        </div>

        <div className="border border-slate-200 rounded-2xl p-5 text-left bg-white shadow-sm space-y-3">
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            {t('forgot.sent.body')}
          </p>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            {t('forgot.sent.hint')}
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => setSent(false)}
          className="w-full justify-center border border-slate-200 py-3 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm text-slate-700 font-semibold text-sm"
        >
          {t('forgot.sent.other')}
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      transitionKey="form"
      heading={t('forgot.panel.heading')}
      blurb={t('forgot.panel.blurb')}
      footer={footer}
    >
      <KeyMark />

      <div>
        <h2 className="text-3xl sm:text-[34px] font-extrabold text-slate-800 leading-tight select-none">
          {t('forgot.title')} <span className="text-brand">{t('forgot.titleAccent')}</span>
        </h2>
        <p className="text-slate-500 text-xs sm:text-sm mt-2 font-semibold">
          {t('forgot.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <Input
          id="email"
          type="email"
          placeholder={t('auth.field.email')}
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          error={error}
          autoComplete="email"
        />

        <Button
          type="submit"
          isLoading={isLoading}
          className="w-full py-3.5 rounded-2xl justify-center text-base active:scale-95 transition-transform shadow-lg shadow-brand/20 select-none"
        >
          <span className="flex items-center gap-1">
            {t('forgot.action')}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
