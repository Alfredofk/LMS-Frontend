import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { AlertCircle, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Select from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import { useSchoolToday, useSchoolZone } from '../../hooks/useSchoolToday';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage, closeErrorMessage, finalisingErrorMessage, isStaleClose, isStaleFinalising, isStaleReopen, reopenErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { gradingService } from '../../services/gradingService';
import { formatDay } from '../Classes/format';
import { defaultSemesterOf } from '../Subjects/subjects';
import { shortWhen } from '../TeacherAssessment/teacherAssessment';
import CloseSemesterDialog from './CloseSemesterDialog';
import ReopenSemesterDialog from './ReopenSemesterDialog';
import {
  blockerText,
  blockerView,
  boardByClass,
  canStopFinalising,
  closeBlocksOf,
  closeRefusalParts,
  defaultReportDate,
  reopenBody,
  reportDateRange,
  slotStateOf,
} from './finalising';

/*
  "Finalisasi Nilai" (/headmaster/finalising; owner, 2026-10-18; backend eadf680,
  ticket 04), for the Principal and the Vice Principals. One semester at a time,
  opening on the one running today: its status, "Mulai finalisasi" / "Hentikan
  finalisasi" for the Principal alone (each asks first; stopping waits while any
  subject is finalised), and the readiness board (GET .../readiness) as a card per
  class: each subject with its teacher and state - Difinalkan (by whom, when), N
  penghalang (opened in place, the same words as the teacher's card, no links: the
  leaders do not manage a teacher's assessments), Tanpa guru, Siap difinalkan - and
  the class's homeroom notes still missing, and in Semester 2 its students with no
  promotion outcome (backend 4dae152). The board is read live on the server,
  one slot at a time, so it is read once per semester and on "Muat ulang".

  "Tutup semester" (owner, 2026-10-20; backend 3a22f90, ticket 05), the Principal's
  alone, while FINALIZING: disabled with what still stops it (closeBlocksOf: the
  last day not come, subjects not finalised or blocked, notes missing), then
  CloseSemesterDialog dates the report cards and closes it. A 409 is said in one
  sentence in the dialog and the board is read again for the detail; done, a toast
  says how many report cards were written, and the version after a reopen. The date
  chosen is said under the status for this visit only: the board does not carry it.
  Once CLOSED, each class card has "Lihat rapor": the class on /headmaster/classes,
  scrolled to its report cards for this semester (ClassReportCards `focus`).

  "Buka kembali" (owner, 2026-10-20; backend 46c6173, ticket 06), the Principal's
  alone, on a CLOSED semester of an open year: grey, its dialog red
  (ReopenSemesterDialog: a reason, the subjects to unfinalise ticked per class).
  Done, a toast and the board read again; for this visit the board says to close it
  again, and "Hentikan finalisasi" stays off - the server refuses a reopened
  semester going back to OPEN, and the board cannot tell one apart otherwise.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const button =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';

const STATE_TONE = {
  FINALISED: 'text-emerald-700',
  BLOCKED: 'text-amber-700',
  NO_TEACHER: 'text-rose-700',
  READY: 'text-brand',
};

/** Every semester of the school's years, the active years first, newest first: `[{ semester, year }]`. */
const semestersOf = (years) =>
  [...(years ?? [])]
    .sort((a, b) => (a.status === b.status ? String(b.label).localeCompare(String(a.label)) : a.status === 'ACTIVE' ? -1 : 1))
    .flatMap((year) => [...(year.semesters ?? [])].sort((a, b) => b.ordinal - a.ordinal).map((semester) => ({ semester, year })));

const SlotRow = ({ slot, zone }) => {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const state = slotStateOf(slot);
  const blockers = (slot.blockers ?? []).map(blockerView);
  const word = t(`grading.fin.state.${state}`, { n: blockers.length });
  return (
    <li className="py-2.5 first:pt-0 last:pb-0 space-y-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <span className="min-w-0">
          <span className="text-sm font-bold text-slate-900">{slot.subject.code}</span>{' '}
          <span className="text-sm text-slate-700 break-words">{slot.subject.name}</span>
          <span className="block text-[11px] font-semibold text-slate-500 break-words">{slot.teacher?.fullName ?? t('grading.fin.blocker.noTeacher')}</span>
        </span>
        {state === 'BLOCKED' ? (
          <button
            type="button"
            onClick={() => setOpen((now) => !now)}
            aria-expanded={open}
            className={`inline-flex items-center gap-0.5 text-xs font-extrabold cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${STATE_TONE[state]}`}
          >
            {word}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        ) : (
          <span className={`text-xs font-extrabold ${STATE_TONE[state]}`}>
            {word}
            {state === 'FINALISED' && (
              <span className="block text-[11px] font-semibold text-slate-500 text-right">
                {t('grading.fin.finalisedBy', { name: slot.finalised.by?.fullName ?? t('tasm.results.unnamed'), when: shortWhen(slot.finalised.at, zone, lang) })}
              </span>
            )}
          </span>
        )}
      </div>
      {open && (
        <ul className="space-y-1 rounded-xl border border-slate-200 px-3.5 py-2.5">
          {blockers.map((view, i) => (
            <li key={`${view.kind}-${view.link?.assessmentId ?? i}`} className="text-xs text-slate-700 break-words">
              {blockerText(view, t, zone, lang)}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

export const FinalisingPage = () => {
  const { t, lang } = useT();
  const { showToast } = useOutletContext() ?? {};
  const navigate = useNavigate();
  const { activeRole } = useAuth();
  const zone = useSchoolZone();
  const today = useSchoolToday();
  const isPrincipal = activeRole === ROLES.PRINCIPAL;

  /* undefined reading · years · { error } */
  const [years, setYears] = useState(undefined);
  const [semesterId, setSemesterId] = useState(null);
  /* undefined reading · the board · { error } */
  const [board, setBoard] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  /* 'start' | 'stop' while its dialog is open */
  const [asking, setAsking] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [closing, setClosing] = useState(false);
  /* the last close of this visit: { semesterId, reportDate, version, reportCards } */
  const [closed, setClosed] = useState(null);
  /* the board's classes when "Buka kembali" was pressed, so a reload behind the dialog does not empty its list; null while closed */
  const [reopening, setReopening] = useState(null);
  /* the semester reopened in this visit */
  const [reopenedId, setReopenedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);
    academicsService
      .academicYears()
      .then((list) => {
        if (cancelled) return;
        setYears(list);
        const active = list.find((year) => year.status === 'ACTIVE');
        setSemesterId(defaultSemesterOf(active, today) ?? semestersOf(list)[0]?.semester.id ?? null);
      })
      .catch((err) => !cancelled && setYears({ error: apiErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!semesterId) return undefined;
    let cancelled = false;
    gradingService
      .readiness(semesterId)
      .then((answer) => !cancelled && setBoard(answer))
      .catch((err) => !cancelled && setBoard({ error: finalisingErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [semesterId, attempt, t]);

  const options = useMemo(() => (Array.isArray(years) ? semestersOf(years) : []), [years]);
  const picked = options.find((entry) => entry.semester.id === semesterId) ?? null;
  const ready = board && !board.error;
  const status = ready ? board.semester.status : picked?.semester.status;
  const yearActive = picked?.year.status === 'ACTIVE';
  const classes = ready ? boardByClass(board) : [];
  const range = reportDateRange(picked?.semester);
  const closeBlocks = ready && status === 'FINALIZING' ? closeBlocksOf(board, picked?.semester, today) : [];
  const canClose = isPrincipal && yearActive && ready && status === 'FINALIZING' && Boolean(range) && closeBlocks.length === 0;
  const lastClose = closed?.semesterId === semesterId ? closed : null;
  const justReopened = reopenedId === semesterId;
  const day = (value) => formatDay(value, lang);

  const pick = (id) => {
    setBoard(undefined);
    setMessage(null);
    setSemesterId(id);
  };
  const reload = () => {
    setBoard(undefined);
    setAttempt((n) => n + 1);
  };

  const run = async () => {
    const act = asking;
    setBusy(true);
    setMessage(null);
    try {
      await (act === 'start' ? gradingService.startFinalising(semesterId) : gradingService.stopFinalising(semesterId));
      setAsking(null);
      showToast?.(t(act === 'start' ? 'grading.fin.done.start' : 'grading.fin.done.stop', { n: picked?.semester.ordinal ?? '' }), 'success');
      reload();
    } catch (err) {
      setAsking(null);
      setMessage(finalisingErrorMessage(err, t));
      if (isStaleFinalising(err)) reload();
    } finally {
      setBusy(false);
    }
  };

  const named = { n: picked?.semester.ordinal ?? '', year: picked?.year.label ?? '' };

  const submitClose = async (reportDate) => {
    try {
      const answer = await gradingService.closeSemester(semesterId, reportDate);
      const version = answer?.version ?? 1;
      setClosing(false);
      setMessage(null);
      setClosed({ semesterId, reportDate: answer?.reportDate ?? reportDate, version, reportCards: answer?.reportCards ?? 0 });
      showToast?.(t(version > 1 ? 'grading.fin.close.doneVersion' : 'grading.fin.close.done', { n: named.n, count: answer?.reportCards ?? 0, version }), 'success');
      reload();
    } catch (err) {
      if (isStaleClose(err)) reload();
      throw err;
    }
  };
  const submitReopen = async (reason, ticked) => {
    try {
      const answer = await gradingService.reopenSemester(semesterId, reopenBody(reason, ticked, board));
      const count = answer?.unfinalised?.length ?? 0;
      setReopening(null);
      setMessage(null);
      setReopenedId(semesterId);
      showToast?.(t(count > 0 ? 'grading.fin.reopen.doneSlots' : 'grading.fin.reopen.done', { n: named.n, count }), 'success');
      reload();
    } catch (err) {
      if (isStaleReopen(err)) reload();
      throw err;
    }
  };
  const closeBlockText = closeBlocks.map((block) => t(block.key, { ...block.vars, date: day(block.vars.date) })).join(', ');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{t('grading.fin.page.title')}</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">{t('grading.fin.page.subtitle')}</p>
      </div>

      {years === undefined ? (
        <div className="h-24 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />
      ) : years.error ? (
        <p className={`${card} text-sm font-semibold text-amber-700`} role="alert">
          {years.error}
        </p>
      ) : options.length === 0 ? (
        <p className={`${card} text-sm font-semibold text-slate-600`}>{t('grading.fin.noSemester')}</p>
      ) : (
        <>
          <section className={`${card} space-y-4`} aria-labelledby="fin-semester">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h2 id="fin-semester" className="text-base font-extrabold text-slate-900">
                  {t('grading.fin.semesterOption', named)}
                </h2>
                {status && <p className="text-xs font-semibold text-slate-500">{t(`grading.fin.semesterStatus.${status}`)}</p>}
                {status === 'CLOSED' && lastClose && (
                  <p className="text-xs font-semibold text-slate-500">
                    {t(lastClose.version > 1 ? 'grading.fin.close.datedVersion' : 'grading.fin.close.dated', { date: day(lastClose.reportDate), version: lastClose.version })}
                  </p>
                )}
              </div>
              <Select size="sm" value={semesterId ?? ''} onChange={(e) => pick(e.target.value)} aria-label={t('grading.fin.semester')} className="w-full sm:w-60">
                {options.map(({ semester, year }) => (
                  <option key={semester.id} value={semester.id}>
                    {t('grading.fin.semesterOption', { n: semester.ordinal, year: year.label })}
                  </option>
                ))}
              </Select>
            </div>

            {ready && (
              <p className="flex flex-wrap gap-x-4 text-xs font-semibold text-slate-500">
                <span>{t('grading.fin.count.slots', { finalised: board.counts.finalised, slots: board.counts.slots })}</span>
                <span className={board.counts.notesMissing > 0 ? 'text-amber-700' : ''}>{t('grading.fin.count.notes', { n: board.counts.notesMissing })}</span>
                {typeof board.counts.promotionsMissing === 'number' && (
                  <span className={board.counts.promotionsMissing > 0 ? 'text-amber-700' : ''}>{t('grading.fin.count.promotions', { n: board.counts.promotionsMissing })}</span>
                )}
              </p>
            )}

            {message && (
              <p className="text-xs font-semibold text-rose-700 leading-relaxed" role="alert">
                {message}
              </p>
            )}

            {yearActive && status === 'CLOSED' && ready && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                {isPrincipal ? <span /> : <p className="text-xs font-semibold text-slate-500">{t('grading.fin.reopen.viceNote')}</p>}
                {isPrincipal && (
                  <button type="button" onClick={() => setReopening(classes)} disabled={busy || reopening !== null} className={`${button} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                    {t('grading.fin.reopen.open')}
                  </button>
                )}
              </div>
            )}

            {yearActive && status !== 'CLOSED' && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                {!isPrincipal ? (
                  <p className="text-xs font-semibold text-slate-500">{t('grading.fin.viceNote')}</p>
                ) : status === 'FINALIZING' && ready ? (
                  <div className="space-y-1 min-w-0">
                    {justReopened && <p className="text-xs font-semibold leading-relaxed text-amber-700">{t('grading.fin.reopen.afterHint')}</p>}
                    <p className={`text-xs font-semibold leading-relaxed ${closeBlocks.length ? 'text-slate-500' : 'text-emerald-700'}`}>
                      {closeBlocks.length ? t('grading.fin.close.blockedHint', { list: closeBlockText }) : t('grading.fin.close.readyHint')}
                    </p>
                    {!canStopFinalising(board) && closeBlocks.length > 0 && <p className="text-xs font-semibold text-slate-500">{t('grading.fin.stopBlockedHint')}</p>}
                  </div>
                ) : (
                  <span />
                )}
                {isPrincipal && status === 'OPEN' && (
                  <button type="button" onClick={() => setAsking('start')} disabled={busy || !ready} className={`${button} bg-brand text-white hover:bg-brand-deep`}>
                    {t('grading.fin.start')}
                  </button>
                )}
                {isPrincipal && status === 'FINALIZING' && (
                  <button
                    type="button"
                    onClick={() => setAsking('stop')}
                    disabled={busy || !ready || !canStopFinalising(board) || justReopened}
                    className={`${button} bg-slate-100 text-slate-700 hover:bg-slate-200`}
                  >
                    {t('grading.fin.stop')}
                  </button>
                )}
                {isPrincipal && status === 'FINALIZING' && (
                  <button type="button" onClick={() => setClosing(true)} disabled={busy || closing || !canClose} className={`${button} bg-brand text-white hover:bg-brand-deep`}>
                    {t('grading.fin.close.open')}
                  </button>
                )}
              </div>
            )}
          </section>

          {board === undefined ? (
            <div className="h-48 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />
          ) : board.error ? (
            <div className={`${card} flex flex-col items-center text-center gap-3 py-8`} role="alert">
              <AlertCircle className="w-7 h-7 text-rose-500" aria-hidden="true" />
              <p className="text-sm font-bold text-slate-700 max-w-sm">{board.error}</p>
              <button type="button" onClick={reload} className={`${button} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                {t('att.error.retry')}
              </button>
            </div>
          ) : classes.length === 0 ? (
            <p className={`${card} text-sm font-semibold text-slate-600`}>{t('grading.fin.noClasses')}</p>
          ) : (
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {classes.map((entry) => (
                <li key={entry.class.id} className={`${card} space-y-3`}>
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="space-y-0.5 min-w-0">
                      <h3 className="text-sm font-extrabold text-slate-900 break-words">{entry.class.name}</h3>
                      <p className="text-[11px] font-semibold text-slate-500">
                        {t('subjects.board.homeroom', { name: entry.homeroomTeacher?.fullName ?? t('classes.detail.noHomeroom') })}
                      </p>
                    </div>
                    {status === 'CLOSED' && (
                      <button
                        type="button"
                        onClick={() => navigate('/headmaster/classes', { state: { classId: entry.class.id, semesterId, focus: 'reportCards' } })}
                        className="inline-flex items-center gap-0.5 text-xs font-extrabold text-brand hover:underline cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        {t('grading.fin.viewReportCards')}
                        <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  {entry.slots.length > 0 && (
                    <ul className="divide-y divide-slate-100">
                      {entry.slots.map((slot) => (
                        <SlotRow key={slot.classSubjectId} slot={slot} zone={zone} />
                      ))}
                    </ul>
                  )}
                  {entry.notes && (
                    <p
                      className={`border-t border-slate-100 pt-2.5 text-xs font-semibold leading-relaxed break-words ${
                        entry.notes.missing.length ? 'text-amber-700' : 'text-slate-500'
                      }`}
                    >
                      {entry.notes.students === 0
                        ? t('grading.fin.notesNoStudents')
                        : entry.notes.missing.length
                          ? t('grading.fin.notesMissing', {
                              n: entry.notes.missing.length,
                              names: entry.notes.missing.map((student) => student.fullName ?? t('tasm.results.unnamed')).join(', '),
                            })
                          : t('grading.fin.notesDone')}
                    </p>
                  )}
                  {entry.notes && entry.notes.students > 0 && Array.isArray(entry.notes.promotionsMissing) && (
                    <p className={`text-xs font-semibold leading-relaxed break-words ${entry.notes.promotionsMissing.length ? 'text-amber-700' : 'text-slate-500'}`}>
                      {entry.notes.promotionsMissing.length
                        ? t('grading.fin.promotionsMissing', {
                            n: entry.notes.promotionsMissing.length,
                            names: entry.notes.promotionsMissing.map((student) => student.fullName ?? t('tasm.results.unnamed')).join(', '),
                          })
                        : t('grading.fin.promotionsDone')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <ConfirmDialog
        open={asking !== null}
        tone={asking === 'stop' ? 'danger' : 'brand'}
        title={t(`grading.fin.confirm.${asking ?? 'start'}.title`, named)}
        body={t(`grading.fin.confirm.${asking ?? 'start'}.body`)}
        confirmLabel={t(asking === 'stop' ? 'grading.fin.stop' : 'grading.fin.start')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        onConfirm={run}
        onCancel={() => !busy && setAsking(null)}
      />

      {reopening && (
        <ReopenSemesterDialog
          title={t('grading.fin.reopen.title', named)}
          classes={reopening}
          onClose={() => setReopening(null)}
          onSubmit={submitReopen}
          describeError={(err) => reopenErrorMessage(err, t)}
        />
      )}

      {closing && (
        <CloseSemesterDialog
          title={t('grading.fin.close.title', named)}
          range={range}
          initialDate={defaultReportDate(range, today)}
          onClose={() => setClosing(false)}
          onSubmit={submitClose}
          describeError={(err) => closeErrorMessage(err, t, closeRefusalParts(err?.details), day)}
        />
      )}
    </div>
  );
};

export default FinalisingPage;
