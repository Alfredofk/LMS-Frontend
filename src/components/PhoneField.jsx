import React from 'react';

import Input from './ui/Input';
import { useT } from '../i18n/LanguageContext';

/*
  The phone box with its hint. What the number is and who reads it, and why it
  may not be known yet: hooks/useAccountPhone.js.
*/

/**
 * The phone box with its hint. `hintKey` swaps the hint — the profile says the
 * box may be left empty.
 */
export const PhoneField = ({ value, error, onChange, onBlur, idPrefix = '', hintKey = 'phone.hint' }) => {
  const { t } = useT();
  const id = idPrefix ? `${idPrefix}-phone` : 'phone';

  return (
    <div className="space-y-1.5">
      <Input
        id={id}
        name="phone"
        label={t('phone.label')}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        spellCheck={false}
        value={value ?? ''}
        error={error || undefined}
        onChange={onChange}
        onBlur={onBlur}
      />
      {!error && <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t(hintKey)}</p>}
    </div>
  );
};

export default PhoneField;
