import React, { useState } from 'react';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SelectField from '../../components/ui/SelectField';
import { governingBodySeatErrorMessage } from '../../i18n/apiError';
import { useT } from '../../i18n/LanguageContext';
import { governingBodyService } from '../../services/governingBodyService';
import { ADDRESS_FIELDS, PROVINCES } from '../Role/bodyRegistration';
import { profileErrorsOf, profileFormOf, profilePatchOf } from './governingBody';

/*
  The address and the phone, changed in place on the identity card by any admin
  (backend 3d7d05a, `PATCH /governing-body`; owner 2026-10-24: "Ubah" opens the form
  where the facts were). Only what changed is sent; the name, kind and SK number are
  the Platform Admin's and are not offered. No question first: the change is the
  admins' own and audited with what it was.

  `onSaved(governingBody)` with the answer; `onStale()` when the body changed
  meanwhile, for the page to read it again; `onCancel()`.
*/
export const GoverningBodyProfileForm = ({ body, onSaved, onStale, onCancel }) => {
  const { t } = useT();
  const [form, setForm] = useState(() => profileFormOf(body));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setError(null);
  };
  const say = (field) => (errors[field] ? t(errors[field].key, errors[field].vars) : undefined);

  const patch = profilePatchOf(body, form);

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    const found = profileErrorsOf(form);
    setErrors(found);
    if (Object.keys(found).length > 0 || !patch) return;

    setSaving(true);
    try {
      onSaved(await governingBodyService.updateProfile(patch));
    } catch (err) {
      if (String(err?.message ?? '').includes('changed meanwhile')) {
        onStale(governingBodySeatErrorMessage(err, t));
        return;
      }
      setError(governingBodySeatErrorMessage(err, t));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4" noValidate>
      {ADDRESS_FIELDS.map((field) => (
        <Input
          key={field.name}
          id={`gbp-${field.name}`}
          name={field.name}
          label={t(`gbreg.field.${field.name}`)}
          autoComplete="off"
          value={form[field.name]}
          maxLength={field.max}
          onChange={set(field.name)}
          error={say(field.name)}
        />
      ))}
      <div className="grid sm:grid-cols-2 gap-4">
        <SelectField id="gbp-province" label={t('gbreg.field.province')} value={form.province} onChange={set('province')} error={say('province')}>
          <option value="">{t('gbreg.field.province.choose')}</option>
          {PROVINCES.map((province) => (
            <option key={province} value={province}>
              {province}
            </option>
          ))}
        </SelectField>
        <Input
          id="gbp-postalCode"
          name="postalCode"
          label={t('gbreg.field.postalCode')}
          inputMode="numeric"
          maxLength={5}
          autoComplete="off"
          value={form.postalCode}
          onChange={set('postalCode')}
          error={say('postalCode')}
        />
      </div>
      <div className="space-y-1">
        <Input id="gbp-phone" name="phone" label={t('gb.phone')} inputMode="tel" autoComplete="off" value={form.phone} onChange={set('phone')} error={say('phone')} />
        {!errors.phone && <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('gb.profile.phone.hint')}</p>}
      </div>

      {error && (
        <p className="text-sm font-semibold text-rose-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" isLoading={saving} isDisabled={!patch || saving}>
          {saving ? t('gb.profile.saving') : t('gb.profile.save')}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} isDisabled={saving}>
          {t('common.cancel')}
        </Button>
      </div>
    </form>
  );
};

export default GoverningBodyProfileForm;
