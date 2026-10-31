import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import { modalActions, modalCancelClass, modalConfirmClass } from '../../components/ui/modalStyles';
import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage, isStaleException } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import { localOf } from '../Attendance/attendance';
import { formatSchoolDay } from '../QuestionBank/questionBank';
import { WindowFields } from './WindowChoice';
import { MAX_EXTRA_ATTEMPTS, exceptionBody, exceptionChanged, exceptionErrors, exceptionFormFrom, remedialOpen } from './exceptions';
import { windowText } from './teacherAssessment';
import { BusyLabel } from '../../components/ui/ModalHeading';

/*
  "Susulan / remedial" for one student on the Hasil tab (backend 1e6c749, ticket
  05; owner 2026-10-11). The whole exception at once: an own window (make-up),
  extra attempts, and whether it is a remedial - locked, with the date, until the
  class's window has closed. A remedial always brings its own window (backend
  52c31db), so ticking it ticks the make-up and holds it ticked. A saved one is read first (GET /:id/exceptions) for
  its updatedAt and whether it was used; an unused one can be removed, asked
  inline (a second dialog would share this one's Escape).

  @param assessment  the assessment as the results read it
  @param student     the results row: `{ studentProfileId, fullName, exception }`
  @param zone        the school's zone
  @param span        semesterSpan of its semester, or null (the server checks)
  @param onDone      ('saved' | 'removed') => void
  @param onStale     () => void - read the results again and close
  @param onClose     () => void
*/
const fieldLabel = 'block text-sm font-bold text-slate-700';
const hint = 'text-[11px] font-medium text-slate-500 leading-relaxed';
const errorText = 'text-xs font-semibold text-rose-700';
const input =
  'block w-24 rounded-xl border bg-white py-2 px-3 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50 disabled:text-slate-500';

