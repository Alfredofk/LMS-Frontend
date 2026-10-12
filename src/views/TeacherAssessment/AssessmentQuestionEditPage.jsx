import React, { useEffect, useId, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertCircle, Lock, RefreshCw } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';

import FactLine from '../../components/ui/FactLine';
import { useSchoolToday } from '../../hooks/useSchoolToday';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage, copyEditErrorMessage, isStaleCopy } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { assessmentService } from '../../services/assessmentService';
import QuestionContentFields from '../QuestionBank/QuestionContentFields';
import { copyPayload, draftChanged, draftFrom, questionErrors, shownChanged } from '../QuestionBank/questionBank';
import {
  MAX_POINTS,
  MAX_REASON,
  MIN_POINTS,
  actionsOf,
  isReleased,
  releasedFixBody,
  releasedFixChanged,
  releasedFixErrors,
  semesterOf,
} from './teacherAssessment';

/*
  One question of an assessment edited in place (backend 6380e3e; owner
  2026-10-09: a full page, as the bank's editor, its points left on the list).
  /teacher/courses/:classSubjectId/penilaian/:assessmentId/soal/:questionId.

  - Only this copy changes; the bank question stays as it is, and the list then
    offers its version back ("Pakai versi Bank Soal").
  - Saved over the assessment version read (`updatedAt`): anything saved since,
    here or on the list, answers 409 and the page offers to read it again.
  - Published with answers in: a change to what students see voids them, a change
    to the key alone marks them again - said on the page with the number of answers
    in (`liveSubmissions`, backend 5cabd3d), and a save that voids asks first
    (owner, 2026-10-12).
  - Released (backend 5255842; owner 2026-10-10): what students were shown is
    locked (`keyOnly`), and the key and the points - here, since the list is
    locked too - are fixed with a reason (1-500), asked on the page as soon as
    either changes. Each released score the fix moves gets a correction with it.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const tool =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';
const note = 'text-[11px] font-medium text-slate-500';

const AssessmentQuestionEditor = () => {
  const { t } = useT();
  const navigate = useNavigate();
  const { classSubjectId, assessmentId, questionId } = useParams();
  const today = useSchoolToday();
  const baseId = useId();
  const { showToast } = useOutletContext() ?? {};
  const back = `/teacher/courses/${classSubjectId}/penilaian/${assessmentId}`;

  /* undefined reading · { assessment, copy, number, editable } · { error } */
  const [state, setState] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState(null);
  const [baseline, setBaseline] = useState(null);
  /* A released copy's fix: its points (the list is locked) and the reason. */
  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [askVoid, setAskVoid] = useState(false);
  const keyChanged = Boolean(baseline) && draftChanged(draft, baseline);
  const released = isReleased(state?.assessment);
  const fixChanged = released && releasedFixChanged({ keyChanged, points, savedPoints: state.copy.points });
  const guard = useUnsavedGuard(released ? fixChanged : keyChanged);

  useEffect(() => {
    let cancelled = false;
    Promise.all([assessmentService.getAssessment(assessmentId), academicsService.academicYears().catch(() => null)])
      .then(([assessment, years]) => {
        if (cancelled) return;
        const index = (assessment.questions ?? []).findIndex((question) => question.id === questionId);
        if (index < 0) {
          setState({ error: t('tasm.editCopy.gone') });
          return;
        }
        const semester = semesterOf(years, assessment.classSubject.semester.id);
        const yearClosed = Boolean(semester) && semester.academicYear.status !== 'ACTIVE';
        const copy = assessment.questions[index];
        setState({ assessment, copy, number: index + 1, editable: actionsOf(assessment, { readOnly: yearClosed }).edit });
        setDraft(draftFrom(copy, today));
        setBaseline(draftFrom(copy, today));
        setPoints(String(copy.points));
        setReason('');
        setErrors({});
        setFailure(null);
      })
      .catch((err) => !cancelled && setState({ error: assessmentErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
    // today is read once per load: a draft is not rebuilt at midnight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, questionId, attempt, t]);

  const update = (patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setFailure(null);
  };

  const live = state?.assessment?.liveSubmissions ?? null;

  /* confirmed: asked first when the change voids answers in (owner, 2026-10-12). */
  const save = async (confirmed = false) => {
    const found = { ...questionErrors(draft, { editing: true, today }), ...(released ? releasedFixErrors({ points, reason }) : {}) };
    setErrors(found);
    if (Object.keys(found).length) {
      setFailure({ message: t('qbank.editor.fixErrors') });
      return;
    }
    if (!confirmed && !released && state.assessment.status === 'PUBLISHED' && live > 0 && shownChanged(draft, baseline)) {
      setAskVoid(true);
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const content = released ? releasedFixBody(copyPayload(draft), { points, reason }) : copyPayload(draft);
      await assessmentService.editCopy(assessmentId, questionId, content, state.assessment.updatedAt);
      showToast?.(t('tasm.toast.copySaved'), 'success');
      guard.release();
      navigate(back);
    } catch (err) {
      setBusy(false);
      setAskVoid(false);
      setFailure({ message: copyEditErrorMessage(err, t), stale: isStaleCopy(err) });
    }
  };

  if (state === undefined) {
    return <div className="h-96 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
  }
  if (state.error || !state.editable) {
    return (
      <div className={`${card} flex flex-col items-center text-center gap-3 py-10`} role={state.error ? 'alert' : undefined}>
        {state.error ? <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" /> : <Lock className="w-8 h-8 text-slate-400" aria-hidden="true" />}
        <p className="text-sm font-bold text-slate-700 max-w-sm">{state.error ?? t('tasm.editCopy.readOnly')}</p>
        <button type="button" onClick={() => navigate(back)} className={`${tool} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
          {t('tasm.editCopy.back')}
        </button>
      </div>
    );
  }

  const { assessment, copy, number } = state;
  const subject = assessment.classSubject.subject;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('tasm.editCopy.title', { n: number })}</h1>
        <FactLine code={subject.code} name={subject.name} facts={[assessment.title, t(`qbank.kind.${copy.kind}`)]} />
      </div>

      <div className="space-y-1">
        <p className={note}>{t('tasm.editCopy.bankNote')}</p>
        {released ? (
          <p className={note}>{t('tasm.editCopy.releasedNote')}</p>
        ) : (
          assessment.status === 'PUBLISHED' && (
            <p className={note}>
              {live === null ? t('tasm.editCopy.publishedNote') : live > 0 ? t('tasm.editCopy.liveNote', { n: live }) : t('tasm.editCopy.noAnswersNote')}
            </p>
          )
        )}
      </div>

      <QuestionContentFields
        draft={draft}
        setDraft={setDraft}
        update={update}
        errors={errors}
        setErrors={setErrors}
        busy={busy}
        baseId={baseId}
        editorKey={assessment.updatedAt}
        imageSource={{ assessmentId }}
        keyOnly={released}
        t={t}
      />

      {released && (
        <section className={`${card} space-y-4`} aria-labelledby={`${baseId}-fix`}>
          <h2 id={`${baseId}-fix`} className="text-base font-extrabold text-slate-900">
            {t('tasm.editCopy.fixTitle')}
          </h2>
          <div className="space-y-1.5">
            <label htmlFor={`${baseId}-points`} className="block text-sm font-bold text-slate-700">
              {t('tasm.points')}
            </label>
            <input
              id={`${baseId}-points`}
              type="number"
              inputMode="numeric"
              min={MIN_POINTS}
              max={MAX_POINTS}
              value={points}
              disabled={busy}
              aria-invalid={Boolean(errors.points)}
              onChange={(e) => {
                setPoints(e.target.value);
                setErrors((prev) => ({ ...prev, points: undefined }));
                setFailure(null);
              }}
              className="block w-24 rounded-xl border border-slate-200 bg-white py-2 px-3 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 disabled:text-slate-500"
            />
            {errors.points && <p className="text-xs font-semibold text-red-600">{t(errors.points)}</p>}
          </div>
          {fixChanged && (
            <div className="space-y-1.5">
              <label htmlFor={`${baseId}-reason`} className="block text-sm font-bold text-slate-700">
                {t('tasm.editCopy.reason')}
              </label>
              <textarea
                id={`${baseId}-reason`}
                rows={3}
                value={reason}
                maxLength={MAX_REASON}
                disabled={busy}
                aria-invalid={Boolean(errors.reason)}
                onChange={(e) => {
                  setReason(e.target.value);
                  setErrors((prev) => ({ ...prev, reason: undefined }));
                  setFailure(null);
                }}
                className={`w-full resize-y rounded-xl border bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand ${
                  errors.reason ? 'border-red-400' : 'border-slate-200'
                }`}
              />
              {errors.reason ? (
                <p className="text-xs font-semibold text-red-600">{t(errors.reason)}</p>
              ) : (
                <p className={note}>{t('tasm.editCopy.reasonHint')}</p>
              )}
            </div>
          )}
        </section>
      )}

      {failure && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold space-y-2" role="alert">
          <p>{failure.message}</p>
          {failure.stale && (
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`${tool} bg-white border border-red-200 text-red-700 hover:bg-red-50`}>
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              {t('tasm.reload')}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        <button type="button" onClick={() => navigate(back)} disabled={busy} className={`${tool} px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100`}>
          {t('common.cancel')}
        </button>
        <button type="button" onClick={() => save()} disabled={busy || (released && !fixChanged)} className={`${tool} px-5 py-2.5 text-sm bg-brand text-white hover:bg-brand-deep`}>
          {busy ? t('common.loading') : t('qbank.editor.saveChanges')}
        </button>
      </div>
      <ConfirmDialog
        open={askVoid}
        tone="danger"
        title={t('tasm.voidConfirm.title', { n: live ?? 0 })}
        body={t('tasm.voidConfirm.copyBody')}
        confirmLabel={t('tasm.voidConfirm.confirm')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        busyLabel={t('common.loading')}
        onConfirm={() => save(true)}
        onCancel={() => !busy && setAskVoid(false)}
      />
      {guard.dialog}
    </div>
  );
};

/* Keyed on the address: another question's page starts afresh, never with this draft. */
export const AssessmentQuestionEditPage = () => {
  const { assessmentId, questionId } = useParams();
  return <AssessmentQuestionEditor key={`${assessmentId}/${questionId}`} />;
};

export default AssessmentQuestionEditPage;
