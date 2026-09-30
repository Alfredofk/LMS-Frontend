import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import SelectField from '../../components/ui/SelectField';
import { academicsService } from '../../services/academicsService';
import { useT } from '../../i18n/LanguageContext';
import { isStaleAssignment, subjectsErrorMessage } from '../../i18n/apiError';
import { changeErrors, replacementTeachers } from './subjects';

/*
  Changing an ACTIVE assignment while its teacher stays in the school — backend
  85bc687, teaching-and-learning 10 (owner, 2026-09-30). One dialog, two ways:

  - **Replace the teacher** — `POST /academics/class-subjects/:id/replace`. The
    old row ends and the new teacher is ACTIVE at once, in one transaction, and
    takes over the timetable and every meeting still ahead.
  - **End it** — `POST /academics/class-subjects/:id/end`. Whether the subject
    stops here (meetings ahead cancelled) or a successor follows (they wait) is
    asked every time, with no default: the backend has none, on purpose.

  A reason is required either way (3–500) and is shown to the teacher. There is
  no second confirmation: the summary and the button say what will happen
  (owner, 2026-09-30). A row ended or replaced elsewhere goes to `onStale`.
*/
export const ChangeAssignmentDialog = ({ row, boardClass, semester, teachers, onClose, onChanged, onStale }) => {
  const { t } = useT();
  const baseId = useId();
  const [mode, setMode] = useState(null);
  const [teacherId, setTeacherId] = useState('');
  const [subjectStops, setSubjectStops] = useState(null);
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const openerRef = useRef(null);
  const firstRef = useRef(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    firstRef.current?.querySelector('input')?.focus();
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

  const candidates = teachers === null ? null : replacementTeachers(teachers, row);
  const successor = (candidates ?? []).find((entry) => entry.membershipId === teacherId) ?? null;
  const names = { teacher: row.teacher.fullName, subject: row.subject.name, className: boardClass.name };

  const clear = (field) => setErrors((prev) => ({ ...prev, [field]: null, global: null }));

  const handleSubmit = async () => {
    const found = changeErrors({ mode, teacherId, subjectStops, reason });
    setErrors(Object.fromEntries(Object.entries(found).map(([field, key]) => [field, t(key)])));
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const trimmed = reason.trim();
      if (mode === 'REPLACE') {
        await academicsService.replaceClassSubject(row.classSubjectId, { reason: trimmed, teacherMembershipId: teacherId });
        onChanged(t('subjects.change.done.replace', { ...names, successor: successor?.fullName ?? '' }));
      } else {
        await academicsService.endClassSubject(row.classSubjectId, { reason: trimmed, subjectStops });
        onChanged(t(subjectStops ? 'subjects.change.done.stop' : 'subjects.change.done.wait', names));
      }
    } catch (err) {
      if (isStaleAssignment(err)) {
        onStale(t('subjects.change.error.gone'));
        return;
      }
      setBusy(false);
      setErrors({ global: subjectsErrorMessage(err, t) });
    }
  };

  const ids = {
    title: `${baseId}-title`,
    body: `${baseId}-body`,
    mode: `${baseId}-mode`,
    stops: `${baseId}-stops`,
    reason: `${baseId}-reason`,
    hint: `${baseId}-hint`,
  };

  /* One choice drawn as a card: a real radio inside a label, so the keyboard,
     the screen reader and the click all work without extra wiring. */
  const choice = (name, value, checked, onPick, title, body) => (
    <label
      className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
        busy ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
      } ${checked ? 'border-brand bg-brand-tint' : 'border-slate-200 hover:bg-slate-50'}`}
    >
      <input
        type="radio"
        name={`${baseId}-${name}`}
        value={value}
        checked={checked}
        disabled={busy}
        onChange={onPick}
        className="mt-0.5 accent-brand shrink-0"
      />
      <span className="min-w-0">
        <span className="block text-xs font-extrabold text-slate-800">{title}</span>
        <span className="block text-[11px] font-semibold text-slate-500 leading-relaxed mt-0.5">{body}</span>
      </span>
    </label>
  );

  const stops = mode === 'END' && subjectStops === true;
  /* Replacing with nobody to replace with: no reason box and no button, only the
     sentence saying why (found as a Vice Principal, 2026-09-30). */
  const noSuccessor = mode === 'REPLACE' && candidates?.length === 0;
  const confirmKey =
    mode === 'REPLACE' ? 'subjects.change.confirm.replace' : stops ? 'subjects.change.confirm.stop' : 'subjects.change.confirm.end';

  let summary = null;
  if (mode === 'REPLACE' && successor) summary = t('subjects.change.summary.replace', { ...names, successor: successor.fullName });
  if (mode === 'END' && subjectStops === false) summary = t('subjects.change.summary.wait', names);
  if (stops) summary = t('subjects.change.summary.stop', names);

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-describedby={ids.body}
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
      >
        <div className="space-y-2">
          <h2 id={ids.title} className="text-base font-extrabold text-slate-900 tracking-tight break-words">
            {t('subjects.change.title', { subject: row.subject.name, className: boardClass.name })}
          </h2>
          <p id={ids.body} className="text-xs text-slate-500 font-medium leading-relaxed">
            {t('subjects.change.body', { teacher: row.teacher.fullName, n: semester.ordinal, year: semester.academicYear })}
          </p>
        </div>

        <fieldset ref={firstRef} className="space-y-2" aria-describedby={errors.mode ? `${ids.mode}-error` : undefined}>
          <legend id={ids.mode} className="text-sm font-semibold text-slate-700 mb-1.5">
            {t('subjects.change.modeLabel')}
          </legend>
          {choice(
            'mode',
            'REPLACE',
            mode === 'REPLACE',
            () => {
              setMode('REPLACE');
              clear('mode');
            },
            t('subjects.change.mode.replace'),
            t('subjects.change.mode.replaceBody')
          )}
          {choice(
            'mode',
            'END',
            mode === 'END',
            () => {
              setMode('END');
              clear('mode');
            },
            t('subjects.change.mode.end'),
            t('subjects.change.mode.endBody')
          )}
          {errors.mode && (
            <p id={`${ids.mode}-error`} className="text-xs text-red-600 font-semibold" role="alert">
              {errors.mode}
            </p>
          )}
        </fieldset>

        {mode === 'REPLACE' &&
          (candidates === null ? (
            <div className="h-12 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />
          ) : candidates.length === 0 ? (
            <p className="text-xs font-semibold text-slate-600 leading-relaxed">{t('subjects.change.noTeachers')}</p>
          ) : (
            <SelectField
              id={`${baseId}-teacher`}
              label={t('subjects.change.successor')}
              value={teacherId}
              disabled={busy}
              error={errors.teacher}
              onChange={(e) => {
                setTeacherId(e.target.value);
                clear('teacher');
              }}
            >
              <option value="">{t('subjects.assign.teacherPlaceholder')}</option>
              {candidates.map((entry) => (
                <option key={entry.membershipId} value={entry.membershipId}>
                  {entry.fullName}
                  {entry.membershipId === boardClass.homeroomTeacher?.membershipId ? ` (${t('subjects.assign.homeroomMark')})` : ''}
                </option>
              ))}
            </SelectField>
          ))}

        {mode === 'END' && (
          <fieldset className="space-y-2" aria-describedby={errors.subjectStops ? `${ids.stops}-error` : undefined}>
            <legend id={ids.stops} className="text-sm font-semibold text-slate-700 mb-1.5">
              {t('subjects.change.stopsLabel')}
            </legend>
            {choice(
              'stops',
              'wait',
              subjectStops === false,
              () => {
                setSubjectStops(false);
                clear('subjectStops');
              },
              t('subjects.change.stops.wait'),
              t('subjects.change.stops.waitBody')
            )}
            {choice(
              'stops',
              'stop',
              subjectStops === true,
              () => {
                setSubjectStops(true);
                clear('subjectStops');
              },
              t('subjects.change.stops.stop'),
              t('subjects.change.stops.stopBody')
            )}
            {errors.subjectStops && (
              <p id={`${ids.stops}-error`} className="text-xs text-red-600 font-semibold" role="alert">
                {errors.subjectStops}
              </p>
            )}
          </fieldset>
        )}

        {mode && !noSuccessor && (
          <div className="space-y-1.5">
            <label htmlFor={ids.reason} className="text-sm font-semibold text-slate-700 block">
              {t('subjects.change.reason')}
            </label>
            <textarea
              id={ids.reason}
              rows={3}
              maxLength={500}
              value={reason}
              disabled={busy}
              onChange={(e) => {
                setReason(e.target.value);
                clear('reason');
              }}
              aria-invalid={!!errors.reason}
              aria-describedby={ids.hint}
              className="block w-full rounded-xl border border-slate-200 hover:border-slate-300 bg-white py-2.5 px-4 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50"
            />
            {errors.reason ? (
              <p id={ids.hint} className="text-xs text-red-600 font-semibold leading-relaxed" role="alert">
                {errors.reason}
              </p>
            ) : (
              <p id={ids.hint} className="text-[11px] text-slate-500 font-medium leading-relaxed">
                {t('subjects.change.reasonHint', { teacher: row.teacher.fullName })}
              </p>
            )}
          </div>
        )}

        {summary && <p className="text-xs font-semibold text-slate-600 leading-relaxed">{summary}</p>}

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
          {mode && !noSuccessor && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                stops ? 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500' : 'bg-brand hover:bg-brand-deep focus-visible:ring-brand'
              } ${busy ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {busy ? t('common.loading') : t(confirmKey)}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ChangeAssignmentDialog;
