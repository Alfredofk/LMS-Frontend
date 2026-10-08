import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertCircle, ArrowDown, ArrowUp, Ban, Copy, Info, Library, Lock, RefreshCw, Send, Trash2 } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FactLine from '../../components/ui/FactLine';
import Input from '../../components/ui/Input';
import QuestionImage from '../../components/questionBank/QuestionImage';
import ReasonDialog from '../../components/ReasonDialog';
import { useAuth } from '../../context/AuthContext';
import { useSchoolZoneState } from '../../hooks/useSchoolToday';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage, isStaleAssessment, questionBankErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { assessmentService } from '../../services/assessmentService';
import { localOf } from '../Attendance/attendance';
import TextEditor from '../Course/TextEditor';
import { readMyTeaching } from '../Course/readMyTeaching';
import { formatSchoolDay } from '../QuestionBank/questionBank';
import { QuestionAnswer } from '../QuestionBank/QuestionItem';
import BankPickerDialog from './BankPickerDialog';
import StateWord from './StateWord';
import CopyToClassesDialog from './CopyToClassesDialog';
import {
  MAX_ATTEMPTS,
  MAX_POINTS,
  MAX_TIME_LIMIT,
  MODES,
  TYPES,
  actionsOf,
  cancelReasonError,
  createBody,
  emptyForm,
  formErrors,
  formFrom,
  heldBankIds,
  moveRow,
  patchBody,
  questionsBody,
  removeRow,
  rowErrors,
  rowsChanged,
  rowsFrom,
  semesterOf,
  semesterSpan,
  totalPoints,
  windowText,
  withBankVersion,
  withPicked,
} from './teacherAssessment';

