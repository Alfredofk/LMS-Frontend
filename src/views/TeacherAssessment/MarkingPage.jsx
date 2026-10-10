import React, { useEffect, useId, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertCircle, ArrowRight, Check, CheckCircle2, Circle, FileText, Lock, RefreshCw } from 'lucide-react';

import FactLine from '../../components/ui/FactLine';
import QuestionImage from '../../components/questionBank/QuestionImage';
import { useSchoolZoneState } from '../../hooks/useSchoolToday';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import { openFileInNewTab } from '../../utils/openFile';
import { localOf } from '../Attendance/attendance';
import { formatSchoolDay } from '../QuestionBank/questionBank';
import { forgetMarkingQueue } from './markingQueue';
import { notifyPendingChanged } from '../../hooks/usePendingCounts';
import { cancelReasonError } from './teacherAssessment';
import {
  canMark,
  chosenOptions,
  formatNumber,
  markBody,
  markDraftFrom,
  markErrors,
  nextToMark,
  pointsChanged,
  takesComment,
  takesPoints,
} from './results';

/*
  One attempt, marked by its teacher (backend 5255842, ticket 04; owner 2026-10-10:
  a full page, saved once) - /teacher/courses/:classSubjectId/penilaian/
  :assessmentId/hasil/:submissionId.

  - Every question it showed, in the assessment's order: the student's answer
    beside the key, the automatic points, and for a SHORT or an ESSAY answered the
    teacher's points (0 to the question's, two decimals; a SHORT's box emptied
    gives its automatic points back). A comment per answer and one on the attempt.
  - One PUT with what changed. A draft until release; released, changed points
    need a reason, asked on the page, which the corrected score carries.
  - "Berikutnya" opens the next attempt waiting for marking, from the results.
  - Read only when the reader does not answer for it, the assessment is not
    published, or the attempt is in progress or void.
  - `Marking` is also opened in place, read only, by AssessmentReader for the
    homeroom teacher and the leaders (`embedded`: no page heading, no next).
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const tool =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';
const fieldLabel = 'block text-xs font-bold text-slate-700';
const errorText = 'text-xs font-semibold text-red-600';
const note = 'text-[11px] font-medium text-slate-500';
const box =
  'w-full rounded-xl border bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 disabled:text-slate-500';

const errorWords = (error, t) => (typeof error === 'string' ? t(error) : t(error.key, error.vars));

const when = (instant, zone, lang) => {
  const local = instant ? localOf(instant, zone) : null;
  return local ? `${formatSchoolDay(local.date, lang)} ${local.time}` : '';
};

/* What the student answered, beside the key. */
const StudentAnswer = ({ question, assessmentId, submissionId, t }) => {
  const [opening, setOpening] = useState(false);
  const [fileError, setFileError] = useState(null);
  if (question.answer === null) return <p className="text-sm font-semibold text-slate-500">{t('tasm.mark.unanswered')}</p>;

  if (question.kind === 'MCQ') {
    return (
      <ol className="space-y-2">
        {chosenOptions(question).map((option) => (
          <li
            key={option.id}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${option.chosen ? (option.correct ? 'border-emerald-300 bg-emerald-50' : 'border-rose-200 bg-rose-50') : option.correct ? 'border-emerald-200' : 'border-slate-200'}`}
          >
            <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-xs font-extrabold flex items-center justify-center shrink-0">{option.letter}</span>
            <span className="min-w-0 flex-1 space-y-1.5">
              {option.text && <span className="block text-sm font-semibold text-slate-800 break-words">{option.text}</span>}
              {option.imageId && <QuestionImage imageId={option.imageId} assessmentId={assessmentId} className="max-h-32" />}
            </span>
            <span className="flex flex-col items-end gap-0.5 shrink-0 text-[11px] font-extrabold">
              {option.chosen && <span className={option.correct ? 'text-emerald-700' : 'text-rose-700'}>{t('tasm.mark.chosen')}</span>}
              {option.correct ? (
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('qbank.correct')}
                </span>
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-300" aria-hidden="true" />
              )}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  if (question.kind === 'TF') {
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-slate-700">
        <span>{t('tasm.mark.studentSaid', { answer: question.answer.value === null ? '-' : t(question.answer.value ? 'qbank.tf.true' : 'qbank.tf.false') })}</span>
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <Check className="w-4 h-4" aria-hidden="true" />
          {t('tasm.mark.keySaid', { answer: t(question.value ? 'qbank.tf.true' : 'qbank.tf.false') })}
        </span>
      </div>
    );
  }

  if (question.kind === 'SHORT') {
    return (
      <div className="space-y-1.5">
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 break-words whitespace-pre-wrap">{question.answer.text || '-'}</p>
        <p className="text-xs font-semibold text-emerald-700 break-words">{t('tasm.mark.accepted', { list: (question.accepted ?? []).join(', ') })}</p>
      </div>
    );
  }

  /* ESSAY: its text and its file, if any. */
  const { text, file } = question.answer;
  const openFile = async () => {
    setOpening(true);
    setFileError(null);
    try {
      await openFileInNewTab(() => assessmentService.markingFile(assessmentId, submissionId, question.id));
    } catch (err) {
      setFileError(assessmentErrorMessage(err, t));
    } finally {
      setOpening(false);
    }
  };
  return (
    <div className="space-y-2">
      {text?.trim() ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 break-words whitespace-pre-wrap">{text}</p>
      ) : (
        !file && <p className="text-sm font-semibold text-slate-500">{t('tasm.mark.emptyEssay')}</p>
      )}
      {file && (
        <button type="button" onClick={openFile} disabled={opening} className={`${tool} border border-slate-200 text-slate-700 hover:bg-slate-50`}>
          <FileText className="w-4 h-4" aria-hidden="true" />
          {opening ? t('common.loading') : t('tasm.mark.openFile', { name: file.name })}
        </button>
      )}
      {fileError && <p className={errorText}>{fileError}</p>}
    </div>
  );
};

/**
 * @param assessmentId, submissionId  what is read
 * @param onBack    () => void - back to the results
 * @param onOpen    (submissionId) => void - another attempt (the next to mark)
 * @param embedded  opened in place inside a reader: no page heading
 */
export const Marking = ({ assessmentId, submissionId, onBack, onOpen, embedded = false }) => {
  const { t, lang } = useT();
  const baseId = useId();
  const { showToast } = useOutletContext() ?? {};
  const { zone } = useSchoolZoneState();

  /* undefined reading · the marking view · { error } */
  const [view, setView] = useState(undefined);
  const [students, setStudents] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState(null);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);

  const adopt = (answer) => {
    setView(answer);
    setDraft(markDraftFrom(answer));
    setReason('');
    setErrors({});
  };

  useEffect(() => {
    let cancelled = false;
    assessmentService
      .marking(assessmentId, submissionId)
      .then((answer) => !cancelled && (adopt(answer), setFailure(null)))
      .catch((err) => !cancelled && setView({ error: assessmentErrorMessage(err, t) }));
    if (!embedded)
      assessmentService
        .results(assessmentId)
        .then((answer) => !cancelled && setStudents(answer.students ?? []))
        .catch(() => !cancelled && setStudents(null));
    return () => {
      cancelled = true;
    };
  }, [assessmentId, submissionId, attempt, t, embedded]);

  /* Embedded in a reader, nothing is changed whatever canManage says (see ResultsTab). */
  const editable = !embedded && Boolean(view && !view.error && canMark(view));
  const body = editable && draft ? markBody(draft, view, reason) : null;
  const released = view?.submission?.status === 'RELEASED';
  const needsReason = editable && released && draft && pointsChanged(draft, view);
  const guard = useUnsavedGuard(Boolean(body));

  if (view === undefined) {
    return <div className="h-96 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
  }
  if (view.error) {
    return (
      <div className={`${card} flex flex-col items-center text-center gap-3 py-10`} role="alert">
        <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-700 max-w-sm">{view.error}</p>
        <button type="button" onClick={onBack} className={`${tool} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
          {t('tasm.mark.back')}
        </button>
      </div>
    );
  }

  const { assessment, submission, scores, questions } = view;
  const next = students ? nextToMark(students, submission.id) : null;
  const mark = submission.score ?? submission.mark;

  const setAnswer = (questionId, patch) => {
    setDraft((prev) => ({ ...prev, answers: { ...prev.answers, [questionId]: { ...prev.answers[questionId], ...patch } } }));
    setErrors((prev) => ({ ...prev, [questionId]: undefined, [`${questionId}:comment`]: undefined }));
    setFailure(null);
  };

  const save = async () => {
    const found = markErrors(draft, view);
    if (needsReason) {
      const reasonError = cancelReasonError(reason);
      if (reasonError) found.reason = reasonError.key === 'tasm.error.reasonEmpty' ? 'tasm.error.fixReasonEmpty' : reasonError.key;
    }
    setErrors(found);
    if (Object.keys(found).length) {
      setFailure({ message: t('tasm.error.fix') });
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const answer = await assessmentService.mark(assessmentId, submissionId, body);
      forgetMarkingQueue();
      notifyPendingChanged();
      adopt(answer);
      showToast?.(t('tasm.toast.marked'), 'success');
      assessmentService
        .results(assessmentId)
        .then((fresh) => setStudents(fresh.students ?? []))
        .catch(() => {});
    } catch (err) {
      setFailure({ message: assessmentErrorMessage(err, t), stale: err?.status === 409 });
    } finally {
      setBusy(false);
    }
  };

  const readOnlyWhy = embedded
    ? 'tasm.reader.readOnly'
    : !assessment.canManage
    ? 'tasm.mark.readOnly.notYours'
    : assessment.status !== 'PUBLISHED'
      ? 'tasm.mark.readOnly.cancelled'
      : submission.status === 'IN_PROGRESS'
        ? 'tasm.mark.readOnly.inProgress'
        : submission.status === 'VOID'
          ? 'tasm.mark.readOnly.void'
          : null;

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6 max-w-3xl'}>
      <div className="space-y-2">
        {embedded ? (
          <p className="text-base font-extrabold text-slate-900 break-words">{submission.student.fullName ?? t('tasm.results.unnamed')}</p>
        ) : (
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight break-words">{submission.student.fullName ?? t('tasm.results.unnamed')}</h1>
        )}
        <FactLine
          code={assessment.classSubject.subject.code}
          name={assessment.classSubject.subject.name}
          facts={[
            assessment.classSubject.class.name,
            assessment.title,
            /* An offline mark is no attempt: one per student, entered by the teacher. */
            submission.closedBy === 'TEACHER' ? t('tasm.mark.offlineMark') : t('tasm.results.attempt', { n: submission.attempt }),
          ]}
        />
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-slate-500">
          <span>{t(`tasm.results.attemptStatus.${submission.status}`)}</span>
          {submission.submittedAt && <span className="tabular-nums">{when(submission.submittedAt, zone, lang)}</span>}
          {submission.late && <span className="text-amber-700">{t('tasm.results.late')}</span>}
          {mark && (
            <span className="tabular-nums text-slate-700">
              {submission.score ? t('tasm.mark.score', { value: formatNumber(mark.value, lang) }) : t('tasm.results.draftMark', { value: formatNumber(mark.value, lang) })}
              {mark.pointsTotal !== null && ` (${t('tasm.results.points', { earned: formatNumber(mark.pointsEarned, lang), total: mark.pointsTotal })})`}
            </span>
          )}
        </p>
      </div>

      {readOnlyWhy && (
        <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-600 leading-relaxed">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
          {t(readOnlyWhy, { reason: submission.voidReason ?? '' })}
        </p>
      )}
      {editable && <p className={note}>{t(released ? 'tasm.mark.releasedNote' : 'tasm.mark.draftNote')}</p>}

      <ol className="space-y-4">
        {questions.map((question, index) => {
          const entry = draft.answers[question.id];
          const error = errors[question.id];
          const commentError = errors[`${question.id}:comment`];
          return (
            <li key={question.id} className={`${embedded ? 'rounded-xl border border-slate-200 p-3.5' : card} space-y-3`}>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-extrabold flex items-center justify-center shrink-0">{index + 1}</span>
                <span className="text-xs font-bold text-slate-600">{t(`qbank.kind.${question.kind}`)}</span>
                <span className="text-xs font-semibold text-slate-500">{t('tasm.mark.worth', { n: question.points })}</span>
                {question.needsMarking && <span className="text-xs font-bold text-amber-700">{t('tasm.results.status.WAITING_FOR_MARKING')}</span>}
                <span className="ml-auto text-xs font-bold text-slate-700 tabular-nums">
                  {t('tasm.mark.earned', { earned: formatNumber(question.earned, lang), total: question.points })}
                </span>
              </div>
              <div className="content-html text-sm text-slate-800 break-words" dangerouslySetInnerHTML={{ __html: question.body ?? '' }} />
              {question.imageId && <QuestionImage imageId={question.imageId} assessmentId={assessmentId} className="max-h-56" />}

              <StudentAnswer question={question} assessmentId={assessmentId} submissionId={submissionId} t={t} />

              {question.kind === 'SHORT' && question.answer !== null && (
                <p className={note}>{t('tasm.mark.auto', { n: formatNumber(question.autoPoints, lang) })}</p>
              )}

              {editable && takesPoints(question) && (
                <div className="space-y-1">
                  <label htmlFor={`${baseId}-pts-${question.id}`} className={fieldLabel}>
                    {t('tasm.mark.points', { n: question.points })}
                  </label>
                  <input
                    id={`${baseId}-pts-${question.id}`}
                    type="text"
                    inputMode="decimal"
                    value={entry.points}
                    disabled={busy}
                    aria-invalid={Boolean(error)}
                    onChange={(e) => setAnswer(question.id, { points: e.target.value })}
                    className={`${box} w-28 ${error ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  {error ? <p className={errorText}>{errorWords(error, t)}</p> : <p className={note}>{t(question.kind === 'SHORT' ? 'tasm.mark.shortHint' : 'tasm.mark.essayHint')}</p>}
                </div>
              )}
              {!editable && question.teacherPoints !== null && <p className={note}>{t('tasm.mark.teacherGave', { n: formatNumber(question.teacherPoints, lang) })}</p>}

              {editable && takesComment(question) ? (
                <div className="space-y-1">
                  <label htmlFor={`${baseId}-c-${question.id}`} className={fieldLabel}>
                    {t('tasm.mark.comment')}
                  </label>
                  <textarea
                    id={`${baseId}-c-${question.id}`}
                    rows={2}
                    value={entry.comment}
                    maxLength={2000}
                    disabled={busy}
                    onChange={(e) => setAnswer(question.id, { comment: e.target.value })}
                    className={`${box} resize-y ${commentError ? 'border-red-400' : 'border-slate-200'}`}
                  />
                  {commentError && <p className={errorText}>{t(commentError)}</p>}
                </div>
              ) : (
                question.comment && <p className="text-sm font-medium text-slate-700 break-words">{t('tasm.mark.commentSaid', { comment: question.comment })}</p>
              )}
            </li>
          );
        })}
      </ol>

      <section className={`${card} space-y-4`} aria-labelledby={`${baseId}-overall`}>
        <h2 id={`${baseId}-overall`} className="text-base font-extrabold text-slate-900">
          {t('tasm.mark.overall')}
        </h2>
        {editable ? (
          <div className="space-y-1">
            <label htmlFor={`${baseId}-comment`} className={fieldLabel}>
              {t('tasm.mark.overallComment')}
            </label>
            <textarea
              id={`${baseId}-comment`}
              rows={3}
              value={draft.comment}
              maxLength={2000}
              disabled={busy}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, comment: e.target.value }));
                setErrors((prev) => ({ ...prev, comment: undefined }));
                setFailure(null);
              }}
              className={`${box} resize-y ${errors.comment ? 'border-red-400' : 'border-slate-200'}`}
            />
            {errors.comment ? <p className={errorText}>{t(errors.comment)}</p> : <p className={note}>{t('tasm.mark.commentHint')}</p>}
          </div>
        ) : (
          <p className="text-sm font-medium text-slate-700 break-words">{submission.comment || t('tasm.mark.noComment')}</p>
        )}

        {needsReason && (
          <div className="space-y-1">
            <label htmlFor={`${baseId}-reason`} className={fieldLabel}>
              {t('tasm.editCopy.reason')}
            </label>
            <textarea
              id={`${baseId}-reason`}
              rows={2}
              value={reason}
              maxLength={500}
              disabled={busy}
              onChange={(e) => {
                setReason(e.target.value);
                setErrors((prev) => ({ ...prev, reason: undefined }));
                setFailure(null);
              }}
              className={`${box} resize-y ${errors.reason ? 'border-red-400' : 'border-slate-200'}`}
            />
            {errors.reason ? <p className={errorText}>{t(errors.reason)}</p> : <p className={note}>{t('tasm.mark.reasonHint')}</p>}
          </div>
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

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center sm:justify-between">
          <button type="button" onClick={onBack} disabled={busy} className={`${tool} px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100`}>
            {t('tasm.mark.back')}
          </button>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            {next && editable && onOpen && (
              <button
                type="button"
                onClick={() => onOpen(next.id)}
                disabled={busy}
                className={`${tool} px-4 py-2.5 text-sm border border-slate-200 text-slate-700 hover:bg-slate-50`}
              >
                {t('tasm.mark.next', { name: next.fullName ?? '' })}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            {editable && (
              <button type="button" onClick={save} disabled={busy || !body} className={`${tool} px-5 py-2.5 text-sm bg-brand text-white hover:bg-brand-deep`}>
                {busy ? t('common.loading') : t('tasm.mark.save')}
              </button>
            )}
          </div>
        </div>
      </section>

      {scores.length > 0 && (
        <section className={`${card} space-y-3`} aria-labelledby={`${baseId}-history`}>
          <h2 id={`${baseId}-history`} className="text-base font-extrabold text-slate-900">
            {t('tasm.mark.history')}
          </h2>
          <ol className="space-y-2">
            {[...scores].reverse().map((score, i) => (
              <li key={`${score.recordedAt}-${i}`} className="rounded-xl bg-slate-50 px-3 py-2 space-y-0.5">
                <p className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs font-semibold text-slate-600">
                  <span className="font-extrabold text-slate-900 tabular-nums">{formatNumber(score.value, lang)}</span>
                  {score.pointsTotal !== null && <span className="tabular-nums">{t('tasm.results.points', { earned: formatNumber(score.pointsEarned, lang), total: score.pointsTotal })}</span>}
                  <span className="tabular-nums">{when(score.recordedAt, zone, lang)}</span>
                  {score.recordedBy?.fullName && <span>{score.recordedBy.fullName}</span>}
                  {i === 0 && <span className="text-emerald-700">{t('tasm.mark.counts')}</span>}
                </p>
                <p className="text-xs font-medium text-slate-600 break-words">{score.reason ? t('tasm.mark.correction', { reason: score.reason }) : t('tasm.mark.firstRelease')}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
      {guard.dialog}
    </div>
  );
};

/* Keyed on the address: another attempt starts afresh, never with this draft. */
export const MarkingPage = () => {
  const { classSubjectId, assessmentId, submissionId } = useParams();
  const navigate = useNavigate();
  const base = `/teacher/courses/${classSubjectId}/penilaian/${assessmentId}`;
  return (
    <Marking
      key={`${assessmentId}/${submissionId}`}
      assessmentId={assessmentId}
      submissionId={submissionId}
      onBack={() => navigate(`${base}?tab=hasil`)}
      onOpen={(id) => navigate(`${base}/hasil/${id}`)}
    />
  );
};

export default MarkingPage;
