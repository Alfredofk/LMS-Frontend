import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock } from 'lucide-react';

import Input from '../../components/ui/Input';
import ModalHeading from '../../components/ui/ModalHeading';
import { modalActions, modalCancelClass, modalConfirmClass } from '../../components/ui/modalStyles';
import { useT } from '../../i18n/LanguageContext';
import { formatDay } from '../Classes/format';
import { reportDateError } from './finalising';

/*
  "Tutup semester" (owner, 2026-10-20; backend 3a22f90, ticket 05): the Principal
  dates the report cards and closes the semester, which writes every student's
  report card at once. The date opens on the school's today, held inside the range
  the server takes (reportDateRange); a date outside it is refused before sending.

  Built like ReasonDialog - portal, alertdialog, focus into the field and back to the
  opener, Escape and the backdrop answering "no" except while the request runs - and,
  like it, makes no call of its own: `onSubmit(reportDate)` does, and closes the
  dialog on success. A throw is shown inside through `describeError`, the date kept.
  The close can take up to a minute on the server, and the dialog says so.

  Render it only while open, so each opening starts on the default date.

  @param title         already translated
  @param range         { from, to }, 'YYYY-MM-DD'
  @param initialDate   'YYYY-MM-DD'
  @param onClose       () => void
  @param onSubmit      (reportDate) => Promise
  @param describeError (err) => string
*/
export const CloseSemesterDialog = ({ title, range, initialDate, onClose, onSubmit, describeError }) => {
  const { t, lang } = useT();
  const baseId = useId();
  const [date, setDate] = useState(initialDate ?? '');
  const [error, setError] = useState(null);
  const [failed, setFailed] = useState(null);
  const [busy, setBusy] = useState(false);
  const fieldRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    fieldRef.current?.focus();
    return () => {
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (busy || e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const day = (value) => formatDay(value, lang);

  const handleSubmit = async () => {
    const wrong = reportDateError(date, range);
    if (wrong) {
      setError(t(wrong.key, { ...wrong.vars, from: day(wrong.vars.from), to: day(wrong.vars.to) }));
      fieldRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    setFailed(null);
    try {
      await onSubmit(date);
    } catch (err) {
      setBusy(false);
      setFailed(describeError(err));
    }
  };

  const ids = { title: `${baseId}-title`, body: `${baseId}-body`, field: `${baseId}-field`, hint: `${baseId}-hint` };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={busy ? undefined : onClose}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-describedby={ids.body}
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
      >
        <ModalHeading tone="brand" icon={Lock} titleId={ids.title} title={title} bodyId={ids.body} body={t('grading.fin.close.body')} />

        <div className="space-y-1.5">
          <Input
            ref={fieldRef}
            id={ids.field}
            name="reportDate"
            type="date"
            label={t('grading.fin.close.date')}
            min={range?.from}
            max={range?.to}
            value={date}
            disabled={busy}
            error={error || undefined}
            aria-describedby={error ? `${ids.field}-error` : ids.hint}
            onChange={(e) => {
              setDate(e.target.value);
              if (error) setError(null);
            }}
          />
          {!error && range && (
            <p id={ids.hint} className="text-[11px] text-slate-500 font-medium leading-relaxed">
              {t('grading.fin.close.dateHint', { from: day(range.from), to: day(range.to) })}
            </p>
          )}
        </div>

        {busy && <p className="text-xs font-semibold text-slate-500 leading-relaxed">{t('grading.fin.close.busyHint')}</p>}
        {failed && (
          <p className="text-xs font-semibold text-rose-700 leading-relaxed" role="alert">
            {failed}
          </p>
        )}

        <div className={modalActions}>
          <button type="button" onClick={onClose} disabled={busy} className={modalCancelClass(busy)}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={handleSubmit} disabled={busy} className={modalConfirmClass('brand', busy)}>
            {busy ? t('grading.fin.close.busy') : t('grading.fin.close.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CloseSemesterDialog;
