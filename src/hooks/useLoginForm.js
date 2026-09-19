import { useState } from 'react';

import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n/LanguageContext';
import { apiErrorMessage } from '../i18n/apiError';
import {
  validateEmail,
  validateFullName,
  validatePassword,
  fieldErrorsFrom,
} from '../utils/validation';

const SIGN_UP_FIELDS = ['fullName', 'email', 'password', 'confirmPassword'];

/*
  What UNAUTHORIZED means on each of this hook's calls.

  The same code, two different sentences: a password this app sent and the
  backend refused, or a Google token Google itself would not vouch for. Neither
  is the default — "your session has ended" — because on this screen there is no
  session yet to end.
*/
const WRONG_PASSWORD = { UNAUTHORIZED: 'error.badCredentials' };
const GOOGLE_REFUSED = { UNAUTHORIZED: 'error.googleRejected' };

/**
 * All state and submit logic for the sign-up / sign-in form.
 *
 * Three steps, not two. Registering does not sign anybody in — the backend
 * returns no token and refuses sign-in until the emailed link is clicked — so
 * `check_email` sits between the two forms and says so. Without it, somebody who
 * has just created an account is dropped back onto a login form with no
 * explanation of why their brand-new password does not work yet.
 *
 * Registration takes an email, a password and a name, and nothing else. It does
 * not take a role: a role is granted by a school's approval after somebody joins
 * one, so it cannot be chosen by the person signing up. The role picker lives
 * after sign-in, at /select-role.
 *
 * Neither an NPSN nor a School Code is a credential. An NPSN identifies a school
 * and a School Code only locates one so a person can ask to join it. Both
 * sign-in paths that used them are gone.
 *
 * @param {'sign_up'|'sign_in'} initialAuthStep
 * @param {(session: { user, membership, roles, activeRole }) => void} onAuthSuccess
 */
