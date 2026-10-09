import React, { useState } from 'react';
import { Lock } from 'lucide-react';

import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { validateFullName, validatePhone, normalisePhone, fieldErrorsFrom } from '../../utils/validation';
import PhoneField from '../../components/PhoneField';
import { useAccountPhone } from '../../hooks/useAccountPhone';

/*
  One's own name and phone number. `PATCH /api/users/me`, which takes either alone
  or both (`updateMeBody`, backend a9ed505); only what changed is sent.

  The phone is optional for everybody (owner, 2026-10-04): an SD child has none,
  and the number is the person's own to remove — an emptied box sends `null`. Only
  a guardian is asked for one, when they ask for the role (PhoneField).

  The email address is shown and cannot be edited, which is the backend's
  decision rather than a gap here: `updateMeBody` has no email, because an address
  is the identity the account is found by. A field that simply refused to accept
  typing would read as a broken input, so it renders as a locked row that says why.
*/
const CHECKS = {
  fullName: (value) => validateFullName(value),
  phone: (value) => validatePhone(value, { optional: true }),
};

export const ProfileForm = ({ onSaved }) => {
  const { user, updateProfile } = useAuth();
  const { t } = useT();
  const accountPhone = useAccountPhone();

  const [values, setValues] = useState({ fullName: user?.fullName ?? '', phone: accountPhone ?? '' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  /* Right after sign-in the number is not known yet (PhoneField); fill the box
     when /users/me brings it, unless something was typed first. */
  const [filledPhone, setFilledPhone] = useState(accountPhone);
  if (accountPhone !== filledPhone) {
    setFilledPhone(accountPhone);
    if (!touched.phone && accountPhone) setValues((prev) => ({ ...prev, phone: accountPhone }));
  }

  const changed = {
    fullName: values.fullName.trim() !== (user?.fullName ?? '').trim(),
    /* Compared as stored: the server drops spaces and dashes, so "0812-3456"
       saved comes back "08123456" and is no change. */
    phone: normalisePhone(values.phone) !== (accountPhone ?? ''),
  };
  /* Nothing to send. Not a disguised validation failure — the button says
     "save changes", and there are none. */
  const unchanged = !changed.fullName && !changed.phone;

  const check = (name, value) => {
    const fail = CHECKS[name](value);
    setErrors((prev) => ({ ...prev, [name]: fail ? t(fail.key, fail.vars) : null }));
    return !fail;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving || unchanged) return;

    setTouched({ fullName: true, phone: true });
    const nameOk = check('fullName', values.fullName);
    const phoneOk = check('phone', values.phone);
    if (!nameOk || !phoneOk) return;

    const body = {};
    if (changed.fullName) body.fullName = values.fullName.trim();
    if (changed.phone) body.phone = values.phone.trim() || null;

    setIsSaving(true);
    try {
      const session = await updateProfile(body);
      /* Show the number as the server keeps it. */
      setValues((prev) => ({ ...prev, phone: session?.user?.phone ?? '' }));
      onSaved?.();
    } catch (err) {
      /* A zod failure names the field it rejected; anything else is one
         sentence, under the name. */
      const fieldErrors = fieldErrorsFrom(err.details, ['fullName', 'phone']);
      setErrors(Object.keys(fieldErrors).length ? fieldErrors : { fullName: apiErrorMessage(err, t) });
    } finally {
      setIsSaving(false);
    }
  };

  const change = (name) => (e) => {
    const next = e.target.value;
    setValues((prev) => ({ ...prev, [name]: next }));
    if (touched[name]) check(name, next);
  };

  const blur = (name) => (e) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    check(name, e.target.value);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left flex-1 flex flex-col">
      <Input
        id="fullName"
        name="fullName"
        label={t('account.profile.fullName')}
        type="text"
        autoComplete="name"
        value={values.fullName}
        error={errors.fullName || undefined}
        onChange={change('fullName')}
        onBlur={blur('fullName')}
      />

      <PhoneField
        value={values.phone}
        error={errors.phone}
        onChange={change('phone')}
        onBlur={blur('phone')}
        idPrefix="profile"
        hintKey="phone.hint.optional"
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
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
          {t('account.profile.email.locked')}
        </p>
      </div>

      <Button
        type="submit"
        isLoading={isSaving}
        isDisabled={unchanged}
        className="w-full mt-auto py-3 rounded-2xl justify-center text-base active:scale-[0.98] select-none"
      >
        {isSaving ? t('account.profile.saving') : t('account.profile.save')}
      </Button>
    </form>
  );
};

export default ProfileForm;
