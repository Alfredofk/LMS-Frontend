import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import useLoginForm from '../../hooks/useLoginForm';
import LoginForm from './LoginForm';
import Toast from '../../components/ui/Toast';
import { homeFor } from '../../constants/roles';

/*
  The role cards that used to open this page now live at /select-role, after
  sign-in. They moved because registration does not take a role: the backend
  grants one through a school's approval, so a choice made here would have been
  a decoration that quietly promised access nobody had yet.
*/
const BRANDING = {
  sign_up: {
    heading: 'Create your MikeKwok account',
    bullets: [
      'One account, whatever your school calls you',
      'Your role is granted once a school approves you',
      'Classes, grades and schedules in one place',
    ],
  },
  check_email: {
    heading: 'One link away from MikeKwok',
    bullets: [
      'Open the link we just emailed you',
      'Come back here and continue — no retyping',
      'The link is good for 24 hours',
    ],
  },
  sign_in: {
    heading: 'Welcome back to MikeKwok',
    bullets: [
      'Pick up exactly where you left off',
      'Switch between your roles without signing out',
      'Everything from your school in one place',
    ],
  },
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialAuthStep = location.state?.step === 'sign_up' ? 'sign_up' : 'sign_in';

  /*
    Where somebody lands is decided by what they actually hold, not by anything
    they typed. No usable role at all — no school, or a membership still waiting
    on approval — means /no-school. Exactly one role is entered without asking.
    More than one, and only then, is worth a question.
  */
  const formState = useLoginForm(initialAuthStep, ({ roles, activeRole }) => {
    if (roles.length === 0) navigate('/no-school', { replace: true });
    else if (activeRole) navigate(homeFor(activeRole), { replace: true });
    else navigate('/select-role', { replace: true });
  });

  const { authStep, setAuthStep, isSignUp, isCheckEmail, toast, closeToast } = formState;
  const branding = BRANDING[authStep];

  return (
    <div className="min-h-screen lg:h-screen w-screen bg-[#6D43EC] flex flex-col lg:flex-row font-sans selection:bg-violet-500 selection:text-white relative lg:overflow-hidden">

      {/* Toast Alert Notifier container */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}

      {/* --- PURPLE SIDEBAR COLUMN --- */}
      <div className="w-full text-white flex-col justify-between p-8 sm:p-12 relative shrink-0 z-0 text-left select-none bg-[#6D43EC] hidden lg:flex lg:w-[38%] lg:h-full lg:order-2 lg:overflow-hidden">
        <div className="text-2xl font-black tracking-tight text-right">
          MikeKwok
        </div>

        <div className="my-auto space-y-6 max-w-sm ml-0 lg:ml-auto text-left lg:text-right pr-0 lg:pr-4 z-10 shrink-0">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
            {branding.heading}
          </h2>

          <ul className="space-y-4">
            {branding.bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex lg:flex-row-reverse items-start gap-3 text-violet-100 text-sm font-medium leading-relaxed"
              >
                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5 shadow-sm text-white font-bold text-xs select-none">
                  ✓
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-[-130px] right-[-130px] w-64 h-64 rounded-full bg-white pointer-events-none opacity-100" />
        <div className="absolute bottom-16 right-16 flex flex-col gap-2.5 pointer-events-none select-none">
          <div className="w-4 h-7 bg-white/20 rounded-full transform -rotate-45" />
          <div className="w-4 h-7 bg-white/20 rounded-full transform -rotate-45" />
          <div className="w-4 h-7 bg-white/20 rounded-full transform -rotate-45" />
        </div>
      </div>

      {/* --- WHITE FORM CONTAINER --- */}
      <div className="w-full bg-white min-h-screen lg:h-full lg:overflow-y-auto flex flex-col justify-between p-6 sm:p-8 lg:py-8 lg:px-12 relative shrink-0 z-10 shadow-2xl lg:w-[62%] lg:order-1 lg:rounded-r-[48px] lg:rounded-l-none">

        {/* Decorative Shapes inside White Card */}
        <div className="absolute top-0 left-0 w-28 h-28 bg-[#6D43EC] rounded-br-full pointer-events-none" />
        <div className="absolute top-10 left-36 w-3 h-3 bg-[#6D43EC] rounded-full opacity-60 pointer-events-none" />
        <div className="absolute top-1/4 left-[-16px] w-12 h-12 bg-[#ECE9FE] rounded-full pointer-events-none" />
        <div className="absolute top-16 right-10 w-14 h-14 bg-[#ECE9FE] rounded-full pointer-events-none opacity-80" />

        {/* Back to the landing page */}
        <div className="absolute top-6 left-6 sm:left-12 z-20">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="group flex items-center gap-1.5 text-xs sm:text-sm font-bold text-slate-400 hover:text-[#7047EB] transition-colors focus:outline-none focus:text-[#7047EB] cursor-pointer"
            aria-label="Back to home"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 transition-transform group-hover:-translate-x-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>
        </div>

        {/* Spacer to balance vertical height */}
        <div className="h-[40px] z-10 shrink-0" />

        <div className="my-auto w-full z-10 py-2 shrink-0">
          <LoginForm formState={formState} />
        </div>

        {/* Bottom Footer Section */}
        <div className="mt-4 z-10 text-center space-y-3 shrink-0">
          {/* Nothing to switch to mid-registration: the account already exists
              and the only thing left is the link in somebody's inbox. */}
          {!isCheckEmail && (
          <p className="text-sm text-slate-500 font-semibold select-none">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => setAuthStep(isSignUp ? 'sign_in' : 'sign_up')}
              className="text-[#7047EB] hover:text-[#5E3BD2] hover:underline font-extrabold focus:outline-none focus:underline cursor-pointer"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
          )}

          <div className="text-[11px] text-slate-400 select-none">
            By clicking button above, you agree to our{' '}
            <a href="#terms" className="text-[#7047EB] hover:underline font-bold">terms of use</a>{' '}
            and{' '}
            <a href="#privacy" className="text-[#7047EB] hover:underline font-bold">privacy policies</a>
          </div>
        </div>

      </div>

    </div>
  );
};

export default LoginPage;
