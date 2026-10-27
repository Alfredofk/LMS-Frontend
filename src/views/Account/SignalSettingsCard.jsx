import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import Button from '../../components/ui/Button';
import { dashboardService } from '../../services/dashboardService';
import { useT } from '../../i18n/LanguageContext';
import { isStaleSignalSettings, signalSettingsErrorMessage } from '../../i18n/apiError';
import { SourceWord } from '../Grading/GradeSettingsParts';
import { forgetTeachingDashboard } from '../Dashboard/teachingDashboard';
import { backToBuiltIn, signalBody, signalDraftErrors, signalDraftOf, typed } from './signalSettings';

/*
  "Siswa perlu perhatian" on Settings, for the Principal and Vice Principals
  (backend 002298e, dashboard ticket 02; owner 2026-10-27, item D): the six
  thresholds a teacher's dashboard flags students at, each with where it comes
  from ("Bawaan" / "Diatur sekolah"). A value the school set has "Pakai bawaan",
  which puts the built-in value in the box and sends null on save. Saving sends
  only what changed with the updatedAt read; a save made meanwhile elsewhere is
  409, and the card reads again and says so. Below the KKTP has no number of its
  own: it is each subject's KKTP. A save drops the teacher's dashboard read, so
  the new numbers apply at once on this device.
*/

/* One line per threshold; a label only where a group starts. */
const ROWS = [
  { key: 'absenceCount', label: 'signal.absence.label', after: 'signal.absenceCount.after' },
  { key: 'absenceWindowDays', before: 'signal.absenceWindowDays.before', after: 'signal.absenceWindowDays.after' },
  { key: 'contentBehindPercent', label: 'signal.content.label', before: 'signal.contentBehindPercent.before', after: 'signal.contentBehindPercent.after' },
  { key: 'contentBehindMinPublished', before: 'signal.contentBehindMinPublished.before', after: 'signal.contentBehindMinPublished.after' },
  { key: 'notSubmittedCount', label: 'signal.notSubmitted.label', after: 'signal.notSubmittedCount.after' },
  { key: 'inactiveDays', label: 'signal.inactive.label', after: 'signal.inactiveDays.after' },
];

const box =
  'w-16 rounded-xl border bg-white py-1.5 px-2.5 text-base sm:text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 disabled:text-slate-500';

const SignalSettingsCard = ({ onToast }) => {
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
    dashboardService
      .signalSettings()
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

  const values = draft ?? signalDraftOf(settings);
  const body = settings ? signalBody(settings, values) : null;

  const edit = (next) => {
    setDraft(next);
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving || !settings) return;
    const found = signalDraftErrors(values);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    if (!body) return;
    setIsSaving(true);
    try {
      setSettings(await dashboardService.setSignalSettings(body));
      setDraft(null);
      setErrors({});
      forgetTeachingDashboard();
      onToast?.(t('signal.saved'), 'success');
    } catch (err) {
      setErrors({ global: signalSettingsErrorMessage(err, t) });
      if (isStaleSignalSettings(err)) {
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
        <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">{t('signal.title')}</h2>
        <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">{t('signal.body')}</p>
      </div>

      {failed && !settings ? (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm font-semibold text-amber-700">{t('signal.failed')}</p>
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
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-3">
            {ROWS.map(({ key, label, before, after }) => {
              const field = values[key];
              const saved = settings[key];
              const error = errors[key];
              return (
                <div key={key} className={`grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-4 gap-y-1 ${label ? '' : '-mt-1'}`}>
                  <span className="text-xs font-bold text-slate-600 sm:pt-2">{label ? t(label) : ''}</span>
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-700">
                      {before && <span>{t(before)}</span>}
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        aria-label={t(`signal.aria.${key}`)}
                        aria-invalid={Boolean(error)}
                        value={field.text}
                        disabled={isSaving}
                        onChange={(e) => edit(typed(values, key, e.target.value))}
                        className={`${box} ${error ? 'border-red-500' : 'border-slate-200'}`}
                      />
                      <span>{t(after)}</span>
                      {field.reset ? (
                        <span className="text-xs font-semibold text-amber-700">{t('signal.willReset')}</span>
                      ) : (
                        <>
                          <SourceWord source={saved.source} t={t} />
                          {saved.source === 'SCHOOL' && (
                            <button
                              type="button"
                              onClick={() => edit(backToBuiltIn(values, key))}
                              disabled={isSaving}
                              className="text-xs font-semibold text-brand hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                            >
                              {t('signal.useBuiltIn')}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    {error && <p className="text-xs font-semibold text-red-600">{t(error.key, error.vars)}</p>}
                  </div>
                </div>
              );
            })}
            <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-4 gap-y-1">
              <span className="text-xs font-bold text-slate-600">{t('signal.kktp.label')}</span>
              <span className="text-sm text-slate-700">{t('signal.kktp.value')}</span>
            </div>
          </div>

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
            <Button type="submit" isLoading={isSaving} isDisabled={!body && !Object.keys(signalDraftErrors(values)).length}>
              {t('classes.edit.save')}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
};

export default SignalSettingsCard;
