import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import PasswordRules from '../../components/ui/PasswordRules';
import { usersService } from '../../services/usersService';
import { getAccessToken } from '../../services/apiClient';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { validatePassword, fieldErrorsFrom } from '../../utils/validation';

/*
  Changing one's own password. `POST /api/users/me/change-password`.

  Two of this endpoint's answers do not mean what the same answer means anywhere
  else in the app, and both are handled here rather than in apiError's defaults:

  **401 means the current password was wrong** — not that the session ran out.
  The generic `error.unauthorized` tells people to sign in again, which is absurd
  advice to give somebody who is signed in and looking at their own settings. It
  is shown against the field that caused it. (`usersService` also turns
  apiClient's refresh-and-retry off for this call for the same reason.)

  **400 PASSWORD_NOT_SET means this account came from Google** and has never had
  a password. `/users/me` does not report whether one exists, so there is no way
  to know before asking — the form renders, and the answer explains. The way out
  is forgot-password, which proves the inbox instead of an old password, and that
  is the backend's own instruction, not an invention here.
*/
export const PasswordForm = ({ onChanged }) => {
  const { t } = useT();

  const [values, setValues] = useState({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState({});
  /* Distinct from an error string: this one renders a way forward, not a note. */
  const [hasNoPassword, setHasNoPassword] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const set = (field) => (e) => {
    const value = e.target.value;
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null, global: null }));
  };

  const checkAll = () => {
    const next = {};

    if (!values.current) next.current = t('validation.password.required');

    const fail = validatePassword(values.next);
    if (fail) next.next = t(fail.key, fail.vars);

    if (!values.confirm) next.confirm = t('validation.confirm.required');
    else if (values.next !== values.confirm) next.confirm = t('validation.confirm.mismatch');

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSending) return;
    if (!checkAll()) return;

    setIsSending(true);
    setHasNoPassword(false);
    try {
      await usersService.changePassword({
        currentPassword: values.current,
        newPassword: values.next,
      });
      setValues({ current: '', next: '', confirm: '' });
      setErrors({});
      onChanged?.();
    } catch (err) {
      if (err.code === 'PASSWORD_NOT_SET') {
        setHasNoPassword(true);
        return;
      }
      if (err.code === 'UNAUTHORIZED') {
        /*
          Two different failures arrive here wearing the same code: a wrong
          current password, and a session that has run out. The backend gives
          both `UNAUTHORIZED` and differs only in prose, which this app does not
          read (apiError.js explains the one place it breaks that rule and why).

          They are still told apart, from state rather than words. apiClient
          refreshes once on a 401 and clears **both** tokens when that refresh is
          itself rejected. So a token still sitting in storage means the refresh
          worked and the request failed again on its own merits — the password
          was wrong. An empty store means the session died, and saying "your
          password is wrong" to somebody who typed it correctly is the one
          message worth going to this trouble to avoid.
        */
        setErrors(
          getAccessToken()
            ? { current: t('account.pwd.wrongCurrent') }
            : { global: apiErrorMessage(err, t) }
        );
        return;
      }

      const fieldErrors = fieldErrorsFrom(err.details, ['currentPassword', 'newPassword']);
      setErrors({
        current: fieldErrors.currentPassword,
        next: fieldErrors.newPassword,
        global: Object.keys(fieldErrors).length ? null : apiErrorMessage(err, t),
      });
    } finally {
      setIsSending(false);
    }
  };

  if (hasNoPassword) {
    return (
      <div className="space-y-3 text-left" role="status">
        <p className="text-sm text-slate-600 font-medium leading-relaxed">
          {t('account.pwd.noPassword')}
        </p>
        <Link
          to="/forgot-password"
          className="inline-block text-sm text-brand hover:text-brand-deep font-bold underline underline-offset-4 transition-colors"
        >
          {t('account.pwd.noPassword.action')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      {errors.global && (
        <div
          className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-2xl text-sm text-red-700"
          role="alert"
        >
          {errors.global}
        </div>
      )}

      <Input
        id="currentPassword"
        name="currentPassword"
        label={t('account.pwd.current')}
        type="password"
        autoComplete="current-password"
        value={values.current}
        error={errors.current || undefined}
        onChange={set('current')}
      />

      <div className="space-y-2">
        <Input
          id="newPassword"
          name="newPassword"
          label={t('account.pwd.new')}
          type="password"
          autoComplete="new-password"
          value={values.next}
          error={errors.next || undefined}
          onChange={set('next')}
        />
        <PasswordRules value={values.next} />
      </div>

      <Input
        id="confirmNewPassword"
        name="confirmNewPassword"
        label={t('account.pwd.confirm')}
        type="password"
        autoComplete="new-password"
        value={values.confirm}
        error={errors.confirm || undefined}
        onChange={set('confirm')}
      />

      {/*
        Said before pressing, not after. Changing a password revokes every
        refresh token this account has (users.service.js), so a phone left
        signed in at home stops working — somebody is entitled to know that
        while they can still decide against it.
      */}
      <p className="text-[11px] text-slate-500 font-medium leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-3">
        {t('account.pwd.warning')}
      </p>

      <Button
        type="submit"
        isLoading={isSending}
        className="w-full py-3 rounded-2xl justify-center text-base active:scale-[0.98] select-none"
      >
        {isSending ? t('account.pwd.submitting') : t('account.pwd.submit')}
      </Button>
    </form>
  );
};

export default PasswordForm;
