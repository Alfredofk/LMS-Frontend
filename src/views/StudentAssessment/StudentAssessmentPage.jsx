import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ChevronRight, Clock, Info, Lock, Maximize, Play, XCircle } from 'lucide-react';

import Button from '../../components/ui/Button';
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
import { STUDENT_STATE_TONE, attemptState, attemptsLeftText, closingWordsOf, startState, studentStateOf } from './studentAssessment';

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

  The look since 2026-10-29 (mockup C:\Thesis\mockups\outline-penilaian.html, all
  eleven items): the facts as eyebrow cells under "Tentang penilaian ini", how
  soon it closes (`closingWordsOf`), every note one bordered box with an icon,
  the reason it cannot start a grey box where the button would be, the score in a
  panel (rose and said "Di bawah KKTP" below it), the attempts one list of rows
  with a "Lanjutkan" on the one in progress, the start question in cells.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const note = 'flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] font-semibold leading-relaxed';
const NOTE = {
  info: `${note} bg-brand-tint border-brand/20 text-brand`,
  warn: `${note} bg-amber-50 border-amber-100 text-amber-800`,
  fail: `${note} bg-rose-50 border-rose-100 text-rose-700`,
  quiet: `${note} bg-slate-50 border-slate-100 text-slate-700`,
};
const noteIcon = 'w-4 h-4 shrink-0 mt-0.5';

const ATTEMPT_TONE = {
  IN_PROGRESS: 'text-brand',
  WAITING: 'text-slate-600',
  RELEASED: 'text-emerald-700',
  CHECKED: 'text-emerald-700',
  VOID: 'text-slate-500',
};

/* An eyebrow cell: the label in small capitals sitting on its value, a grey line under it when there is one. */
const Fact = ({ label, sub, wide = false, children }) => (
  <div className={`min-w-0 ${wide ? 'col-span-full' : ''}`}>
    <dt className="text-[10px] font-bold tracking-wider uppercase text-slate-500">{label}</dt>
    <dd className="mt-0.5 text-sm font-bold text-slate-900 break-words">
      {children}
      {sub && <span className="block text-xs font-medium text-slate-500">{sub}</span>}
    </dd>
  </div>
);

/* Facts and pieces joined by the light slash, as FactLine does. */
const Slashed = ({ parts }) => (
  <p className="flex flex-wrap items-center text-xs font-semibold text-slate-500">
    {parts.filter(Boolean).map((part, i) => (
      <React.Fragment key={i}>
        {i > 0 && <span className="mx-1.5 text-slate-300" aria-hidden="true">/</span>}
        {part}
      </React.Fragment>
    ))}
  </p>
);

