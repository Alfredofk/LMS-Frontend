import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Clock, FileText, Paperclip, RefreshCw, Send } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FactLine from '../../components/ui/FactLine';
import QuestionImage from '../../components/questionBank/QuestionImage';
import { useSchoolZone } from '../../hooks/useSchoolToday';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { useT } from '../../i18n/LanguageContext';
import { isAttemptOver, studentAssessmentErrorMessage } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import { downloadFile, openFileInNewTab } from '../../utils/openFile';
import { localOf } from '../Attendance/attendance';
import { formatSchoolDay } from '../QuestionBank/questionBank';
import { formatNumber } from '../TeacherAssessment/results';
import {
  TEXT_SAVE_DELAY_MS,
  answerBody,
  answeredCount,
  attemptState,
  choose,
  clockText,
  countsDown,
  draftChanged,
  draftError,
  draftOf,
  essayFileError,
  isAnswered,
  keyOf,
  lettered,
  remainingMs,
} from './studentAssessment';
import { forgetMyMenu } from './readMyMenu';
import FullscreenLockDialog from './FullscreenLockDialog';
import { questionsLocked } from './integrity';
import { useIntegritySignals } from './useIntegritySignals';

/*
  One of a student's attempts (/assessment/:id/percobaan/:submissionId; backend
  6380e3e, 5255842; owner 2026-10-11).

  In progress: one question at a time (owner), a row of numbers marking what is
  answered, Sebelumnya / Berikutnya, the time left and "Kumpulkan" always in
  view. Answers save themselves (owner): a choice at once, typed text a second
  after typing stops and before moving on, an essay's file when picked. Each
  question says "Menyimpan..." or "Tersimpan 10:42". The server holds the clock:
  at the deadline the attempt is read again and shows as closed with what was
  saved. Leaving with a save still pending asks first.

  On a KUIS, UTS or UAS answered online (`integritySignals`) the attempt is done
  in fullscreen - asked at the start; out of it the page is blurred behind a
  popup back to fullscreen (FullscreenLockDialog), "Kumpulkan sekarang" in it -
  and leaving the page, leaving fullscreen, copying and pasting are
  reported (useIntegritySignals, integrity.js; backend b5db324, owner
  2026-10-13). The outline told the student so before they started.

  Handed in, closed or void: the answers read back. Released: the score, the
  teacher's comment, each question's points and comment, and the key when the
  teacher shows it (owner: all of it).
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const tool =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';
const box =
  'w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 disabled:text-slate-500';

const isOfficeFile = (name) => /\.(docx|pptx)$/i.test(String(name ?? ''));

/* A question's body and image, as the bank wrote it. */
const QuestionBody = ({ question, submissionId }) => (
  <div className="space-y-3">
    <div className="content-html text-sm text-slate-800 break-words" dangerouslySetInnerHTML={{ __html: question.body ?? '' }} />
    {question.imageId && <QuestionImage imageId={question.imageId} submissionId={submissionId} />}
  </div>
);

/* The essay file the student sent: opened (PDF, image) or saved (DOCX, PPTX). */
const EssayFileLink = ({ submissionId, question, t }) => {
  const file = question.answer?.file;
  if (!file) return null;
  const open = () => {
    const fetchBlob = () => assessmentService.essayFile(submissionId, question.id);
    return isOfficeFile(file.name) ? downloadFile(fetchBlob, file.name) : openFileInNewTab(fetchBlob);
  };
  return (
    <button type="button" onClick={() => open().catch(() => {})} className={`${tool} border border-slate-200 text-slate-700 hover:bg-slate-50 max-w-full`}>
      <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{file.name}</span>
      <span className="sr-only">{t('sasm.openFile')}</span>
    </button>
  );
};

// ---------------------------------------------------------------------------
// Answering one question
// ---------------------------------------------------------------------------

