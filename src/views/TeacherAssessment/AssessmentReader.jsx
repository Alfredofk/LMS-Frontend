import React, { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, ClipboardList, Lock } from 'lucide-react';

import QuestionImage from '../../components/questionBank/QuestionImage';
import { useSchoolZone } from '../../hooks/useSchoolToday';
import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import { QuestionAnswer } from '../QuestionBank/QuestionItem';
import StateWord from './StateWord';
import { windowText } from './teacherAssessment';

/*
  A class subject's assessments, read only (backend 0bb4598; owner 2026-10-08) -
  for those the server lets read and change nothing: the Class's homeroom teacher
  (HomeroomAttendance), the Principal and Vice Principals (the Subjects
  timetable's ScheduleDialog). Opened in place, as SubjectProgress is.

  The slot's list (GET /assessments/class-subjects/:id, drafts included and
  marked), then one opened in the same place (GET /assessments/:id): its window,
  instructions, settings and questions with their keys - the staff see the key,
  as in the bank. No action anywhere; the teacher of the class subject manages.

  @param classSubjectId  the class subject
  @param onBack          () => void - back to what opened it
  @param showTitle       false where the host already heads it "Penilaian"
*/

const back = (label, onClick) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-brand hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
  >
    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
    {label}
  </button>
);

const loading = (t) => <div className="h-20 bg-slate-50 rounded-xl animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;

const settingsFacts = (settings, t) =>
  settings
    ? [
        t('tasm.reader.attempts', { n: settings.maxAttempts }),
        settings.timeLimitMinutes ? t('tasm.reader.limit', { n: settings.timeLimitMinutes }) : t('tasm.reader.noLimit'),
        settings.acceptLate && t('tasm.reader.late'),
        settings.shuffleQuestions && t('tasm.reader.shuffleQuestions'),
        settings.shuffleOptions && t('tasm.reader.shuffleOptions'),
        settings.showKeyOnRelease && t('tasm.reader.showKey'),
      ].filter(Boolean)
    : [];

const Detail = ({ id, zone, onBack, t, lang }) => {
  /* undefined: reading · assessment · { error } */
  const [assessment, setAssessment] = useState(undefined);

  useEffect(() => {
    let cancelled = false;
    assessmentService
      .getAssessment(id)
      .then((found) => !cancelled && setAssessment(found))
      .catch((err) => !cancelled && setAssessment({ error: assessmentErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  if (assessment === undefined) return <div className="space-y-3">{back(t('tasm.reader.backToList'), onBack)}{loading(t)}</div>;
  if (assessment.error) {
    return (
      <div className="space-y-3">
        {back(t('tasm.reader.backToList'), onBack)}
        <p className="text-xs font-semibold text-red-600" role="alert">
          {assessment.error}
        </p>
      </div>
    );
  }

  const facts = settingsFacts(assessment.settings, t);
  const questions = assessment.questions ?? [];

  return (
    <div className="space-y-4">
      {back(t('tasm.reader.backToList'), onBack)}

      <div className="space-y-1">
        <p className="text-base font-extrabold text-slate-900 break-words">{assessment.title}</p>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-slate-500">
          <StateWord assessment={assessment} t={t} />
          <span>{t(`tasm.type.${assessment.type}`)}</span>
          <span>{t(`tasm.mode.${assessment.mode}`)}</span>
          <span className="tabular-nums">{windowText(assessment, zone, lang)}</span>
        </p>
      </div>

      {assessment.status === 'CANCELLED' && assessment.cancelReason && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 break-words">
          {t('tasm.cancelledReason', { reason: assessment.cancelReason })}
        </p>
      )}

      <p className="flex items-start gap-2 text-[11px] font-semibold text-slate-500 leading-relaxed">
        <Lock className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
        {t('tasm.reader.readOnly')}
      </p>

      {assessment.instructions && (
        <div className="space-y-1">
          <p className="text-sm font-extrabold text-slate-900">{t('tasm.reader.instructions')}</p>
          <div className="content-html text-sm text-slate-800 break-words" dangerouslySetInnerHTML={{ __html: assessment.instructions }} />
        </div>
      )}

      {facts.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-extrabold text-slate-900">{t('tasm.settings')}</p>
          <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs font-semibold text-slate-600">
            {facts.map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </p>
        </div>
      )}

      {assessment.mode === 'OFFLINE' ? (
        <p className="text-xs font-semibold text-slate-500 leading-relaxed">{t('tasm.offlineNote')}</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-extrabold text-slate-900">
            {t('tasm.questions')}{' '}
            <span className="text-xs font-semibold text-slate-500">{t('tasm.count', { n: assessment.questionCount, points: assessment.totalPoints })}</span>
          </p>
          {questions.length === 0 ? (
            <p className="text-xs font-semibold text-slate-500">{t('tasm.noQuestionsReadOnly')}</p>
          ) : (
            <ol className="space-y-3">
              {questions.map((question, index) => (
                <li key={question.id} className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs font-bold text-slate-600">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-extrabold flex items-center justify-center shrink-0">{index + 1}</span>
                    <span>{t(`qbank.kind.${question.kind}`)}</span>
                    <span className="ml-auto tabular-nums">{t('tasm.reader.points', { n: question.points })}</span>
                  </p>
                  <div className="content-html text-sm text-slate-800 break-words" dangerouslySetInnerHTML={{ __html: question.body ?? '' }} />
                  {question.imageId && <QuestionImage imageId={question.imageId} assessmentId={assessment.id} className="max-h-48" />}
                  <QuestionAnswer question={question} t={t} imageSource={{ assessmentId: assessment.id }} />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
};

export const AssessmentReader = ({ classSubjectId, onBack, showTitle = true }) => {
  const { t, lang } = useT();
  const zone = useSchoolZone();
  /* undefined: reading · array · { error } */
  const [list, setList] = useState(undefined);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    assessmentService
      .listFor(classSubjectId)
      .then((rows) => !cancelled && setList(rows))
      .catch((err) => !cancelled && setList({ error: assessmentErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [classSubjectId, t]);

  if (openId) return <Detail id={openId} zone={zone} onBack={() => setOpenId(null)} t={t} lang={lang} />;

  return (
    <div className="space-y-3">
      {back(t('tasm.reader.back'), onBack)}
      {showTitle && <p className="text-sm font-extrabold text-slate-900">{t('tasm.pageTitle')}</p>}
      {list === undefined ? (
        loading(t)
      ) : list.error ? (
        <p className="text-xs font-semibold text-red-600" role="alert">
          {list.error}
        </p>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2 py-6">
          <ClipboardList className="w-7 h-7 text-slate-400" aria-hidden="true" />
          <p className="text-xs font-semibold text-slate-500">{t('tasm.reader.empty')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
          {list.map((assessment) => (
            <li key={assessment.id}>
              <button
                type="button"
                onClick={() => setOpenId(assessment.id)}
                className="w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
              >
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 text-xs font-bold text-slate-800 break-words">{assessment.title}</span>
                    <StateWord assessment={assessment} t={t} />
                  </span>
                  <span className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] font-semibold text-slate-500">
                    <span>{t(`tasm.type.${assessment.type}`)}</span>
                    <span>{t(`tasm.mode.${assessment.mode}`)}</span>
                    {assessment.mode === 'ONLINE' && <span>{t('tasm.count', { n: assessment.questionCount, points: assessment.totalPoints })}</span>}
                  </span>
                  <span className="block text-[11px] font-semibold text-slate-500 tabular-nums">{windowText(assessment, zone, lang)}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AssessmentReader;
