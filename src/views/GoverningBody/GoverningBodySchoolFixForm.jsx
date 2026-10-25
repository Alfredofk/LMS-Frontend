import React, { useState } from 'react';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { SCHOOL_TYPE_NAMES, SCHOOL_TYPES, choosesDuration } from '../../constants/schoolTypes';
import { useT } from '../../i18n/LanguageContext';
import { bodySchoolsErrorMessage, isHadPrincipal, isStaleBodySchool } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import { fieldErrorsFrom } from '../../utils/validation';
import { fixErrorsOf, fixFormOf, fixPatchOf } from './bodySchools';

/*
  Fixing one of the body's Schools in place, under its row (backend ed0d304 and
  9697362; owner 2026-10-25): the name, the NPSN, the type and an SMK's duration,
  `PATCH /governing-body/schools/:id` with only what changed. Allowed while the School
  has never had a Principal; the address stays as it was.

  A taken NPSN and a field the server refuses are said on their box. A refusal the row
  cannot fix - a Principal since, changed meanwhile, gone, the seat ended - goes to the
  page (`onRefused`), which closes the form.
*/

const FIELDS = ['schoolName', 'npsn', 'schoolType', 'durationYears'];

export const GoverningBodySchoolFixForm = ({ school, onCancel, onSaved, onRefused }) => {
  const { t } = useT();
  const [values, setValues] = useState(() => fixFormOf(school));
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [global, setGlobal] = useState(null);
  const [saving, setSaving] = useState(false);

  const say = (fail) => (fail ? t(fail.key, fail.vars) : null);
  const shown = submitted ? Object.fromEntries(Object.entries(fixErrorsOf(values)).map(([field, fail]) => [field, say(fail)])) : {};
  const errorOf = (field) => shown[field] || errors[field] || undefined;

  const change = (field, value) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: null }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSubmitted(true);
    setGlobal(null);
    if (Object.keys(fixErrorsOf(values)).length) return;

    const patch = fixPatchOf(school, values);
    if (!patch) {
      onSaved(null);
      return;
    }

    setSaving(true);
    try {
      onSaved(await governingBodyService.fixSchool(school.id, patch));
    } catch (err) {
      if (err?.status === 403 || isHadPrincipal(err) || isStaleBodySchool(err)) {
        onRefused(err);
        return;
      }
      const fields = fieldErrorsFrom(err?.details, FIELDS);
      if (String(err?.message ?? '').includes('NPSN is already registered')) fields.npsn = t('reg.conflict.npsn');
      if (Object.keys(fields).length) setErrors(fields);
      else setGlobal(bodySchoolsErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  const id = (field) => `fix-${school.id}-${field}`;

  return (
    <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4" aria-label={t('gbs.fix.title', { name: school.name })}>
      <div>
        <p className="text-sm font-extrabold text-slate-900">{t('gbs.fix.title', { name: school.name })}</p>
        <p className="text-xs font-medium text-slate-500 leading-relaxed mt-0.5">{t('gbs.fix.lead')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id={id('schoolName')}
          name="schoolName"
          label={t('reg.field.schoolName')}
          autoComplete="off"
          value={values.schoolName}
          error={errorOf('schoolName')}
          onChange={(e) => change('schoolName', e.target.value)}
        />
        <Input
          id={id('npsn')}
          name="npsn"
          label={t('reg.field.npsn')}
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          value={values.npsn}
          error={errorOf('npsn')}
          onChange={(e) => change('npsn', e.target.value)}
        />
        <div className="space-y-1.5">
          <label htmlFor={id('schoolType')} className="text-sm font-semibold text-slate-700 block">
            {t('reg.field.schoolType')}
          </label>
          <Select
            id={id('schoolType')}
            name="schoolType"
            value={values.schoolType}
            onChange={(e) => {
              const schoolType = e.target.value;
              setValues((prev) => ({ ...prev, schoolType, durationYears: schoolType === school.schoolType ? fixFormOf(school).durationYears : '' }));
              setErrors((prev) => ({ ...prev, durationYears: null }));
            }}
          >
            {SCHOOL_TYPE_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </div>
        {choosesDuration(values.schoolType) && (
          <div className="space-y-1.5">
            <label htmlFor={id('durationYears')} className="text-sm font-semibold text-slate-700 block">
              {t('reg.field.duration')}
            </label>
            <Select
              id={id('durationYears')}
              name="durationYears"
              value={values.durationYears}
              invalid={!!errorOf('durationYears')}
              onChange={(e) => change('durationYears', e.target.value)}
            >
              <option value="">{t('reg.field.duration.placeholder')}</option>
              {SCHOOL_TYPES[values.schoolType].allowedDurationYears.map((years) => (
                <option key={years} value={years}>
                  {t('reg.field.duration.years', { n: years })}
                </option>
              ))}
            </Select>
            {errorOf('durationYears') && (
              <span className="text-xs text-red-600 font-medium" role="alert">
                {errorOf('durationYears')}
              </span>
            )}
          </div>
        )}
      </div>

      {global && (
        <p className="text-sm font-semibold text-rose-700" role="alert">
          {global}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel} isDisabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button size="sm" type="submit" isLoading={saving}>
          {t('gbs.fix.save')}
        </Button>
      </div>
    </form>
  );
};

export default GoverningBodySchoolFixForm;