const AnswerInput = ({ question, draft, disabled, onDraft, onText, onFile, onPicking, onPicked, t }) => {
  if (question.kind === 'MCQ') {
    const single = question.mcqScoring === 'SINGLE';
    return (
      <fieldset className="space-y-2">
        <legend className="text-[11px] font-semibold text-slate-500 mb-1">{single ? t('sasm.pickOne') : t('sasm.pickAll')}</legend>
        {lettered(question.options).map((option) => {
          const chosen = draft.includes(option.id);
          return (
            <label
              key={option.id}
              className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 cursor-pointer select-none ${chosen ? 'border-brand bg-brand-tint' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              <input
                type={single ? 'radio' : 'checkbox'}
                name={`q-${question.id}`}
                checked={chosen}
                disabled={disabled}
                onChange={() => onDraft(choose(question, draft, option.id))}
                className="mt-0.5 w-4 h-4 accent-brand cursor-pointer"
              />
              <span className="w-6 shrink-0 text-xs font-extrabold text-slate-500">{option.letter}</span>
              <span className="min-w-0 flex-1 space-y-2">
                {option.text && <span className="block text-sm font-semibold text-slate-800 break-words">{option.text}</span>}
                {option.imageId && <QuestionImage imageId={option.imageId} submissionId={question.submissionId} className="max-h-48" />}
              </span>
            </label>
          );
        })}
      </fieldset>
    );
  }
  if (question.kind === 'TF') {
    return (
      <div className="grid grid-cols-2 gap-2 max-w-sm" role="radiogroup" aria-label={t('sasm.answer')}>
        {[true, false].map((value) => (
          <label
            key={String(value)}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold cursor-pointer select-none ${draft === value ? 'border-brand bg-brand-tint text-brand' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            <input type="radio" name={`q-${question.id}`} checked={draft === value} disabled={disabled} onChange={() => onDraft(value)} className="sr-only" />
            {t(`qbank.tf.${value}`)}
          </label>
        ))}
      </div>
    );
  }
  if (question.kind === 'SHORT') {
    return (
      <input
        type="text"
        aria-label={t('sasm.answer')}
        value={draft}
        maxLength={400}
        disabled={disabled}
        onChange={(e) => onText(e.target.value)}
        placeholder={t('sasm.shortPlaceholder')}
        className={`${box} border-slate-200`}
      />
    );
  }
  return (
    <div className="space-y-3">
      <textarea
        aria-label={t('sasm.answer')}
        rows={8}
        value={draft}
        disabled={disabled}
        onChange={(e) => onText(e.target.value)}
        placeholder={t('sasm.essayPlaceholder')}
        className={`${box} border-slate-200 resize-y`}
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${tool} border border-slate-200 text-slate-700 hover:bg-slate-50 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <Paperclip className="w-4 h-4" aria-hidden="true" />
          {question.answer?.file ? t('sasm.replaceFile') : t('sasm.attachFile')}
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.docx,.pptx"
            disabled={disabled}
            className="sr-only"
            onClick={onPicking}
            /* The picker cancelled; React passes no onCancel to an <input>. */
            ref={(el) => {
              if (!el || !onPicked) return undefined;
              el.addEventListener('cancel', onPicked);
              return () => el.removeEventListener('cancel', onPicked);
            }}
            onChange={(e) => {
              onPicked?.();
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) onFile(file);
            }}
          />
        </label>
        <EssayFileLink submissionId={question.submissionId} question={question} t={t} />
      </div>
      <p className="text-[11px] font-medium text-slate-500">{t('sasm.fileHint')}</p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Answering
// ---------------------------------------------------------------------------

const Answering = ({ view, zone, onClosed, onHandedIn }) => {
  const { t, lang } = useT();
  const submissionId = view.submission.id;
  const [questions, setQuestions] = useState(() => view.questions.map((question) => ({ ...question, submissionId })));
  const [drafts, setDrafts] = useState(() => Object.fromEntries(view.questions.map((question) => [question.id, draftOf(question)])));
  /* Per question: { saving, savedAt, error } */
  const [saves, setSaves] = useState({});
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);
  const timers = useRef({});
  const chains = useRef({});
  const draftsRef = useRef(drafts);
  const questionsRef = useRef(questions);

  const left = remainingMs(view.submission.deadlineAt, now);
  const pending = Object.values(saves).some((save) => save.saving) || questions.some((question) => draftChanged(question, drafts[question.id]) && !draftError(question, drafts[question.id]));
  const guard = useUnsavedGuard(pending);
  const signalled = Boolean(view.assessment.integritySignals);
  const integrity = useIntegritySignals({ enabled: signalled, submissionId });

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  /* At the deadline the server has closed it with what was saved: read it again (a beat later, so the server's clock has passed too). */
  useEffect(() => {
    if (left > 0) return undefined;
    const later = setTimeout(onClosed, 1500);
    return () => clearTimeout(later);
  }, [left, onClosed]);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const setSave = (questionId, patch) => setSaves((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch } }));

  /* The refs hold what a save reads; they change only here and in setDraft, never while rendering. */
  const adoptAnswer = (questionId, answer) => {
    questionsRef.current = questionsRef.current.map((question) => (question.id === questionId ? { ...question, answer } : question));
    setQuestions(questionsRef.current);
  };

  /* One save per question at a time, in order: a later draft waits for the earlier one. */
  const save = (questionId) => {
    clearTimeout(timers.current[questionId]);
    const run = async () => {
      const question = questionsRef.current.find((item) => item.id === questionId);
      const draft = draftsRef.current[questionId];
      if (!question || !draftChanged(question, draft) || draftError(question, draft)) return;
      setSave(questionId, { saving: true, error: null, fileError: false });
      try {
        const answer = await assessmentService.saveAnswer(submissionId, questionId, answerBody(question, draft));
        adoptAnswer(questionId, answer);
        setSave(questionId, { saving: false, savedAt: answer?.savedAt ?? new Date().toISOString() });
      } catch (err) {
        setSave(questionId, { saving: false, error: studentAssessmentErrorMessage(err, t) });
        if (isAttemptOver(err)) onClosed();
      }
    };
    chains.current[questionId] = (chains.current[questionId] ?? Promise.resolve()).then(run);
    return chains.current[questionId];
  };

  const flushAll = () => Promise.all(questionsRef.current.map((question) => save(question.id)));

  const setDraft = (questionId, draft, { now: immediate = false } = {}) => {
    setDrafts((prev) => ({ ...prev, [questionId]: draft }));
    draftsRef.current = { ...draftsRef.current, [questionId]: draft };
    clearTimeout(timers.current[questionId]);
    if (immediate) save(questionId);
    else timers.current[questionId] = setTimeout(() => save(questionId), TEXT_SAVE_DELAY_MS);
  };

  const sendFile = async (question, file) => {
    const why = essayFileError(file);
    if (why) {
      setSave(question.id, { error: t(`sasm.error.${why}`), fileError: true });
      return;
    }
    setSave(question.id, { saving: true, error: null, fileError: false });
    try {
      const answer = await assessmentService.saveEssayFile(submissionId, question.id, file);
      adoptAnswer(question.id, answer);
      setSave(question.id, { saving: false, savedAt: answer?.savedAt ?? new Date().toISOString() });
    } catch (err) {
      setSave(question.id, { saving: false, error: studentAssessmentErrorMessage(err, t), fileError: true });
      if (isAttemptOver(err)) onClosed();
    }
  };

  const go = (next) => {
    const current = questions[index];
    if (current) save(current.id);
    setIndex(Math.max(0, Math.min(questions.length - 1, next)));
  };

  const handIn = async () => {
    setBusy(true);
    setFailure(null);
    await flushAll();
    await integrity.finish();
    try {
      const answer = await assessmentService.handIn(submissionId);
      forgetMyMenu();
      guard.release();
      onHandedIn(answer);
    } catch (err) {
      setBusy(false);
      setAsking(false);
      setFailure(studentAssessmentErrorMessage(err, t));
      if (isAttemptOver(err)) onClosed();
      else integrity.resume();
    }
  };

  const question = questions[index];
  const draft = drafts[question.id];
  const status = saves[question.id] ?? {};
  const changed = draftChanged(question, draft);
  const tooLong = draftError(question, draft);
  const answered = answeredCount(questions, drafts);
  const local = localOf(view.submission.deadlineAt, zone);
  const deadlineWords = local ? `${formatSchoolDay(local.date, lang)} ${local.time}` : '';
  const savedLocal = status.savedAt ? localOf(status.savedAt, zone) : question.answer?.savedAt ? localOf(question.answer.savedAt, zone) : null;
  const short = left < 5 * 60 * 1000;
  const locked = questionsLocked({ signalled, supported: integrity.fullscreen.supported, fullscreen: integrity.fullscreen.active, timeLeftMs: left });

  let saveLine;
  if (status.saving) saveLine = <span className="text-slate-500">{t('sasm.saving')}</span>;
  else if (status.error) saveLine = <span className="text-rose-700">{status.error}</span>;
  else if (tooLong) saveLine = <span className="text-rose-700">{t(`sasm.error.${tooLong}`)}</span>;
  else if (changed) saveLine = <span className="text-slate-500">{t('sasm.notSavedYet')}</span>;
  else if (savedLocal && isAnswered(question, draft)) saveLine = <span className="text-emerald-700 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" aria-hidden="true" />{t('sasm.savedAt', { time: savedLocal.time })}</span>;
  else saveLine = <span className="text-slate-500">{t('sasm.unanswered')}</span>;

  return (
    /* Out of fullscreen on a KUIS, UTS or UAS online, everything here sits blurred and inert behind FullscreenLockDialog. */
    <div className="space-y-4" inert={locked}>
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-canvas/95 backdrop-blur-sm">
        <div className="bg-white border border-slate-100 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-wrap items-center gap-3">
          {/* The title is the page's h1 just above; the bar keeps what changes. */}
          <p className="text-xs font-bold text-slate-600 whitespace-nowrap">{t('sasm.answeredOf', { n: answered, total: questions.length })}</p>
          <p className={`ml-auto inline-flex items-center gap-1.5 text-sm font-extrabold tabular-nums whitespace-nowrap ${short ? 'text-rose-700' : 'text-slate-800'}`} role="timer" aria-live="off">
            <Clock className="w-4 h-4" aria-hidden="true" />
            {countsDown(view.submission.deadlineAt, now) ? clockText(left) : t('sasm.until', { date: deadlineWords })}
          </p>
          <button type="button" onClick={() => setAsking(true)} disabled={busy || left <= 0} className={`${tool} px-4 py-2.5 text-sm bg-brand text-white hover:bg-brand-deep`}>
            <Send className="w-4 h-4" aria-hidden="true" />
            {t('sasm.handIn')}
          </button>
        </div>
      </div>

      {left <= 0 && (
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800" role="status">
          {t('sasm.timeUpNow')}
        </p>
      )}
      {failure && (
        <p className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
          {failure}
        </p>
      )}

      <nav aria-label={t('sasm.numbers')} className="flex flex-wrap gap-1.5">
        {questions.map((item, i) => {
          const done = isAnswered(item, drafts[item.id]);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(i)}
              aria-current={i === index ? 'step' : undefined}
              aria-label={t(done ? 'sasm.numberDone' : 'sasm.numberOpen', { n: i + 1 })}
              className={`w-9 h-9 rounded-lg text-xs font-extrabold tabular-nums cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                i === index ? 'ring-2 ring-brand ring-offset-1' : ''
              } ${done ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
            >
              {i + 1}
            </button>
          );
        })}
      </nav>

      <section className={`${card} space-y-4`} aria-labelledby={`q-title-${question.id}`}>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h2 id={`q-title-${question.id}`} className="text-sm font-extrabold text-slate-900">
            {t('sasm.questionOf', { n: index + 1, total: questions.length })}
          </h2>
          <span className="text-xs font-bold text-slate-600">{t(`qbank.kind.${question.kind}`)}</span>
          <span className="text-xs font-semibold text-slate-500">{t('sasm.points', { n: question.points })}</span>
        </div>
        <QuestionBody question={question} submissionId={submissionId} />
        <AnswerInput
          question={question}
          draft={draft}
          disabled={busy || left <= 0}
          onDraft={(value) => setDraft(question.id, value, { now: true })}
          onText={(value) => setDraft(question.id, value)}
          onFile={(file) => sendFile(question, file)}
          onPicking={integrity.picking}
          onPicked={integrity.picked}
          t={t}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold" aria-live="polite">
          {saveLine}
          {/* "Coba lagi" saves the typed or chosen answer again; a file is picked again instead. */}
          {status.error && !status.saving && !status.fileError && (
            <button type="button" onClick={() => save(question.id)} className="text-brand hover:underline cursor-pointer">
              {t('att.error.retry')}
            </button>
          )}
          {(question.kind === 'MCQ' || question.kind === 'TF') && isAnswered(question, draft) && left > 0 && (
            <button type="button" onClick={() => setDraft(question.id, question.kind === 'MCQ' ? [] : null, { now: true })} className="ml-auto text-slate-500 hover:text-slate-800 hover:underline cursor-pointer">
              {t('sasm.clear')}
            </button>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className={`${tool} px-4 py-2.5 text-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {t('sasm.prev')}
        </button>
        {index < questions.length - 1 ? (
          <button type="button" onClick={() => go(index + 1)} className={`${tool} px-4 py-2.5 text-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
            {t('sasm.next')}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : (
          <button type="button" onClick={() => setAsking(true)} disabled={busy || left <= 0} className={`${tool} px-4 py-2.5 text-sm bg-brand text-white hover:bg-brand-deep`}>
            <Send className="w-4 h-4" aria-hidden="true" />
            {t('sasm.handIn')}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={asking}
        tone="brand"
        icon={Send}
        title={t('sasm.handInConfirm.title')}
        body={
          answered < questions.length
            ? t('sasm.handInConfirm.someEmpty', { n: questions.length - answered, total: questions.length })
            : t('sasm.handInConfirm.all', { total: questions.length })
        }
        confirmLabel={t('sasm.handIn')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        busyLabel={t('common.loading')}
        onConfirm={handIn}
        onCancel={() => !busy && setAsking(false)}
      />
      {locked && !asking && <FullscreenLockDialog onBack={integrity.fullscreen.enter} onHandIn={() => setAsking(true)} />}
      {guard.dialog}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Reading it back
// ---------------------------------------------------------------------------

const AnswerReadBack = ({ question, submissionId, t }) => {
  const answer = question.answer;
  if (!answer) return <p className="text-sm font-semibold text-slate-500">{t('sasm.noAnswer')}</p>;
  if (question.kind === 'MCQ') {
    const options = lettered(question.options);
    const key = new Set(question.key?.correctOptionIds ?? []);
    return (
      <ul className="space-y-1.5">
        {options.map((option) => {
          const chosen = answer.optionIds?.includes(option.id);
          const correct = question.key ? key.has(option.id) : null;
          return (
            <li
              key={option.id}
              className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${chosen ? 'border-brand bg-brand-tint' : 'border-slate-200'} ${correct ? 'ring-1 ring-emerald-400' : ''}`}
            >
              <span className="w-6 shrink-0 text-xs font-extrabold text-slate-500">{option.letter}</span>
              <span className="min-w-0 flex-1 space-y-2">
                {option.text && <span className="block text-sm font-semibold text-slate-800 break-words">{option.text}</span>}
                {option.imageId && <QuestionImage imageId={option.imageId} submissionId={submissionId} className="max-h-40" />}
              </span>
              {chosen && <span className="text-[11px] font-bold text-brand shrink-0">{t('sasm.yourChoice')}</span>}
            </li>
          );
        })}
      </ul>
    );
  }
  if (question.kind === 'TF') {
    return <p className="text-sm font-bold text-slate-800">{answer.value === null ? '-' : t(`qbank.tf.${answer.value}`)}</p>;
  }
  return (
    <div className="space-y-2">
      {answer.text ? <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 break-words whitespace-pre-wrap">{answer.text}</p> : null}
      {question.kind === 'ESSAY' && <EssayFileLink submissionId={submissionId} question={question} t={t} />}
      {!answer.text && !answer.file && <p className="text-sm font-semibold text-slate-500">{t('sasm.noAnswer')}</p>}
    </div>
  );
};

const KeyLine = ({ question, t }) => {
  const key = keyOf(question);
  if (!key) return null;
  let text;
  if (key.kind === 'MCQ') text = key.letters.join(', ') || '-';
  else if (key.kind === 'TF') text = t(`qbank.tf.${key.value}`);
  else text = key.accepted.join(' / ');
  return (
    <p className="text-xs font-semibold text-emerald-700">
      {t('sasm.key')}: <span className="font-bold">{text}</span>
    </p>
  );
};

const ReadBack = ({ view, zone, notice }) => {
  const { t, lang } = useT();
  const { submission, questions } = view;
  const state = attemptState(submission);
  const local = (instant) => {
    const value = instant ? localOf(instant, zone) : null;
    return value ? `${formatSchoolDay(value.date, lang)} ${value.time}` : '';
  };

  let closedLine;
  if (state === 'VOID') closedLine = t('sasm.voided', { reason: submission.voidReason ?? '' });
  else if (submission.closedBy === 'TEACHER') closedLine = t('sasm.markedAt', { date: local(submission.submittedAt) });
  else if (submission.closedBy === 'TIME') closedLine = t('sasm.closedByTime', { date: local(submission.submittedAt) });
  else closedLine = t('sasm.handedInAt', { date: local(submission.submittedAt) });

  return (
    <div className="space-y-5">
      {notice && (
        <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800" role="status">
          {notice}
        </p>
      )}
      <section className={`${card} space-y-3`}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-semibold text-slate-700">{closedLine}</p>
            <p className="flex flex-wrap gap-x-2.5 text-xs font-semibold">
              {submission.late && <span className="text-amber-700">{t('tasm.results.late')}</span>}
              {submission.remedial && <span className="text-brand">{t('tasm.results.remedial')}</span>}
              {state === 'WAITING' && <span className="text-slate-500">{t('sasm.waitingRelease')}</span>}
            </p>
          </div>
          {submission.score && (
            <div className="text-right shrink-0">
              <p className="text-3xl font-extrabold text-slate-900 tabular-nums leading-tight">{formatNumber(submission.score.value, lang)}</p>
              {submission.score.pointsTotal !== null && (
                <p className="text-[11px] font-medium text-slate-500">
                  {t('tasm.results.points', { earned: formatNumber(submission.score.pointsEarned, lang), total: submission.score.pointsTotal })}
                </p>
              )}
            </div>
          )}
        </div>
        {submission.score?.reason && <p className="text-xs font-semibold text-slate-600 break-words">{t('sasm.corrected', { reason: submission.score.reason })}</p>}
        {submission.comment && (
          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 space-y-0.5">
            <p className="text-[11px] font-bold text-slate-500">{t('sasm.teacherComment')}</p>
            <p className="text-sm font-medium text-slate-800 break-words whitespace-pre-wrap">{submission.comment}</p>
          </div>
        )}
      </section>

      <ol className="space-y-3">
        {questions.map((question, index) => (
          <li key={question.id} className={`${card} space-y-3`}>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-extrabold flex items-center justify-center shrink-0">{index + 1}</span>
              <span className="text-xs font-bold text-slate-600">{t(`qbank.kind.${question.kind}`)}</span>
              <span className="ml-auto text-xs font-bold text-slate-700 tabular-nums">
                {question.marks
                  ? t('sasm.pointsOf', { earned: formatNumber(question.marks.points, lang), total: question.points })
                  : t('sasm.points', { n: question.points })}
              </span>
            </div>
            <QuestionBody question={question} submissionId={submission.id} />
            <AnswerReadBack question={question} submissionId={submission.id} t={t} />
            <KeyLine question={question} t={t} />
            {question.marks?.comment && <p className="text-xs font-semibold text-slate-700 break-words">{t('tasm.mark.commentSaid', { comment: question.marks.comment })}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
};

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export const StudentAttemptPage = () => {
  const { assessmentId, submissionId } = useParams();
  const { t } = useT();
  const navigate = useNavigate();
  const zone = useSchoolZone();
  /* undefined reading · { view } · { error } */
  const [data, setData] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    assessmentService
      .attempt(submissionId)
      .then((view) => !cancelled && setData({ view }))
      .catch((err) => !cancelled && setData({ error: studentAssessmentErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [submissionId, attempt, t]);

  /* The attempt ended under the page (time, voided, cancelled, moved): read it again and say so. */
  const onClosed = useCallback(() => {
    setNotice(t('sasm.closedNotice'));
    setAttempt((n) => n + 1);
  }, [t]);

  const back = () => navigate(`/assessment/${assessmentId}`);

  if (data === undefined) {
    return <div className="h-96 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
  }
  if (data.error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{t('shell.assessment')}</h1>
        <div className={`${card} flex flex-col items-center text-center gap-3 py-10`} role="alert">
          <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-700 max-w-sm">{data.error}</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`${tool} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('att.error.retry')}
          </button>
        </div>
      </div>
    );
  }

  const { view } = data;
  const inProgress = view.submission.status === 'IN_PROGRESS';
  const assessment = view.assessment;

  return (
    <div className="space-y-5 text-left">
      <div className="space-y-1.5">
        <button type="button" onClick={back} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-brand cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded">
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          {t('sasm.backToOutline')}
        </button>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight break-words">
          {inProgress || view.submission.closedBy === 'TEACHER' ? assessment.title : t('sasm.attemptTitle', { n: view.submission.attempt, title: assessment.title })}
        </h1>
        <FactLine code={assessment.classSubject.subject.code} name={assessment.classSubject.subject.name} facts={[assessment.classSubject.class.name, t(`tasm.type.${assessment.type}`)]} />
      </div>

      {inProgress ? (
        <Answering
          key={view.submission.id}
          view={view}
          zone={zone}
          onClosed={onClosed}
          onHandedIn={(answer) => {
            setNotice(null);
            setData({ view: answer });
            window.scrollTo({ top: 0 });
          }}
        />
      ) : (
        <ReadBack view={view} zone={zone} notice={notice} />
      )}
    </div>
  );
};

export default StudentAttemptPage;
