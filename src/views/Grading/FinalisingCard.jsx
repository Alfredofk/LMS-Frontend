import React, { useState } from 'react';
import { ChevronRight, Lock } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useT } from '../../i18n/LanguageContext';
import { finalisingErrorMessage, isStaleFinalising } from '../../i18n/apiError';
import { gradingService } from '../../services/gradingService';
import { shortWhen } from '../TeacherAssessment/teacherAssessment';
import { blockerText, blockerView, canFinalise, canUnfinalise, finalisingShown, semesterStatusOf } from './finalising';
import { forgetSlotFinalised } from './useSlotFinalised';

/*
  "Finalisasi" at the top of a subject's "Nilai" tab (owner, 2026-10-18; backend
  eadf680, ticket 04), for its answering teacher: shown only while the semester is
  being finalised or once the slot is (finalisingShown). Before finalising, what
  still blocks it, each line with a way to where it is cleared ("Buka Pertemuan",
  "Buka Hasil"); "Finalkan" once nothing does. After, who finalised it and when, and
  "Batalkan finalisasi" until the semester closes. Both ask first. Everything comes
  from the grade read (`finalised`, `blockers`); a change reads it again (`onChanged`).

  @param classSubjectId     the slot
  @param subjectName        its name, for the dialogs and the toast
  @param grades             the gradebook's grade read
  @param canEdit            the teacher's desk in an open year
  @param zone               the school's zone, for the times
  @param onChanged          () => void - read the grades again
  @param onOpenSessions     () => void
  @param onOpenAssessment   (assessmentId) => void
  @param onToast            (message, type) => void
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const button =
  'inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';
const link = 'inline-flex items-center gap-0.5 text-xs font-extrabold text-brand hover:underline cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand';

export const FinalisingCard = ({ classSubjectId, subjectName, grades, canEdit = false, zone, onChanged, onOpenSessions, onOpenAssessment, onToast }) => {
  const { t, lang } = useT();
  /* 'finalise' | 'unfinalise' while its dialog is open */
  const [asking, setAsking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  if (!finalisingShown(grades)) return null;

  const status = semesterStatusOf(grades);
  const blockers = (grades.blockers ?? []).map(blockerView);
  const finalised = grades.finalised;

  const run = async () => {
    const act = asking;
    setBusy(true);
    setMessage(null);
    try {
      await (act === 'finalise' ? gradingService.finalise(classSubjectId) : gradingService.unfinalise(classSubjectId));
      forgetSlotFinalised(classSubjectId);
      setAsking(null);
      onToast?.(t(act === 'finalise' ? 'grading.fin.done.finalise' : 'grading.fin.done.unfinalise', { subject: subjectName }), 'success');
      onChanged?.();
    } catch (err) {
      setAsking(null);
      setMessage(finalisingErrorMessage(err, t));
      if (isStaleFinalising(err)) {
        forgetSlotFinalised(classSubjectId);
        onChanged?.();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${card} space-y-4`} aria-labelledby={`fin-${classSubjectId}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`fin-${classSubjectId}`} className="text-base font-extrabold text-slate-900">
          {t('grading.fin.title')}
        </h2>
        {status !== 'OPEN' && <p className="text-xs font-semibold text-slate-500">{t(`grading.fin.status.${status}`)}</p>}
      </div>

      {finalised ? (
        <div className="space-y-1">
          <p className="flex items-start gap-2 text-sm font-bold text-slate-800">
            <Lock className="w-4 h-4 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
            {t('grading.fin.doneBy', { when: shortWhen(finalised.at, zone, lang), name: finalised.by?.fullName ?? t('tasm.results.unnamed') })}
          </p>
          <p className="text-xs font-medium text-slate-500 leading-relaxed">{t('grading.fin.doneLocked')}</p>
        </div>
      ) : blockers.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">{t('grading.fin.blockedHead', { n: blockers.length })}</p>
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {blockers.map((view, i) => (
              <li key={`${view.kind}-${view.link?.assessmentId ?? i}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3.5 py-2.5">
                <span className="text-sm text-slate-700 break-words min-w-0">{blockerText(view, t, zone, lang)}</span>
                {view.link?.to === 'sessions' && onOpenSessions && (
                  <button type="button" onClick={onOpenSessions} className={link}>
                    {t('grading.fin.openSessions')}
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
                {view.link?.to === 'assessment' && onOpenAssessment && (
                  <button type="button" onClick={() => onOpenAssessment(view.link.assessmentId)} className={link}>
                    {t('grading.fin.openResults')}
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm font-medium text-slate-600 leading-relaxed">{t('grading.fin.ready')}</p>
      )}

      {message && (
        <p className="text-xs font-semibold text-rose-700 leading-relaxed" role="alert">
          {message}
        </p>
      )}

      {canEdit && (finalised ? canUnfinalise(grades) : status === 'FINALIZING') && (
        <div className="flex justify-end">
          {finalised ? (
            <button type="button" onClick={() => setAsking('unfinalise')} disabled={busy} className={`${button} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
              {t('grading.fin.unfinalise')}
            </button>
          ) : (
            <button type="button" onClick={() => setAsking('finalise')} disabled={busy || !canFinalise(grades)} className={`${button} bg-brand text-white hover:bg-brand-deep`}>
              {t('grading.fin.finalise')}
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={asking !== null}
        tone={asking === 'unfinalise' ? 'danger' : 'brand'}
        title={t(`grading.fin.confirm.${asking ?? 'finalise'}.title`, { subject: subjectName })}
        body={t(`grading.fin.confirm.${asking ?? 'finalise'}.body`)}
        confirmLabel={t(asking === 'unfinalise' ? 'grading.fin.unfinalise' : 'grading.fin.finalise')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        onConfirm={run}
        onCancel={() => !busy && setAsking(null)}
      />
    </section>
  );
};

export default FinalisingCard;
