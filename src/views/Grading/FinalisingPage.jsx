import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { AlertCircle, BookOpen, Check, ChevronRight, Clock, Lock, RotateCcw } from 'lucide-react';

import Button from '../../components/ui/Button';
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
import { Bone, HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { defaultSemesterOf } from '../Subjects/subjects';
import { shortWhen } from '../TeacherAssessment/teacherAssessment';
import CloseSemesterDialog from './CloseSemesterDialog';
import ReopenSemesterDialog from './ReopenSemesterDialog';
import {
  blockerText,
  blockerView,
  boardByClass,
  canStopFinalising,
  classStandingOf,
  closeBlocksOf,
  closeChecksOf,
  closeRefusalParts,
  defaultReportDate,
  reopenBody,
  reportDateRange,
  slotCountsOf,
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

  The look since 2026-10-29 (mockup C:\Thesis\mockups\finalisasi-nilai.html, all
  twelve items): a slash line under the title with the state coloured; on the
  semester card the subjects finalised over a four-part bar (slotCountsOf) and
  "Syarat menutup semester" as a checklist (closeChecksOf, the conditions
  closeBlocksOf refuses on); the classes under text tabs (classStandingOf), a
  blocked subject's whole row opening its list in place; the notes and promotions
  as lines with an icon; the dashboards' loading, failed and empty states.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm min-w-0';
const note = 'flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] font-semibold leading-relaxed';
const NOTE = {
  warn: `${note} bg-amber-50 border-amber-100 text-amber-800`,
  fail: `${note} bg-rose-50 border-rose-100 text-rose-700`,
  quiet: `${note} bg-slate-50 border-slate-100 text-slate-700`,
  done: `${note} bg-emerald-50 border-emerald-100 text-emerald-700`,
};
const noteIcon = 'w-4 h-4 shrink-0 mt-0.5';

const STATE_TONE = {
  FINALISED: 'text-emerald-700',
  BLOCKED: 'text-amber-700',
  NO_TEACHER: 'text-rose-700',
  READY: 'text-brand',
};
/* The summary bar's parts, in its order (owner 2026-10-29: purple, pale purple, amber, rose). */
const BAR = [
  ['FINALISED', 'bg-brand'],
  ['READY', 'bg-brand/35'],
  ['BLOCKED', 'bg-amber-500'],
  ['NO_TEACHER', 'bg-rose-500'],
];
const STATUS_TONE = { OPEN: 'text-slate-600', FINALIZING: 'text-amber-700', CLOSED: 'text-emerald-700' };
const TABS = ['ALL', 'ATTENTION', 'READY', 'DONE'];

/** Every semester of the school's years, the active years first, newest first: `[{ semester, year }]`. */
const semestersOf = (years) =>
  [...(years ?? [])]
    .sort((a, b) => (a.status === b.status ? String(b.label).localeCompare(String(a.label)) : a.status === 'ACTIVE' ? -1 : 1))
    .flatMap((year) => [...(year.semesters ?? [])].sort((a, b) => b.ordinal - a.ordinal).map((semester) => ({ semester, year })));

/* As FactLine draws it: spaces either side, so a long line breaks at a slash. */
const Slash = () => (
  <>
    {' '}
    <span className="mx-1 text-slate-300" aria-hidden="true">
      /
    </span>{' '}
  </>
);

const SlotRow = ({ slot, zone }) => {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const state = slotStateOf(slot);
  const blockers = (slot.blockers ?? []).map(blockerView);
  const word = t(`grading.fin.state.${state}`, { n: blockers.length });
  const teacherName = slot.teacher?.fullName ?? t('grading.fin.blocker.noTeacher');
  /* Who finalised it, said only when that is not the teacher on the row (the read names a user, the row a membership: told apart by name). */
  const by = slot.finalised?.by?.fullName;
  const finalisedLine = slot.finalised
    ? by && by !== slot.teacher?.fullName
      ? t('grading.fin.finalisedByOther', { name: by, when: shortWhen(slot.finalised.at, zone, lang) })
      : t('grading.fin.finalisedAt', { when: shortWhen(slot.finalised.at, zone, lang) })
    : null;
  const name = (
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-bold text-slate-900 break-words">{`${slot.subject.code} - ${slot.subject.name}`}</span>
      <span className="block text-xs font-medium text-slate-500 break-words">
        {teacherName}
        {finalisedLine && (
          <>
            <Slash />
            {finalisedLine}
          </>
        )}
      </span>
    </span>
  );
  return (
    <li className="border-b border-slate-100 last:border-0">
      {state === 'BLOCKED' ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((now) => !now)}
            aria-expanded={open}
            className={`w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-left cursor-pointer transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${open ? 'bg-slate-50' : ''}`}
          >
            {name}
            <span className={`shrink-0 text-xs font-extrabold ${STATE_TONE[state]}`}>{word}</span>
            <ChevronRight className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
          </button>
          {open && (
            <div className="animate-rise mx-2 mb-2.5 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5">
              <p className="text-[10px] font-bold tracking-wider uppercase text-amber-800">{t('grading.fin.blockersTitle')}</p>
              <ul className="mt-1 list-disc pl-4 space-y-0.5">
                {blockers.map((view, i) => (
                  <li key={`${view.kind}-${view.link?.assessmentId ?? i}`} className="text-[13px] text-slate-800 break-words">
                    {blockerText(view, t, zone, lang)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-3 px-2 py-2.5">
          {name}
          <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-extrabold ${STATE_TONE[state]}`}>
            {state === 'FINALISED' && <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />}
            {word}
          </span>
        </div>
      )}
    </li>
  );
};

/* A class's notes or promotions: amber with the names while any is missing, a green tick once complete. */
const CompletionLine = ({ missing, missingKey, doneKey, t }) => (
  <p className={`flex items-start gap-2 text-[12.5px] font-semibold leading-relaxed break-words ${missing.length ? 'text-amber-700' : 'text-emerald-700'}`}>
    {missing.length ? <AlertCircle className="w-[15px] h-[15px] shrink-0 mt-0.5" aria-hidden="true" /> : <Check className="w-[15px] h-[15px] shrink-0 mt-0.5" strokeWidth={3} aria-hidden="true" />}
    {missing.length
      ? t(missingKey, { n: missing.length, names: missing.map((student) => student.fullName ?? t('tasm.results.unnamed')).join(', ') })
      : t(doneKey)}
  </p>
);

const BoardLoading = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" aria-hidden="true">
    {[0, 1].map((i) => (
      <div key={i} className={`${card} space-y-3`}>
        <Bone className="h-4 w-24" />
        <Bone className="h-3 w-2/5" />
        <Bone className="h-10" />
        <Bone className="h-10" />
      </div>
    ))}
  </div>
);

export const FinalisingPage = () => {
  const { t, lang } = useT();
  const { showToast } = useOutletContext() ?? {};
  const navigate = useNavigate();
  const { activeRole, membership } = useAuth();
  const zone = useSchoolZone();
  const today = useSchoolToday();
  const isPrincipal = activeRole === ROLES.PRINCIPAL;

  /* undefined reading · years · { error } */
  const [years, setYears] = useState(undefined);
  const [yearsAttempt, setYearsAttempt] = useState(0);
  const [semesterId, setSemesterId] = useState(null);
  /* undefined reading · the board · { error } */
  const [board, setBoard] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState('ALL');
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
  }, [t, yearsAttempt]);

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
  const checks = ready && status === 'FINALIZING' ? closeChecksOf(board, picked?.semester, today) : [];
  const canClose = isPrincipal && yearActive && ready && status === 'FINALIZING' && Boolean(range) && closeBlocks.length === 0;
  const lastClose = closed?.semesterId === semesterId ? closed : null;
  const justReopened = reopenedId === semesterId;
  const day = (value) => formatDay(value, lang);
  const counts = slotCountsOf(ready ? board.slots : []);
  const standings = new Map(classes.map((entry) => [entry.class.id, classStandingOf(entry)]));
  const tabCount = (id) => (id === 'ALL' ? classes.length : classes.filter((entry) => standings.get(entry.class.id) === id).length);
  const shown = tab === 'ALL' ? classes : classes.filter((entry) => standings.get(entry.class.id) === tab);
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? '';

  const pick = (id) => {
    setBoard(undefined);
    setMessage(null);
    setTab('ALL');
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

  /* What the close dialog says it writes: the students of the classes on the board, and the subjects finalised. */
  const closeSummary = ready
    ? {
        students: classes.reduce((sum, entry) => sum + (entry.notes?.students ?? 0), 0),
        classes: classes.filter((entry) => (entry.notes?.students ?? 0) > 0).length,
        finalised: board.counts.finalised,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('grading.fin.page.title')}</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          {schoolName && (
            <>
              <span>{schoolName}</span>
              {picked && <Slash />}
            </>
          )}
          {picked && <span className="whitespace-nowrap">{t('grading.fin.semesterOption', named)}</span>}
          {status && (
            <>
              <Slash />
              <span className={`font-bold ${STATUS_TONE[status] ?? ''}`}>{t(`grading.fin.semesterStatus.${status}`)}</span>
            </>
          )}
        </p>
      </div>

      {years === undefined ? (
        <div className={`${card} space-y-3`} aria-busy="true" aria-label={t('common.loading')}>
          <Bone className="h-5 w-48" />
          <Bone className="h-16" />
        </div>
      ) : years.error ? (
        <HomeError
          message={years.error}
          retryLabel={t('att.error.retry')}
          onRetry={() => {
            setYears(undefined);
            setYearsAttempt((n) => n + 1);
          }}
        />
      ) : options.length === 0 ? (
        <section className={card}>
          <HomeEmpty icon={Clock} title={t('grading.fin.noSemester')} />
        </section>
      ) : (
        <>
          <section className={`${card} space-y-4`} aria-labelledby="fin-semester">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 id="fin-semester" className="text-base font-extrabold text-slate-900 tracking-tight">
                {t('grading.fin.semesterOption', named)}
              </h2>
              <Select size="sm" value={semesterId ?? ''} onChange={(e) => pick(e.target.value)} aria-label={t('grading.fin.semester')} className="w-full sm:w-60">
                {options.map(({ semester, year }) => (
                  <option key={semester.id} value={semester.id}>
                    {t('grading.fin.semesterOption', { n: semester.ordinal, year: year.label })}
                  </option>
                ))}
              </Select>
            </div>

            {ready && counts.total > 0 && (
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <b className="text-[28px] font-extrabold tracking-tight leading-none tabular-nums text-slate-900">
                    {t('grading.fin.summary.of', { finalised: counts.FINALISED, slots: counts.total })}
                  </b>
                  <span className="text-[13px] text-slate-500">{t('grading.fin.summary.label')}</span>
                </p>
                <div
                  role="img"
                  aria-label={BAR.map(([state]) => `${t(`grading.fin.legend.${state}`)} ${counts[state]}`).join(', ')}
                  className="mt-2.5 flex h-2.5 overflow-hidden rounded-full bg-slate-200"
                >
                  {BAR.map(([state, fill]) => (
                    <i key={state} className={`h-full ${fill}`} style={{ width: `${(counts[state] / counts.total) * 100}%` }} />
                  ))}
                </div>
                <p className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-slate-500" aria-hidden="true">
                  {BAR.map(([state, fill]) => (
                    <span key={state} className="inline-flex items-center gap-1.5">
                      <i className={`w-2.5 h-2.5 rounded-[3px] ${fill}`} />
                      {t(`grading.fin.legend.${state}`)} {counts[state]}
                    </span>
                  ))}
                </p>
              </div>
            )}

            {checks.length > 0 && (
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">{t('grading.fin.check.title')}</h3>
                <ul className="mt-1">
                  {checks.map((check) => (
                    <li key={check.id} className="flex items-start gap-2.5 py-2 border-b border-slate-100 last:border-0">
                      {check.done ? (
                        <span className="grid place-items-center w-[22px] h-[22px] shrink-0 rounded-full bg-emerald-600 text-white">
                          <Check className="w-3 h-3" strokeWidth={3.5} aria-hidden="true" />
                        </span>
                      ) : (
                        <span className="grid place-items-center w-[22px] h-[22px] shrink-0 rounded-full border-2 border-amber-500 text-[10px] font-extrabold text-amber-700 tabular-nums">
                          {check.count ?? <Clock className="w-3 h-3" strokeWidth={3} aria-hidden="true" />}
                        </span>
                      )}
                      <span className="min-w-0 text-[13.5px] font-semibold text-slate-800">
                        {t(check.key)}
                        <span className="sr-only">: {t(check.done ? 'grading.fin.check.met' : 'grading.fin.check.notMet')}</span>
                        {check.detail && (
                          <span className="block text-xs font-medium text-slate-500">
                            {t(check.detail.key, { ...check.detail.vars, date: check.detail.vars.date ? day(check.detail.vars.date) : undefined })}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {message && (
              <p className={NOTE.fail} role="alert">
                <AlertCircle className={noteIcon} aria-hidden="true" />
                {message}
              </p>
            )}
            {status === 'CLOSED' && lastClose && (
              <p className={NOTE.done}>
                <Check className={noteIcon} strokeWidth={3} aria-hidden="true" />
                {t(lastClose.version > 1 ? 'grading.fin.close.datedVersion' : 'grading.fin.close.dated', { date: day(lastClose.reportDate), version: lastClose.version })}
              </p>
            )}
            {justReopened && status === 'FINALIZING' && (
              <p className={NOTE.warn}>
                <RotateCcw className={noteIcon} aria-hidden="true" />
                {t('grading.fin.reopen.afterHint')}
              </p>
            )}

            {yearActive && status === 'CLOSED' && ready && (
              <div className="border-t border-slate-100 pt-4">
                {isPrincipal ? (
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setReopening(classes)} isDisabled={busy || reopening !== null}>
                      {t('grading.fin.reopen.open')}
                    </Button>
                  </div>
                ) : (
                  <p className={NOTE.quiet}>
                    <Lock className={noteIcon} aria-hidden="true" />
                    {t('grading.fin.reopen.viceNote')}
                  </p>
                )}
              </div>
            )}

            {yearActive && status !== 'CLOSED' && (
              <div className="border-t border-slate-100 pt-4">
                {!isPrincipal ? (
                  <p className={NOTE.quiet}>
                    <Lock className={noteIcon} aria-hidden="true" />
                    {t('grading.fin.viceNote')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-end gap-2.5">
                      {status === 'OPEN' && (
                        <Button size="sm" onClick={() => setAsking('start')} isDisabled={busy || !ready}>
                          {t('grading.fin.start')}
                        </Button>
                      )}
                      {status === 'FINALIZING' && (
                        <Button size="sm" variant="outline" onClick={() => setAsking('stop')} isDisabled={busy || !ready || !canStopFinalising(board) || justReopened}>
                          {t('grading.fin.stop')}
                        </Button>
                      )}
                      {status === 'FINALIZING' && (
                        <Button size="sm" onClick={() => setClosing(true)} isDisabled={busy || closing || !canClose}>
                          {t('grading.fin.close.open')}
                        </Button>
                      )}
                    </div>
                    {status === 'FINALIZING' && ready && !canStopFinalising(board) && closeBlocks.length > 0 && (
                      <p className="text-right text-xs font-semibold text-slate-500">{t('grading.fin.stopBlockedHint')}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {board === undefined ? (
            <BoardLoading />
          ) : board.error ? (
            <HomeError message={board.error} retryLabel={t('att.error.retry')} onRetry={reload} />
          ) : classes.length === 0 ? (
            <section className={card}>
              <HomeEmpty
                icon={BookOpen}
                title={t('grading.fin.empty.title')}
                body={t('grading.fin.empty.body')}
                action={
                  <Button size="sm" variant="outline" onClick={() => navigate('/headmaster/subjects')}>
                    {t('grading.fin.empty.action')}
                  </Button>
                }
              />
            </section>
          ) : (
            <div className="space-y-4">
              <div
                role="tablist"
                aria-label={t('grading.fin.tabs')}
                className="flex gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]"
              >
                {TABS.map((id) => {
                  const on = tab === id;
                  const n = tabCount(id);
                  const counter = on ? 'bg-brand-tint text-brand' : id === 'ATTENTION' && n > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600';
                  return (
                    <button
                      key={id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setTab(id)}
                      className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-t ${
                        on ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
                      }`}
                    >
                      {t(`grading.fin.tab.${id}`)}
                      <span className={`ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums ${counter}`}>{n}</span>
                    </button>
                  );
                })}
              </div>
              {shown.length === 0 ? (
                <section className={card}>
                  <HomeEmpty icon={Check} title={t(`grading.fin.tabEmpty.${tab}`)} />
                </section>
              ) : (
                <ul className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                  {shown.map((entry) => {
                    const finalised = entry.slots.filter((slot) => slot.finalised).length;
                    const allDone = entry.slots.length > 0 && finalised === entry.slots.length;
                    return (
                      <li key={entry.class.id} className={`${card} space-y-1`}>
                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                          <div className="min-w-0">
                            <h3 className="text-base font-extrabold text-slate-900 tracking-tight break-words">{entry.class.name}</h3>
                            <p className="text-xs font-medium text-slate-500">
                              {t('subjects.board.homeroom', { name: entry.homeroomTeacher?.fullName ?? t('classes.detail.noHomeroom') })}
                            </p>
                          </div>
                          {status === 'CLOSED' ? (
                            <button
                              type="button"
                              onClick={() => navigate('/headmaster/classes', { state: { classId: entry.class.id, semesterId, focus: 'reportCards' } })}
                              className="group inline-flex items-center gap-0.5 text-xs font-extrabold text-brand cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                            >
                              {t('grading.fin.viewReportCards')}
                              <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                            </button>
                          ) : (
                            entry.slots.length > 0 && (
                              <span className={`text-xs font-extrabold tabular-nums whitespace-nowrap ${allDone ? 'text-emerald-700' : 'text-slate-600'}`}>
                                {t('grading.fin.classCount', { finalised, slots: entry.slots.length })}
                              </span>
                            )
                          )}
                        </div>
                        {entry.slots.length > 0 && (
                          <ul className="pt-2">
                            {entry.slots.map((slot) => (
                              <SlotRow key={slot.classSubjectId} slot={slot} zone={zone} />
                            ))}
                          </ul>
                        )}
                        {entry.notes && (
                          <div className="pt-2 space-y-1.5">
                            {entry.notes.students === 0 ? (
                              <p className="text-[12.5px] font-semibold text-slate-500">{t('grading.fin.notesNoStudents')}</p>
                            ) : (
                              <>
                                <CompletionLine missing={entry.notes.missing} missingKey="grading.fin.notesMissingLine" doneKey="grading.fin.notesDone" t={t} />
                                {Array.isArray(entry.notes.promotionsMissing) && (
                                  <CompletionLine missing={entry.notes.promotionsMissing} missingKey="grading.fin.promotionsMissingLine" doneKey="grading.fin.promotionsDone" t={t} />
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
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
          summary={closeSummary}
          onClose={() => setClosing(false)}
          onSubmit={submitClose}
          describeError={(err) => closeErrorMessage(err, t, closeRefusalParts(err?.details), day)}
        />
      )}
    </div>
  );
};

export default FinalisingPage;