export const useLoginForm = (initialAuthStep = 'sign_in', onAuthSuccess) => {
  const { signIn, signInWithGoogle } = useAuth();
  const { t } = useT();

  const [authStep, setAuthStep] = useState(
    initialAuthStep === 'sign_up' ? 'sign_up' : 'sign_in'
  );

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);

  /*
    "Remember me", off by default.

    All it decides is where the session is kept: checked, it survives closing the
    browser; unchecked, it dies with the tab. Off by default because these are
    school machines as often as personal ones, and leaving somebody signed in on
    a shared computer should be a choice, not what happens when nobody looks.
  */
  const [remember, setRemember] = useState(false);

  /*
    The address an account was just created for.

    Held apart from `email` so the check-email screen keeps naming the right
    address even if the field is edited afterwards, and so resending has a
    definite target rather than whatever happens to be typed at the time.
  */
  const [registeredEmail, setRegisteredEmail] = useState(null);

  /*
    Signing in before confirming the address answers 403 EMAIL_NOT_VERIFIED
    rather than 401, precisely so the UI can offer the link again instead of
    saying "wrong password". Holding the address here is what makes that offer
    possible without asking the person to type it a second time.
  */
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [isResending, setIsResending] = useState(false);

  const showToast = (message, type = 'info') => setToast({ message, type });
  const closeToast = () => setToast(null);

  const isSignUp = authStep === 'sign_up';
  const isCheckEmail = authStep === 'check_email';

  const validateForm = () => {
    const next = {};

    /* Every validator returns a key, so the same rule reads in either language. */
    const say = (fail) => t(fail.key, fail.vars);

    const emailError = validateEmail(email);
    if (emailError) next.email = say(emailError);

    if (isSignUp) {
      const nameError = validateFullName(fullName);
      if (nameError) next.fullName = say(nameError);

      const passwordError = validatePassword(password);
      if (passwordError) next.password = say(passwordError);

      if (!confirmPassword) next.confirmPassword = t('validation.confirm.required');
      else if (password !== confirmPassword) next.confirmPassword = t('validation.confirm.mismatch');
    } else {
      /*
        Sign-in checks that a password was typed and nothing more. An account
        created before a rule changed must still be able to authenticate — and
        then change it. The backend takes the same view (auth.schema.js:61-63).
      */
      if (!password) next.password = t('validation.password.required');
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /*
    Every failure arrives as an ApiError carrying the backend's own `code`.
    Branching on that rather than on the message is what keeps this readable when
    the prose is reworded, translated, or made deliberately vague — which
    forgot-password and resend-verification both are, on purpose.

    `overrides` says what UNAUTHORIZED means on this particular call — see
    i18n/apiError.js. Nothing else about the mapping varies.
  */
  const handleApiError = (err, overrides) => {
    const details = fieldErrorsFrom(err.details, SIGN_UP_FIELDS);

    switch (err.code) {
      case 'EMAIL_NOT_VERIFIED':
        setUnverifiedEmail(email);
        setErrors({ global: t('error.emailNotVerified') });
        return;

      case 'CONFLICT':
        setErrors({ email: t('error.conflict'), ...details });
        return;

      case 'UNAUTHORIZED':
        setErrors({ global: apiErrorMessage(err, t, overrides) });
        return;

      /*
        Field-level details keep the server's own English: they only appear when
        our checks passed and its did not, and in that disagreement its exact
        words are the more useful thing to read.
      */
      case 'BAD_REQUEST':
        setErrors(
          Object.keys(details).length ? details : { global: apiErrorMessage(err, t, overrides) }
        );
        return;

      default:
        setErrors({ global: apiErrorMessage(err, t, overrides) });
    }
  };

  const handleAuthSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});
    setUnverifiedEmail(null);

    try {
      if (isSignUp) {
        await authService.register({ email, password, fullName });

        /*
          Registering does not sign anybody in. The backend sends a verification
          link and refuses sign-in until it is clicked, so landing on a dashboard
          here would be a lie — the very next request would 403.

          The password deliberately stays in state. The check-email step signs in
          with it once the link has been opened, which spares somebody typing it
          again for no reason. It lives in this component's memory only: never a
          URL, never history.state, never localStorage, and gone the moment this
          page unmounts.
        */
        setRegisteredEmail(email);
        setConfirmPassword('');
        setAuthStep('check_email');
        return;
      }

      const session = await signIn({ email, password, remember });
      showToast(t('auth.welcomeBack', { name: session.user.fullName }), 'success');
      resetForm();
      if (onAuthSuccess) onAuthSuccess(session);
    } catch (err) {
      handleApiError(err, WRONG_PASSWORD);
      if (!err.code || err.code !== 'EMAIL_NOT_VERIFIED') {
        showToast(apiErrorMessage(err, t, WRONG_PASSWORD), 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * "I have verified — continue", from the check-email step.
   *
   * Signs in with the credentials just typed. No endpoint reports whether an
   * address has been verified without authenticating first, so attempting the
   * sign-in *is* the check: a 403 means the link has not been opened yet, which
   * here is the ordinary case rather than an edge one — and it says so, instead
   * of reading like a rejection.
   */
  const handleVerifiedContinue = async () => {
    setIsLoading(true);
    setErrors({});

    try {
      const session = await signIn({ email, password, remember });
      showToast(t('auth.welcome', { name: session.user.fullName }), 'success');
      resetForm();
      if (onAuthSuccess) onAuthSuccess(session);
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setErrors({
          global: t('checkEmail.notOpened'),
        });
      } else {
        handleApiError(err, WRONG_PASSWORD);
        showToast(apiErrorMessage(err, t, WRONG_PASSWORD), 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Send the confirmation link again.
   *
   * The backend answers the same whether or not the address has an account, so
   * this can never be read as proof that one exists — and neither can the toast.
   */
  const handleResendVerification = async () => {
    const target = registeredEmail || unverifiedEmail || email;
    if (!target) return;

    setIsResending(true);
    try {
      await authService.resendVerification(target);
      showToast(t('checkEmail.resent', { email: target }), 'success');
    } catch {
      showToast(t('checkEmail.resendFailed'), 'error');
    } finally {
      setIsResending(false);
    }
  };

  /**
   * The ID token Google Identity Services just handed the browser.
   *
   * Everything after this point is the same as an ordinary sign-in — same
   * response shape, same session, same Remember me. What differs is that there
   * is no EMAIL_NOT_VERIFIED branch to worry about: Google only issues a token
   * for an address it has verified itself, and the backend refuses the rest.
   */
  const handleGoogleCredential = async (idToken) => {
    setIsLoading(true);
    setErrors({});

    try {
      const session = await signInWithGoogle({ idToken, remember });
      showToast(t('auth.welcome', { name: session.user.fullName }), 'success');
      resetForm();
      if (onAuthSuccess) onAuthSuccess(session);
    } catch (err) {
      handleApiError(err, GOOGLE_REFUSED);
      showToast(apiErrorMessage(err, t, GOOGLE_REFUSED), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setErrors({});
    setUnverifiedEmail(null);
    setRegisteredEmail(null);
  };

  const switchStep = (step) => {
    setAuthStep(step);
    setErrors({});
    setUnverifiedEmail(null);
    setRegisteredEmail(null);
    setPassword('');
    setConfirmPassword('');
  };

  return {
    authStep,
    setAuthStep: switchStep,
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
    registeredEmail,
    unverifiedEmail,
    isResending,
    handleResendVerification,
    handleVerifiedContinue,
    toast,
    showToast,
    closeToast,
    handleAuthSubmit,
    handleGoogleCredential,
    resetForm,
  };
};

export default useLoginForm;
