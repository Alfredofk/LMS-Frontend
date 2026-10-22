import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import Button from '../../components/ui/Button';
import { gradingService } from '../../services/gradingService';
import { useT } from '../../i18n/LanguageContext';
import { gradingErrorMessage, isStaleGrading } from '../../i18n/apiError';
import { RuleChoice, SourceWord, WeightFields, WholeBox } from './GradeSettingsParts';
import { REPORT_TABLES, schoolBody, schoolDraftErrors, schoolDraftOf } from './grading';

/*
  The school's grade settings, on Settings, for the Principal and Vice Principals
  (backend 5d42af6; owner 2026-10-14): the default Grade Weights of Tugas, Kuis,
  UTS and UAS, the default KKTP, and the Remedial Rule. A teacher may give their own
  class subject its own weights and KKTP (SlotGradeSettings); the rule is the
  school's alone.

  Until the school saves, the built-in values apply (25/25/25/25, 75, capped at the
  KKTP) and each says "Bawaan". Saving sends only what changed, with the updatedAt
  read; a save made meanwhile elsewhere answers 409, and the card reads the
  settings again and says so. No Final Grade exists yet (ticket 02).

  Since backend 4dae152 (ticket 08) also whether the printed report card carries two
  blank tables, Ekstrakurikuler and Kepribadian, to be filled in by hand: two boxes,
  off until the school turns one on, frozen onto each report card at close.
*/
const SchoolGradeSettingsCard = ({ onToast }) => {
  const { t } = useT();
  const [settings, setSettings] = useState(null);
  const [failed, setFailed] = useState(false);
  /* null until the reader edits: the form shows what is saved until then. */
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  /* Bumped to read again: Retry, and a save refused as stale. */
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    gradingService
      .schoolSettings()
      .then((answer) => {
        if (cancelled) return;
        setSettings(answer);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [attempt]);
  const load = () => setAttempt((n) => n + 1);

  const values = draft ?? schoolDraftOf(settings);

  const change = (patch) => {
    setDraft((prev) => ({ ...(prev ?? schoolDraftOf(settings)), ...patch }));
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving || !settings) return;
    const found = schoolDraftErrors(values);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    const body = schoolBody(settings, values);
    if (!body) {
      setErrors({ global: t('classes.edit.nothing') });
      return;
    }
    setIsSaving(true);
    try {
      setSettings(await gradingService.setSchoolSettings(body));
      setDraft(null);
      setErrors({});
      onToast?.(t('grading.saved'), 'success');
    } catch (err) {
      setErrors({ global: gradingErrorMessage(err, t) });
      if (isStaleGrading(err)) {
        setDraft(null);
        load();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm space-y-4 text-left">
      <div className="min-w-0">
        <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">{t('grading.school.title')}</h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">{t('grading.school.body')}</p>
      </div>

      {failed && !settings ? (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm font-semibold text-amber-700">{t('grading.failed')}</p>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('att.error.retry')}
          </button>
        </div>
      ) : !settings ? (
        <div className="h-48 bg-slate-50 rounded-2xl animate-pulse" aria-label={t('common.loading')} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <fieldset className="space-y-2">
            <legend className="flex flex-wrap items-baseline gap-x-3 text-sm font-bold text-slate-700 mb-2">
              {t('grading.weights.legend')}
              <SourceWord source={settings.weights.source === 'BUILT_IN' ? 'BUILT_IN' : null} t={t} />
            </legend>
            <WeightFields
              idPrefix="schoolWeight"
              values={values.weights}
              onChange={(type, value) => change({ weights: { ...values.weights, [type]: value } })}
              errors={errors.weights}
              disabled={isSaving}
              t={t}
            />
          </fieldset>

          <div className="space-y-1.5">
            <WholeBox
              id="schoolKktp"
              label={
                <span className="flex flex-wrap items-baseline gap-x-3">
                  {t('grading.kktp.label')}
                  <SourceWord source={settings.kktp.source === 'BUILT_IN' ? 'BUILT_IN' : null} t={t} />
                </span>
              }
              value={values.kktp}
              onChange={(value) => change({ kktp: value })}
              error={errors.kktp}
              disabled={isSaving}
              className="max-w-[8rem]"
            />
            {errors.kktp && <p className="text-xs font-semibold text-red-600">{t(errors.kktp)}</p>}
            <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{t('grading.kktp.hint')}</p>
          </div>

          <div className="space-y-1">
            <RuleChoice value={values.remedialRule} onChange={(rule) => change({ remedialRule: rule })} disabled={isSaving} t={t} />
            {settings.remedialRule.source === 'BUILT_IN' && <p className="text-[11px] font-medium text-slate-500">{t('grading.rule.builtIn')}</p>}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-slate-700 mb-1">{t('grading.tables.legend')}</legend>
            {REPORT_TABLES.map((key) => (
              <label key={key} className="flex items-start gap-2.5 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values[key]}
                  onChange={(e) => change({ [key]: e.target.checked })}
                  disabled={isSaving}
                  className="mt-0.5 w-4 h-4 accent-brand cursor-pointer"
                />
                <span className="font-semibold">{t(`grading.tables.${key}`)}</span>
              </label>
            ))}
            <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{t('grading.tables.hint')}</p>
          </fieldset>

          {errors.global && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
              {errors.global}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            {draft && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(null);
                  setErrors({});
                }}
                isDisabled={isSaving}
              >
                {t('common.cancel')}
              </Button>
            )}
            <Button type="submit" isLoading={isSaving}>
              {t('classes.edit.save')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
};

export default SchoolGradeSettingsCard;
