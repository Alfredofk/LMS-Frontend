import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import AuthLayout from '../../layouts/AuthLayout';
import { authService } from '../../services/authService';
import { validatePassword, passwordChecklist } from '../../utils/validation';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

/*
  Choose a new password from an emailed link.

  Two calls, not one. The GET only asks whether the token is still usable, so the
  form is never rendered for a link that cannot work; the POST spends it. An
  unusable token does not come back as { valid: false } — the backend throws
  BAD_REQUEST (auth.service.js, loadUsableResetToken), so the branch is in the
  catch.

  Succeeding here revokes every refresh token the account holds and returns no
  new pair, so there is deliberately nothing to continue into: the last screen
  says so and sends them to sign in.

  Today the emailed link points at /api/auth/reset-password, the backend's own
  GET, which answers JSON and offers nowhere to type anything. Pointing it here
  is a one-line change in mailer.js:178 — the backend author's to make.
*/

const LockMark = ({ tone = 'brand' }) => (
  <div
    className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm ${
      tone === 'error' ? 'bg-red-50 text-red-500' : 'bg-[#F1EEFF] text-[#7047EB]'
    }`}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
      {tone === 'error' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      ) : tone === 'done' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      )}
    </svg>
  </div>
);

const PasswordRules = ({ value, t }) => (
  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 pt-0.5" aria-live="polite">
    {passwordChecklist(value).map((rule) => (
      <li
        key={rule.key}
        className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
          rule.met ? 'text-emerald-600' : 'text-slate-400'
        }`}
      >
        <span
          className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] shrink-0 ${
            rule.met ? 'bg-emerald-100' : 'bg-slate-100'
          }`}
          aria-hidden="true"
        >
          {rule.met ? '✓' : '•'}
        </span>
        {t(rule.key, rule.vars)}
      </li>
    ))}
  </ul>
);

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useT();
  const token = searchParams.get('token');

  const [state, setState] = useState('checking'); // checking · ready · rejected · done
  const [message, setMessage] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // StrictMode runs effects twice in development; checking a token twice is
  // harmless but pointless.
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    if (!token) {
      setState('rejected');
      setMessage(t('reset.rejected.noToken'));
      return;
    }

    authService
      .checkResetToken(token)
      .then(() => setState('ready'))
      .catch((err) => {
        setState('rejected');
        setMessage(apiErrorMessage(err, t));
      });
  }, [token, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const next = {};
    const passwordError = validatePassword(password);
    if (passwordError) next.password = t(passwordError.key, passwordError.vars);

    if (!confirmPassword) next.confirmPassword = t('validation.confirm.required');
    else if (password !== confirmPassword) next.confirmPassword = t('validation.confirm.mismatch');

    setErrors(next);
    if (Object.keys(next).length) return;

    setIsSaving(true);
    try {
      const data = await authService.resetPassword({ token, password });
      setMessage(data?.message ?? t('reset.done.fallback'));
      setState('done');
    } catch (err) {
      /*
        The token can expire between the check above and this submit — an hour is
        not long, and somebody may leave the form open. That comes back as the
        same BAD_REQUEST, and it belongs on the rejected screen, not as a field
        error under a password that was perfectly fine.
      */
      if (err.code === 'BAD_REQUEST' && !err.details) {
        setState('rejected');
        setMessage(err.message);
      } else {
        setErrors({ global: apiErrorMessage(err, t) });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const footer = (
    <Link
      to="/login"
      className="text-xs text-slate-400 hover:text-[#7047EB] font-bold transition-colors focus:outline-none"
    >
      {t('common.backToSignIn')}
    </Link>
  );

  if (state === 'checking') {
    return (
      <AuthLayout
        heading={t('reset.checking.panelHeading')}
        blurb={t('reset.checking.panelBlurb')}
        footer={footer}
      >
        <LockMark />
        <p className="text-slate-400 text-sm font-semibold">{t('reset.checking.note')}</p>
      </AuthLayout>
    );
  }

  if (state === 'rejected') {
    return (
      <AuthLayout
        heading={t('reset.rejected.panelHeading')}
        blurb={t('reset.rejected.panelBlurb')}
        footer={footer}
      >
        <LockMark tone="error" />

        <div>
          <h1 className="text-3xl sm:text-[34px] font-extrabold text-slate-800 leading-tight select-none">
            {t('reset.rejected.title')} <span className="text-[#7047EB]">{t('reset.rejected.titleAccent')}</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-2 font-semibold">{message}</p>
        </div>

        <Button
          onClick={() => navigate('/forgot-password')}
          className="w-full py-3.5 rounded-2xl justify-center font-bold text-base bg-[#7047EB] hover:bg-[#5E3BD2] text-white active:scale-95 transition-transform shadow-lg shadow-[#7047EB]/20 select-none"
        >
          {t('reset.rejected.action')}
        </Button>
      </AuthLayout>
    );
  }

  if (state === 'done') {
    return (
      <AuthLayout
        heading={t('reset.done.panelHeading')}
        blurb={t('reset.done.panelBlurb')}
        footer={footer}
      >
        <LockMark tone="done" />

        <div>
          <h1 className="text-3xl sm:text-[34px] font-extrabold text-slate-800 leading-tight select-none">
            {t('reset.done.title')} <span className="text-[#7047EB]">{t('reset.done.titleAccent')}</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-2 font-semibold">{message}</p>
        </div>

        <div className="border border-slate-200 rounded-2xl p-5 text-left bg-white shadow-sm">
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            {t('reset.done.body')}
          </p>
        </div>

        <Button
          onClick={() => navigate('/login', { replace: true })}
          className="w-full py-3.5 rounded-2xl justify-center font-bold text-base bg-[#7047EB] hover:bg-[#5E3BD2] text-white active:scale-95 transition-transform shadow-lg shadow-[#7047EB]/20 select-none"
        >
          <span className="flex items-center gap-1">
            {t('reset.done.action')}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      heading={t('reset.form.panelHeading')}
      blurb={t('reset.form.panelBlurb')}
      footer={footer}
    >
      <LockMark />

      <div>
        <h1 className="text-3xl sm:text-[34px] font-extrabold text-slate-800 leading-tight select-none">
          {t('reset.form.title')} <span className="text-[#7047EB]">{t('reset.form.titleAccent')}</span>
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-2 font-semibold">
          {t('reset.form.subtitle')}
        </p>
      </div>

      {errors.global && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700 text-left flex items-start gap-2.5 shadow-sm" role="alert">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{errors.global}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <Input
          id="password"
          type="password"
          placeholder={t('reset.form.newPassword')}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete="new-password"
        />

        <PasswordRules value={password} t={t} />

        <Input
          id="confirmPassword"
          type="password"
          placeholder={t('reset.form.confirm')}
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          autoComplete="new-password"
        />

        <Button
          type="submit"
          isLoading={isSaving}
          className="w-full py-3.5 rounded-2xl justify-center font-bold text-base bg-[#7047EB] hover:bg-[#5E3BD2] text-white active:scale-95 transition-transform shadow-lg shadow-[#7047EB]/20 select-none"
        >
          <span className="flex items-center gap-1">
            {t('reset.form.action')}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