const OutlineLoading = ({ label }) => (
  <div className="space-y-6" aria-busy="true" aria-label={label}>
    <div className="space-y-2">
      <div className="h-8 w-3/4 rounded-[10px] bg-slate-100 animate-pulse" />
      <div className="h-3 w-2/5 rounded-[10px] bg-slate-100 animate-pulse" />
    </div>
    <div className={`${card} space-y-4`}>
      <div className="h-4 w-40 rounded-[10px] bg-slate-100 animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-full h-9 rounded-[10px] bg-slate-100 animate-pulse" />
        <div className="h-9 rounded-[10px] bg-slate-100 animate-pulse" />
        <div className="h-9 rounded-[10px] bg-slate-100 animate-pulse" />
        <div className="h-9 rounded-[10px] bg-slate-100 animate-pulse" />
      </div>
      <div className="h-10 w-48 rounded-[10px] bg-slate-100 animate-pulse" />
    </div>
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

  if (data === undefined) return <OutlineLoading label={t('common.loading')} />;
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

  const { assessment, submissions = [] } = data;
  const state = startState(data);
  const online = assessment.mode === 'ONLINE';
  const practice = isPractice(assessment);
  const attemptsLeft = attemptsLeftText(data);
  /* What heads the attempts: the score that counts, or a LATIHAN's best attempt (backend 026e4f9). */
  const shownScore = practice ? (data.practice?.best?.value ?? null) : data.score;
  const below = !practice && belowKktpOf(data);
  const hasKktp = !practice && typeof data.kktp === 'number';
  /* A clock that starts, or the integrity notice: worth a question before the first click. */
  const asksFirst = Boolean(assessment.timeLimitMinutes) || assessment.integritySignals;
  const studentState = studentStateOf(assessment);
  const closing = studentState === 'OPEN' ? closingWordsOf(assessment.closesAt, zone) : null;

  /* An attempt that records integrity signals is done in fullscreen: asked here, inside the click (owner 2026-10-13). */
  const fullscreenFirst = () => assessment.integritySignals && enterFullscreen();
  const continueAttempt = (submissionId) => {
    fullscreenFirst();
    openAttempt(submissionId);
  };

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
  const questionsFact = t('sasm.questionsN', { n: assessment.questionCount });
  const pointsFact = t('sasm.pointsN', { points: assessment.totalPoints });

  let scoreLabel;
  if (practice) scoreLabel = t(shownScore !== null ? 'sasm.practice.best' : assessment.totalPoints === 0 ? 'sasm.practice.noTotal' : 'sasm.noScoreYet');
  else scoreLabel = data.score !== null ? t('sasm.scoreCounts') : t('sasm.noScoreYet');

  return (
    <div className="space-y-6 text-left">
      <div className="space-y-1.5">
        <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight break-words">
          {assessment.title}{' '}
          <span
            className={`inline-flex items-center align-middle ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold uppercase leading-4 whitespace-nowrap ${STUDENT_STATE_TONE[studentState]}`}
          >
            {t(`sasm.state.${studentState}`)}
          </span>
        </h1>
        <FactLine
          code={assessment.classSubject.subject.code}
          name={assessment.classSubject.subject.name}
          facts={[assessment.classSubject.class.name, typeModeText(t, assessment)]}
        />
      </div>

      {assessment.status === 'CANCELLED' && (
        <div className={NOTE.fail}>
          <XCircle className={noteIcon} aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-bold">{t('sasm.cancelled')}</p>
            {assessment.cancelReason && <p className="font-medium break-words">{t('sasm.cancelReason', { reason: assessment.cancelReason })}</p>}
          </div>
        </div>
      )}

      <section className={`${card} space-y-5`} aria-labelledby="sasm-about">
        <h2 id="sasm-about" className="text-base font-extrabold text-slate-900 tracking-tight">
          {t('sasm.about')}
        </h2>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
          <Fact wide label={t('sasm.fact.window')} sub={closing ? t(closing.key, closing.vars) : null}>
            {windowText(assessment, zone, lang)}
          </Fact>
          {online && (
            <Fact label={t('sasm.fact.timeLimit')} sub={assessment.timeLimitMinutes ? t('sasm.sinceStart') : t('sasm.untilClose')}>
              {assessment.timeLimitMinutes ? t('sasm.minutesN', { n: assessment.timeLimitMinutes }) : t('sasm.noLimitShort')}
            </Fact>
          )}
          {online && <Fact label={t('sasm.fact.attempts')}>{t(attemptsLeft.key, attemptsLeft.vars)}</Fact>}
          {online && (
            <Fact label={t('sasm.fact.questions')} sub={pointsFact}>
              {questionsFact}
            </Fact>
          )}
          {online && assessment.acceptLate && (
            <Fact wide label={t('sasm.fact.late')}>
              {t('sasm.lateAccepted')}
            </Fact>
          )}
        </dl>

        {practice && (
          <p className={NOTE.info}>
            <Info className={noteIcon} aria-hidden="true" />
            {t('sasm.practice.note')}
          </p>
        )}

        {exception && (
          <p className={NOTE.info}>
            <Info className={noteIcon} aria-hidden="true" />
            {exception.remedial
              ? t('sasm.exception.remedial', { n: exception.extraAttempts })
              : exception.makeUp
                ? t('sasm.exception.makeUp')
                : t('sasm.exception.extra', { n: exception.extraAttempts })}
          </p>
        )}

        {online && assessment.integritySignals && (
          <p className={NOTE.warn}>
            <Maximize className={noteIcon} aria-hidden="true" />
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
          <p className={NOTE.fail} role="alert">
            <AlertCircle className={noteIcon} aria-hidden="true" />
            {failure}
          </p>
        )}

        <div className="border-t border-slate-100 pt-4">
          {state.action === 'continue' && (
            <Button onClick={() => continueAttempt(data.inProgressId)}>
              <Play className="w-4 h-4 mr-2" aria-hidden="true" />
              {t('sasm.continue')}
            </Button>
          )}
          {state.action === 'start' && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button onClick={() => (asksFirst ? setAsking(true) : start())} isLoading={busy}>
                {!busy && <Play className="w-4 h-4 mr-2" aria-hidden="true" />}
                {submissions.length ? t('sasm.startAgain') : t('sasm.start')}
              </Button>
              {online && typeof data.attemptsLeft === 'number' && (
                <p className="text-xs font-semibold text-slate-500">{t('sasm.attemptsLeftHint', attemptsLeft.vars)}</p>
              )}
            </div>
          )}
          {state.why && (
            <p className={NOTE.quiet}>
              {state.why === 'notOpen' ? <Clock className={noteIcon} aria-hidden="true" /> : <Lock className={noteIcon} aria-hidden="true" />}
              {t(`sasm.why.${state.why}`, { date: when(assessment.opensAt) })}
            </p>
          )}
        </div>
      </section>

      {(data.score !== null || submissions.length > 0) && (
        <section className={`${card} space-y-4`} aria-labelledby="sasm-attempts">
          <h2 id="sasm-attempts" className="text-base font-extrabold text-slate-900 tracking-tight">
            {t(online ? 'sasm.attempts' : 'sasm.yourMark')}
          </h2>
          <div className={`flex items-center gap-4 rounded-2xl px-4 py-3.5 ${below ? 'bg-rose-50' : shownScore === null ? 'bg-slate-50' : 'bg-brand-tint'}`}>
            <p className={`text-[34px] font-extrabold tabular-nums leading-none ${below ? 'text-rose-700' : shownScore === null ? 'text-slate-500' : 'text-brand'}`}>
              {formatNumber(shownScore, lang)}
            </p>
            <div className="text-[12.5px] font-medium text-slate-600 leading-snug">
              {below && <p className="text-[13px] font-bold text-rose-700">{t('sasm.belowKktp', { kktp: data.kktp })}</p>}
              <p>{scoreLabel}</p>
              {hasKktp && !below && <p className="tabular-nums">{t('sasm.kktp', { kktp: data.kktp })}</p>}
            </div>
          </div>
          {/* The score a remedial counts for, where the school's rule moves it (backend 79b319f, owner 2026-10-18): the raw score stays above. */}
          {afterRuleOf(data) && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-700 tabular-nums">
                {t('sasm.afterRule', { score: formatNumber(afterRuleOf(data).score, lang), rule: afterRuleOf(data).rule ? t(`grading.rule.${afterRuleOf(data).rule}`) : '-' })}
              </p>
              {afterRuleOf(data).rule && <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{t(`grading.rule.${afterRuleOf(data).rule}.hint`)}</p>}
            </div>
          )}
          {submissions.length > 0 ? (
            <ul>
              {[...submissions].reverse().map((submission) => {
                const rowState = attemptState(submission, assessment);
                /* An offline mark is the teacher's, not an attempt the student made. */
                const name = submission.closedBy === 'TEACHER' ? t('sasm.teacherMark') : t('tasm.results.attempt', { n: submission.attempt });
                const facts = (
                  <Slashed
                    parts={[
                      <span key="state" className={`font-bold ${ATTEMPT_TONE[rowState]}`}>{t(`sasm.attemptState.${rowState}`)}</span>,
                      submission.submittedAt && <span key="at" className="tabular-nums">{when(submission.submittedAt)}</span>,
                      submission.late && <span key="late" className="font-bold text-amber-700">{t('tasm.results.late')}</span>,
                      submission.remedial && <span key="remedial" className="font-bold text-brand">{t('tasm.results.remedial')}</span>,
                    ]}
                  />
                );
                return (
                  <li key={submission.id} className="border-b border-slate-100 last:border-0">
                    {rowState === 'IN_PROGRESS' ? (
                      <div className="flex items-center gap-3 px-2 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900">{name}</p>
                          {facts}
                        </div>
                        <Button size="sm" variant="outline" onClick={() => continueAttempt(submission.id)}>
                          {t('sasm.continueShort')}
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAttempt(submission.id)}
                        className="group w-full flex items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-900">{name}</span>
                          {facts}
                        </span>
                        {submission.score && <span className="text-[15px] font-extrabold text-slate-900 tabular-nums">{formatNumber(submission.score.value, lang)}</span>}
                        <ChevronRight className="w-4 h-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true" />
                      </button>
                    )}
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
        body={
          <div className="space-y-2.5">
            {online && (
              <dl className="flex flex-wrap gap-x-7 gap-y-2 pt-1">
                {assessment.timeLimitMinutes ? (
                  <div>
                    <dt className="text-[10px] font-bold tracking-wider uppercase text-slate-500">{t('sasm.yourTime')}</dt>
                    <dd className="text-sm font-extrabold text-slate-900">{t('sasm.minutesN', { n: assessment.timeLimitMinutes })}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-[10px] font-bold tracking-wider uppercase text-slate-500">{t('sasm.fact.questions')}</dt>
                  <dd className="text-sm font-extrabold text-slate-900">{`${questionsFact}, ${pointsFact}`}</dd>
                </div>
              </dl>
            )}
            <p>{assessment.timeLimitMinutes ? t('sasm.startConfirm.clockNote') : t('sasm.startConfirm.noClock', { date: when(assessment.closesAt) })}</p>
            {assessment.integritySignals && <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 font-semibold text-amber-800">{t('sasm.startConfirm.integrity')}</p>}
          </div>
        }
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
