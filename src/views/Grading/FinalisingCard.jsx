import React, { useState } from 'react';
import { ArrowLeftRight, Calendar, Check, ChevronRight, CircleAlert, CircleCheck, ClipboardList, Info, Lock, LockOpen, Users } from 'lucide-react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useT } from '../../i18n/LanguageContext';
import { finalisingErrorMessage, isStaleFinalising } from '../../i18n/apiError';
import { gradingService } from '../../services/gradingService';
import { shortWhen } from '../TeacherAssessment/teacherAssessment';
import { blockerLines, blockerView, canFinalise, canUnfinalise, finalisingShown, semesterStatusOf } from './finalising';
import { forgetSlotFinalised } from './useSlotFinalised';

/*
  "Finalisasi" at the top of a subject's "Nilai" tab (owner, 2026-10-18; backend
  eadf680, ticket 04), for its answering teacher: shown only while the semester is
  being finalised or once the slot is (finalisingShown). Before finalising, what
  still blocks it, each line with a way to where it is cleared ("Buka Pertemuan",
  "Buka Hasil", "Buka Penilaian"); "Finalkan" once nothing does. After, who
  finalised it and when, and "Batalkan finalisasi" until the semester closes. Both
  ask first. Everything comes from the grade read (`finalised`, `blockers`); a
  change reads it again (`onChanged`).

  The look is the mockup finalisasi-guru.html (owner, 2026-10-30, all nine items):
  the subject's state at the right of the title over the semester's slash line, an
  amber count over the blockers, each blocker a two-line row that opens where it is
  cleared, the button under a rule with why it is off, and the dialogs' lock icons.

  @param classSubjectId     the slot
  @param subjectName        its name, for the dialogs and the toast
  @param semester           `{ ordinal, academicYear }`, for the line under the title
  @param grades             the gradebook's grade read
  @param canEdit            the teacher's desk in an open year
  @param zone               the school's zone, for the times
  @param onChanged          () => void - read the grades again
  @param onOpenSessions     () => void
  @param onOpenAssessment   (assessmentId) => void
  @param onOpenAssessments  () => void - the assessments tab, for a student with no grade
  @param onToast            (message, type) => void
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4';
const eyebrow = 'block text-[10px] font-bold tracking-wider uppercase';
const noteLine = 'flex items-start gap-2 text-[13px] font-medium text-slate-600 leading-relaxed';
const lineIcon = 'w-4 h-4 shrink-0 mt-0.5';

const SEMESTER_TONE = { FINALIZING: 'text-amber-700', CLOSED: 'text-slate-600' };
const STATE = {
  blocked: { tone: 'text-amber-700', Icon: CircleAlert },
  ready: { tone: 'text-brand', Icon: CircleCheck },
  finalised: { tone: 'text-emerald-700', Icon: CircleCheck },
};
const BLOCKER_ICON = { SESSIONS_NEED_COMPLETION: Calendar, ASSESSMENT: ClipboardList, NO_GRADE: Users, POOLED: ArrowLeftRight };
const LINK_LABEL = { sessions: 'grading.fin.openSessions', assessments: 'grading.fin.openAssessments', assessment: 'grading.fin.openResults' };

export const FinalisingCard = ({ classSubjectId, subjectName, semester, grades, canEdit = false, zone, onChanged, onOpenSessions, onOpenAssessment, onOpenAssessments, onToast }) => {
  const { t, lang } = useT();
  /* 'finalise' | 'unfinalise' while its dialog is open */
  const [asking, setAsking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  if (!finalisingShown(grades)) return null;

  const status = semesterStatusOf(grades);
  const blockers = (grades.blockers ?? []).map(blockerView);
  const finalised = grades.finalised;
  const state = finalised ? 'finalised' : blockers.length > 0 ? 'blocked' : 'ready';
  const { tone, Icon: StateIcon } = STATE[state];
  const semesterTone = SEMESTER_TONE[status];

  /* Where a blocker's row leads, or null (another class's, or one this page cannot open). */
  const openerOf = (view) => {
    if (view.link?.to === 'sessions') return onOpenSessions ?? null;
    if (view.link?.to === 'assessments') return onOpenAssessments ?? null;
    if (view.link?.to === 'assessment' && onOpenAssessment) return () => onOpenAssessment(view.link.assessmentId);
    return null;
  };

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
    <section className={card} aria-labelledby={`fin-${classSubjectId}`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 id={`fin-${classSubjectId}`} className="text-base font-extrabold text-slate-900 tracking-tight">
            {t('grading.fin.title')}
          </h2>
          {/* The slash line (item 1): the semester, then its state in colour. */}
          {(semester || semesterTone) && (
            <p className="mt-0.5 text-[13px] font-medium text-slate-500">
              {semester && <span className="whitespace-nowrap">{t('grading.fin.semesterOption', { n: semester.ordinal, year: semester.academicYear })}</span>}
              {semester && semesterTone && (
                <>
                  {' '}
                  <span className="mx-1 text-slate-300" aria-hidden="true">
                    /
                  </span>{' '}
                </>
              )}
              {semesterTone && <span className={`whitespace-nowrap font-bold ${semesterTone}`}>{t(`grading.fin.status.${status}`)}</span>}
            </p>
          )}
        </div>
        <p className={`inline-flex items-center gap-1.5 pt-0.5 text-[13px] font-extrabold whitespace-nowrap ${tone}`}>
          <StateIcon className="w-3.5 h-3.5" aria-hidden="true" />
          {t(`grading.fin.state.${state}`)}
        </p>
      </div>

      {finalised ? (
        <>
          <div className="flex flex-wrap gap-x-7 gap-y-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5">
            <div className="min-w-0">
              <span className={`${eyebrow} text-slate-500`}>{t('grading.fin.doneByLabel')}</span>
              <span className="text-sm font-bold text-slate-800 break-words">{finalised.by?.fullName ?? t('tasm.results.unnamed')}</span>
            </div>
            <div>
              <span className={`${eyebrow} text-slate-500`}>{t('grading.fin.doneAtLabel')}</span>
              <span className="text-sm font-bold text-slate-800">{shortWhen(finalised.at, zone, lang)}</span>
            </div>
          </div>
          <p className={noteLine}>
            <Lock className={lineIcon} aria-hidden="true" />
            {t('grading.fin.doneLocked')}
          </p>
          {status === 'CLOSED' && (
            <p className={noteLine}>
              <Info className={lineIcon} aria-hidden="true" />
              {t('grading.fin.closedNote')}
            </p>
          )}
        </>
      ) : blockers.length > 0 ? (
        <>
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3.5">
            <span className={`${eyebrow} text-amber-700`}>{t('grading.fin.leftHead')}</span>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <b className="text-[26px] font-extrabold tracking-tight leading-none tabular-nums text-amber-700">{t('grading.fin.leftCount', { n: blockers.length })}</b>
              <span className="text-[13px] font-semibold text-amber-800">{t('grading.fin.leftFor', { subject: subjectName })}</span>
            </p>
          </div>
          <ul className="divide-y divide-slate-100">
            {blockers.map((view, i) => {
              const { title, detail } = blockerLines(view, t, zone, lang);
              const open = openerOf(view);
              const KindIcon = BLOCKER_ICON[view.kind] ?? CircleAlert;
              const inner = (
                <>
                  <span className="grid place-items-center w-8 h-8 shrink-0 rounded-[10px] bg-slate-100 text-slate-600">
                    <KindIcon className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-900 break-words">{title}</span>
                    {detail.length > 0 && (
                      <span className="block mt-px text-[13px] font-medium text-slate-500 break-words">
                        {detail.map((part, j) => (
                          <React.Fragment key={j}>
                            {j > 0 && ', '}
                            {part.count !== null && <span className="font-bold text-amber-700 tabular-nums">{part.count}</span>}
                            {part.text}
                          </React.Fragment>
                        ))}
                      </span>
                    )}
                  </span>
                  {open ? (
                    <span className="inline-flex items-center gap-0.5 shrink-0 text-[13px] font-extrabold text-brand">
                      {t(LINK_LABEL[view.link.to])}
                      <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                    </span>
                  ) : (
                    view.kind === 'POOLED' && <span className="shrink-0 text-xs font-semibold text-slate-500">{t('grading.fin.line.otherClass')}</span>
                  )}
                </>
              );
              return (
                <li key={`${view.kind}-${view.link?.assessmentId ?? i}`}>
                  {open ? (
                    <button
                      type="button"
                      onClick={open}
                      className="group w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-left transition-colors hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      {inner}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 px-2 py-2.5">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3.5">
            <span className="grid place-items-center w-[26px] h-[26px] shrink-0 rounded-full bg-emerald-600 text-white">
              <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-extrabold text-slate-900">{t('grading.fin.readyTitle')}</span>
              <span className="block text-[13px] font-medium text-slate-600">{t('grading.fin.readyDetail')}</span>
            </span>
          </div>
          <p className={noteLine}>
            <Lock className={lineIcon} aria-hidden="true" />
            {t('grading.fin.ready')}
          </p>
        </>
      )}

      {message && (
        <p className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-[13px] font-semibold leading-relaxed text-rose-700" role="alert">
          <CircleAlert className={lineIcon} aria-hidden="true" />
          {message}
        </p>
      )}

      {canEdit && (finalised ? canUnfinalise(grades) : status === 'FINALIZING') && (
        <div className={`flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 ${state === 'blocked' ? 'justify-between' : 'justify-end'}`}>
          {state === 'blocked' && <p className="text-[13px] font-medium text-slate-500">{t('grading.fin.blockedHint')}</p>}
          {finalised ? (
            <Button size="sm" variant="outline" onClick={() => setAsking('unfinalise')} isDisabled={busy}>
              <LockOpen className="w-4 h-4 mr-2" aria-hidden="true" />
              {t('grading.fin.unfinalise')}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setAsking('finalise')} isDisabled={busy || !canFinalise(grades)}>
              <Lock className="w-4 h-4 mr-2" aria-hidden="true" />
              {t('grading.fin.finalise')}
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={asking !== null}
        tone={asking === 'unfinalise' ? 'warning' : 'brand'}
        icon={asking === 'unfinalise' ? LockOpen : Lock}
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
