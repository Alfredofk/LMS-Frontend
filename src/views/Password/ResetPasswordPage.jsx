import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import AuthLayout from '../../layouts/AuthLayout';
import { authService } from '../../services/authService';
import { validatePassword } from '../../utils/validation';
import PasswordRules from '../../components/ui/PasswordRules';
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
      tone === 'error' ? 'bg-red-50 text-red-500' : 'bg-brand-tint text-brand'
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

/*
  A dead link is a BAD_REQUEST, and so is a form with a bad field — one code,
  two very different sentences. The default is written for the form, because
  that is where BAD_REQUEST comes from nearly everywhere else: "some of your
  input was not accepted, check the fields again".

  Said to somebody who just clicked a link in their email, that is nonsense —
  there are no fields on this screen to check. And an expired link is not the
  rare case here; it is the likeliest way anyone arrives at this state at all.

  The sentence that belongs here was already written and had never been wired
  to anything. `apiErrorMessage` takes overrides for exactly this, the same way
  useLoginForm distinguishes a wrong password from an expired session.
*/
const LINK_DEAD = { BAD_REQUEST: 'reset.rejected.invalid' };

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useT();
  const token = searchParams.get('token');

  const [state, setState] = useState('checking'); // checking · ready · rejected · done
  /*
    What went wrong, not how to say it.

    This used to hold a finished sentence, translated at the moment the error
    happened. Switching language afterwards then left it in the old one while
    everything around it changed — and the language switch sits right there in
    the purple column, so the person most likely to use it is exactly the one
    reading a page in a language they did not want.

    Same rule the validators already follow: helpers hand back keys, and the
    caller decides which language to say them in.
  */
  const [problem, setProblem] = useState(null); // { key } | { err } | { text } | null

  const message = problem?.key
    ? t(problem.key)
    : problem?.err
      ? apiErrorMessage(problem.err, t, LINK_DEAD)
      : problem?.text ?? '';

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
      setProblem({ key: 'reset.rejected.noToken' });
      return;
    }

    authService
      .checkResetToken(token)
      .then(() => setState('ready'))
      .catch((err) => {
        setState('rejected');
        setProblem({ err });
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
      /* The server's own sentence when it sends one — it is the only party that
         knows what it just did — and our key when it does not. */
      setProblem(data?.message ? { text: data.message } : { key: 'reset.done.fallback' });
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
        /* Not `err.message`: that is the server's English, and this screen has
           an Indonesian sentence for the same thing. The server keeps its own
           words only where it disagrees with our validation — a link that ran
           out is not a disagreement. */
        setProblem({ key: 'reset.rejected.invalid' });
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
      className="text-xs text-slate-400 hover:text-brand font-bold transition-colors focus:outline-none"
    >
      {t('common.backToSignIn')}
    </Link>
  );

  if (state === 'checking') {
    return (
      <AuthLayout
        transitionKey={state}
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
        transitionKey={state}
        heading={t('reset.rejected.panelHeading')}
        blurb={t('reset.rejected.panelBlurb')}
        footer={footer}
      >
        <LockMark tone="error" />

        <div>
          <h1 className="text-3xl sm:text-[34px] font-extrabold text-slate-800 leading-tight select-none">
            {t('reset.rejected.title')} <span className="text-brand">{t('reset.rejected.titleAccent')}</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-2 font-semibold">{message}</p>
        </div>

        <Button
          onClick={() => navigate('/forgot-password')}
          className="w-full py-3.5 rounded-2xl justify-center font-bold text-base bg-brand hover:bg-brand-deep text-white active:scale-95 transition-transform shadow-lg shadow-brand/20 select-none"
        >
          {t('reset.rejected.action')}
        </Button>
      </AuthLayout>
    );
  }

  if (state === 'done') {
    return (
      <AuthLayout
        transitionKey={state}
        heading={t('reset.done.panelHeading')}
        blurb={t('reset.done.panelBlurb')}
        footer={footer}
      >
        <LockMark tone="done" />

        <div>
          <h1 className="text-3xl sm:text-[34px] font-extrabold text-slate-800 leading-tight select-none">
            {t('reset.done.title')} <span className="text-brand">{t('reset.done.titleAccent')}</span>
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
          className="w-full py-3.5 rounded-2xl justify-center font-bold text-base bg-brand hover:bg-brand-deep text-white active:scale-95 transition-transform shadow-lg shadow-brand/20 select-none"
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
    /* Four states, one URL. `transitionKey` is what lets each one arrive
       instead of appearing — the pathname is the same for all four. */
    <AuthLayout
      transitionKey={state}
      heading={t('reset.form.panelHeading')}
      blurb={t('reset.form.panelBlurb')}
      footer={footer}
    >
      <LockMark />

      <div>
        <h1 className="text-3xl sm:text-[34px] font-extrabold text-slate-800 leading-tight select-none">
          {t('reset.form.title')} <span className="text-brand">{t('reset.form.titleAccent')}</span>
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

        <PasswordRules value={password} />

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
          className="w-full py-3.5 rounded-2xl justify-center text-base active:scale-95 transition-transform shadow-lg shadow-brand/20 select-none"
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
