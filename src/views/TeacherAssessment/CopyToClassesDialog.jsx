import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, X } from 'lucide-react';

import { modalActions, modalCancelClass, modalConfirmClass } from '../../components/ui/modalStyles';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { assessmentService } from '../../services/assessmentService';
import { readMyTeaching } from '../Course/readMyTeaching';
import WindowChoice from './WindowChoice';
import {
  MAX_COPY_TARGETS,
  copyBody,
  copyTargets,
  emptyWindow,
  needsNewWindow,
  semesterSpan,
  windowErrors,
  windowText,
} from './teacherAssessment';

/*
  "Salin ke kelas lain" (backend 0bb4598, POST /assessments/:id/copies; owner
  2026-10-08). The targets are the teacher's own live class subjects of the
  source's subject and grade in an open semester (copyTargets), grouped by
  semester, its own class left out. Copies in the source's semester may keep its
  window; a target in another semester needs a new one, which must fit every
  semester ticked - so one semester at a time, since semesters never overlap.
  All targets or none, as the server does it.

  @param source    the assessment detail
  @param zone      the school's zone
  @param onCopied  (copies) => void - the drafts made, each a detail
  @param onClose   () => void
*/
export const CopyToClassesDialog = ({ source, zone, onCopied, onClose }) => {
  const { t, lang } = useT();
  const { membership } = useAuth();
  const baseId = useId();
  /* undefined: reading · { groups } · { error } */
  const [data, setData] = useState(undefined);
  const [ticked, setTicked] = useState(() => new Set());
  const [keep, setKeep] = useState(true);
  const [when, setWhen] = useState(emptyWindow);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const openerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([readMyTeaching(membership?.id), academicsService.academicYears()])
      .then(([teaching, years]) => !cancelled && setData({ groups: copyTargets(teaching.rows, source, years) }))
      .catch((err) => !cancelled && setData({ error: assessmentErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [membership?.id, source, t]);

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

  const groups = useMemo(() => data?.groups ?? [], [data]);
  const picked = groups.flatMap((group) => group.rows.filter((row) => ticked.has(row.id)).map((row) => ({ row, semester: group.semester })));
  const pickedSemesters = [...new Map(picked.map((item) => [item.semester.id, item.semester])).values()];
  const required = needsNewWindow(pickedSemesters.map((semester) => semester.id), source.classSubject.semester.id);
  const newWindow = required || !keep;
  const one = pickedSemesters.length === 1 ? pickedSemesters[0] : null;
  /* Semesters never overlap, so one window cannot fit two: copy to one semester at a time. */
  const split = pickedSemesters.length > 1;

  const toggle = (id) => {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_COPY_TARGETS) next.add(id);
      return next;
    });
    setFailure(null);
  };

  const submit = async () => {
    if (picked.length === 0 || split) return;
    if (newWindow) {
      const found = windowErrors(when, { zone, spans: pickedSemesters.map((semester) => semesterSpan(semester, zone)) });
      setErrors(found);
      if (Object.keys(found).length) return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const copies = await assessmentService.copy(source.id, copyBody(picked.map((item) => item.row.id), newWindow ? when : null, zone));
      onCopied(copies);
    } catch (err) {
      setBusy(false);
      setFailure(assessmentErrorMessage(err, t));
    }
  };

  const titleId = `${baseId}-title`;

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
              {t('tasm.copy.title')}
            </h2>
            <p className="text-xs font-semibold text-slate-500 break-words">{t('tasm.copy.body', { title: source.title })}</p>
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
        ) : groups.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm font-semibold text-slate-600">
            {t('tasm.copy.noTargets', { subject: source.classSubject.subject.code, grade: source.classSubject.class.gradeLevel })}
          </p>
        ) : (
          <>
            <fieldset className="space-y-3">
              <legend className="block text-sm font-bold text-slate-700">{t('tasm.copy.targets')}</legend>
              {groups.map((group) => (
                <div key={group.semester.id} className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-500">
                    {t('tasm.copy.semester', { n: group.semester.ordinal, year: group.semester.academicYear.label })}
                    {group.semester.id === source.classSubject.semester.id && ` - ${t('tasm.copy.sameSemester')}`}
                  </p>
                  <ul className="rounded-xl border border-slate-100 divide-y divide-slate-100">
                    {group.rows.map((row) => (
                      <li key={row.id}>
                        <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none">
                          <input type="checkbox" checked={ticked.has(row.id)} disabled={busy} onChange={() => toggle(row.id)} className="w-4 h-4 accent-brand cursor-pointer" />
                          <span className="text-sm font-semibold text-slate-800">{row.class?.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-[11px] font-medium text-slate-500">{t('tasm.copy.targetsHint')}</p>
            </fieldset>

            {split && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700" role="status">
                {t('tasm.copy.oneSemester')}
              </p>
            )}
            {picked.length > 0 && !split && (
              <WindowChoice
                required={required}
                keep={keep}
                onKeep={(value) => {
                  setKeep(value);
                  setErrors({});
                }}
                value={when}
                onChange={(key, value) => {
                  setWhen((prev) => ({ ...prev, [key]: value }));
                  setErrors({});
                }}
                errors={errors}
                sourceText={windowText(source, zone, lang)}
                bounds={one ? { min: String(one.startDate).slice(0, 10), max: String(one.endDate).slice(0, 10) } : null}
                zone={zone}
                disabled={busy}
                t={t}
              />
            )}
            <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{t('tasm.copy.result')}</p>
          </>
        )}

        {failure && (
          <p className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
            {failure}
          </p>
        )}

        <div className={modalActions}>
          <button type="button" onClick={onClose} disabled={busy} className={modalCancelClass(busy)}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={submit} disabled={busy || picked.length === 0 || split} className={modalConfirmClass('brand', busy)}>
            <Copy className="w-4 h-4 inline -mt-0.5 mr-1.5" aria-hidden="true" />
            {busy ? t('common.loading') : t('tasm.copy.submit', { n: picked.length })}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CopyToClassesDialog;
