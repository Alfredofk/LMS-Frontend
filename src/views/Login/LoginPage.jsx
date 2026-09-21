import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

import useLoginForm from '../../hooks/useLoginForm';
import LoginForm from './LoginForm';
import Toast from '../../components/ui/Toast';
import AuthLayout from '../../layouts/AuthLayout';
import { homeFor } from '../../constants/roles';
import { useT } from '../../i18n/LanguageContext';

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
  const formState = useLoginForm(initialAuthStep, ({ roles, activeRole, isPlatformAdmin }) => {
    /*
      A platform admin holds no school role and never will — they stand above
      every school. Sending them to /select-role would offer three cards that
      are none of their business, and then take the page away again once it
      worked out who they were. `signIn` has already asked by the time this
      runs, so the answer is here rather than a round trip away.
    */
    if (roles.length === 0 && isPlatformAdmin) {
      navigate('/admin/school-registrations', { replace: true });
    } else if (roles.length === 0) navigate('/select-role', { replace: true });
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

  /*
    This page used to carry its own copy of the auth shell, mirrored: purple on
    the right, white on the left. Measured at 1280px, signing in then threw the
    purple column 794 pixels across the screen, because every other signed-out
    screen puts it on the left. Somebody testing the app said this moment made
    them dizzy, and that number is why.

    `transitionKey={authStep}` rather than the default pathname: the three steps
    of this page all live at /login, so the URL cannot tell them apart, and
    without it the sign-up → check-email → sign-in moves would be the only ones
    in the flow that change nothing on screen but the words.
  */
  return (
    <AuthLayout
      heading={t(branding.heading)}
      transitionKey={authStep}
      onBack={() => navigate('/')}
      aside={
        <ul className="space-y-4">
          {branding.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-3 text-violet-100 text-sm font-medium leading-relaxed"
            >
              <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5 shadow-sm text-white font-bold text-xs select-none">
                ✓
              </span>
              <span>{t(bullet)}</span>
            </li>
          ))}
        </ul>
      }
      footer={
        <>
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
        </>
      }
    >
      {/* Toast is `fixed`, so where it sits in the tree does not matter. */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={closeToast}
        />
      )}

      <LoginForm
        formState={formState}
        notice={
          verified && !isSignUp && !isCheckEmail
            ? t('auth.verifiedNotice')
            : null
        }
      />
    </AuthLayout>
  );
};

export default LoginPage;
