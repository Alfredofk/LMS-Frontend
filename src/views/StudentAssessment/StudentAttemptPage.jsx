import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Clock, FileText, Loader2, Paperclip, Send } from 'lucide-react';

import Button from '../../components/ui/Button';
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
import { formatNumber, verdictOf, VERDICT_TONE } from '../TeacherAssessment/results';
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
  waitsForComment,
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

  A LATIHAN (backend 026e4f9) shows all that as soon as it is handed in, never
  released; its ESSAY has no points ("Dikomentari guru"), only a comment.

  Handed in, closed or void: the answers read back. Released: the score, the
  teacher's comment, each question's points and comment, and the key when the
  teacher shows it (owner: all of it).

  The look since 2026-10-29 (mockup C:\Thesis\mockups\mengerjakan-penilaian.html,
  all thirteen items): the bar shows "8 dari 10 dijawab" over a thin bar and the
  time left in a labelled box, amber under 10 minutes and rose under 5; the
  number open now is solid purple, an answered one pale; the save state is a
  chip at the question's top right; an option's letter fills when chosen; the
  hand-in question names the numbers left empty, each one a way back to it; a
  toast says it was sent; on the read back the key is green and a wrong choice
  rose.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const tool =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';
const box =
  'w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 disabled:text-slate-500';
const chip = 'inline-flex items-center gap-1.5 rounded-full pl-2 pr-2.5 py-1 text-xs font-bold whitespace-nowrap';
const message = 'flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] font-semibold';
const WARN = `${message} bg-amber-50 border-amber-100 text-amber-800`;
const FAIL = `${message} bg-rose-50 border-rose-100 text-rose-700`;

const MINUTE_MS = 60 * 1000;
/* The time-left box: grey, amber under 10 minutes, rose under 5 (owner, 2026-10-29). */
const clockTone = (counting, left) => {
  if (!counting || left >= 10 * MINUTE_MS) return 'bg-slate-100 text-slate-800';
  return left < 5 * MINUTE_MS ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700';
};

const isOfficeFile = (name) => /\.(docx|pptx)$/i.test(String(name ?? ''));

/* A thin bar of answered questions, in the top bar and the hand-in question. */
const AnsweredBar = ({ answered, total }) => (
  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
    <div
      className="h-full rounded-full bg-brand transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{ width: `${total ? (answered / total) * 100 : 0}%` }}
    />
  </div>
);

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

