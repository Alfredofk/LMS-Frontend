import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, RotateCcw } from 'lucide-react';

import ModalHeading from '../../components/ui/ModalHeading';
import { modalActions, modalCancelClass, modalConfirmClass } from '../../components/ui/modalStyles';
import { useT } from '../../i18n/LanguageContext';
import { REASON_MAX, reopenReasonError, toggleClass } from './finalising';

/*
  "Buka kembali" (owner, 2026-10-20; backend 46c6173, ticket 06): the Principal gives
  a reason and ticks the subjects whose finalising is undone at once, grouped by class
  with "Pilih semua" per class, none ticked at first - none at all reopens it for a
  homeroom note only. Red, since the report cards handed out are replaced by a new
  version at the next close.

  Built like CloseSemesterDialog: portal, alertdialog, focus into the reason and back
  to the opener, Escape and the backdrop answering "no" except while it runs, and no
  call of its own - `onSubmit(reason, ticked)` does it and closes the dialog; a throw
  is shown inside through `describeError`, the typing and ticks kept.

  @param title         already translated
  @param classes       boardByClass(board): `[{ class, slots }]`
  @param onClose       () => void
  @param onSubmit      (reason, ticked: Set<classSubjectId>) => Promise
  @param describeError (err) => string
*/
export const ReopenSemesterDialog = ({ title, classes, onClose, onSubmit, describeError }) => {
  const { t } = useT();
  const baseId = useId();
  const [reason, setReason] = useState('');
  const [ticked, setTicked] = useState(() => new Set());
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

  const tick = (id) =>
    setTicked((now) => {
      const next = new Set(now);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSubmit = async () => {
    const wrong = reopenReasonError(reason);
    if (wrong) {
      setError(t(wrong.key, wrong.vars));
      fieldRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    setFailed(null);
    try {
      await onSubmit(reason, ticked);
    } catch (err) {
      setBusy(false);
      setFailed(describeError(err));
    }
  };

  const ids = { title: `${baseId}-title`, body: `${baseId}-body`, field: `${baseId}-field`, hint: `${baseId}-hint` };
  const withSlots = (classes ?? []).filter((entry) => entry.slots.length > 0);

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={busy ? undefined : onClose}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-describedby={ids.body}
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 sm:p-7 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
      >
        <ModalHeading tone="danger" icon={RotateCcw} titleId={ids.title} title={title} bodyId={ids.body} body={t('grading.fin.reopen.body')} />

        <div className="space-y-1.5">
          <label htmlFor={ids.field} className="text-sm font-semibold text-slate-700 block">
            {t('grading.fin.reopen.reason')}
          </label>
          <textarea
            ref={fieldRef}
            id={ids.field}
            rows={3}
            maxLength={REASON_MAX}
            value={reason}
            disabled={busy}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby={ids.hint}
            className={`block w-full rounded-xl border ${error ? 'border-rose-300' : 'border-slate-200 hover:border-slate-300'} bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50`}
          />
          {error ? (
            <p id={ids.hint} className="text-xs text-rose-700 font-semibold leading-relaxed" role="alert">
              {error}
            </p>
          ) : (
            <p id={ids.hint} className="text-[11px] text-slate-500 font-medium leading-relaxed">
              {t('grading.fin.reopen.reasonHint')}
            </p>
          )}
        </div>

        <fieldset className="space-y-2" disabled={busy}>
          <legend className="text-sm font-semibold text-slate-700">{t('grading.fin.reopen.subjects')}</legend>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('grading.fin.reopen.subjectsHint')}</p>
          {withSlots.length === 0 ? (
            <p className="text-sm font-semibold text-slate-600">{t('grading.fin.reopen.none')}</p>
          ) : (
            <ul className="space-y-2">
              {withSlots.map((entry) => {
                const all = entry.slots.every((slot) => ticked.has(slot.classSubjectId));
                return (
                  <li key={entry.class.id} className="rounded-xl border border-slate-200 px-3.5 py-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-extrabold text-slate-900 break-words">{entry.class.name}</span>
                      <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 cursor-pointer">
                        <input type="checkbox" checked={all} onChange={() => setTicked((now) => toggleClass(now, entry.slots))} className="w-4 h-4 accent-brand cursor-pointer" />
                        {t('grading.fin.reopen.all')}
                      </label>
                    </div>
                    <ul className="space-y-1">
                      {entry.slots.map((slot) => (
                        <li key={slot.classSubjectId}>
                          <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ticked.has(slot.classSubjectId)}
                              onChange={() => tick(slot.classSubjectId)}
                              className="w-4 h-4 mt-0.5 shrink-0 accent-brand cursor-pointer"
                            />
                            <span className="min-w-0 break-words">
                              <span className="font-bold text-slate-900">{`${slot.subject.code} - ${slot.subject.name}`}</span>
                              {slot.teacher?.fullName && (
                                <span className="text-slate-500">
                                  <span className="mx-1.5 text-slate-300" aria-hidden="true">
                                    /
                                  </span>
                                  {slot.teacher.fullName}
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
          {ticked.size > 0 && <p className="text-xs font-semibold text-slate-500">{t('grading.fin.reopen.picked', { n: ticked.size })}</p>}
        </fieldset>

        {failed && (
          <p className="flex items-start gap-2.5 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-3 text-[12.5px] font-semibold text-rose-700 leading-relaxed" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            {failed}
          </p>
        )}

        <div className={modalActions}>
          <button type="button" onClick={onClose} disabled={busy} className={modalCancelClass(busy)}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={handleSubmit} disabled={busy} className={modalConfirmClass('danger', busy)}>
            {busy ? t('grading.fin.reopen.busy') : t('grading.fin.reopen.confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReopenSemesterDialog;
