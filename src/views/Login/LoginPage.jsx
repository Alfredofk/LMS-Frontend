import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import useLoginForm from '../../hooks/useLoginForm';
import LoginForm from './LoginForm';
import Toast from '../../components/ui/Toast';
import { homeFor } from '../../constants/roles';
import { useT } from '../../i18n/LanguageContext';
import LanguageSwitch from '../../components/ui/LanguageSwitch';

/*
  The role cards that used to open this page now live at /select-role, after
  sign-in. They moved because registration does not take a role: the backend
  grants one through a school's approval, so a choice made here would have been
  a decoration that quietly promised access nobody had yet.
*/
const BRANDING = {
  sign_up: {
    heading: 'auth.panel.signUp.heading',
    bullets: ['auth.panel.signUp.a', 'auth.panel.signUp.b', 'auth.panel.signUp.c'],
  },
  check_email: {
    heading: 'auth.panel.checkEmail.heading',
    bullets: ['auth.panel.checkEmail.a', 'auth.panel.checkEmail.b', 'auth.panel.checkEmail.c'],
  },
  sign_in: {
    heading: 'auth.panel.signIn.heading',
    bullets: ['auth.panel.signIn.a', 'auth.panel.signIn.b', 'auth.panel.signIn.c'],
  },
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useT();
  const initialAuthStep = location.state?.step === 'sign_up' ? 'sign_up' : 'sign_in';

  /*
    Where somebody lands is decided by what they actually hold, not by anything
    they typed. No usable role at all — no school, or a membership still waiting
    on approval — means /select-role, where every card is locked and says why.
    Exactly one usable role is entered without asking.
    More than one, and only then, is worth a question.
  */
  const formState = useLoginForm(initialAuthStep, ({ roles, activeRole }) => {
    if (roles.length === 0) navigate('/select-role', { replace: true });
    else if (activeRole) navigate(homeFor(activeRole), { replace: true });
    else navigate('/select-role', { replace: true });
  });

  const { authStep, setAuthStep, isSignUp, isCheckEmail, toast, closeToast } = formState;
  const branding = BRANDING[authStep];

  /*
    /verify-email sends people straight here once it has claimed their token, so
    this is where the good news has to land. A banner rather than a toast: the
    person has just come back from their inbox and may not be looking at the
    screen the moment it appears.
  */
  const verified = location.state?.verified === true;

  return (
    <div className="min-h-screen lg:h-screen w-screen bg-brand flex flex-col lg:flex-row font-sans selection:bg-brand selection:text-white relative lg:overflow-hidden">

      {/* Toast Alert Notifier container */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}

      {/* --- PURPLE SIDEBAR COLUMN --- */}
      <div className="w-full text-white flex-col justify-between p-8 sm:p-12 relative shrink-0 z-0 text-left select-none bg-brand hidden lg:flex lg:w-[38%] lg:h-full lg:order-2 lg:overflow-hidden">
        <div className="text-2xl font-extrabold tracking-tight text-right">
          EduForID
        </div>

        <div className="my-auto space-y-6 max-w-sm ml-0 lg:ml-auto text-left lg:text-right pr-0 lg:pr-4 z-10 shrink-0">
          <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
            {t(branding.heading)}
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
                <span>{t(bullet)}</span>
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
        <div className="absolute top-0 left-0 w-28 h-28 bg-brand rounded-br-full pointer-events-none" />
        <div className="absolute top-10 left-36 w-3 h-3 bg-brand rounded-full opacity-60 pointer-events-none" />
        <div className="absolute top-1/4 left-[-16px] w-12 h-12 bg-brand-tint rounded-full pointer-events-none" />
        <div className="absolute top-16 right-10 w-14 h-14 bg-brand-tint rounded-full pointer-events-none opacity-80" />

        {/* Back to the landing page.

            A white pill rather than bare text: this sits on top of the purple
            corner above, and grey-on-purple was all but invisible. The pill
            reads on either background, and its height and radius are the
            language switch's, so the two corners match. */}
        <div className="absolute top-6 left-6 sm:left-12 z-20 flex">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="group inline-flex items-center gap-1.5 pl-2.5 pr-3.5 py-1.5 rounded-full bg-white shadow-sm ring-1 ring-slate-200 text-xs font-bold text-slate-600 hover:text-brand hover:ring-brand/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer"
            aria-label={t('auth.backToHome')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 transition-transform group-hover:-translate-x-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            {t('auth.back')}
          </button>
        </div>

        {/* Opposite the Back button, in the white card rather than the purple
            panel — that panel is hidden below lg, and a language switch nobody
            on a phone can reach is not a language switch. */}
        <div className="absolute top-6 right-6 sm:right-12 z-20 flex">
          <LanguageSwitch />
        </div>

        {/* Spacer to balance vertical height */}
        <div className="h-[40px] z-10 shrink-0" />

        <div className="my-auto w-full z-10 py-2 shrink-0">
          <LoginForm
            formState={formState}
            notice={
              verified && !isSignUp && !isCheckEmail
                ? t('auth.verifiedNotice')
                : null
            }
          />
        </div>

        {/* Bottom Footer Section */}
        <div className="mt-4 z-10 text-center space-y-3 shrink-0">
          {/* Nothing to switch to mid-registration: the account already exists
              and the only thing left is the link in somebody's inbox. */}
          {!isCheckEmail && (
          <p className="text-sm text-slate-500 font-semibold select-none">
            {isSignUp ? t('auth.haveAccount') : t('auth.noAccount')}{' '}
            <button
              type="button"
              onClick={() => setAuthStep(isSignUp ? 'sign_in' : 'sign_up')}
              className="text-brand hover:text-brand-deep hover:underline font-extrabold focus:outline-none focus:underline cursor-pointer"
            >
              {isSignUp ? t('auth.signInLink') : t('auth.signUpLink')}
            </button>
          </p>
          )}

          <div className="text-[11px] text-slate-400 select-none">
            {t('auth.terms')}{' '}
            <a href="#terms" className="text-brand hover:underline font-bold">{t('auth.termsOfUse')}</a>{' '}
            {t('auth.and')}{' '}
            <a href="#privacy" className="text-brand hover:underline font-bold">{t('auth.privacy')}</a>
          </div>
        </div>

      </div>

    </div>
  );
};

export default LoginPage;
