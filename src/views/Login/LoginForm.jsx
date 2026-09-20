import React from 'react';
import { Link } from 'react-router-dom';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import BrandMark from '../../components/ui/BrandMark';
import PasswordRules from '../../components/ui/PasswordRules';
import { useT } from '../../i18n/LanguageContext';
import CheckEmailStep from './CheckEmailStep';
import GoogleButton from './GoogleButton';
import DevSignIn from '../../components/dev/DevSignIn';

/*
  One form, two modes.

  What used to live here — a teacher tab posting its own fetch to
  /api/auth/teacher/login, an NPSN field for principals, a School Code field for
  students — described a backend that does not exist. Signing in is an email and
  a password, for everybody. Which school somebody belongs to, and what they may
  do there, is decided by their membership after they are in, not by what they
  type on this screen.
*/

const icons = {
  user: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-brand/70">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  email: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-brand/70">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  lock: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-brand/70">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
};

export const LoginForm = ({ formState, notice }) => {
  const {
    authStep,
    isSignUp,
    isCheckEmail,
    fullName,
    setFullName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    errors,
    isLoading,
    remember,
    setRemember,
    unverifiedEmail,
    isResending,
    handleResendVerification,
    handleAuthSubmit,
    handleGoogleCredential,
  } = formState;
  const { t } = useT();

  /*
    The step between registering and signing in has nothing in common with a
    form — no fields, no submit — so it replaces this card rather than adding a
    third branch to everything below.
  */
  if (isCheckEmail) return <CheckEmailStep formState={formState} />;

  return (
    <div className="w-full max-w-[420px] mx-auto text-center">
      <BrandMark size="lg" tone="soft" className="mb-5 mx-auto" />

      <h1 className="text-[26px] font-extrabold text-slate-800 leading-tight select-none">
        {isSignUp ? (
          <>{t('auth.signUp.title')} <span className="text-brand">{t('auth.signUp.titleAccent')}</span></>
        ) : (
          <>{t('auth.signIn.title')} <span className="text-brand">{t('auth.signIn.titleAccent')}</span></>
        )}
      </h1>
      <p className="text-slate-400 text-sm mt-2 mb-8 font-medium select-none">
        {isSignUp
          ? t('auth.signUp.subtitle')
          : t('auth.signIn.subtitle')}
      </p>

      {/* Something good that just happened elsewhere — today, an email that was
          verified a moment ago on /verify-email. An error below outranks it. */}
      {notice && !errors.global && (
        <div className="mb-5 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-r-2xl text-sm text-emerald-800 text-left flex items-start gap-2.5 shadow-sm" role="status">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{notice}</span>
        </div>
      )}

      {errors.global && (
        <div className="mb-5 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700 text-left flex items-start gap-2.5 shadow-sm" role="alert">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <div className="space-y-2">
            <span className="block">{errors.global}</span>

            {/* Only a 403 EMAIL_NOT_VERIFIED puts an address here, so this offer
                appears exactly when it can actually help. */}
            {unverifiedEmail && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isResending}
                className="font-extrabold text-red-800 underline underline-offset-2 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none cursor-pointer"
              >
                {isResending ? t('common.sending') : t('auth.resendLink')}
              </button>
            )}
          </div>
        </div>
      )}

      {/*
        The key matters. Without it React keeps the same <input> nodes across
        sign-up and sign-in and only swaps their autocomplete attribute — and a
        password field Chrome has already filed as "new-password" stops offering
        saved credentials for the rest of the session. That is why arriving
        straight at Sign In showed saved emails and switching to it did not.
        A new key means a new form, judged fresh.
      */}
      <form key={authStep} onSubmit={handleAuthSubmit} className="space-y-[15px] text-left">
        {isSignUp && (
          <Input
            id="fullName"
            name="fullName"
            type="text"
            placeholder={t('auth.field.fullName')}
            required
            icon={icons.user}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
            autoComplete="name"
          />
        )}

        <Input
          id="email"
          name="email"
          type="email"
          placeholder={t('auth.field.email')}
          required
          icon={icons.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete={isSignUp ? 'email' : 'username'}
        />

        <Input
          id="password"
          name="password"
          type="password"
          placeholder={t('auth.field.password')}
          required
          icon={icons.lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />

        {isSignUp ? (
          <>
            <PasswordRules value={password} />

            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder={t('auth.field.confirmPassword')}
              required
              icon={icons.lock}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
          </>
        ) : (
          /*
            Sign-in only. On the sign-up form "Remember me" would be answering a
            question nobody has reached yet — registering does not start a
            session — and "Forgot password?" would be asking about a password
            being chosen on that very screen.
          */
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-brand accent-brand focus:ring-2 focus:ring-brand/20 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">
                {t('auth.rememberMe')}
              </span>
            </label>

            <Link
              to="/forgot-password"
              className="text-xs font-extrabold text-brand hover:text-brand-deep hover:underline focus:outline-none focus:underline"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>
        )}

        <Button
          type="submit"
          className="w-full py-3 md:py-3.5 rounded-2xl justify-center text-sm md:text-base active:scale-95 transition-transform mt-5 shadow-lg shadow-brand/20 select-none"
          isLoading={isLoading}
        >
          <span className="flex items-center gap-1">
            {t('common.continue')}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </Button>
      </form>

      <div className="flex items-center justify-center gap-3 my-5">
        <span className="h-px bg-slate-100 flex-1" />
        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider select-none">{t('common.or')}</span>
        <span className="h-px bg-slate-100 flex-1" />
      </div>

      {/*
        Google renders this one itself. The custom button that used to sit here
        was ours in style but a lie in substance — it called a mock. Their button
        is what the ID-token flow expects and what their branding rules ask for.
      */}
      <GoogleButton
        onCredential={handleGoogleCredential}
        disabled={isLoading}
        /*
          Google's own wording for each form. Sign-in keeps "continue" rather
          than "sign in" on purpose: the backend creates an account when the
          Google address is new to it, so this button really can register
          somebody standing on the sign-in form.
        */
        text={isSignUp ? 'signup_with' : 'continue_with'}
      />

      {/* Renders nothing unless this is `npm run dev` — see the file. */}
      <DevSignIn />
    </div>
  );
};

export default LoginForm;
