import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { AlertCircle, RefreshCw, Send } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FactLine from '../../components/ui/FactLine';
import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import { localOf } from '../Attendance/attendance';
import { formatSchoolDay } from '../QuestionBank/questionBank';
import { forgetMarkingQueue } from './markingQueue';
import { notifyPendingChanged } from '../../hooks/usePendingCounts';
import { cancelReasonError } from './teacherAssessment';
import ExceptionDialog from './ExceptionDialog';
import { canSetException, exceptionFacts } from './exceptions';
import {
  MAX_OFFLINE_MARK,
  attemptsNewestFirst,
  formatNumber,
  offlineBody,
  offlineDraftsFrom,
  offlineErrors,
  offlineNeedsReason,
  offlineSavedOf,
  releaseState,
} from './results';

/*
  "Hasil" on an assessment's page (backend 5255842, ticket 04; owner 2026-10-10):
  every student of the class over the semester with their status, the score that
  counts and their attempts; an attempt opens MarkingPage. "Rilis nilai" records
  the scores of what is closed and fully marked - asked first, with what still
  waits - and is offered to the answering teacher only, an online one once closed.
  A score is 0-100 with the points under it; a student who did not submit has
  none, which is not 0.

  An OFFLINE one's marks are typed here (owner 2026-10-10): a box per student
  (0-100, two decimals), a comment per row - filled from the results, which carry
  each attempt's comment since backend d13ded4, and shown open when one is stored -
  and one "Simpan nilai" sending what changed
  (PUT offline-marks, all or none). Released, a changed mark asks a reason. Release
  waits while marks are unsaved; the page's leave guard hears `onDirty`.

  Make-up and remedial (backend 1e6c749, ticket 05; owner 2026-10-11): a row's
  exception is one grey line under its status (FactLine), and an attempt started
  under a remedial says "Remedial". On an ONLINE one published, the answering
  teacher has "Susulan / remedial" per student placed now (ExceptionDialog).
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const tool =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';

const STATUS_TONE = {
  NOT_STARTED: 'text-slate-500',
  IN_PROGRESS: 'text-sky-700',
  WAITING_FOR_MARKING: 'text-amber-700',
  WAITING_FOR_RELEASE: 'text-brand',
  RELEASED: 'text-emerald-700',
  DID_NOT_SUBMIT: 'text-rose-700',
  VOID: 'text-slate-500',
};

const when = (instant, zone, lang) => {
  const local = instant ? localOf(instant, zone) : null;
  return local ? `${formatSchoolDay(local.date, lang)} ${local.time}` : '';
};

const errorText = 'text-xs font-semibold text-red-600';
const box =
  'rounded-xl border bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 disabled:text-slate-500';

/* One student's offline mark: the box, and the comment - open when one is stored, else on demand. */
const OfflineRow = ({ student, draft, error, commentError, busy, lang, t, onMark, onComment, onOpenComment, onHistory }) => {
  const id = student.studentProfileId;
  const saved = offlineSavedOf(student);
  const commentShown = draft.commentOpen || Boolean(draft.loadedComment);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <label htmlFor={`mark-${id}`} className="text-xs font-bold text-slate-700">
          {t('tasm.offline.mark', { n: MAX_OFFLINE_MARK })}
        </label>
        <input
          id={`mark-${id}`}
          type="text"
          inputMode="decimal"
          value={draft.mark}
          disabled={busy}
          aria-invalid={Boolean(error)}
          placeholder="-"
          onChange={(e) => onMark(e.target.value)}
          className={`${box} w-24 ${error ? 'border-red-400' : 'border-slate-200'}`}
        />
        {saved && !saved.released && <span className="text-[11px] font-medium text-slate-500">{t('tasm.offline.draft', { value: formatNumber(saved.value, lang) })}</span>}
        {/* A released mark's scores and corrections live on its attempt (Marking, read only for an offline one). */}
        {saved?.released && (
          <button type="button" onClick={onHistory} disabled={busy} className={`${tool} ml-auto border border-slate-200 text-slate-700 hover:bg-slate-50`}>
            {t('tasm.offline.history')}
          </button>
        )}
        {!commentShown && (
          <button type="button" onClick={onOpenComment} disabled={busy} className={`${tool} ml-auto border border-slate-200 text-slate-700 hover:bg-slate-50`}>
            {t('tasm.offline.comment')}
          </button>
        )}
      </div>
      {error && <p className={errorText}>{t(error)}</p>}
      {commentShown && (
        <textarea
          aria-label={t('tasm.offline.commentFor', { name: student.fullName ?? '' })}
          rows={2}
          value={draft.comment ?? ''}
          maxLength={2000}
          disabled={busy}
          onChange={(e) => onComment(e.target.value)}
          className={`${box} w-full resize-y ${commentError ? 'border-red-400' : 'border-slate-200'}`}
        />
      )}
      {commentError && <p className={errorText}>{t(commentError)}</p>}
    </div>
  );
};

