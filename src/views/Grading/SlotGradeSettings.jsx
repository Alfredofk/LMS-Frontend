import React, { useEffect, useState } from 'react';
import { Lock, RefreshCw } from 'lucide-react';

import Button from '../../components/ui/Button';
import { gradingService } from '../../services/gradingService';
import { useT } from '../../i18n/LanguageContext';
import { gradingErrorMessage, isGradingLocked, isStaleGrading } from '../../i18n/apiError';
import { SettingsSummary, WeightFields, WholeBox } from './GradeSettingsParts';
import { slotChange, slotDraftErrors, slotDraftOf, weightsLine } from './grading';

/*
  One class subject's grade settings (backend 5d42af6; owner 2026-10-14): the
  weights, KKTP and remedial rule its Final Grade will be computed with, each
  saying where it comes from - this class ("Khusus kelas ini"), the school, or the
  built-in default. Above the gradebook on the subject's "Nilai" tab, and read only
  in GradebookReader (the Principal, Vice Principals, the homeroom teacher).

  Its answering teacher (`canEdit`) may give the slot its own weights, its own
  KKTP, or both, and put either back to the school's: a PUT with only what changed
  (null for "follow the school"), or the clear route when both go back. The
  remedial rule is the school's alone. A slot is Class x Subject x Semester, so an
  ended assignment's successor shares it. A CLOSED semester or a closed year takes
  no change (409): the panel then says so and offers nothing more. A save made
  meanwhile (409 stale) reads the settings again.

  @param classSubjectId  the class subject
  @param canEdit         the answering teacher, in an open year
  @param onToast         (message, type) => void
  @param onSettings      (settings) => void - each read and save, so the host can
                         mark the gradebook's scores under the KKTP
*/
const card = 'bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm';

const FollowChoice = ({ name, own, onOwn, followLabel, ownLabel, disabled }) => (
  <div className="space-y-2">
    {[false, true].map((option) => (
      <label key={String(option)} className="flex items-start gap-2.5 cursor-pointer select-none">
        <input
          type="radio"
          name={name}
          checked={own === option}
          disabled={disabled}
          onChange={() => onOwn(option)}
          className="mt-0.5 w-4 h-4 accent-brand cursor-pointer shrink-0"
        />
        <span className="text-sm font-semibold text-slate-700">{option ? ownLabel : followLabel}</span>
      </label>
    ))}
  </div>
);

