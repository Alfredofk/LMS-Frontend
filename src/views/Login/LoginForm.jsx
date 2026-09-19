import React from 'react';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { passwordChecklist } from '../../utils/validation';
import CheckEmailStep from './CheckEmailStep';

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
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#8F7CFF]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  email: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#8F7CFF]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  lock: (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-[#8F7CFF]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  ),
};

const BrandMark = () => (
  <div className="w-16 h-16 bg-[#F1EEFF] rounded-2xl flex items-center justify-center text-[#7047EB] mb-5 mx-auto shadow-sm">
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 4L4 10L12 16L20 10L12 4Z" fill="currentColor" fillOpacity="0.9" />
      <path d="M7 13.5L12 17.5L17 13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

const PasswordRules = ({ value }) => (
  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 pt-0.5" aria-live="polite">
    {passwordChecklist(value).map((rule) => (
      <li
        key={rule.label}
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
        {rule.label}
      </li>
    ))}
  </ul>
);

export const LoginForm = ({ formState }) => {
  const {
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
    unverifiedEmail,
    isResending,
    handleResendVerification,
    handleAuthSubmit,
    handleGoogleAuth,
  } = formState;

  /*
    The step between registering and signing in has nothing in common with a
    form — no fields, no submit — so it replaces this card rather than adding a
    third branch to everything below.
  */
  if (isCheckEmail) return <CheckEmailStep formState={formState} />;

  return (
    <div className="w-full max-w-[420px] mx-auto text-center">
      <BrandMark />

      <h1 className="text-[26px] font-extrabold text-slate-800 leading-tight select-none">
        {isSignUp ? (
          <>Create your <span className="text-[#7047EB]">account</span></>
        ) : (
          <>Welcome <span className="text-[#7047EB]">back</span></>
        )}
      </h1>
      <p className="text-slate-400 text-sm mt-2 mb-8 font-medium select-none">
        {isSignUp
          ? 'Start your journey with MikeKwok'
          : 'Sign in to continue to MikeKwok'}
      </p>

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
                {isResending ? 'Sending…' : 'Send the confirmation link again'}
              </button>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleAuthSubmit} className="space-y-[15px] text-left">
        {isSignUp && (
          <Input
            id="fullName"
            type="text"
            placeholder="Enter your full name"
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
          type="email"
          placeholder="Enter your email"
          required
          icon={icons.email}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />

        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          required
          icon={icons.lock}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />

        {isSignUp && (
          <>
            <PasswordRules value={password} />

            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              required
              icon={icons.lock}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
          </>
        )}

        <Button
          type="submit"
          className="w-full py-3 md:py-3.5 rounded-2xl justify-center font-bold text-sm md:text-base bg-[#7047EB] hover:bg-[#5E3BD2] active:scale-95 transition-transform mt-5 shadow-lg shadow-[#7047EB]/20 text-white select-none"
          isLoading={isLoading}
        >
          <span className="flex items-center gap-1">
            Continue
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </span>
        </Button>
      </form>

      <div className="flex items-center justify-center gap-3 my-5">
        <span className="h-px bg-slate-100 flex-1" />
        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider select-none">or</span>
        <span className="h-px bg-slate-100 flex-1" />
      </div>

      <Button
        variant="outline"
        onClick={handleGoogleAuth}
        className="w-full justify-center gap-2 border border-slate-200 py-3 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm text-slate-700 font-semibold text-sm md:text-base"
      >
        {icons.google}
        Continue with Google
      </Button>
    </div>
  );
};

export default LoginForm;
