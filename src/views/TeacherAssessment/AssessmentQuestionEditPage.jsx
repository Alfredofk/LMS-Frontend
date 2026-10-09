import React, { useEffect, useId, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertCircle, Lock, RefreshCw } from 'lucide-react';

import FactLine from '../../components/ui/FactLine';
import { useSchoolToday } from '../../hooks/useSchoolToday';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage, copyEditErrorMessage, isStaleCopy } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { assessmentService } from '../../services/assessmentService';
import QuestionContentFields from '../QuestionBank/QuestionContentFields';
import { copyPayload, draftChanged, draftFrom, questionErrors } from '../QuestionBank/questionBank';
import { actionsOf, semesterOf } from './teacherAssessment';

/*
  One question of an assessment edited in place (backend 6380e3e; owner
  2026-10-09: a full page, as the bank's editor, its points left on the list).
  /teacher/courses/:classSubjectId/penilaian/:assessmentId/soal/:questionId.

  - Only this copy changes; the bank question stays as it is, and the list then
    offers its version back ("Pakai versi Bank Soal").
  - Saved over the assessment version read (`updatedAt`): anything saved since,
    here or on the list, answers 409 and the page offers to read it again.
  - Published with answers in: a change to what students see voids them, a change
    to the key alone marks them again - said on the page before saving.
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
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const guard = useUnsavedGuard(Boolean(baseline) && draftChanged(draft, baseline));

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

  const save = async () => {
    const found = questionErrors(draft, { editing: true, today });
    setErrors(found);
    if (Object.keys(found).length) {
      setFailure({ message: t('qbank.editor.fixErrors') });
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await assessmentService.editCopy(assessmentId, questionId, copyPayload(draft), state.assessment.updatedAt);
      showToast?.(t('tasm.toast.copySaved'), 'success');
      guard.release();
      navigate(back);
    } catch (err) {
      setBusy(false);
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
        {assessment.status === 'PUBLISHED' && <p className={note}>{t('tasm.editCopy.publishedNote')}</p>}
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
        t={t}
      />

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
        <button type="button" onClick={save} disabled={busy} className={`${tool} px-5 py-2.5 text-sm bg-brand text-white hover:bg-brand-deep`}>
          {busy ? t('common.loading') : t('qbank.editor.saveChanges')}
        </button>
      </div>
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
