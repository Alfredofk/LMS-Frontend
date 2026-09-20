import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import AuthLayout from '../../layouts/AuthLayout';
import { authService } from '../../services/authService';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Toast from '../../components/ui/Toast';

/*
  Where the link in the verification email should land.

  Today it does not: mailer.js:154 points the link at
  ${APP_BASE_URL}/api/auth/verify-email?token=..., which is the backend endpoint,
  so clicking it shows somebody raw JSON with no way back. That URL is the
  backend author's to change — this page is the destination waiting for it, and
  can be reached in the meantime by pasting the token into /verify-email?token=.

  The endpoint is a plain GET that claims the token, so opening this page IS the
  verification. Nothing here asks for a password: a link from an inbox proves the
  address, and that is all this step is for.
*/

const MailIcon = ({ state }) => (
  <div
    className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm ${
      state === 'error' ? 'bg-red-50 text-red-500' : 'bg-brand-tint text-brand'
    }`}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
      {state === 'error' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      )}
    </svg>
  </div>
);

export const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useT();
  const token = searchParams.get('token');

  const [state, setState] = useState('checking'); // checking · error
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [toast, setToast] = useState(null);

  /*
    Claiming the token is not idempotent from the UI's point of view — it is a
    one-shot side effect, and StrictMode runs effects twice in development. The
    backend does answer `alreadyVerified` on a second claim, so a double call
    would still read correctly, but firing it twice is noise this page has no
    reason to make.
  */
  const claimed = useRef(false);

  useEffect(() => {
    if (claimed.current) return;
    claimed.current = true;

    if (!token) {
      setState('error');
      setMessage(t('verify.error.noToken'));
      return;
    }

    /*
      Succeeding here is not worth a screen of its own. Claiming the token gives
      no session — the endpoint returns { verified, message } and no tokens — so
      the only thing left to do is sign in, and a page whose single control says
      "sign in now" is a door with a doorman. Go straight through it, and let the
      sign-in form carry the good news.
    */
    authService
      .verifyEmail(token)
      .then(() => navigate('/login', { replace: true, state: { verified: true } }))
      .catch((err) => {
        setState('error');
        setMessage(apiErrorMessage(err, t));
      });
  }, [token, navigate, t]);

  /*
    A link expires after 24 hours (mailer.js:155-156), so an expired one is the
    likeliest way to arrive at the error state. This page has no idea whose link
    it was — the token is opaque and the request failed — so the address has to
    be asked for.
  */
  const handleResend = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsResending(true);
    try {
      await authService.resendVerification(email.trim());
      setToast({
        message: t('checkEmail.resent', { email: email.trim() }),
        type: 'success',
      });
    } catch {
      setToast({ message: t('checkEmail.resendFailed'), type: 'error' });
    } finally {
      setIsResending(false);
    }
  };

  const heading = {
    checking: ['verify.checking.title', 'verify.checking.titleAccent'],
    error: ['verify.error.title', 'verify.error.titleAccent'],
  }[state];

  const footer = (
    <button
      type="button"
      onClick={() => navigate('/login')}
      className="text-xs text-slate-400 hover:text-brand font-bold transition-colors focus:outline-none cursor-pointer"
    >
      {t('common.backToSignIn')}
    </button>
  );

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <AuthLayout
        heading={t('verify.panel.heading')}
        blurb={t('verify.panel.blurb')}
        footer={footer}
      >
        <MailIcon state={state} />

        <div>
          <h1 className="text-3xl sm:text-[34px] font-extrabold text-slate-800 leading-tight select-none">
            {t(heading[0])} <span className="text-brand">{t(heading[1])}</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-2 font-semibold">
            {state === 'checking' ? t('verify.checking.note') : message}
          </p>
        </div>

        {state === 'error' && (
          <form onSubmit={handleResend} className="border border-slate-200 rounded-2xl p-5 text-left bg-white shadow-sm space-y-3">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {t('verify.resend.label')}
              </span>
              <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">
                {t('verify.resend.hint')}
              </p>
            </div>

            <Input
              id="resendEmail"
              type="email"
              placeholder={t('auth.field.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <Button
              type="submit"
              isLoading={isResending}
              className="w-full py-3 rounded-2xl justify-center text-sm active:scale-95 transition-transform shadow-lg shadow-brand/20 select-none"
            >
              {t('verify.resend.action')}
            </Button>
          </form>
        )}
      </AuthLayout>
    </>
  );
};

export default VerifyEmailPage;