/*
  `readOnly`: a reader's desk (AssessmentReader). The server's canManage follows the
  person, so a Principal who teaches the subject is told true; at the Principal's
  desk nothing is changed all the same - they mark and release as Teacher.
*/
export const ResultsTab = ({ assessment, zone, span = null, onReleased, onDirty, onOpen = null, bare = false, readOnly = false }) => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const { showToast } = useOutletContext() ?? {};
  /* undefined reading · { assessment, waiting, students } · { error } */
  const [data, setData] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  /* Offline marks: the form per student, the reason, and their errors. */
  const [drafts, setDrafts] = useState({});
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  /* The student whose make-up/remedial dialog is open. */
  const [excFor, setExcFor] = useState(null);

  const adoptResults = useCallback((answer) => {
    const students = answer.students ?? [];
    setData({ assessment: answer.assessment, waiting: answer.waiting, students });
    setDrafts(offlineDraftsFrom(students, lang));
    setReason('');
    setErrors({});
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    assessmentService
      .results(assessment.id)
      .then((answer) => !cancelled && adoptResults(answer))
      .catch((err) => !cancelled && setData({ error: assessmentErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [assessment.id, attempt, t, adoptResults]);

  const ready = Boolean(data && !data.error);
  const manages = !readOnly && Boolean((ready && data.assessment ? data.assessment : assessment).canManage);
  const entering = ready && assessment.mode === 'OFFLINE' && manages && (data.assessment ?? assessment).status === 'PUBLISHED';
  const body = entering ? offlineBody(drafts, data.students, reason) : null;
  const dirty = Boolean(body);
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  useEffect(() => () => onDirty?.(false), [onDirty]);

  /* A reader opens an attempt in place (onOpen); the teacher's page goes to the marking page. */
  const open = useCallback(
    (submissionId) =>
      onOpen ? onOpen(submissionId) : navigate(`/teacher/courses/${assessment.classSubject.id}/penilaian/${assessment.id}/hasil/${submissionId}`),
    [onOpen, navigate, assessment.classSubject.id, assessment.id]
  );
  const frame = bare ? '' : card;

  if (data === undefined) {
    return <div className="h-64 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
  }
  if (data.error) {
    return (
      <div className={`${frame} flex flex-col items-center text-center gap-3 py-10`} role="alert">
        <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-700 max-w-sm">{data.error}</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`${tool} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          {t('att.error.retry')}
        </button>
      </div>
    );
  }

  const { waiting, students } = data;
  /* The results carry the assessment as read now: its window or state may have moved since the page read it. */
  const current = { ...(data.assessment ?? assessment), canManage: manages };
  /* Unsaved marks would be left out of a release: save them first. */
  const release = dirty ? { show: true, enabled: false, why: 'tasm.offline.saveFirst' } : releaseState(current, waiting);
  const offline = assessment.mode === 'OFFLINE';
  const needsReason = entering && offlineNeedsReason(drafts, students);

  const setDraft = (studentProfileId, patch) => {
    setDrafts((prev) => ({ ...prev, [studentProfileId]: { ...prev[studentProfileId], ...patch } }));
    setErrors((prev) => ({ ...prev, [studentProfileId]: undefined, [`${studentProfileId}:comment`]: undefined, save: undefined }));
  };

  const saveMarks = async () => {
    const found = offlineErrors(drafts, students);
    if (needsReason) {
      const reasonError = cancelReasonError(reason);
      if (reasonError) found.reason = reasonError.key === 'tasm.error.reasonEmpty' ? 'tasm.error.fixReasonEmpty' : reasonError.key;
    }
    if (Object.keys(found).length) {
      setErrors({ ...found, save: 'tasm.error.fix' });
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const answer = await assessmentService.offlineMarks(current.id, body);
      forgetMarkingQueue();
      notifyPendingChanged();
      adoptResults(answer);
      showToast?.(t('tasm.toast.offlineSaved', { n: body.marks.length }), 'success');
    } catch (err) {
      setFailure(assessmentErrorMessage(err, t));
    } finally {
      setBusy(false);
    }
  };

  const excDone = (outcome) => {
    const name = excFor?.fullName ?? '';
    setExcFor(null);
    showToast?.(t(outcome === 'removed' ? 'tasm.exc.toast.removed' : 'tasm.exc.toast.saved', { name }), 'success');
    setAttempt((n) => n + 1);
  };

  const factText = (fact) =>
    t(fact.key, fact.key === 'tasm.exc.fact.makeUp' ? { opens: when(fact.vars.opens, zone, lang), closes: when(fact.vars.closes, zone, lang) } : fact.vars);

  const doRelease = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const outcome = await assessmentService.release(assessment.id);
      forgetMarkingQueue();
      notifyPendingChanged();
      setConfirming(false);
      showToast?.(t('tasm.toast.released', { n: outcome.released }), 'success');
      setAttempt((n) => n + 1);
      onReleased?.();
    } catch (err) {
      setConfirming(false);
      setFailure(assessmentErrorMessage(err, t));
      setAttempt((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${frame} space-y-4`} aria-label={t('tasm.tab.results')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-extrabold text-slate-900">{t('tasm.results.title', { n: students.length })}</h2>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
            <span>{t('tasm.results.waitingMarking', { n: waiting.marking })}</span>
            <span>{t('tasm.results.waitingRelease', { n: waiting.release })}</span>
            {!offline && <span>{t('tasm.results.inProgress', { n: waiting.inProgress })}</span>}
          </p>
        </div>
        {release.show && (
          <div className="flex flex-col items-start sm:items-end gap-1">
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={!release.enabled || busy}
              className={`${tool} px-4 py-2.5 text-sm bg-brand text-white hover:bg-brand-deep`}
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              {t('tasm.results.release')}
            </button>
            {release.why && (
              <p className="text-[11px] font-medium text-slate-500 sm:text-right max-w-xs">
                {t(release.why, { date: when(current.closesAt, zone, lang) })}
              </p>
            )}
          </div>
        )}
      </div>

      {entering && <p className="text-[11px] font-medium text-slate-500">{t('tasm.offline.hint')}</p>}
      {current.releasedAt && <p className="text-[11px] font-medium text-slate-500">{t('tasm.results.releasedNote')}</p>}

      {failure && (
        <p className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
          {failure}
        </p>
      )}

      {students.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">{t('tasm.results.empty')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {students.map((student) => (
            <li key={student.studentProfileId} className="py-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-bold text-slate-900 break-words">{student.fullName ?? t('tasm.results.unnamed')}</p>
                  <p className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-xs font-semibold">
                    <span className={STATUS_TONE[student.status]}>{t(`tasm.results.status.${student.status}`)}</span>
                    {!student.placedNow && <span className="text-slate-500">{t('tasm.results.movedAway')}</span>}
                  </p>
                  {student.exception && <FactLine size="xs" wrap facts={exceptionFacts(student.exception).map(factText)} />}
                  {canSetException(current, student, manages) && (
                    <button
                      type="button"
                      onClick={() => setExcFor(student)}
                      disabled={busy}
                      className="text-xs font-bold text-brand hover:text-brand-deep hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded disabled:opacity-50"
                    >
                      {t('tasm.exc.open')}
                    </button>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-extrabold text-slate-900 tabular-nums leading-tight">{formatNumber(student.countedScore, lang)}</p>
                  {student.countedScore !== null && <p className="text-[11px] font-medium text-slate-500">{t('tasm.results.scoreLabel')}</p>}
                </div>
              </div>

              {entering && (
                <OfflineRow
                  student={student}
                  draft={drafts[student.studentProfileId] ?? { mark: '', comment: '', loadedComment: null }}
                  error={errors[student.studentProfileId]}
                  commentError={errors[`${student.studentProfileId}:comment`]}
                  busy={busy}
                  lang={lang}
                  t={t}
                  onMark={(mark) => setDraft(student.studentProfileId, { mark })}
                  onComment={(comment) => setDraft(student.studentProfileId, { comment })}
                  onOpenComment={() => setDraft(student.studentProfileId, { commentOpen: true })}
                  onHistory={() => open(offlineSavedOf(student).submissionId)}
                />
              )}

              {!entering && student.attempts.length > 0 && (
                <ul className="space-y-1.5">
                  {attemptsNewestFirst(student.attempts).map((item) => {
                    const shown = item.score ?? (item.mark && item.status !== 'VOID' ? item.mark : null);
                    const isDraft = !item.score && Boolean(shown);
                    const markable = item.status === 'WAITING_FOR_MARKING' || item.status === 'WAITING_FOR_RELEASE' || item.status === 'RELEASED';
                    const label = manages && current.status === 'PUBLISHED' && markable ? 'tasm.results.mark' : 'tasm.results.view';
                    return (
                      <li key={item.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                        {!offline && <span className="font-bold text-slate-700">{t('tasm.results.attempt', { n: item.attempt })}</span>}
                        <span className={STATUS_TONE[item.status]}>{t(`tasm.results.attemptStatus.${item.status}`)}</span>
                        {item.submittedAt && <span className="tabular-nums">{when(item.submittedAt, zone, lang)}</span>}
                        {item.late && <span className="text-amber-700">{t('tasm.results.late')}</span>}
                        {item.remedial && <span className="text-brand">{t('tasm.results.remedial')}</span>}
                        {item.status === 'WAITING_FOR_MARKING' && item.waitingForMarking > 0 && <span>{t('tasm.results.essaysLeft', { n: item.waitingForMarking })}</span>}
                        {shown && (
                          <span className="tabular-nums text-slate-700">
                            {isDraft ? t('tasm.results.draftMark', { value: formatNumber(shown.value, lang) }) : formatNumber(shown.value, lang)}
                            {shown.pointsTotal !== null && ` (${t('tasm.results.points', { earned: formatNumber(shown.pointsEarned, lang), total: shown.pointsTotal })})`}
                          </span>
                        )}
                        {item.score?.reason && <span className="text-slate-500">{t('tasm.results.corrected')}</span>}
                        {item.closedBy !== 'TEACHER' && (
                          <button type="button" onClick={() => open(item.id)} className={`${tool} ml-auto bg-white border border-slate-200 text-slate-700 hover:bg-slate-100`}>
                            {t(label)}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {entering && students.length > 0 && (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          {needsReason && (
            <div className="space-y-1">
              <label htmlFor={`reason-${current.id}`} className="block text-xs font-bold text-slate-700">
                {t('tasm.editCopy.reason')}
              </label>
              <textarea
                id={`reason-${current.id}`}
                rows={2}
                value={reason}
                maxLength={500}
                disabled={busy}
                onChange={(e) => {
                  setReason(e.target.value);
                  setErrors((prev) => ({ ...prev, reason: undefined, save: undefined }));
                }}
                className={`${box} w-full resize-y ${errors.reason ? 'border-red-400' : 'border-slate-200'}`}
              />
              {errors.reason ? <p className={errorText}>{t(errors.reason)}</p> : <p className="text-[11px] font-medium text-slate-500">{t('tasm.offline.reasonHint')}</p>}
            </div>
          )}
          {errors.save && <p className={errorText}>{t(errors.save)}</p>}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center sm:justify-end">
            {dirty && (
              <button
                type="button"
                onClick={() => {
                  setDrafts(offlineDraftsFrom(students, lang));
                  setReason('');
                  setErrors({});
                }}
                disabled={busy}
                className={`${tool} px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100`}
              >
                {t('tasm.undo')}
              </button>
            )}
            <button type="button" onClick={saveMarks} disabled={busy || !dirty} className={`${tool} px-5 py-2.5 text-sm bg-brand text-white hover:bg-brand-deep`}>
              {busy ? t('common.loading') : t('tasm.offline.save')}
            </button>
          </div>
        </div>
      )}

      {excFor && (
        <ExceptionDialog
          assessment={current}
          student={excFor}
          zone={zone}
          span={span}
          onDone={excDone}
          onStale={() => {
            setExcFor(null);
            setAttempt((n) => n + 1);
          }}
          onClose={() => setExcFor(null)}
        />
      )}

      <ConfirmDialog
        open={confirming}
        tone="brand"
        icon={Send}
        title={t('tasm.results.releaseConfirm.title')}
        body={
          offline
            ? t('tasm.results.releaseConfirm.offlineBody', { n: waiting.release })
            : t('tasm.results.releaseConfirm.body', { n: waiting.release, marking: waiting.marking, inProgress: waiting.inProgress })
        }
        confirmLabel={t('tasm.results.release')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        busyLabel={t('common.loading')}
        onConfirm={doRelease}
        onCancel={() => !busy && setConfirming(false)}
      />
    </section>
  );
};

export default ResultsTab;
