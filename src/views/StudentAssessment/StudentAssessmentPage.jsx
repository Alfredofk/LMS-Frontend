import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ChevronRight, Play, RefreshCw, ShieldAlert } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FactLine from '../../components/ui/FactLine';
import { useSchoolZone } from '../../hooks/useSchoolToday';
import { useT } from '../../i18n/LanguageContext';
import { studentAssessmentErrorMessage } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import { localOf } from '../Attendance/attendance';
import { formatSchoolDay } from '../QuestionBank/questionBank';
import { formatNumber } from '../TeacherAssessment/results';
import { afterRuleOf, belowKktpOf } from './studentMenu';
import { isPractice, typeModeText, windowText } from '../TeacherAssessment/teacherAssessment';
import { noteAssessmentSubject } from './assessmentBack';
import { forgetMyMenu } from './readMyMenu';
import { enterFullscreen, leaveFullscreen } from './useIntegritySignals';
import { STUDENT_STATE_TONE, attemptState, attemptsLeftText, startState, studentStateOf } from './studentAssessment';

/*
  One assessment for a student, before and between attempts (/assessment/:id;
  backend 6380e3e, 1e6c749; owner 2026-10-11). The outline never shows a question:
  the window and attempts on the student's own terms (a make-up's or a remedial's,
  said in a line), the time limit, the integrity notice for a Kuis/UTS/UAS taken
  online, the instructions, the score that counts, and their attempts, each opening
  StudentAttemptPage. "Mulai" asks first when a clock or the notice applies;
  "Lanjutkan" goes back to the attempt in progress.

  Reached from a subject's "Penilaian" tab (SubjectAssessments; /assessment's
  cards lead there), backend 113ae37.

  A LATIHAN (backend 026e4f9, owner 2026-10-18) says it is never graded, may have
  unlimited attempts, and shows the best attempt's result where the score that
  counts would be (`practice.best`). A graded one's score is red under the KKTP it
  is counted with (`kktp`, backend 3814cf9; owner 2026-10-19), "KKTP 75" under it.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const tool =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';

const ATTEMPT_TONE = {
  IN_PROGRESS: 'text-sky-700',
  WAITING: 'text-brand',
  RELEASED: 'text-emerald-700',
  CHECKED: 'text-emerald-700',
  VOID: 'text-slate-500',
};

const Fact = ({ label, children }) => (
  <div className="space-y-0.5">
    <dt className="text-[11px] font-bold text-slate-500">{label}</dt>
    <dd className="text-sm font-semibold text-slate-800">{children}</dd>
  </div>
);

export const StudentAssessmentPage = () => {
  const { assessmentId } = useParams();
  const { t, lang } = useT();
  const navigate = useNavigate();
  const zone = useSchoolZone();
  /* undefined reading · outline · { error } */
  const [data, setData] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  useEffect(() => {
    let cancelled = false;
    assessmentService
      .outline(assessmentId)
      .then((answer) => !cancelled && setData(answer))
      .catch((err) => !cancelled && setData({ error: studentAssessmentErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [assessmentId, attempt, t]);

  /* The navbar's back arrow leads to this assessment's subject tab once it is known. */
  const classSubjectId = data?.assessment?.classSubject?.id ?? null;
  useEffect(() => noteAssessmentSubject(assessmentId, classSubjectId), [assessmentId, classSubjectId]);

  const when = (instant) => {
    const local = instant ? localOf(instant, zone) : null;
    return local ? `${formatSchoolDay(local.date, lang)} ${local.time}` : '';
  };
  const openAttempt = (submissionId) => navigate(`/assessment/${assessmentId}/percobaan/${submissionId}`);

  if (data === undefined) {
    return <div className="h-72 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
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

  const { assessment, submissions = [] } = data;
  const state = startState(data);
  const online = assessment.mode === 'ONLINE';
  const practice = isPractice(assessment);
  const attemptsLeft = attemptsLeftText(data);
  /* What heads the attempts: the score that counts, or a LATIHAN's best attempt (backend 026e4f9). */
  const shownScore = practice ? (data.practice?.best?.value ?? null) : data.score;
  const below = !practice && belowKktpOf(data);
  /* A clock that starts, or the integrity notice: worth a question before the first click. */
  const asksFirst = Boolean(assessment.timeLimitMinutes) || assessment.integritySignals;

  /* An attempt that records integrity signals is done in fullscreen: asked here, inside the click (owner 2026-10-13). */
  const fullscreenFirst = () => assessment.integritySignals && enterFullscreen();

  const start = async () => {
    fullscreenFirst();
    setBusy(true);
    setFailure(null);
    try {
      const answer = await assessmentService.start(assessmentId);
      forgetMyMenu();
      openAttempt(answer.submission.id);
    } catch (err) {
      setBusy(false);
      setAsking(false);
      setFailure(studentAssessmentErrorMessage(err, t));
      setAttempt((n) => n + 1);
      leaveFullscreen();
    }
  };

  const exception = assessment.exception;

  return (
    <div className="space-y-6 text-left">
      <div className="space-y-1.5">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight break-words">
          {assessment.title}{' '}
          <span
            className={`inline-flex items-center align-middle ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase leading-4 whitespace-nowrap ${STUDENT_STATE_TONE[studentStateOf(assessment)]}`}
          >
            {t(`sasm.state.${studentStateOf(assessment)}`)}
          </span>
        </h1>
        <FactLine
          code={assessment.classSubject.subject.code}
          name={assessment.classSubject.subject.name}
          facts={[assessment.classSubject.class.name, typeModeText(t, assessment)]}
        />
      </div>

      {assessment.status === 'CANCELLED' && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 space-y-1">
          <p className="text-sm font-bold text-rose-700">{t('sasm.cancelled')}</p>
          {assessment.cancelReason && <p className="text-xs font-semibold text-rose-700 break-words">{t('sasm.cancelReason', { reason: assessment.cancelReason })}</p>}
        </div>
      )}

      <section className={`${card} space-y-5`} aria-label={t('sasm.about')}>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <Fact label={t('sasm.fact.window')}>{windowText(assessment, zone, lang)}</Fact>
          {online && <Fact label={t('sasm.fact.timeLimit')}>{assessment.timeLimitMinutes ? t('sasm.minutes', { n: assessment.timeLimitMinutes }) : t('sasm.noLimit')}</Fact>}
          {online && <Fact label={t('sasm.fact.attempts')}>{t(attemptsLeft.key, attemptsLeft.vars)}</Fact>}
          {online && <Fact label={t('sasm.fact.questions')}>{t('sasm.questionCount', { n: assessment.questionCount, points: assessment.totalPoints })}</Fact>}
          {online && assessment.acceptLate && <Fact label={t('sasm.fact.late')}>{t('sasm.lateAccepted')}</Fact>}
        </dl>

        {practice && <p className="rounded-xl bg-brand-tint px-3.5 py-2.5 text-xs font-semibold text-brand leading-relaxed">{t('sasm.practice.note')}</p>}

        {exception && (
          <p className="rounded-xl bg-brand-tint px-3.5 py-2.5 text-xs font-semibold text-brand leading-relaxed">
            {exception.remedial
              ? t('sasm.exception.remedial', { n: exception.extraAttempts })
              : exception.makeUp
                ? t('sasm.exception.makeUp')
                : t('sasm.exception.extra', { n: exception.extraAttempts })}
          </p>
        )}

        {online && assessment.integritySignals && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800 leading-relaxed">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            {t('sasm.integrity')}
          </p>
        )}

        {assessment.instructions && (
          <div className="space-y-1">
            <p className="text-sm font-extrabold text-slate-900">{t('tasm.reader.instructions')}</p>
            <div className="content-html text-sm text-slate-800 break-words" dangerouslySetInnerHTML={{ __html: assessment.instructions }} />
          </div>
        )}

        {failure && (
          <p className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
            {failure}
          </p>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 border-t border-slate-100 pt-4">
          {state.action === 'continue' && (
            <button type="button" onClick={() => {
                fullscreenFirst();
                openAttempt(data.inProgressId);
              }} className={`${tool} px-5 py-2.5 text-sm bg-brand text-white hover:bg-brand-deep`}>
              <Play className="w-4 h-4" aria-hidden="true" />
              {t('sasm.continue')}
            </button>
          )}
          {state.action === 'start' && (
            <button
              type="button"
              onClick={() => (asksFirst ? setAsking(true) : start())}
              disabled={busy}
              className={`${tool} px-5 py-2.5 text-sm bg-brand text-white hover:bg-brand-deep`}
            >
              <Play className="w-4 h-4" aria-hidden="true" />
              {busy ? t('common.loading') : submissions.length ? t('sasm.startAgain') : t('sasm.start')}
            </button>
          )}
          {state.why && <p className="text-xs font-semibold text-slate-500">{t(`sasm.why.${state.why}`, { date: when(assessment.opensAt) })}</p>}
        </div>
      </section>

      {(data.score !== null || submissions.length > 0) && (
        <section className={`${card} space-y-4`} aria-labelledby="sasm-attempts">
          <div className="flex items-start justify-between gap-3">
            <h2 id="sasm-attempts" className="text-base font-extrabold text-slate-900">
              {t(online ? 'sasm.attempts' : 'sasm.yourMark')}
            </h2>
            <div className="text-right">
              <p className={`text-2xl font-extrabold tabular-nums leading-tight ${below ? 'text-rose-600' : 'text-slate-900'}`}>
                {formatNumber(shownScore, lang)}
                {below && <span className="sr-only"> ({t('gradebook.kktp.below')})</span>}
              </p>
              <p className="text-[11px] font-medium text-slate-500">
                {practice
                  ? t(shownScore !== null ? 'sasm.practice.best' : assessment.totalPoints === 0 ? 'sasm.practice.noTotal' : 'sasm.noScoreYet')
                  : data.score !== null
                    ? t('sasm.scoreCounts')
                    : t('sasm.noScoreYet')}
              </p>
              {!practice && typeof data.kktp === 'number' && <p className="text-[11px] font-medium text-slate-500 tabular-nums">{t('sasm.kktp', { kktp: data.kktp })}</p>}
            </div>
          </div>
          {/* The score a remedial counts for, where the school's rule moves it (backend 79b319f, owner 2026-10-18): the raw score stays above. */}
          {afterRuleOf(data) && (
            <div className="space-y-1">
              <p className="text-right text-xs font-semibold text-slate-700 tabular-nums">
                {t('sasm.afterRule', { score: formatNumber(afterRuleOf(data).score, lang), rule: afterRuleOf(data).rule ? t(`grading.rule.${afterRuleOf(data).rule}`) : '-' })}
              </p>
              {afterRuleOf(data).rule && <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{t(`grading.rule.${afterRuleOf(data).rule}.hint`)}</p>}
            </div>
          )}
          {submissions.length > 0 ? (
            <ul className="space-y-2">
              {[...submissions].reverse().map((submission) => {
                const rowState = attemptState(submission, assessment);
                return (
                  <li key={submission.id}>
                    <button
                      type="button"
                      onClick={() => openAttempt(submission.id)}
                      className="group w-full flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl bg-slate-50 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {/* An offline mark is the teacher's, not an attempt the student made. */}
                      <span className="font-bold text-slate-800">
                        {submission.closedBy === 'TEACHER' ? t('sasm.teacherMark') : t('tasm.results.attempt', { n: submission.attempt })}
                      </span>
                      <span className={ATTEMPT_TONE[rowState]}>{t(`sasm.attemptState.${rowState}`)}</span>
                      {submission.submittedAt && <span className="tabular-nums">{when(submission.submittedAt)}</span>}
                      {submission.late && <span className="text-amber-700">{t('tasm.results.late')}</span>}
                      {submission.remedial && <span className="text-brand">{t('tasm.results.remedial')}</span>}
                      <span className="ml-auto flex items-center gap-2">
                        {submission.score && <span className="text-sm font-extrabold text-slate-900 tabular-nums">{formatNumber(submission.score.value, lang)}</span>}
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand" aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs font-semibold text-slate-500">{t('sasm.offlineScore')}</p>
          )}
        </section>
      )}

      <ConfirmDialog
        open={asking}
        tone="brand"
        icon={Play}
        title={t('sasm.startConfirm.title')}
        body={[
          assessment.timeLimitMinutes ? t('sasm.startConfirm.clock', { n: assessment.timeLimitMinutes }) : t('sasm.startConfirm.noClock', { date: when(assessment.closesAt) }),
          assessment.integritySignals ? t('sasm.startConfirm.integrity') : '',
        ]
          .filter(Boolean)
          .join(' ')}
        confirmLabel={t('sasm.start')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        busyLabel={t('common.loading')}
        onConfirm={start}
        onCancel={() => !busy && setAsking(false)}
      />
    </div>
  );
};

export default StudentAssessmentPage;
