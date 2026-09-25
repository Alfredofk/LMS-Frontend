import React, { useState } from 'react';

import Input from './ui/Input';
import SelectField from './ui/SelectField';
import { useT } from '../i18n/LanguageContext';

/*
  The relationships most claims are, offered as a choice rather than typed. A
  link's relationship cannot be changed once it is ACTIVE — the backend has no
  route for it — and "Other" typed into a free box is exactly what a school
  found on a real link. The stored value is the Indonesian word whatever the
  screen language: it is a school record, read by the homeroom teacher, and like
  every free text in this app it is never translated. Anything else is still
  possible under "Lainnya", typed.
*/
const RELATIONSHIP_PRESETS = ['Ayah', 'Ibu', 'Wali'];
const OTHER = 'OTHER';

/*
  The three boxes that name a child: NISN, full name, relationship.

  The backend's `guardianPayload` (membership.schema.js:73) is the same three
  fields wherever a child is claimed — joining as a guardian, adding GUARDIAN to
  a membership already held, and claiming a further child — so this is one
  component, and `childErrors` in utils/validation.js one rule, for all three.

  The child is named, never listed. Both the number and the name have to be
  known already — that pairing is the out-of-band check, and nothing here will
  look a child up. A wrong pairing and a child not yet placed in a class get the
  same one refusal from the server (`resolveChild`), on purpose.

  `idPrefix` keeps ids unique when two forms could share a page; the `name`
  attributes stay the payload's own field names.
*/
export const ChildFields = ({ values, errors, onChange, idPrefix = '' }) => {
  const { t } = useT();
  const id = (name) => (idPrefix ? `${idPrefix}-${name}` : name);

  const relationship = values.relationship ?? '';
  const [typing, setTyping] = useState(() => relationship !== '' && !RELATIONSHIP_PRESETS.includes(relationship));
  const setRelationship = (value) => onChange('relationship')({ target: { value } });
  const choice = typing ? OTHER : RELATIONSHIP_PRESETS.includes(relationship) ? relationship : '';

  return (
    <>
      <Input
        id={id('childNisn')}
        name="childNisn"
        label={t('getStarted.join.field.childNisn')}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        value={values.childNisn ?? ''}
        error={errors.childNisn || undefined}
        onChange={onChange('childNisn')}
      />

      <Input
        id={id('childFullName')}
        name="childFullName"
        label={t('getStarted.join.field.childFullName')}
        type="text"
        autoComplete="off"
        value={values.childFullName ?? ''}
        error={errors.childFullName || undefined}
        onChange={onChange('childFullName')}
      />

      <SelectField
        id={id('relationshipChoice')}
        label={t('getStarted.join.field.relationship')}
        value={choice}
        error={typing ? undefined : errors.relationship || undefined}
        onChange={(e) => {
          const next = e.target.value;
          setTyping(next === OTHER);
          setRelationship(next === OTHER ? '' : next);
        }}
      >
        <option value="" disabled>
          {t('getStarted.join.relationship.choose')}
        </option>
        {RELATIONSHIP_PRESETS.map((value) => (
          <option key={value} value={value}>
            {t(`getStarted.join.relationship.option.${value}`)}
          </option>
        ))}
        <option value={OTHER}>{t('getStarted.join.relationship.option.OTHER')}</option>
      </SelectField>

      {typing && (
        <Input
          id={id('relationship')}
          name="relationship"
          label={t('getStarted.join.field.relationshipOther')}
          type="text"
          autoComplete="off"
          placeholder={t('getStarted.join.field.relationshipPlaceholder')}
          value={relationship}
          error={errors.relationship || undefined}
          onChange={onChange('relationship')}
        />
      )}
    </>
  );
};

export default ChildFields;