/* An option's letter: a circle (one answer) or a square (several), filled when chosen. */
const Letter = ({ letter, round = true, tone = 'idle' }) => {
  const tones = {
    idle: 'border-slate-200 text-slate-600 bg-white',
    chosen: 'bg-brand border-brand text-white',
    key: 'bg-emerald-600 border-emerald-600 text-white',
    wrong: 'bg-rose-600 border-rose-600 text-white',
  };
  return (
    <span
      aria-hidden="true"
      className={`w-7 h-7 shrink-0 grid place-items-center border-[1.5px] text-xs font-extrabold transition-colors ${round ? 'rounded-full' : 'rounded-lg'} ${tones[tone]}`}
    >
      {letter}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Answering one question
// ---------------------------------------------------------------------------

const optionRow = (chosen, disabled) =>
  `flex items-center gap-3 rounded-xl border px-3.5 py-3 select-none transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand ${
    chosen ? 'border-brand bg-brand-tint shadow-[inset_0_0_0_1px_var(--color-brand)]' : 'border-slate-200'
  } ${disabled ? 'opacity-60 cursor-not-allowed' : `cursor-pointer ${chosen ? '' : 'hover:bg-slate-50'}`}`;

const AnswerInput = ({ question, draft, disabled, onDraft, onText, onFile, onPicking, onPicked, t }) => {
  if (question.kind === 'MCQ') {
    const single = question.mcqScoring === 'SINGLE';
    return (
      <fieldset className="space-y-2">
        <legend className="text-[11px] font-semibold text-slate-500 mb-1">{single ? t('sasm.pickOne') : t('sasm.pickAll')}</legend>
        {lettered(question.options).map((option) => {
          const chosen = draft.includes(option.id);
          return (
            <label key={option.id} className={optionRow(chosen, disabled)}>
              <input
                type={single ? 'radio' : 'checkbox'}
                name={`q-${question.id}`}
                checked={chosen}
                disabled={disabled}
                onChange={() => onDraft(choose(question, draft, option.id))}
                className="sr-only"
              />
              <Letter letter={option.letter} round={single} tone={chosen ? 'chosen' : 'idle'} />
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
          <label key={String(value)} className={`${optionRow(draft === value, disabled)} justify-center text-sm font-bold ${draft === value ? 'text-brand' : 'text-slate-700'}`}>
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
      onHandedIn(answer, { answered: answeredCount(questionsRef.current, draftsRef.current), total: questionsRef.current.length });
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
  const missing = questions.map((item, i) => (isAnswered(item, drafts[item.id]) ? null : i)).filter((i) => i !== null);
  const local = localOf(view.submission.deadlineAt, zone);
  const deadlineWords = local ? `${formatSchoolDay(local.date, lang)} ${local.time}` : '';
  const savedLocal = status.savedAt ? localOf(status.savedAt, zone) : question.answer?.savedAt ? localOf(question.answer.savedAt, zone) : null;
  const counting = countsDown(view.submission.deadlineAt, now);
  const timeText = counting ? clockText(left) : t('sasm.until', { date: deadlineWords });
  const locked = questionsLocked({ signalled, supported: integrity.fullscreen.supported, fullscreen: integrity.fullscreen.active, timeLeftMs: left });

  /* The save state as a chip at the question's top right; a sentence that needs reading goes under the answer. */
  let saveChip;
  let saveProblem = null;
  if (status.saving) {
    saveChip = (
      <span className={`${chip} bg-slate-100 text-slate-600`}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        {t('sasm.saving')}
      </span>
    );
  } else if (status.error) {
    saveChip = (
      <span className={`${chip} bg-rose-50 text-rose-700`}>
        <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
        {t('sasm.saveFailed')}
      </span>
    );
    saveProblem = status.error;
  } else if (tooLong || changed) {
    saveChip = <span className={`${chip} px-2.5 bg-amber-50 text-amber-700`}>{t('sasm.notSavedYet')}</span>;
    if (tooLong) saveProblem = t(`sasm.error.${tooLong}`);
  } else if (savedLocal && isAnswered(question, draft)) {
    saveChip = (
      <span className={`${chip} bg-emerald-50 text-emerald-700`}>
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path key={savedLocal.time} className="animate-draw" d="M20 6L9 17l-5-5" />
        </svg>
        {t('sasm.savedAt', { time: savedLocal.time })}
      </span>
    );
  } else {
    saveChip = <span className={`${chip} px-2.5 bg-slate-100 text-slate-600`}>{t('sasm.unanswered')}</span>;
  }

  return (
    /* Out of fullscreen on a KUIS, UTS or UAS online, everything here sits blurred and inert behind FullscreenLockDialog. */
    <div className="space-y-4" inert={locked}>
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-canvas/95 backdrop-blur-sm">
        <div className="bg-white border border-slate-100 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-wrap items-center gap-3">
          {/* The title is the page's h1 just above; the bar keeps what changes. */}
          <div className="flex-1 min-w-[150px]">
            <p className="text-[13px] text-slate-500 whitespace-nowrap">
              <span className="font-extrabold text-slate-900 tabular-nums">{t('sasm.answeredCount', { n: answered, total: questions.length })}</span> {t('sasm.answeredWord')}
            </p>
            <div className="mt-1.5">
              <AnsweredBar answered={answered} total={questions.length} />
            </div>
          </div>
          <p className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-extrabold tabular-nums whitespace-nowrap transition-colors ${clockTone(counting, left)}`} role="timer" aria-live="off">
            <Clock className="w-4 h-4" aria-hidden="true" />
            {counting && <span className="text-[11px] font-bold opacity-90">{t('sasm.timeLeft')} </span>}
            {timeText}
          </p>
          <Button size="sm" onClick={() => setAsking(true)} isDisabled={busy || left <= 0}>
            <Send className="w-4 h-4 mr-1.5" aria-hidden="true" />
            {t('sasm.handIn')}
          </Button>
        </div>
      </div>

      {left <= 0 && (
        <p className={WARN} role="status">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {t('sasm.timeUpNow')}
        </p>
      )}
      {failure && (
        <p className={FAIL} role="alert">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {failure}
        </p>
      )}

      <div>
        <nav aria-label={t('sasm.numbers')} className="flex flex-wrap gap-1.5">
          {questions.map((item, i) => {
            const done = isAnswered(item, drafts[item.id]);
            const current = i === index;
            let look = 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50';
            if (current) look = 'bg-brand text-white shadow-sm shadow-brand/30';
            else if (done) look = 'bg-brand-tint text-brand hover:bg-brand/15';
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(i)}
                aria-current={current ? 'step' : undefined}
                aria-label={t(done ? 'sasm.numberDone' : 'sasm.numberOpen', { n: i + 1 })}
                className={`w-9 h-9 rounded-lg text-xs font-extrabold tabular-nums cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 ${look}`}
              >
                {i + 1}
              </button>
            );
          })}
        </nav>
        <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-slate-500" aria-hidden="true">
          <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] bg-brand" />{t('sasm.legend.current')}</span>
          <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] bg-brand-tint border border-brand/35" />{t('sasm.legend.answered')}</span>
          <span className="inline-flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-[3px] bg-white border border-slate-200" />{t('sasm.legend.open')}</span>
        </p>
      </div>

      <section className={`${card} space-y-4`} aria-labelledby={`q-title-${question.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h2 id={`q-title-${question.id}`} className="text-base font-extrabold text-slate-900 tracking-tight">
              {t('sasm.questionOf', { n: index + 1, total: questions.length })}
            </h2>
            <FactLine
              size="xs"
              facts={[t(`qbank.kind.${question.kind}`), question.points === null ? t('sasm.commentOnly') : t('sasm.points', { n: question.points })]}
            />
          </div>
          <div aria-live="polite" className="flex items-center gap-2">
            {saveChip}
            {/* "Coba lagi" saves the typed or chosen answer again; a file is picked again instead. */}
            {status.error && !status.saving && !status.fileError && (
              <button type="button" onClick={() => save(question.id)} className="text-xs font-bold text-brand hover:underline cursor-pointer">
                {t('att.error.retry')}
              </button>
            )}
          </div>
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
        {(saveProblem || ((question.kind === 'MCQ' || question.kind === 'TF') && isAnswered(question, draft) && left > 0)) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
            {saveProblem && <span className="text-rose-700">{saveProblem}</span>}
            {(question.kind === 'MCQ' || question.kind === 'TF') && isAnswered(question, draft) && left > 0 && (
              <button type="button" onClick={() => setDraft(question.id, question.kind === 'MCQ' ? [] : null, { now: true })} className="ml-auto text-slate-500 hover:text-slate-800 underline underline-offset-2 cursor-pointer">
                {t('sasm.clear')}
              </button>
            )}
          </div>
        )}
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
          <Button size="sm" onClick={() => setAsking(true)} isDisabled={busy || left <= 0}>
            <Send className="w-4 h-4 mr-1.5" aria-hidden="true" />
            {t('sasm.handIn')}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={asking}
        tone="brand"
        icon={Send}
        title={t('sasm.handInConfirm.title')}
        body={
          <>
            <p>{t('sasm.handInConfirm.final')}</p>
            <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p className="flex justify-between gap-3 text-[12.5px] font-bold text-slate-700">
                <span>{t('sasm.answeredOfWords', { n: answered, total: questions.length })}</span>
                {missing.length > 0 && <span className="text-amber-700">{t('sasm.notAnsweredCount', { n: missing.length })}</span>}
              </p>
              <div className="mt-2">
                <AnsweredBar answered={answered} total={questions.length} />
              </div>
              {missing.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                  <span className="mr-0.5">{t('sasm.missingLabel')}</span>
                  {missing.map((i) => (
                    <button
                      key={questions[i].id}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setAsking(false);
                        go(i);
                      }}
                      aria-label={t('sasm.goTo', { n: i + 1 })}
                      className="w-[30px] h-[30px] rounded-lg bg-white border border-slate-200 text-xs font-extrabold text-slate-700 tabular-nums hover:border-brand hover:text-brand cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        }
        confirmLabel={t('sasm.handIn')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        onConfirm={handIn}
        onCancel={() => !busy && setAsking(false)}
      />
      {locked && !asking && (
        <FullscreenLockDialog
          facts={[
            { label: counting ? t('sasm.timeLeft') : t('sasm.deadline'), value: counting ? clockText(left) : deadlineWords },
            { label: t('sasm.answeredWordLabel'), value: t('sasm.answeredCount', { n: answered, total: questions.length }) },
          ]}
          onBack={integrity.fullscreen.enter}
          onHandIn={() => setAsking(true)}
        />
      )}
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
    const shown = Boolean(question.key);
    const key = new Set(question.key?.correctOptionIds ?? []);
    const round = question.mcqScoring === 'SINGLE';
    return (
      <ul className="space-y-1.5">
        {options.map((option) => {
          const chosen = Boolean(answer.optionIds?.includes(option.id));
          const correct = shown && key.has(option.id);
          /* With the key shown: the key green, a wrong choice rose; without it a choice stays purple. */
          let look = 'border-slate-200';
          let tone = 'idle';
          let side = null;
          if (correct) {
            look = 'border-emerald-200 bg-emerald-50';
            tone = 'key';
            side = <span className="text-emerald-700">{chosen ? t('sasm.yourChoiceKey') : t('sasm.key')}</span>;
          } else if (chosen && shown) {
            look = 'border-rose-200 bg-rose-50';
            tone = 'wrong';
            side = <span className="text-rose-700">{t('sasm.yourChoice')}</span>;
          } else if (chosen) {
            look = 'border-brand bg-brand-tint';
            tone = 'chosen';
            side = <span className="text-brand">{t('sasm.yourChoice')}</span>;
          }
          return (
            <li key={option.id} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${look}`}>
              <Letter letter={option.letter} round={round} tone={tone} />
              <span className="min-w-0 flex-1 space-y-2 pt-1">
                {option.text && <span className="block text-sm font-semibold text-slate-800 break-words">{option.text}</span>}
                {option.imageId && <QuestionImage imageId={option.imageId} submissionId={submissionId} className="max-h-40" />}
              </span>
              {side && <span className="shrink-0 pt-1.5 text-[11px] font-bold text-right">{side}</span>}
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

/* The key in words, for the kinds whose options are not coloured (an MCQ's key is the green option). */
const KeyLine = ({ question, t }) => {
  const key = keyOf(question);
  if (!key || key.kind === 'MCQ') return null;
  const text = key.kind === 'TF' ? t(`qbank.tf.${key.value}`) : key.accepted.join(' / ');
  return (
    <p className="text-xs font-semibold text-slate-600">
      {t('sasm.key')}: <span className="font-bold">{text}</span>
    </p>
  );
};

const ReadBack = ({ view, zone, notice }) => {
  const { t, lang } = useT();
  const { submission, questions } = view;
  const state = attemptState(submission, view.assessment);
  const local = (instant) => {
    const value = instant ? localOf(instant, zone) : null;
    return value ? `${formatSchoolDay(value.date, lang)} ${value.time}` : '';
  };

  let closedLine;
  if (state === 'VOID') closedLine = t('sasm.voided', { reason: submission.voidReason ?? '' });
  else if (submission.closedBy === 'TEACHER') closedLine = t('sasm.markedAt', { date: local(submission.submittedAt) });
  else if (submission.closedBy === 'TIME') closedLine = t('sasm.closedByTime', { date: local(submission.submittedAt) });
  else closedLine = t('sasm.handedInAt', { date: local(submission.submittedAt) });

  const flags = [
    submission.late && <span key="late" className="text-amber-700 font-bold">{t('tasm.results.late')}</span>,
    submission.remedial && <span key="remedial" className="text-brand font-bold">{t('tasm.results.remedial')}</span>,
    state === 'WAITING' && <span key="waiting">{t('sasm.waitingRelease')}</span>,
    state === 'CHECKED' && waitsForComment(questions) && <span key="comment">{t('sasm.practice.waitingComment')}</span>,
  ].filter(Boolean);

  return (
    <div className="space-y-5">
      {notice && (
        <p className={WARN} role="status">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          {notice}
        </p>
      )}
      <section className={`${card} space-y-3`}>
        <div className="space-y-1 min-w-0">
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight break-words">{closedLine}</h2>
          {flags.length > 0 && (
            <p className="flex flex-wrap items-center text-xs font-semibold text-slate-500">
              {flags.map((flag, i) => (
                <React.Fragment key={flag.key}>
                  {i > 0 && <span className="mx-2 text-slate-300" aria-hidden="true">/</span>}
                  {flag}
                </React.Fragment>
              ))}
            </p>
          )}
        </div>
        {submission.score && (
          <div className="flex items-center gap-4 rounded-2xl bg-brand-tint px-4 py-3.5">
            <p className="text-[34px] font-extrabold text-brand tabular-nums leading-none">{formatNumber(submission.score.value, lang)}</p>
            <p className="text-[12.5px] font-medium text-slate-600 leading-snug">
              {t('sasm.yourScore')}
              {submission.score.pointsTotal !== null && (
                <span className="block">{t('sasm.scorePoints', { earned: formatNumber(submission.score.pointsEarned, lang), total: submission.score.pointsTotal })}</span>
              )}
            </p>
          </div>
        )}
        {submission.score?.reason && <p className="text-xs font-semibold text-slate-600 break-words">{t('sasm.corrected', { reason: submission.score.reason })}</p>}
        {submission.comment && (
          <div className="rounded-xl bg-slate-50 px-3.5 py-2.5 space-y-0.5">
            <p className="text-[10px] font-bold tracking-wider uppercase text-slate-500">{t('sasm.teacherComment')}</p>
            <p className="text-sm font-medium text-slate-800 break-words whitespace-pre-wrap">{submission.comment}</p>
          </div>
        )}
      </section>

      <ol className="space-y-3">
        {questions.map((question, index) => {
          /* Right or wrong once released (owner, 2026-10-18), as the teacher's marking page says it. */
          const verdict = question.marks ? verdictOf({ kind: question.kind, points: question.points, earned: question.marks.points, answered: Boolean(question.answer) }) : null;
          let points;
          if (question.points === null) points = t('sasm.commentOnly');
          else if (question.marks) points = t('sasm.pointsOf', { earned: formatNumber(question.marks.points, lang), total: question.points });
          else points = t('sasm.points', { n: question.points });
          return (
            <li key={question.id} className={`${card} space-y-3`}>
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-extrabold flex items-center justify-center shrink-0">{index + 1}</span>
                <div className="min-w-0">
                  {verdict && <p className={`text-xs font-extrabold ${VERDICT_TONE[verdict]}`}>{t(`tasm.verdict.${verdict}`)}</p>}
                  <FactLine size="xs" facts={[t(`qbank.kind.${question.kind}`), points]} />
                </div>
              </div>
              <QuestionBody question={question} submissionId={submission.id} />
              <AnswerReadBack question={question} submissionId={submission.id} t={t} />
              <KeyLine question={question} t={t} />
              {question.marks?.comment && <p className="text-xs font-semibold text-slate-700 break-words">{t('tasm.mark.commentSaid', { comment: question.marks.comment })}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

/* While the attempt is read: the heading, the bar and a question, in outline. */
const AttemptLoading = ({ label }) => (
  <div className="space-y-5" aria-busy="true" aria-label={label}>
    <div className="space-y-2">
      <div className="h-3 w-28 rounded-[10px] bg-slate-100 animate-pulse" />
      <div className="h-7 w-3/4 rounded-[10px] bg-slate-100 animate-pulse" />
      <div className="h-3 w-2/5 rounded-[10px] bg-slate-100 animate-pulse" />
    </div>
    <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex gap-3">
      <div className="h-8 flex-1 rounded-[10px] bg-slate-100 animate-pulse" />
      <div className="h-9 w-28 rounded-[10px] bg-slate-100 animate-pulse" />
    </div>
    <div className={`${card} space-y-3`}>
      <div className="h-4 w-28 rounded-[10px] bg-slate-100 animate-pulse" />
      <div className="h-3 w-11/12 rounded-[10px] bg-slate-100 animate-pulse" />
      <div className="h-3 w-3/4 rounded-[10px] bg-slate-100 animate-pulse" />
      <div className="h-11 rounded-[10px] bg-slate-100 animate-pulse" />
      <div className="h-11 rounded-[10px] bg-slate-100 animate-pulse" />
    </div>
  </div>
);

export const StudentAttemptPage = () => {
  const { assessmentId, submissionId } = useParams();
  const { t } = useT();
  const navigate = useNavigate();
  const { showToast } = useOutletContext() ?? {};
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

  if (data === undefined) return <AttemptLoading label={t('common.loading')} />;
  if (data.error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('shell.assessment')}</h1>
        <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-[13px] font-semibold text-rose-700" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-[12rem]">{data.error}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setData(undefined);
              setAttempt((n) => n + 1);
            }}
          >
            {t('att.error.retry')}
          </Button>
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
          onHandedIn={(answer, { answered, total }) => {
            setNotice(null);
            setData({ view: answer });
            window.scrollTo({ top: 0 });
            showToast?.(t('sasm.handedInToast.title'), 'success', {
              description: t('sasm.handedInToast.body', { title: assessment.title, n: answered, total }),
            });
          }}
        />
      ) : (
        <ReadBack view={view} zone={zone} notice={notice} />
      )}
    </div>
  );
};

export default StudentAttemptPage;