export const ExceptionDialog = ({ assessment, student, zone, span = null, onDone, onStale, onClose }) => {
  const { t, lang } = useT();
  const baseId = useId();
  /* undefined: reading · { saved } (null for a new one) · { error } */
  const [data, setData] = useState(student.exception ? undefined : { saved: null });
  const [form, setForm] = useState(() => exceptionFormFrom(student.exception, zone));
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const openerRef = useRef(null);

  useEffect(() => {
    if (!student.exception) return undefined;
    let cancelled = false;
    assessmentService
      .exceptions(assessment.id)
      .then((rows) => {
        if (cancelled) return;
        const saved = rows.find((row) => row.studentProfileId === student.studentProfileId) ?? null;
        setData({ saved });
        setForm(exceptionFormFrom(saved, zone));
      })
      .catch((err) => !cancelled && setData({ error: assessmentErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [assessment.id, student.exception, student.studentProfileId, zone, t]);

  useEffect(() => {
    openerRef.current = document.activeElement;
    const onKeyDown = (e) => {
      if (busy || e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, [busy, onClose]);

  const saved = data?.saved ?? null;
  const canRemedial = remedialOpen(assessment);
  const maxAttempts = assessment.settings?.maxAttempts ?? null;
  const closesDay = formatSchoolDay(localOf(assessment.closesAt, zone)?.date, lang);
  const changed = exceptionChanged(form, saved, zone);

  const change = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors({});
    setFailure(null);
    setAsking(false);
  };

  const fail = (err) => {
    setBusy(false);
    setFailure({ text: assessmentErrorMessage(err, t), stale: isStaleException(err) });
  };

  const submit = async () => {
    const found = exceptionErrors(form, { zone, span, assessment });
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFailure(null);
    try {
      await assessmentService.setException(assessment.id, student.studentProfileId, exceptionBody(form, zone, saved));
      onDone('saved');
    } catch (err) {
      fail(err);
    }
  };

  const remove = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await assessmentService.removeException(assessment.id, student.studentProfileId);
      onDone('removed');
    } catch (err) {
      setAsking(false);
      fail(err);
    }
  };

  const titleId = `${baseId}-title`;
  const extraId = `${baseId}-extra`;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full p-5 sm:p-6 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-extrabold text-slate-900">
              {t('tasm.exc.title')}
            </h2>
            <p className="text-xs font-semibold text-slate-500 break-words">{t('tasm.exc.body', { name: student.fullName ?? '' })}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t('common.close')} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {data === undefined ? (
          <div className="h-32 rounded-2xl bg-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />
        ) : data.error ? (
          <p className="text-sm font-semibold text-rose-700" role="alert">
            {data.error}
          </p>
        ) : (
          <>
            <div className="space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={form.makeUp} disabled={busy || form.remedial} onChange={(e) => change({ makeUp: e.target.checked })} className="mt-0.5 w-4 h-4 accent-brand cursor-pointer disabled:cursor-not-allowed" />
                <span className="space-y-0.5">
                  <span className={fieldLabel}>{t('tasm.exc.makeUp')}</span>
                  <span className={`block ${hint}`}>
                    {form.remedial ? t('tasm.exc.makeUpRemedial') : t('tasm.exc.makeUpHint', { window: windowText(assessment, zone, lang) })}
                  </span>
                </span>
              </label>
              {form.makeUp && (
                <div className="sm:pl-6">
                  <WindowFields
                    value={form.window}
                    onChange={(key, value) => change({ window: { ...form.window, [key]: value } })}
                    errors={errors}
                    bounds={span ? { min: span.first, max: span.last } : null}
                    zone={zone}
                    disabled={busy}
                    t={t}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor={extraId} className={fieldLabel}>
                {t('tasm.exc.extra')}
              </label>
              <input
                id={extraId}
                type="number"
                inputMode="numeric"
                min={form.remedial ? 1 : 0}
                max={MAX_EXTRA_ATTEMPTS}
                step={1}
                value={form.extraAttempts}
                disabled={busy}
                aria-invalid={Boolean(errors.extraAttempts)}
                onChange={(e) => change({ extraAttempts: e.target.value })}
                className={`${input} ${errors.extraAttempts ? 'border-red-400' : 'border-slate-200'}`}
              />
              {errors.extraAttempts ? (
                <p className={errorText}>{t(errors.extraAttempts)}</p>
              ) : (
                <p className={hint}>{form.remedial ? t('tasm.exc.extraHintRemedial') : t('tasm.exc.extraHint', { n: maxAttempts ?? '-' })}</p>
              )}
            </div>

            <label className={`flex items-start gap-2.5 select-none ${canRemedial ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
              <input
                type="checkbox"
                checked={form.remedial}
                disabled={busy || (!canRemedial && !form.remedial)}
                onChange={(e) =>
                  change({
                    remedial: e.target.checked,
                    ...(e.target.checked ? { makeUp: true } : {}),
                    ...(e.target.checked && form.extraAttempts === '0' ? { extraAttempts: '1' } : {}),
                  })
                }
                className="mt-0.5 w-4 h-4 accent-brand cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="space-y-0.5">
                <span className={`${fieldLabel} ${canRemedial ? '' : 'text-slate-500'}`}>{t('tasm.exc.remedial')}</span>
                <span className={`block ${hint}`}>{canRemedial ? t('tasm.exc.remedialHint') : t('tasm.exc.remedialLocked', { date: closesDay })}</span>
              </span>
            </label>

            {errors.form && <p className={errorText}>{t(errors.form)}</p>}
            {saved?.used && <p className={hint}>{t('tasm.exc.used')}</p>}

            {asking && (
              <div className="rounded-xl bg-rose-50 px-3 py-2.5 space-y-2" role="alert">
                <p className="text-xs font-semibold text-rose-700">{t('tasm.exc.removeAsk')}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAsking(false)} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    {t('common.cancel')}
                  </button>
                  <button type="button" onClick={remove} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer disabled:opacity-50">
                    <BusyLabel busy={busy}>{t('tasm.exc.removeConfirm')}</BusyLabel>
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {failure && (
          <div className="rounded-xl bg-rose-50 p-3.5 space-y-2" role="alert">
            <p className="text-[13px] text-rose-700 font-semibold">{failure.text}</p>
            {failure.stale && (
              <button type="button" onClick={onStale} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer">
                {t('tasm.reload')}
              </button>
            )}
          </div>
        )}

        <div className={modalActions}>
          {saved && !saved.used && !asking && (
            <button type="button" onClick={() => setAsking(true)} disabled={busy} className="px-4 py-2.5 rounded-xl text-sm font-bold text-rose-700 hover:bg-rose-50 cursor-pointer disabled:opacity-50 sm:mr-auto">
              {t('tasm.exc.remove')}
            </button>
          )}
          <button type="button" onClick={onClose} disabled={busy} className={modalCancelClass(busy)}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={submit} disabled={busy || !data || data.error || !changed} className={`${modalConfirmClass('brand', busy)} disabled:opacity-50 disabled:cursor-not-allowed`}>
            <BusyLabel busy={busy && !asking}>{t('tasm.exc.save')}</BusyLabel>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ExceptionDialog;