/*
  One assessment of a class subject, at the teacher's desk (backend 0bb4598,
  assessment ticket 02; owner 2026-10-08) - /teacher/courses/:classSubjectId/
  penilaian/new and /:assessmentId.

  - Two parts, each saved on its own (owner's choice): "Detail" - type, mode
    (chosen once), title, instructions, the window as a day and a clock time in
    the school's zone, and an online one's settings - sent as PATCH with only what
    changed; and "Soal" - the list from the bank with points and order, sent whole
    as PUT. A new one shows Detail alone and becomes a draft on "Buat".
  - Questions come from the bank (BankPickerDialog), copied in when saved. A copy
    whose bank question changed since offers the bank's version in its place; an
    archived one says so. Wording is fixed in the bank, never here.
  - A draft is published (asked first; "Terbitkan" waits while either part has
    unsaved changes) or deleted; a published one is cancelled with a reason the
    students see (1-500). Cancelled, nothing changes.
  - Read only when the year is closed or it is not this teacher's (`canManage`).
  - "Salin ke kelas lain" (CopyToClassesDialog) on any one the teacher can open,
    read-only ones included: last year's, or a colleague's from a semester over.
    One copy opens its draft; several stay here, named in a toast.
  Students cannot answer it yet (ticket 03); the page says so.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const fieldLabel = 'block text-sm font-bold text-slate-700';
const errorText = 'text-xs font-semibold text-red-600';
const tool =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';
const smallInput =
  'block w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 disabled:text-slate-500';

const Failure = ({ message, onReload, t }) => (
  <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold space-y-2" role="alert">
    <p>{message}</p>
    {onReload && (
      <button type="button" onClick={onReload} className={`${tool} bg-white border border-red-200 text-red-700 hover:bg-red-50`}>
        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
        {t('tasm.reload')}
      </button>
    )}
  </div>
);

const Toggle = ({ checked, onChange, disabled, label, hint }) => (
  <label className={`flex items-start gap-2.5 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} select-none`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 w-4 h-4 accent-brand cursor-pointer disabled:cursor-not-allowed" />
    <span className="space-y-0.5">
      <span className="block text-sm font-bold text-slate-700">{label}</span>
      {hint && <span className="block text-[11px] font-medium text-slate-500 leading-relaxed">{hint}</span>}
    </span>
  </label>
);

const TeacherAssessment = () => {
  const { classSubjectId, assessmentId } = useParams();
  const creating = !assessmentId;
  const { t, lang } = useT();
  const navigate = useNavigate();
  const baseId = useId();
  const { showToast } = useOutletContext() ?? {};
  const { membership } = useAuth();
  const { zone, known: zoneKnown } = useSchoolZoneState();

  /* What the page stands on: the class subject (new) or the assessment, and the years. */
  const [ctx, setCtx] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [rows, setRows] = useState([]);
  const [pointErrors, setPointErrors] = useState({});
  const [busy, setBusy] = useState(null);
  const [failure, setFailure] = useState({});
  const [dialog, setDialog] = useState(null);
  const [swapping, setSwapping] = useState(null);

  const adopt = useCallback(
    (assessment) => {
      setSaved(assessment);
      setForm(formFrom(assessment, zone));
      setRows(rowsFrom(assessment));
      setErrors({});
      setPointErrors({});
    },
    [zone]
  );

  useEffect(() => {
    if (!zoneKnown) return undefined;
    let cancelled = false;
    const years = academicsService.academicYears().catch(() => null);
    const read = creating
      ? readMyTeaching(membership?.id).then(({ rows: taught }) => {
          const entry = taught.find((row) => row.id === classSubjectId);
          if (!entry) return { missing: true };
          return {
            subject: entry.subject,
            className: entry.class?.name,
            gradeLevel: entry.class?.gradeLevel,
            semesterId: entry.semester?.id,
            semesterOrdinal: entry.semester?.ordinal,
            ended: entry.status !== 'ACTIVE' || Boolean(entry.endedAt),
          };
        })
      : assessmentService.getAssessment(assessmentId).then((assessment) => ({
          assessment,
          subject: assessment.classSubject.subject,
          className: assessment.classSubject.class.name,
          gradeLevel: assessment.classSubject.class.gradeLevel,
          semesterId: assessment.classSubject.semester.id,
          semesterOrdinal: assessment.classSubject.semester.ordinal,
          ended: assessment.classSubject.ended,
        }));
    Promise.all([read, years])
      .then(([found, yearList]) => {
        if (cancelled) return;
        const semester = found.missing ? null : semesterOf(yearList, found.semesterId);
        setCtx({ ...found, years: yearList, semester });
        if (found.assessment) adopt(found.assessment);
        else if (!found.missing) setForm((prev) => prev ?? emptyForm());
        setFailure({});
      })
      .catch((err) => !cancelled && setCtx({ error: assessmentErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [creating, assessmentId, classSubjectId, membership?.id, attempt, zoneKnown, adopt, t]);

  const span = useMemo(() => (ctx?.semester ? semesterSpan(ctx.semester, zone) : null), [ctx, zone]);
  const yearClosed = Boolean(ctx?.semester) && ctx.semester.academicYear.status !== 'ACTIVE';
  const readOnly = yearClosed || (saved ? !saved.canManage : false);
  const actions = actionsOf(saved, { readOnly });
  const editable = creating ? !readOnly : actions.edit;
  const published = saved?.status === 'PUBLISHED';
  const patch = saved && form ? patchBody(form, saved, zone) : {};
  const detailsDirty = Object.keys(patch).length > 0;
  const questionsDirty = saved ? rowsChanged(rows, saved.questions) : false;
  const back = `/teacher/courses/${classSubjectId}?tab=penilaian`;
  /* Unsaved work holds a move away (owner, 2026-10-08): a new form touched, or either part changed. */
  const guard = useUnsavedGuard(creating ? Boolean(form) && JSON.stringify(form) !== JSON.stringify(emptyForm()) : detailsDirty || questionsDirty);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key === 'opensDate' || key === 'opensTime' ? 'opens' : key === 'closesDate' || key === 'closesTime' ? 'closes' : key]: undefined }));
    setFailure((prev) => ({ ...prev, details: null }));
  };

  const fail = (part, err) => setFailure((prev) => ({ ...prev, [part]: { message: assessmentErrorMessage(err, t), stale: isStaleAssessment(err) } }));

  const saveDetails = async () => {
    const found = formErrors(form, { zone, span, published, savedClosesAt: saved?.closesAt });
    setErrors(found);
    if (Object.keys(found).length) {
      setFailure((prev) => ({ ...prev, details: { message: t('tasm.error.fix') } }));
      return;
    }
    setBusy('details');
    setFailure((prev) => ({ ...prev, details: null }));
    try {
      if (creating) {
        const made = await assessmentService.createAssessment(classSubjectId, createBody(form, zone));
        showToast?.(t('tasm.toast.created'), 'success');
        guard.release();
        navigate(`/teacher/courses/${classSubjectId}/penilaian/${made.id}`, { replace: true });
        return;
      }
      const answer = await assessmentService.updateAssessment(saved.id, patch);
      /* The questions part keeps what is being edited there. */
      setSaved(answer);
      setForm(formFrom(answer, zone));
      if (!questionsDirty) setRows(rowsFrom(answer));
      showToast?.(t('tasm.toast.saved'), 'success');
    } catch (err) {
      fail('details', err);
    } finally {
      setBusy(null);
    }
  };

  const saveQuestions = async () => {
    const found = rowErrors(rows);
    setPointErrors(found);
    if (Object.keys(found).length) {
      setFailure((prev) => ({ ...prev, questions: { message: t(found.list ?? 'tasm.error.fix') } }));
      return;
    }
    setBusy('questions');
    setFailure((prev) => ({ ...prev, questions: null }));
    try {
      const answer = await assessmentService.replaceQuestions(saved.id, questionsBody(rows));
      setSaved(answer);
      setRows(rowsFrom(answer));
      if (!detailsDirty) setForm(formFrom(answer, zone));
      showToast?.(t('tasm.toast.questionsSaved'), 'success');
    } catch (err) {
      fail('questions', err);
    } finally {
      setBusy(null);
    }
  };

  const swapToBank = async (row) => {
    setSwapping(row.key);
    setFailure((prev) => ({ ...prev, questions: null }));
    try {
      const question = await assessmentService.get(row.sourceQuestionId);
      setRows((prev) => withBankVersion(prev, row.key, question));
    } catch (err) {
      setFailure((prev) => ({ ...prev, questions: { message: questionBankErrorMessage(err, t) } }));
    } finally {
      setSwapping(null);
    }
  };

  const runDialog = async (kind, call, toastKey) => {
    setBusy(kind);
    setFailure((prev) => ({ ...prev, top: null }));
    try {
      const answer = await call();
      setDialog(null);
      showToast?.(t(toastKey), 'success');
      if (answer) adopt(answer);
      else {
        guard.release();
        navigate(back, { replace: true });
      }
    } catch (err) {
      setDialog(null);
      fail('top', err);
    } finally {
      setBusy(null);
    }
  };

  /* ---- before there is anything to show ---- */

  if (ctx === undefined || (!creating && !saved && !ctx?.error)) {
    return <div className="h-96 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
  }
  if (ctx.error || ctx.missing) {
    return (
      <div className={`${card} flex flex-col items-center text-center gap-3 py-10`} role="alert">
        <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-700 max-w-sm">{ctx.error ?? t('teach.notFound')}</p>
        <div className="flex gap-2">
          {ctx.error && (
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`${tool} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              {t('att.error.retry')}
            </button>
          )}
          <button type="button" onClick={() => navigate(back)} className={`${tool} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
            {t('tasm.backToList')}
          </button>
        </div>
      </div>
    );
  }
  /* A new one goes only where the server takes one: a live assignment in an open semester of an active year. */
  if (creating && (ctx.ended || yearClosed || (ctx.semester && ctx.semester.status !== 'OPEN'))) {
    return (
      <div className={`${card} flex flex-col items-center text-center gap-3 py-10`}>
        <Lock className="w-8 h-8 text-slate-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-600 max-w-sm">{t('tasm.cannotCreate')}</p>
        <button type="button" onClick={() => navigate(back)} className={`${tool} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
          {t('tasm.backToList')}
        </button>
      </div>
    );
  }

  const disabled = !editable || Boolean(busy);
  const tz = zone ? ` (${zone})` : '';
  const total = totalPoints(rows);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight break-words">
          {creating ? t('tasm.newTitle') : saved.title}
        </h1>
        <FactLine code={ctx.subject?.code} name={ctx.subject?.name} facts={[ctx.className, t('tasm.semester', { n: ctx.semesterOrdinal })]} />
        {saved && (
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-slate-500">
            <StateWord assessment={saved} t={t} />
            <span>{t(`tasm.type.${saved.type}`)}</span>
            <span>{t(`tasm.mode.${saved.mode}`)}</span>
            <span className="tabular-nums">{windowText(saved, zone, lang)}</span>
          </p>
        )}
      </div>

      {saved && (
        <div className="flex flex-wrap items-center gap-2">
          {actions.edit && saved.status === 'DRAFT' && (
            <button
              type="button"
              onClick={() => setDialog('publish')}
              disabled={!actions.publish || detailsDirty || questionsDirty || Boolean(busy)}
              className={`${tool} px-4 py-2.5 text-sm bg-brand text-white hover:bg-brand-deep`}
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              {t('tasm.publish')}
            </button>
          )}
          {actions.remove && (
            <button type="button" onClick={() => setDialog('remove')} disabled={Boolean(busy)} className={`${tool} px-4 py-2.5 text-sm border border-slate-200 text-rose-700 hover:bg-rose-50`}>
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              {t('tasm.remove')}
            </button>
          )}
          <button type="button" onClick={() => setDialog('copy')} disabled={Boolean(busy)} className={`${tool} px-4 py-2.5 text-sm border border-slate-200 text-slate-700 hover:bg-slate-50`}>
            <Copy className="w-4 h-4" aria-hidden="true" />
            {t('tasm.copy.open')}
          </button>
          {actions.cancel && (
            <button type="button" onClick={() => setDialog('cancel')} disabled={Boolean(busy)} className={`${tool} px-4 py-2.5 text-sm border border-slate-200 text-rose-700 hover:bg-rose-50`}>
              <Ban className="w-4 h-4" aria-hidden="true" />
              {t('tasm.cancel')}
            </button>
          )}
          {actions.edit && saved.status === 'DRAFT' && (detailsDirty || questionsDirty) && (
            <span className="text-xs font-semibold text-amber-700">{t('tasm.publishWaits')}</span>
          )}
          {actions.edit && saved.status === 'DRAFT' && !detailsDirty && !questionsDirty && !actions.publish && (
            <span className="text-xs font-semibold text-slate-500">{t('tasm.publishNeedsQuestion')}</span>
          )}
        </div>
      )}

      {failure.top && <Failure message={failure.top.message} onReload={failure.top.stale ? () => setAttempt((n) => n + 1) : null} t={t} />}

      {saved?.status === 'CANCELLED' && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 space-y-1">
          <p className="text-sm font-bold text-rose-700">{t('tasm.cancelledOn', { date: formatSchoolDay(localOf(saved.cancelledAt, zone)?.date, lang) })}</p>
          {saved.cancelReason && <p className="text-sm font-semibold text-rose-700 break-words">{t('tasm.cancelledReason', { reason: saved.cancelReason })}</p>}
        </div>
      )}
      {readOnly && saved?.status !== 'CANCELLED' && (
        <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-600 leading-relaxed">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
          {t(yearClosed ? 'tasm.readOnlyYear' : 'tasm.readOnlyNotYours')}
        </p>
      )}
      <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-semibold text-slate-600 leading-relaxed">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
        {t('tasm.studentsNotYet')}
      </p>

      {/* ---- Detail ---- */}
      <section className={`${card} space-y-5`} aria-labelledby={`${baseId}-details`}>
        <h2 id={`${baseId}-details`} className="text-base font-extrabold text-slate-900">
          {t('tasm.details')}
        </h2>

        <div className="space-y-2">
          <span id={`${baseId}-type`} className={fieldLabel}>
            {t('tasm.field.type')}
          </span>
          <div role="radiogroup" aria-labelledby={`${baseId}-type`} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TYPES.map((type) => {
              const on = form.type === type;
              return (
                <button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={disabled || published}
                  onClick={() => setField('type', type)}
                  className={`px-3 py-2.5 rounded-xl border text-sm font-bold cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                    on ? 'border-brand bg-brand-tint text-brand' : 'border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60'
                  }`}
                >
                  {t(`tasm.type.${type}`)}
                </button>
              );
            })}
          </div>
          {published && editable && <p className="text-[11px] font-medium text-slate-500">{t('tasm.typeFixed')}</p>}
        </div>

        <div className="space-y-2">
          <span id={`${baseId}-mode`} className={fieldLabel}>
            {t('tasm.field.mode')}
          </span>
          {creating ? (
            <div role="radiogroup" aria-labelledby={`${baseId}-mode`} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MODES.map((mode) => {
                const on = form.mode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={disabled}
                    onClick={() => setField('mode', mode)}
                    className={`px-3.5 py-3 rounded-xl border text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      on ? 'border-brand bg-brand-tint' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`block text-sm font-bold ${on ? 'text-brand' : 'text-slate-700'}`}>{t(`tasm.mode.${mode}`)}</span>
                    <span className="block text-[11px] font-medium text-slate-500 leading-relaxed">{t(`tasm.modeHint.${mode}`)}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm font-semibold text-slate-700">
              {t(`tasm.mode.${form.mode}`)} <span className="text-xs font-medium text-slate-500">- {t('tasm.modeFixed')}</span>
            </p>
          )}
        </div>

        <Input
          id={`${baseId}-title`}
          name="title"
          label={t('tasm.field.title')}
          value={form.title}
          maxLength={200}
          disabled={disabled}
          error={errors.title ? t(errors.title) : undefined}
          onChange={(e) => setField('title', e.target.value)}
        />

        <div className="space-y-2">
          <span id={`${baseId}-instructions`} className={fieldLabel}>
            {t('tasm.field.instructions')}
          </span>
          <TextEditor
            key={saved ? saved.updatedAt : 'new'}
            id={`${baseId}-instructions-box`}
            labelledBy={`${baseId}-instructions`}
            value={form.instructions}
            onChange={(html) => setField('instructions', html)}
            disabled={disabled}
            invalid={Boolean(errors.instructions)}
          />
          {errors.instructions ? <p className={errorText}>{t(errors.instructions)}</p> : <p className="text-[11px] font-medium text-slate-500">{t('tasm.instructionsHint')}</p>}
        </div>

        <div className="space-y-3">
          {[
            ['opens', 'opensDate', 'opensTime'],
            ['closes', 'closesDate', 'closesTime'],
          ].map(([end, dateKey, timeKey]) => (
            <fieldset key={end} className="space-y-1.5">
              <legend className={fieldLabel}>{t(`tasm.field.${end}`) + tz}</legend>
              <div className="grid grid-cols-[1fr_auto] gap-2 max-w-sm">
                <input
                  type="date"
                  aria-label={t(`tasm.field.${end}Date`)}
                  value={form[dateKey]}
                  min={span?.first}
                  max={span?.last}
                  disabled={disabled}
                  aria-invalid={Boolean(errors[end])}
                  onChange={(e) => setField(dateKey, e.target.value)}
                  className={smallInput}
                />
                <input
                  type="time"
                  aria-label={t(`tasm.field.${end}Time`)}
                  value={form[timeKey]}
                  disabled={disabled}
                  aria-invalid={Boolean(errors[end])}
                  onChange={(e) => setField(timeKey, e.target.value)}
                  className={`${smallInput} w-32`}
                />
              </div>
              {errors[end] && <p className={errorText}>{t(errors[end])}</p>}
            </fieldset>
          ))}
          <p className="text-[11px] font-medium text-slate-500">
            {span
              ? t('tasm.windowHint', { n: ctx.semesterOrdinal, from: formatSchoolDay(span.first, lang), to: formatSchoolDay(span.last, lang) })
              : t('tasm.windowHintNoSemester')}
          </p>
        </div>

        {form.mode === 'ONLINE' && (
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-sm font-extrabold text-slate-900">{t('tasm.settings')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor={`${baseId}-attempts`} className={fieldLabel}>
                  {t('tasm.field.attempts')}
                </label>
                <input
                  id={`${baseId}-attempts`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_ATTEMPTS}
                  value={form.maxAttempts}
                  disabled={disabled}
                  aria-invalid={Boolean(errors.maxAttempts)}
                  onChange={(e) => setField('maxAttempts', e.target.value)}
                  className={`${smallInput} w-28`}
                />
                {errors.maxAttempts ? <p className={errorText}>{t(errors.maxAttempts)}</p> : <p className="text-[11px] font-medium text-slate-500">{t('tasm.attemptsHint')}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${baseId}-limit`} className={fieldLabel}>
                  {t('tasm.field.timeLimit')}
                </label>
                <input
                  id={`${baseId}-limit`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_TIME_LIMIT}
                  placeholder={t('tasm.noLimit')}
                  value={form.timeLimit}
                  disabled={disabled}
                  aria-invalid={Boolean(errors.timeLimit)}
                  onChange={(e) => setField('timeLimit', e.target.value)}
                  className={`${smallInput} w-36`}
                />
                {errors.timeLimit ? <p className={errorText}>{t(errors.timeLimit)}</p> : <p className="text-[11px] font-medium text-slate-500">{t('tasm.timeLimitHint')}</p>}
              </div>
            </div>
            <div className="space-y-3">
              <Toggle checked={form.acceptLate} disabled={disabled} onChange={(v) => setField('acceptLate', v)} label={t('tasm.field.acceptLate')} hint={t('tasm.acceptLateHint')} />
              <Toggle checked={form.shuffleQuestions} disabled={disabled} onChange={(v) => setField('shuffleQuestions', v)} label={t('tasm.field.shuffleQuestions')} />
              <Toggle checked={form.shuffleOptions} disabled={disabled} onChange={(v) => setField('shuffleOptions', v)} label={t('tasm.field.shuffleOptions')} hint={t('tasm.shuffleOptionsHint')} />
              <Toggle checked={form.showKeyOnRelease} disabled={disabled} onChange={(v) => setField('showKeyOnRelease', v)} label={t('tasm.field.showKey')} hint={t('tasm.showKeyHint')} />
            </div>
            {published && editable && <p className="text-[11px] font-medium text-slate-500">{t('tasm.settingsAfterPublish')}</p>}
          </div>
        )}

        {failure.details && <Failure message={failure.details.message} onReload={failure.details.stale ? () => setAttempt((n) => n + 1) : null} t={t} />}

        {editable && (
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-1">
            {creating && (
              <button type="button" onClick={() => navigate(back)} disabled={Boolean(busy)} className={`${tool} px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100`}>
                {t('common.cancel')}
              </button>
            )}
            <button
              type="button"
              onClick={saveDetails}
              disabled={Boolean(busy) || (!creating && !detailsDirty)}
              className={`${tool} px-5 py-2.5 text-sm bg-brand text-white hover:bg-brand-deep`}
            >
              {busy === 'details' ? t('common.loading') : t(creating ? 'tasm.createDraft' : 'tasm.saveDetails')}
            </button>
          </div>
        )}
      </section>

      {/* ---- Soal ---- */}
      {saved && saved.mode === 'OFFLINE' && (
        <p className={`${card} text-sm font-semibold text-slate-600`}>{t('tasm.offlineNote')}</p>
      )}
      {saved && saved.mode === 'ONLINE' && (
        <section className={`${card} space-y-4`} aria-labelledby={`${baseId}-questions`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id={`${baseId}-questions`} className="text-base font-extrabold text-slate-900">
                {t('tasm.questions')}
              </h2>
              <p className="text-xs font-semibold text-slate-500">{t('tasm.count', { n: rows.length, points: total })}</p>
            </div>
            {actions.edit && (
              <button
                type="button"
                onClick={() => setDialog('picker')}
                disabled={Boolean(busy)}
                className={`${tool} px-3.5 py-2.5 text-sm border border-slate-200 text-slate-700 hover:bg-slate-50`}
              >
                <Library className="w-4 h-4" aria-hidden="true" />
                {t('tasm.addFromBank')}
              </button>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-600">{t(actions.edit ? 'tasm.noQuestions' : 'tasm.noQuestionsReadOnly')}</p>
          ) : (
            <ol className="space-y-3">
              {rows.map((row, index) => {
                const question = row.content;
                const imageSource = row.id ? { assessmentId: saved.id } : { questionId: row.questionId };
                const archived = Boolean(row.bank?.archived);
                const changed = Boolean(row.bank?.changed) && !archived;
                return (
                  <li key={row.key} className="rounded-2xl border border-slate-200 p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 text-xs font-extrabold flex items-center justify-center shrink-0">{index + 1}</span>
                      <span className="text-xs font-bold text-slate-600">{t(`qbank.kind.${question.kind}`)}</span>
                      {!row.id && <span className="text-xs font-bold text-brand">{t('tasm.unsavedRow')}</span>}
                      <span className="ml-auto flex items-center gap-1.5">
                        <label htmlFor={`${baseId}-pts-${row.key}`} className="text-xs font-bold text-slate-600">
                          {t('tasm.points')}
                        </label>
                        <input
                          id={`${baseId}-pts-${row.key}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={MAX_POINTS}
                          value={row.points}
                          disabled={!actions.edit || Boolean(busy)}
                          aria-invalid={Boolean(pointErrors[row.key])}
                          onChange={(e) => {
                            const value = e.target.value;
                            setRows((prev) => prev.map((item) => (item.key === row.key ? { ...item, points: value } : item)));
                            setPointErrors((prev) => ({ ...prev, [row.key]: undefined }));
                          }}
                          className={`${smallInput} w-20 py-1.5`}
                        />
                        {actions.edit && (
                          <>
                            <button type="button" onClick={() => setRows((prev) => moveRow(prev, row.key, -1))} disabled={index === 0 || Boolean(busy)} aria-label={t('tasm.moveUp', { n: index + 1 })} className={`${tool} px-1.5 text-slate-500 hover:bg-slate-100`}>
                              <ArrowUp className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => setRows((prev) => moveRow(prev, row.key, 1))} disabled={index === rows.length - 1 || Boolean(busy)} aria-label={t('tasm.moveDown', { n: index + 1 })} className={`${tool} px-1.5 text-slate-500 hover:bg-slate-100`}>
                              <ArrowDown className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button type="button" onClick={() => setRows((prev) => removeRow(prev, row.key))} disabled={Boolean(busy)} aria-label={t('tasm.removeQuestion', { n: index + 1 })} className={`${tool} px-1.5 text-rose-600 hover:bg-rose-50`}>
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                    {pointErrors[row.key] && <p className={errorText}>{t(pointErrors[row.key])}</p>}
                    <div className="content-html text-sm text-slate-800 break-words" dangerouslySetInnerHTML={{ __html: question.body ?? '' }} />
                    {question.imageId && <QuestionImage imageId={question.imageId} {...imageSource} className="max-h-56" />}
                    <QuestionAnswer question={question} t={t} imageSource={imageSource} />
                    {archived && <p className="text-xs font-semibold text-slate-500">{t('tasm.bank.archived')}</p>}
                    {changed && (
                      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2">
                        <p className="text-xs font-semibold text-amber-700 flex-1 min-w-[12rem]">{t('tasm.bank.changed')}</p>
                        {actions.edit && (
                          <button type="button" onClick={() => swapToBank(row)} disabled={Boolean(busy) || swapping === row.key} className={`${tool} bg-white border border-amber-200 text-amber-700 hover:bg-amber-50`}>
                            {swapping === row.key ? t('common.loading') : t('tasm.bank.use')}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {failure.questions && <Failure message={failure.questions.message} onReload={failure.questions.stale ? () => setAttempt((n) => n + 1) : null} t={t} />}

          {actions.edit && (
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center sm:justify-between pt-1">
              <a href="/question-bank/new" target="_blank" rel="noreferrer" className="text-xs font-bold text-brand hover:underline">
                {t('tasm.writeInBank')}
              </a>
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                {questionsDirty && (
                  <button type="button" onClick={() => { setRows(rowsFrom(saved)); setPointErrors({}); setFailure((prev) => ({ ...prev, questions: null })); }} disabled={Boolean(busy)} className={`${tool} px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100`}>
                    {t('tasm.undo')}
                  </button>
                )}
                <button type="button" onClick={saveQuestions} disabled={Boolean(busy) || !questionsDirty} className={`${tool} px-5 py-2.5 text-sm bg-brand text-white hover:bg-brand-deep`}>
                  {busy === 'questions' ? t('common.loading') : t('tasm.saveQuestions')}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {guard.dialog}
      {dialog === 'copy' && (
        <CopyToClassesDialog
          source={saved}
          zone={zone}
          onClose={() => setDialog(null)}
          onCopied={(copies) => {
            setDialog(null);
            if (copies.length === 1) {
              showToast?.(t('tasm.toast.copiedOne', { name: copies[0].classSubject.class.name }), 'success');
              navigate(`/teacher/courses/${copies[0].classSubject.id}/penilaian/${copies[0].id}`);
            } else {
              showToast?.(t('tasm.toast.copiedMany', { names: copies.map((copy) => copy.classSubject.class.name).join(', ') }), 'success');
            }
          }}
        />
      )}
      {dialog === 'picker' && (
        <BankPickerDialog
          subject={ctx.subject}
          gradeLevel={ctx.gradeLevel}
          held={heldBankIds(rows)}
          today={localOf(new Date(), zone)?.date ?? ''}
          onAdd={(picked) => setRows((prev) => withPicked(prev, picked))}
          onClose={() => setDialog(null)}
        />
      )}
      <ConfirmDialog
        open={dialog === 'publish'}
        tone="brand"
        icon={Send}
        title={t('tasm.publishConfirm.title')}
        body={t('tasm.publishConfirm.body', { title: saved?.title ?? '' })}
        confirmLabel={t('tasm.publish')}
        cancelLabel={t('common.cancel')}
        busy={busy === 'publish'}
        busyLabel={t('common.loading')}
        onConfirm={() => runDialog('publish', () => assessmentService.publish(saved.id), 'tasm.toast.published')}
        onCancel={() => busy !== 'publish' && setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === 'remove'}
        tone="danger"
        title={t('tasm.removeConfirm.title')}
        body={t('tasm.removeConfirm.body', { title: saved?.title ?? '' })}
        confirmLabel={t('tasm.remove')}
        cancelLabel={t('common.cancel')}
        busy={busy === 'remove'}
        busyLabel={t('common.loading')}
        onConfirm={() => runDialog('remove', async () => { await assessmentService.removeAssessment(saved.id); return null; }, 'tasm.toast.removed')}
        onCancel={() => busy !== 'remove' && setDialog(null)}
      />
      {dialog === 'cancel' && (
        <ReasonDialog
          title={t('tasm.cancelDialog.title')}
          body={t('tasm.cancelDialog.body', { title: saved.title })}
          label={t('tasm.cancelDialog.label')}
          hint={t('tasm.cancelDialog.hint')}
          confirmLabel={t('tasm.cancel')}
          validate={cancelReasonError}
          onClose={() => setDialog(null)}
          onSubmit={async (reason) => {
            const answer = await assessmentService.cancel(saved.id, reason);
            setDialog(null);
            adopt(answer);
            showToast?.(t('tasm.toast.cancelled'), 'success');
          }}
          describeError={(err) => assessmentErrorMessage(err, t)}
        />
      )}
    </div>
  );
};

/*
  Keyed on the address: from one assessment to another (or to /new) starts afresh,
  so a form read for one is never sent to another.
*/
export const TeacherAssessmentPage = () => {
  const { classSubjectId, assessmentId } = useParams();
  return <TeacherAssessment key={`${classSubjectId}/${assessmentId ?? 'new'}`} />;
};

export default TeacherAssessmentPage;
