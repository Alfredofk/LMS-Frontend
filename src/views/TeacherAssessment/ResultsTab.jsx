import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { AlertCircle, RefreshCw, Send } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FactLine from '../../components/ui/FactLine';
import { initialsOf } from '../../utils/names';
import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import { gradingService } from '../../services/gradingService';
import { belowKktp } from '../Gradebook/gradebook';
import { localOf } from '../Attendance/attendance';
import { formatSchoolDay } from '../QuestionBank/questionBank';
import { forgetMarkingQueue } from './markingQueue';
import { notifyPendingChanged } from '../../hooks/usePendingCounts';
import { cancelReasonError, isPractice } from './teacherAssessment';
import ExceptionDialog from './ExceptionDialog';
import { canSetException, exceptionFacts } from './exceptions';
import {
  MARKABLE,
  MAX_OFFLINE_MARK,
  flaggedCount,
  formatNumber,
  hasSignals,
  offlineBody,
  offlineDraftsFrom,
  offlineErrors,
  offlineNeedsReason,
  offlineSavedOf,
  releaseState,
  remedialBody,
  remedialErrors,
  remedialMarksOpen,
  shownAttempts,
  signalTotal,
  takesRemedialMark,
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

  A remedial mark sits beside it (backend dfa2545, owner 2026-10-19: a second
  column), once the window has closed, for a student placed in the class now: one
  "Simpan nilai" sends the originals and then the remedial marks, each its own PUT.
  One not yet released is taken back with "Tarik" (asked first).

  Make-up and remedial (backend 1e6c749, ticket 05; owner 2026-10-11): a row's
  exception is one grey line under its status (FactLine), and an attempt started
  under a remedial says "Remedial". On an ONLINE one published, the answering
  teacher has "Susulan / remedial" per student placed now (ExceptionDialog).

  Integrity counts (backend b5db324, ticket 06; owner 2026-10-13), kept short for
  a class of thirty: an attempt with something recorded says "8 catatan" in its
  own row (the breakdown is on the attempt's page, SignalLine); the head says how
  many students have any, with "Tampilkan yang ada catatan saja". Each student
  shows only the newest attempt and those waiting for marking or release; the
  rest open with "Tampilkan N percobaan lain" (shownAttempts).

  A LATIHAN (backend 026e4f9) has no release and no score that counts: each
  student shows their best attempt with the latest under it, an attempt's mark is
  its result (no "draf"), and "Beri komentar" opens it. No KKTP line.
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
  DONE: 'text-emerald-700',
  SUBMITTED: 'text-emerald-700',
};

const when = (instant, zone, lang) => {
  const local = instant ? localOf(instant, zone) : null;
  return local ? `${formatSchoolDay(local.date, lang)} ${local.time}` : '';
};

const errorText = 'text-xs font-semibold text-red-600';
const box =
  'rounded-xl border bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 disabled:text-slate-500';

/* One student's offline mark: the box, and the comment - open when one is stored, else on demand. */
const OfflineRow = ({ student, draft, error, commentError, remedialError, remedialOn, busy, lang, t, onMark, onComment, onOpenComment, onHistory, onRemedial, onTakeBack }) => {
  const id = student.studentProfileId;
  const saved = offlineSavedOf(student);
  const savedRemedial = offlineSavedOf(student, true);
  /* One who moved away keeps a remedial mark entered before, read only; a new one is for students placed now. */
  const remedialEditable = remedialOn && Boolean(student.placedNow);
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
        {remedialOn && takesRemedialMark(student) && (
          <>
            <label htmlFor={`remedial-${id}`} className="text-xs font-bold text-slate-700">
              {t('tasm.offline.remedial')}
            </label>
            <input
              id={`remedial-${id}`}
              type="text"
              inputMode="decimal"
              value={draft.remedial ?? ''}
              disabled={busy || !remedialEditable}
              aria-invalid={Boolean(remedialError)}
              placeholder="-"
              onChange={(e) => onRemedial(e.target.value)}
              className={`${box} w-24 ${remedialError ? 'border-red-400' : 'border-slate-200'}`}
            />
            {savedRemedial && !savedRemedial.released && (
              <span className="text-[11px] font-medium text-slate-500">{t('tasm.offline.draft', { value: formatNumber(savedRemedial.value, lang) })}</span>
            )}
            {savedRemedial && !savedRemedial.released && (
              <button type="button" onClick={onTakeBack} disabled={busy} className="text-xs font-bold text-rose-700 hover:underline cursor-pointer disabled:opacity-50">
                {t('tasm.offline.takeBack')}
              </button>
            )}
          </>
        )}
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
      {remedialError && <p className={errorText}>{t(remedialError)}</p>}
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
  /* The student whose remedial mark is being taken back (asked first). */
  const [takingBack, setTakingBack] = useState(null);
  /* Only students with recorded activity; students whose every attempt is open. */
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const toggleExpanded = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  /* The KKTP that applies to the slot (backend 5d42af6), for the score under it in red
     (owner, 2026-10-14, as in the gradebook); null when it cannot be read. */
  const [kktp, setKktp] = useState(null);
  useEffect(() => {
    let cancelled = false;
    gradingService
      .slotSettings(assessment.classSubject.id)
      .then((settings) => !cancelled && setKktp(settings?.kktp?.value ?? null))
      .catch(() => !cancelled && setKktp(null));
    return () => {
      cancelled = true;
    };
  }, [assessment.classSubject.id]);

  const ready = Boolean(data && !data.error);
  const manages = !readOnly && Boolean((ready && data.assessment ? data.assessment : assessment).canManage);
  const entering = ready && assessment.mode === 'OFFLINE' && manages && (data.assessment ?? assessment).status === 'PUBLISHED';
  const body = entering ? offlineBody(drafts, data.students, reason) : null;
  const remedialOn = entering && remedialMarksOpen(data.assessment ?? assessment);
  const remedialPut = remedialOn ? remedialBody(drafts, data.students, reason) : null;
  const dirty = Boolean(body || remedialPut);
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
  const flagged = flaggedCount(students);
  /* The filter is let go once nobody has anything recorded (a re-read after a void, say). */
  const listed = flaggedOnly && flagged > 0 ? students.filter(hasSignals) : students;
  /* The results carry the assessment as read now: its window or state may have moved since the page read it. */
  const current = { ...(data.assessment ?? assessment), canManage: manages };
  /* Unsaved marks would be left out of a release: save them first. */
  const release = dirty ? { show: true, enabled: false, why: 'tasm.offline.saveFirst' } : releaseState(current, waiting);
  const offline = assessment.mode === 'OFFLINE';
  const practice = isPractice(current);
  const needsReason = entering && offlineNeedsReason(drafts, students);

  const setDraft = (studentProfileId, patch) => {
    setDrafts((prev) => ({ ...prev, [studentProfileId]: { ...prev[studentProfileId], ...patch } }));
    setErrors((prev) => ({ ...prev, [studentProfileId]: undefined, [`${studentProfileId}:comment`]: undefined, [`${studentProfileId}:remedial`]: undefined, save: undefined }));
  };

  const saveMarks = async () => {
    const found = { ...offlineErrors(drafts, students), ...(remedialOn ? remedialErrors(drafts, students) : {}) };
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
    /* The originals first, then the remedial marks: two PUTs, so a refused remedial never holds back a class's originals. */
    let answer = null;
    try {
      if (body) answer = await assessmentService.offlineMarks(current.id, body);
      if (remedialPut) answer = await assessmentService.offlineMarks(current.id, remedialPut);
      forgetMarkingQueue();
      notifyPendingChanged();
      adoptResults(answer);
      showToast?.(t('tasm.toast.offlineSaved', { n: (body?.marks.length ?? 0) + (remedialPut?.marks.length ?? 0) }), 'success');
    } catch (err) {
      setFailure(assessmentErrorMessage(err, t));
      if (answer) {
        /* The originals landed and the remedial marks did not: take the originals in, keep the remedial typing. */
        forgetMarkingQueue();
        notifyPendingChanged();
        const typed = Object.fromEntries(Object.entries(drafts).map(([id, draft]) => [id, draft.remedial]));
        adoptResults(answer);
        setDrafts((prev) => Object.fromEntries(Object.entries(prev).map(([id, draft]) => [id, { ...draft, remedial: typed[id] ?? draft.remedial }])));
      }
    } finally {
      setBusy(false);
    }
  };

  const takeBack = async () => {
    const student = takingBack;
    setBusy(true);
    setFailure(null);
    try {
      const answer = await assessmentService.removeRemedialMark(current.id, student.studentProfileId);
      forgetMarkingQueue();
      notifyPendingChanged();
      setTakingBack(null);
      adoptResults(answer);
      showToast?.(t('tasm.offline.takenBack', { name: student.fullName ?? '' }), 'success');
    } catch (err) {
      setTakingBack(null);
      setFailure(assessmentErrorMessage(err, t));
      setAttempt((n) => n + 1);
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

  /* A student's attempts in the list: the ones worth seeing now, and a way to the rest (shownAttempts). */
  const renderAttempts = (student) => {
    const isOpen = expanded.has(student.studentProfileId);
    const { shown: visible, hidden } = shownAttempts(student.attempts, { expanded: isOpen, flaggedOnly });
    return (
      <>
        <ul className="space-y-1.5">
          {visible.map((item) => {
            const recorded = signalTotal(item.signals);
            const shown = item.score ?? (item.mark && item.status !== 'VOID' && item.mark.value !== null ? item.mark : null);
            /* A LATIHAN's mark is its result, never a draft waiting for release. */
            const isDraft = !practice && !item.score && Boolean(shown);
            const markable = MARKABLE.includes(item.status);
            const label = manages && current.status === 'PUBLISHED' && markable ? (practice ? 'tasm.results.comment' : 'tasm.results.mark') : 'tasm.results.view';
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                {!offline && <span className="font-bold text-slate-700">{t('tasm.results.attempt', { n: item.attempt })}</span>}
                <span className={STATUS_TONE[item.status]}>
                  {practice && item.status === 'WAITING_FOR_MARKING' ? t('tasm.mark.waitingComment') : t(`tasm.results.attemptStatus.${item.status}`)}
                </span>
                {item.submittedAt && <span className="tabular-nums">{when(item.submittedAt, zone, lang)}</span>}
                {item.late && <span className="text-amber-700">{t('tasm.results.late')}</span>}
                {item.remedial && <span className="text-brand">{t('tasm.results.remedial')}</span>}
                {item.status === 'WAITING_FOR_MARKING' && item.waitingForMarking > 0 && (
                  <span>{t(practice ? 'tasm.results.essaysToComment' : 'tasm.results.essaysLeft', { n: item.waitingForMarking })}</span>
                )}
                {shown && (
                  <span className="tabular-nums text-slate-700">
                    {isDraft ? t('tasm.results.draftMark', { value: formatNumber(shown.value, lang) }) : formatNumber(shown.value, lang)}
                    {shown.pointsTotal !== null && ` (${t('tasm.results.points', { earned: formatNumber(shown.pointsEarned, lang), total: shown.pointsTotal })})`}
                  </span>
                )}
                {item.score?.reason && <span className="text-slate-500">{t('tasm.results.corrected')}</span>}
                {recorded > 0 && <span className="text-slate-700">{t('tasm.signals.count', { n: recorded })}</span>}
                {item.closedBy !== 'TEACHER' && (
                  <button type="button" onClick={() => open(item.id)} className={`${tool} ml-auto bg-white border border-slate-200 text-slate-700 hover:bg-slate-100`}>
                    {t(label)}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {(hidden > 0 || isOpen) && (
          <button
            type="button"
            onClick={() => toggleExpanded(student.studentProfileId)}
            aria-expanded={isOpen}
            className="text-xs font-bold text-slate-600 hover:text-brand hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
          >
            {isOpen ? t('tasm.results.fewerAttempts') : t('tasm.results.moreAttempts', { n: hidden })}
          </button>
        )}
      </>
    );
  };

  /* The waiting counts as tiles: a practice has nothing to release, an offline one nobody answering. */
  const tiles = [
    { key: practice ? 'comment' : 'marking', n: waiting.marking },
    !practice && { key: 'release', n: waiting.release },
    !offline && { key: 'inProgress', n: waiting.inProgress },
  ].filter(Boolean);

  return (
    <section className={`${frame} space-y-4`} aria-label={t('tasm.tab.results')}>
      {/* Two columns from sm up, never wrapping: a long stats line once threw the release block onto its own line, where it floated mid-left (owner, 2026-10-18). */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1 min-w-0 sm:flex-1">
          <h2 className="text-base font-extrabold text-slate-900">{t('tasm.results.title', { n: students.length })}</h2>
          {flagged > 0 && <p className="text-xs font-semibold text-slate-700">{t('tasm.results.flagged', { n: flagged })}</p>}
          {flagged > 0 && (
            <button
              type="button"
              onClick={() => setFlaggedOnly((on) => !on)}
              aria-pressed={flaggedOnly}
              className="text-xs font-bold text-brand hover:text-brand-deep hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
            >
              {flaggedOnly ? t('tasm.results.showAll') : t('tasm.results.onlyFlagged')}
            </button>
          )}
        </div>
        {release.show && (
          <div className="flex flex-col items-start sm:items-end gap-1 sm:shrink-0 sm:max-w-xs">
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

      {/* What waits as numbered tiles, amber while anything does (the reviewed mockup,
          owner 2026-10-28), as on the Principal's subjects card. */}
      <dl className={`grid gap-2.5 ${tiles.length === 3 ? 'grid-cols-3' : tiles.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {tiles.map(({ key, n }) => (
          <div key={key} className="rounded-[14px] border border-slate-100 bg-slate-50 px-3.5 py-2.5 min-w-0">
            <dt className="text-xs font-semibold text-slate-600">{t(`tasm.results.tile.${key}`)}</dt>
            <dd className={`mt-0.5 text-[22px] font-extrabold tracking-tight tabular-nums ${n > 0 && key !== 'inProgress' ? 'text-amber-700' : 'text-slate-900'}`}>{n}</dd>
          </div>
        ))}
      </dl>

      {practice && <p className="text-[11px] font-medium text-slate-500">{t('tasm.results.practiceNote')}</p>}
      {!practice && typeof kktp === 'number' && students.length > 0 && (
        <p className="text-xs font-semibold text-slate-500">
          <span className="text-rose-700">{t('gradebook.kktp.red')}</span> {t('gradebook.kktp.legend', { kktp })}
        </p>
      )}
      {entering && <p className="text-[11px] font-medium text-slate-500">{t('tasm.offline.hint')}</p>}
      {entering && (
        <p className="text-[11px] font-medium text-slate-500">
          {remedialOn ? t('tasm.offline.remedialHint') : t('tasm.offline.remedialLater', { date: when(current.closesAt, zone, lang) })}
        </p>
      )}
      {current.releasedAt && <p className="text-[11px] font-medium text-slate-500">{t('tasm.results.releasedNote')}</p>}

      {failure && (
        <p className="rounded-xl bg-rose-50 p-3.5 text-[13px] text-rose-700 font-semibold" role="alert">
          {failure}
        </p>
      )}

      {students.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">{t('tasm.results.empty')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {listed.map((student) => (
            <li key={student.studentProfileId} className="py-3.5 flex items-start gap-3">
              {/* Round initials, as on the dashboards (the reviewed mockup, owner 2026-10-28). */}
              <span className="grid place-items-center w-[34px] h-[34px] rounded-full bg-brand-tint text-brand text-[11px] font-extrabold shrink-0" aria-hidden="true">
                {initialsOf(student.fullName ?? '')}
              </span>
              <div className="flex-1 min-w-0 space-y-2">
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
                {practice ? (
                  <div className="text-right shrink-0">
                    <p className="text-lg font-extrabold text-slate-900 tabular-nums leading-tight">{formatNumber(student.practice?.best?.value ?? null, lang)}</p>
                    {student.practice?.best && <p className="text-[11px] font-medium text-slate-500">{t('tasm.results.bestLabel')}</p>}
                    {student.practice?.latest && student.practice.latest.attempt !== student.practice.best?.attempt && (
                      <p className="text-[11px] font-medium text-slate-500 tabular-nums">{t('tasm.results.latest', { value: formatNumber(student.practice.latest.value, lang) })}</p>
                    )}
                  </div>
                ) : (
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-extrabold tabular-nums leading-tight ${belowKktp({ score: student.countedScore }, kktp) ? 'text-rose-700' : 'text-slate-900'}`}>
                      {formatNumber(student.countedScore, lang)}
                      {belowKktp({ score: student.countedScore }, kktp) && <span className="sr-only"> ({t('gradebook.kktp.below')})</span>}
                    </p>
                    {student.countedScore !== null && (
                      <p className="text-[11px] font-medium text-slate-500">{t(student.countedFromRemedial ? 'tasm.results.scoreFromRemedial' : 'tasm.results.scoreLabel')}</p>
                    )}
                  </div>
                )}
              </div>

              {entering && (
                <OfflineRow
                  student={student}
                  draft={drafts[student.studentProfileId] ?? { mark: '', comment: '', loadedComment: null }}
                  error={errors[student.studentProfileId]}
                  commentError={errors[`${student.studentProfileId}:comment`]}
                  remedialError={errors[`${student.studentProfileId}:remedial`]}
                  remedialOn={remedialOn}
                  busy={busy}
                  lang={lang}
                  t={t}
                  onMark={(mark) => setDraft(student.studentProfileId, { mark })}
                  onComment={(comment) => setDraft(student.studentProfileId, { comment })}
                  onOpenComment={() => setDraft(student.studentProfileId, { commentOpen: true })}
                  onHistory={() => open(offlineSavedOf(student).submissionId)}
                  onRemedial={(remedial) => setDraft(student.studentProfileId, { remedial })}
                  onTakeBack={() => setTakingBack(student)}
                />
              )}

              {!entering && student.attempts.length > 0 && renderAttempts(student)}
              </div>
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
        open={Boolean(takingBack)}
        tone="danger"
        title={t('tasm.offline.takeBackConfirm.title')}
        body={t('tasm.offline.takeBackConfirm.body', {
          name: takingBack?.fullName ?? '',
          value: formatNumber(takingBack ? offlineSavedOf(takingBack, true)?.value : null, lang),
        })}
        confirmLabel={t('tasm.offline.takeBack')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        busyLabel={t('common.loading')}
        onConfirm={takeBack}
        onCancel={() => !busy && setTakingBack(null)}
      />

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
