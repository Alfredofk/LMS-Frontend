import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

import SelectField from '../../components/ui/SelectField';
import { academicsService } from '../../services/academicsService';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { movesErrorMessage } from '../../i18n/apiError';
import { validateOptionalReason } from '../../utils/validation';
import { groupTargets } from './moves';

/*
  Moving one student out of the reader's class — ticket 16, backend `89d1fc1`.

  The choices are `GET /academics/classes/:id/move-targets`: every other class of
  the same academic year, grouped by grade. **Another grade may be chosen**
  (owner, 2026-09-26: a student released into the wrong grade is put right here),
  and when it is, the dialog says so before anything is sent. A class with no
  homeroom teacher is listed but cannot be picked — nobody there could accept.

  What happens next is said before the press, because it differs: the other
  class's homeroom teacher decides — unless the reader is homeroom of that class
  too, when the server moves the student at once (nobody else could decide).

  The reason is optional, as in the backend; typed, it is 3–500 characters, and
  the receiving teacher reads it. Every refusal stays inside the dialog.
*/
export const MoveStudentDialog = ({ student, fromClass, onClose, onRequested }) => {
  const { t } = useT();
  const { membership } = useAuth();
  const [targets, setTargets] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [choice, setChoice] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const openerRef = useRef(null);
  const selectWrapRef = useRef(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    return () => {
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    academicsService
      .moveTargets(fromClass.id)
      .then((list) => !cancelled && setTargets(list))
      .catch((err) => !cancelled && setLoadError(movesErrorMessage(err, t)));
    return () => {
      cancelled = true;
    };
  }, [fromClass.id, t]);

  /* Focus the select once it exists — the first thing to decide. */
  useEffect(() => {
    if (targets) selectWrapRef.current?.querySelector('select')?.focus();
  }, [targets]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (busy || e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [busy, onClose]);

  const chosen = targets?.find((target) => target.id === choice) ?? null;
  const takesItAtOnce = chosen && chosen.homeroomTeacher?.membershipId === membership?.id;
  const anyOpen = targets?.some((target) => target.acceptsMoves);

  const handleSubmit = async () => {
    const next = {};
    if (!chosen) next.choice = t('moves.request.chooseRequired');
    const reasonFail = validateOptionalReason(reason);
    if (reasonFail) next.reason = t(reasonFail.key, reasonFail.vars);
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const trimmed = reason.trim();
      const move = await academicsService.requestMove({
        studentProfileId: student.studentProfileId,
        toClassId: chosen.id,
        ...(trimmed ? { reason: trimmed } : {}),
      });
      onRequested(move);
    } catch (err) {
      setBusy(false);
      setErrors({ global: movesErrorMessage(err, t) });
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="move-student-title"
        aria-describedby="move-student-body"
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
      >
        <div className="space-y-2">
          <h2 id="move-student-title" className="text-base font-extrabold text-slate-900 tracking-tight break-words">
            {t('moves.request.title', { name: student.fullName })}
          </h2>
          <p id="move-student-body" className="text-xs text-slate-500 font-medium leading-relaxed">
            {t('moves.request.body', { from: fromClass.name })}
          </p>
        </div>

        {loadError ? (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
            {loadError}
          </div>
        ) : targets === null ? (
          <div className="h-12 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />
        ) : !anyOpen ? (
          <p className="text-xs font-semibold text-slate-600 leading-relaxed">{t('moves.request.noTargets')}</p>
        ) : (
          <div ref={selectWrapRef} className="space-y-4">
            <SelectField
              id="move-target"
              label={t('moves.request.to')}
              value={choice}
              disabled={busy}
              error={errors.choice}
              onChange={(e) => {
                setChoice(e.target.value);
                setErrors((prev) => ({ ...prev, choice: null, global: null }));
              }}
            >
              <option value="">{t('moves.request.toPlaceholder')}</option>
              {groupTargets(targets).map((group) => (
                <optgroup key={group.grade} label={t('classes.grade', { n: group.grade })}>
                  {group.classes.map((target) => (
                    <option key={target.id} value={target.id} disabled={!target.acceptsMoves}>
                      {target.acceptsMoves
                        ? `${target.name} — ${target.homeroomTeacher.fullName}`
                        : `${target.name} — ${t('moves.request.noHomeroom')}`}
                    </option>
                  ))}
                </optgroup>
              ))}
            </SelectField>

            {chosen && chosen.gradeLevel !== fromClass.gradeLevel && (
              <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-800 leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                {t('moves.request.gradeChange', { from: fromClass.gradeLevel, to: chosen.gradeLevel })}
              </p>
            )}

            {chosen && (
              <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                {takesItAtOnce
                  ? t('moves.request.atOnce', { to: chosen.name })
                  : t('moves.request.waits', { name: chosen.homeroomTeacher.fullName })}
              </p>
            )}

            <div className="space-y-1.5">
              <label htmlFor="move-reason" className="text-sm font-semibold text-slate-700 block">
                {t('moves.request.reason')}
              </label>
              <textarea
                id="move-reason"
                rows={3}
                maxLength={500}
                value={reason}
                disabled={busy}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (errors.reason || errors.global) setErrors((prev) => ({ ...prev, reason: null, global: null }));
                }}
                aria-invalid={!!errors.reason}
                aria-describedby="move-reason-hint"
                className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50"
              />
              <p id="move-reason-hint" className={`text-xs font-medium ${errors.reason ? 'text-red-500' : 'text-slate-500'}`}>
                {errors.reason || t('moves.request.reasonHint')}
              </p>
            </div>
          </div>
        )}

        {errors.global && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
            {errors.global}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold text-slate-600 border border-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
              busy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'
            }`}
          >
            {t('common.cancel')}
          </button>
          {anyOpen && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 bg-brand hover:bg-brand-deep focus-visible:ring-brand ${
                busy ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'
              }`}
            >
              {busy ? t('common.loading') : t(takesItAtOnce ? 'moves.request.moveNow' : 'moves.request.send')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MoveStudentDialog;
