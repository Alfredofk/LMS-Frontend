import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { authService } from '../../services/authService';
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
      state === 'error' ? 'bg-red-50 text-red-500' : 'bg-[#F1EEFF] text-[#7047EB]'
    }`}
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
      {state === 'error' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      ) : state === 'success' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      )}
    </svg>
  </div>
);

export const VerifyEmailPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [state, setState] = useState('checking'); // checking · success · error
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
      setMessage('This link is missing its token. Open the link from your email directly.');
      return;
    }

    authService
      .verifyEmail(token)
      .then((data) => {
        setState('success');
        setMessage(data?.message ?? 'Email verified. You can sign in now.');
      })
      .catch((err) => {
        setState('error');
        setMessage(err.message || 'This link is no longer valid.');
      });
  }, [token]);

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
        message: `If ${email.trim()} has an account, a new link is on its way.`,
        type: 'success',
      });
    } catch (err) {
      setToast({ message: err.message || 'Could not send the link.', type: 'error' });
    } finally {
      setIsResending(false);
    }
  };

  const heading = {
    checking: ['Verifying your', 'email'],
    success: ['Email', 'verified'],
    error: ['This link did not', 'work'],
  }[state];

  return (
    <div className="min-h-screen lg:h-screen w-screen bg-[#6D43EC] flex flex-col lg:flex-row font-sans selection:bg-violet-500 selection:text-white relative lg:overflow-hidden">

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* --- PURPLE SIDEBAR COLUMN --- */}
      <div className="w-full text-white flex flex-col justify-between p-8 sm:p-12 relative shrink-0 z-0 text-left select-none bg-[#6D43EC] lg:w-[35%] lg:h-full lg:order-1 lg:overflow-hidden">
        <div className="text-2xl font-black tracking-tight text-left">
          MikeKwok
        </div>

        <div className="relative my-auto space-y-6 max-w-sm z-10 shrink-0">
          <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight">
            {state === 'success' ? 'You Are In' : 'Almost There'}
          </h2>
          <p className="text-sm sm:text-base text-violet-100/90 leading-relaxed font-medium">
            {state === 'success'
              ? 'Your address is confirmed. Sign in and MikeKwok is yours to use.'
              : 'Confirming an address is what keeps an account tied to a person a school can recognise.'}
          </p>
        </div>

        {/* Hidden below lg: stacked on a phone the purple panel is a short band,
            and a white disc behind white copy simply erases it. */}
        <div className="hidden lg:block absolute bottom-[-130px] left-[-130px] w-64 h-64 rounded-full bg-white pointer-events-none" />
      </div>

      {/* --- WHITE CARD COLUMN --- */}
      <div className="w-full bg-white min-h-screen lg:h-full lg:overflow-y-auto flex flex-col justify-between p-6 sm:p-8 lg:py-8 lg:px-12 relative shrink-0 z-10 shadow-2xl lg:w-[65%] lg:order-2 lg:rounded-l-[48px] lg:rounded-r-none">

        <div className="absolute top-0 left-0 w-28 h-28 bg-[#6D43EC] rounded-br-full pointer-events-none" />
        <div className="absolute top-10 left-36 w-3 h-3 bg-[#6D43EC] rounded-full opacity-60 pointer-events-none" />
        <div className="absolute top-1/4 left-[-16px] w-12 h-12 bg-[#ECE9FE] rounded-full pointer-events-none" />
        <div className="absolute top-16 right-10 w-14 h-14 bg-[#ECE9FE] rounded-full pointer-events-none opacity-80" />

        <div className="h-[40px] z-10 shrink-0" />

        <div className="my-auto w-full z-10 py-2 shrink-0">
          <div className="w-full max-w-[420px] mx-auto text-center space-y-6">

            <MailIcon state={state} />

            <div>
              <h1 className="text-3xl sm:text-[34px] font-extrabold text-slate-800 leading-tight select-none">
                {heading[0]} <span className="text-[#7047EB]">{heading[1]}</span>
              </h1>
              <p className="text-slate-400 text-xs sm:text-sm mt-2 font-semibold">
                {state === 'checking' ? 'One moment…' : message}
              </p>
            </div>

            {state === 'success' && (
              <Button
                onClick={() => navigate('/login', { replace: true })}
                className="w-full py-3.5 rounded-2xl justify-center font-bold text-base bg-[#7047EB] hover:bg-[#5E3BD2] text-white active:scale-95 transition-transform shadow-lg shadow-[#7047EB]/20 select-none"
              >
                <span className="flex items-center gap-1">
                  Sign in now
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </span>
              </Button>
            )}

            {state === 'error' && (
              <form onSubmit={handleResend} className="border border-slate-200 rounded-2xl p-5 text-left bg-white shadow-sm space-y-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Send a new link
                  </span>
                  <p className="text-xs text-slate-400 font-medium mt-1 leading-relaxed">
                    A link expires 24 hours after it is sent. Enter the address you registered
                    with and we will send another.
                  </p>
                </div>

                <Input
                  id="resendEmail"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />

                <Button
                  type="submit"
                  isLoading={isResending}
                  className="w-full py-3 rounded-2xl justify-center font-bold text-sm bg-[#7047EB] hover:bg-[#5E3BD2] text-white active:scale-95 transition-transform shadow-lg shadow-[#7047EB]/20 select-none"
                >
                  Send the link
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* Bottom Footer Section */}
        <div className="mt-4 z-10 text-center shrink-0">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-xs text-slate-400 hover:text-[#7047EB] font-bold transition-colors focus:outline-none cursor-pointer"
          >
            Back to sign in
          </button>
        </div>

      </div>

    </div>
  );
};

export default VerifyEmailPage;