export const SlotGradeSettings = ({ classSubjectId, canEdit = false, onToast, onSettings }) => {
  const { t } = useT();
  const [settings, setSettings] = useState(null);
  /* The school's own, for "follow the school (25/25/25/25)": read only for the teacher. */
  const [school, setSchool] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  /* A refusal saying this slot takes no change any more, kept as the reason. */
  const [locked, setLocked] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([gradingService.slotSettings(classSubjectId), canEdit ? gradingService.schoolSettings().catch(() => null) : null])
      .then(([slot, schoolSettings]) => {
        if (cancelled) return;
        setSettings(slot);
        setSchool(schoolSettings);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [classSubjectId, canEdit, attempt]);

  /* The host hears every settings change (the gradebook's KKTP marks). */
  useEffect(() => {
    if (settings) onSettings?.(settings);
  }, [settings, onSettings]);

  const reload = () => setAttempt((n) => n + 1);
  const editing = Boolean(draft);
  const change = (patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors({});
  };

  const save = async (e) => {
    e.preventDefault();
    if (isSaving || !settings || !draft) return;
    const found = slotDraftErrors(draft);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    const plan = slotChange(settings, draft);
    if (!plan) {
      setErrors({ global: t('classes.edit.nothing') });
      return;
    }
    setIsSaving(true);
    try {
      const next =
        plan.method === 'DELETE'
          ? await gradingService.clearSlotSettings(classSubjectId, plan.body.updatedAt)
          : await gradingService.setSlotSettings(classSubjectId, plan.body);
      setSettings(next);
      setDraft(null);
      setErrors({});
      onToast?.(t(plan.method === 'DELETE' ? 'grading.slot.cleared' : 'grading.saved'), 'success');
    } catch (err) {
      const message = gradingErrorMessage(err, t);
      if (isGradingLocked(err)) {
        setLocked(message);
        setDraft(null);
        setErrors({});
      } else {
        setErrors({ global: message });
        if (isStaleGrading(err)) {
          setDraft(null);
          reload();
        }
      }
    } finally {
      setIsSaving(false);
    }
  };

  /* What "follow the school" means here, when the school's read answered. */
  const schoolWeights = school ? ` (${weightsLine(school.weights.value)})` : '';
  const schoolKktp = school ? ` (${school.kktp.value})` : '';

  if (failed && !settings) {
    return (
      <div className={`${card} flex flex-wrap items-center gap-3`} role="alert">
        <p className="text-sm font-semibold text-amber-700">{t('grading.failed')}</p>
        <button
          type="button"
          onClick={reload}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          {t('att.error.retry')}
        </button>
      </div>
    );
  }

  if (!settings) return <div className={`${card} h-32 animate-pulse`} aria-label={t('common.loading')} />;

  return (
    <section className={`${card} space-y-4 text-left`} aria-labelledby={`grading-${classSubjectId}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`grading-${classSubjectId}`} className="text-base font-extrabold text-slate-900 tracking-tight">
            {t('grading.slot.title')}
          </h3>
          <p className="text-[13px] font-medium text-slate-500 leading-relaxed mt-0.5">{t('grading.slot.body')}</p>
        </div>
        {canEdit && !locked && !editing && (
          <Button variant="outline" size="sm" onClick={() => setDraft(slotDraftOf(settings))} className="shrink-0">
            {t('grading.slot.edit')}
          </Button>
        )}
      </div>

      {locked && (
        <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-600 leading-relaxed">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
          {locked}
        </p>
      )}

      {!editing ? (
        <>
          <SettingsSummary settings={settings} t={t} />
          {errors.global && (
            <p className="text-xs font-semibold text-red-600" role="alert">
              {errors.global}
            </p>
          )}
        </>
      ) : (
        <form onSubmit={save} className="space-y-5" noValidate>
          <fieldset className="space-y-3">
            <legend className="block text-sm font-bold text-slate-700 mb-2">{t('grading.weights.legend')}</legend>
            <FollowChoice
              name={`weights-${classSubjectId}`}
              own={draft.ownWeights}
              onOwn={(own) => change({ ownWeights: own })}
              followLabel={t('grading.slot.followSchool') + schoolWeights}
              ownLabel={t('grading.slot.own')}
              disabled={isSaving}
            />
            {draft.ownWeights && (
              <WeightFields
                idPrefix={`slotWeight-${classSubjectId}`}
                values={draft.weights}
                onChange={(type, value) => change({ weights: { ...draft.weights, [type]: value } })}
                errors={errors.weights}
                disabled={isSaving}
                t={t}
              />
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="block text-sm font-bold text-slate-700 mb-2">{t('grading.kktp.label')}</legend>
            <FollowChoice
              name={`kktp-${classSubjectId}`}
              own={draft.ownKktp}
              onOwn={(own) => change({ ownKktp: own })}
              followLabel={t('grading.slot.followSchool') + schoolKktp}
              ownLabel={t('grading.slot.own')}
              disabled={isSaving}
            />
            {draft.ownKktp && (
              <div className="space-y-1.5">
                <WholeBox
                  id={`slotKktp-${classSubjectId}`}
                  label={t('grading.kktp')}
                  value={draft.kktp}
                  onChange={(value) => change({ kktp: value })}
                  error={errors.kktp}
                  disabled={isSaving}
                  className="max-w-[8rem]"
                />
                {errors.kktp && <p className="text-xs font-semibold text-red-600">{t(errors.kktp)}</p>}
              </div>
            )}
          </fieldset>

          <p className="text-xs font-medium text-slate-500 leading-relaxed">
            {t('grading.slot.ruleNote', { rule: t(`grading.rule.${settings.remedialRule.value}`) })}
          </p>

          {errors.global && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
              {errors.global}
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(null);
                setErrors({});
              }}
              isDisabled={isSaving}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="sm" isLoading={isSaving}>
              {t('classes.edit.save')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
};

export default SlotGradeSettings;
