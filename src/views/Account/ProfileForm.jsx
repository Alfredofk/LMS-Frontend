import React, { useState } from 'react';
import { Lock } from 'lucide-react';

import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { validateFullName, fieldErrorsFrom } from '../../utils/validation';

/*
  Renaming oneself. `PATCH /api/users/me`, and the only field it accepts.

  The email address is shown and cannot be edited, which is the backend's
  decision rather than a gap here: `updateMeBody` is `z.object({ fullName })` and
  nothing else, because an address is the identity the account is found by. A
  field that simply refused to accept typing would read as a broken input, so it
  renders as a locked row that says why.
*/
export const ProfileForm = ({ onSaved }) => {
  const { user, updateProfile } = useAuth();
  const { t } = useT();

  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const saved = user?.fullName ?? '';
  /* Nothing to send. Not a disguised validation failure — the button says
     "save changes", and there are none. */
  const unchanged = fullName.trim() === saved.trim();

  const check = (value) => {
    const fail = validateFullName(value);
    setError(fail ? t(fail.key, fail.vars) : null);
    return !fail;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving || unchanged) return;

    setTouched(true);
    if (!check(fullName)) return;

    setIsSaving(true);
    try {
      await updateProfile({ fullName: fullName.trim() });
      onSaved?.();
    } catch (err) {
      /* A zod failure names the field it rejected; anything else is one
         sentence for the whole form. */
      const fieldErrors = fieldErrorsFrom(err.details, ['fullName']);
      setError(fieldErrors.fullName ?? apiErrorMessage(err, t));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <Input
        id="fullName"
        name="fullName"
        label={t('account.profile.fullName')}
        type="text"
        autoComplete="name"
        value={fullName}
        error={error || undefined}
        onChange={(e) => {
          const next = e.target.value;
          setFullName(next);
          if (touched) check(next);
        }}
        onBlur={(e) => {
          setTouched(true);
          check(e.target.value);
        }}
      />

      <div className="space-y-1.5">
        <span className="text-sm font-semibold text-slate-700 block">
          {t('account.profile.email')}
        </span>
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 min-w-0">
          <Lock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          <span className="text-sm text-slate-500 font-medium truncate" title={user?.email}>
            {user?.email}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
          {t('account.profile.email.locked')}
        </p>
      </div>

      <Button
        type="submit"
        isLoading={isSaving}
        isDisabled={unchanged}
        className="w-full py-3 rounded-2xl justify-center text-base active:scale-[0.98] select-none"
      >
        {isSaving ? t('account.profile.saving') : t('account.profile.save')}
      </Button>
    </form>
  );
};

export default ProfileForm;
