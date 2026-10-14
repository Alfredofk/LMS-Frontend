import React, { Fragment } from 'react';

import { GRADE_TYPES, REMEDIAL_RULES, weightsSum } from './grading';

/*
  What the school's card and a slot's panel share: the settings read out in
  words (SettingsSummary), the four weight boxes (WeightFields), one whole-number
  box (WholeBox) and the three remedial rules (RuleChoice).
*/

const box =
  'block w-full min-w-0 rounded-xl border bg-white py-2 px-3 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 disabled:text-slate-500';
const errorText = 'text-xs font-semibold text-red-600';

/** Where a value comes from, in grey beside it. */
export const SourceWord = ({ source, t }) =>
  source ? <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">{t(`grading.source.${source}`)}</span> : null;

/**
 * The settings as they apply: weights, KKTP and the remedial rule, each with its
 * source. `rule` false leaves the remedial rule out.
 */
export const SettingsSummary = ({ settings, t, rule = true }) => {
  const weights = settings?.weights?.value ?? {};
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-sm items-baseline">
      <dt className="text-xs font-bold text-slate-500">{t('grading.weights')}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 min-w-0">
        {/* A flex row so the four wrap on a narrow dialog: the parts have no space between them to break at. */}
        <span className="flex flex-wrap items-baseline gap-y-0.5 min-w-0 font-semibold text-slate-800">
          {GRADE_TYPES.map((type, i) => (
            <Fragment key={type}>
              {i > 0 && (
                <span className="mx-1.5 text-slate-300" aria-hidden="true">
                  /
                </span>
              )}
              <span className="whitespace-nowrap">{t('grading.weightOf', { type: t(`grading.type.${type}`), n: weights[type] ?? '-' })}</span>
            </Fragment>
          ))}
        </span>
        <SourceWord source={settings?.weights?.source} t={t} />
      </dd>

      <dt className="text-xs font-bold text-slate-500">{t('grading.kktp')}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="font-semibold text-slate-800">{settings?.kktp?.value ?? '-'}</span>
        <SourceWord source={settings?.kktp?.source} t={t} />
      </dd>

      {rule && (
        <>
          <dt className="text-xs font-bold text-slate-500">{t('grading.remedial')}</dt>
          <dd className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="font-semibold text-slate-800">{t(`grading.rule.${settings?.remedialRule?.value ?? 'CAP_AT_KKTP'}`)}</span>
            <SourceWord source={settings?.remedialRule?.source} t={t} />
          </dd>
        </>
      )}
    </dl>
  );
};

/** A box for a whole number 0-100, with "%" after it when `percent`. */
export const WholeBox = ({ id, label, value, onChange, error, disabled, percent = false, className = '' }) => (
  <div className={`space-y-1.5 min-w-0 ${className}`}>
    <label htmlFor={id} className="block text-xs font-bold text-slate-600">
      {label}
    </label>
    <div className="relative">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
        className={`${box} ${percent ? 'pr-8' : ''} ${error ? 'border-red-500' : 'border-slate-200'}`}
      />
      {percent && <span className="absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-slate-500 pointer-events-none">%</span>}
    </div>
  </div>
);

/**
 * The four weights, a box each, the sum under them as it is typed.
 * `errors` is weightErrors' answer.
 */
export const WeightFields = ({ idPrefix, values, onChange, errors = {}, disabled, t }) => {
  const sum = weightsSum(values);
  const boxError = GRADE_TYPES.find((type) => errors[type]);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl">
        {GRADE_TYPES.map((type) => (
          <WholeBox
            key={type}
            id={`${idPrefix}-${type}`}
            label={t(`grading.type.${type}`)}
            value={values[type]}
            onChange={(value) => onChange(type, value)}
            error={errors[type]}
            disabled={disabled}
            percent
          />
        ))}
      </div>
      <p className={`text-xs font-semibold ${sum === 100 ? 'text-slate-500' : 'text-amber-700'}`} aria-live="polite">
        {t('grading.sum', { n: sum })}
      </p>
      {boxError && <p className={errorText}>{t(errors[boxError])}</p>}
      {errors.sum && <p className={errorText}>{t(errors.sum)}</p>}
    </div>
  );
};

/** The school's remedial rule: three choices, each with what it does. */
export const RuleChoice = ({ value, onChange, disabled, t }) => (
  <fieldset className="space-y-2.5">
    <legend className="block text-xs font-bold text-slate-600 mb-2">{t('grading.remedial.legend')}</legend>
    {REMEDIAL_RULES.map((rule) => (
      <label key={rule} className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="radio"
          name="remedialRule"
          checked={value === rule}
          disabled={disabled}
          onChange={() => onChange(rule)}
          className="mt-0.5 w-4 h-4 accent-brand cursor-pointer shrink-0"
        />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-slate-800">{t(`grading.rule.${rule}`)}</span>
          <span className="block text-xs font-medium text-slate-500 leading-relaxed">{t(`grading.rule.${rule}.hint`)}</span>
        </span>
      </label>
    ))}
  </fieldset>
);
