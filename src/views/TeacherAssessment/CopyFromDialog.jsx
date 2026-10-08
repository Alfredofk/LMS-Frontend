import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, ExternalLink, FolderOpen, X } from 'lucide-react';

import { modalActions, modalCancelClass, modalConfirmClass } from '../../components/ui/modalStyles';
import { useT } from '../../i18n/LanguageContext';
import { assessmentErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { assessmentService } from '../../services/assessmentService';
import StateWord from './StateWord';
import WindowChoice from './WindowChoice';
import {
  copyBody,
  emptyWindow,
  semesterOf,
  semesterSpan,
  sourcesBySemester,
  windowErrors,
  windowText,
} from './teacherAssessment';

/*
  "Ambil dari penilaian lain" (backend 0bb4598/abbb3d5; owner 2026-10-08): what
  GET /assessments/class-subjects/:id/copy-sources offers this class subject -
  the teacher's own of any class and semester, and anyone's of a semester that
  is over (`canManage: false`), of the same subject and grade, latest semester
  first. One is picked and copied here as a draft (POST /:sourceId/copies with
  this class subject alone). From the same semester its window may be kept;
  from another a new window inside this semester is needed. "Lihat" opens the
  source read only in a new tab.

  @param classSubjectId  this class subject, the target
  @param semesterId      its semester
  @param zone            the school's zone
  @param onCopied        (copies) => void
  @param onClose         () => void
*/
export const CopyFromDialog = ({ classSubjectId, semesterId, zone, onCopied, onClose }) => {
  const { t, lang } = useT();
  const baseId = useId();
  /* undefined: reading · { groups, span, semester } · { error } */
  const [data, setData] = useState(undefined);
  const [pickedId, setPickedId] = useState(null);
  const [keep, setKeep] = useState(true);
  const [when, setWhen] = useState(emptyWindow);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const openerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([assessmentService.copySources(classSubjectId), academicsService.academicYears().catch(() => null)])
      .then(([sources, years]) => {
        if (cancelled) return;
        const semester = semesterOf(years, semesterId);
        setData({ sources, groups: sourcesBySemester(sources), semester, span: semester ? semesterSpan(semester, zone) : null });
      })
      .catch((err) => !cancelled && setData({ error: assessmentErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [classSubjectId, semesterId, zone, t]);

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

  const picked = data?.sources?.find((source) => source.id === pickedId) ?? null;
  const required = Boolean(picked) && picked.classSubject.semester.id !== semesterId;
  const newWindow = required || !keep;

  const submit = async () => {
    if (!picked) return;
    if (newWindow) {
      const found = windowErrors(when, { zone, spans: data.span ? [data.span] : [] });
      setErrors(found);
      if (Object.keys(found).length) return;
    }
    setBusy(true);
    setFailure(null);
    try {
      onCopied(await assessmentService.copy(picked.id, copyBody([classSubjectId], newWindow ? when : null, zone)));
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
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full p-5 sm:p-6 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-extrabold text-slate-900">
              {t('tasm.from.title')}
            </h2>
            <p className="text-xs font-semibold text-slate-500">{t('tasm.from.body')}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label={t('common.close')} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {data === undefined ? (
          <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />
        ) : data.error ? (
          <p className="text-sm font-semibold text-rose-700" role="alert">
            {data.error}
          </p>
        ) : data.sources.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-2 py-8">
            <FolderOpen className="w-8 h-8 text-slate-400" aria-hidden="true" />
            <p className="text-sm font-bold text-slate-700">{t('tasm.from.empty')}</p>
            <p className="text-xs font-semibold text-slate-500 max-w-sm">{t('tasm.from.emptyHint')}</p>
          </div>
        ) : (
          <>
            <div role="radiogroup" aria-labelledby={titleId} className="space-y-3">
              {data.groups.map((group) => (
                <div key={group.key} className="space-y-1.5">
                  <p className="text-xs font-bold text-slate-500">
                    {t('tasm.copy.semester', { n: group.ordinal, year: group.academicYear })}
                    {group.key === semesterId && ` - ${t('tasm.copy.sameSemester')}`}
                  </p>
                  <ul className="rounded-xl border border-slate-100 divide-y divide-slate-100">
                    {group.rows.map((source) => (
                      <li key={source.id} className="flex items-start gap-2.5 px-3 py-2.5">
                        <input
                          type="radio"
                          id={`${baseId}-src-${source.id}`}
                          name={`${baseId}-source`}
                          checked={pickedId === source.id}
                          disabled={busy}
                          onChange={() => {
                            setPickedId(source.id);
                            setKeep(true);
                            setErrors({});
                            setFailure(null);
                          }}
                          className="mt-1 w-4 h-4 accent-brand cursor-pointer"
                        />
                        <label htmlFor={`${baseId}-src-${source.id}`} className="min-w-0 flex-1 space-y-0.5 cursor-pointer">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="min-w-0 text-sm font-bold text-slate-800 break-words">{source.title}</span>
                            <StateWord assessment={source} t={t} />
                          </span>
                          <span className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] font-semibold text-slate-500">
                            <span>{source.classSubject.class.name}</span>
                            <span>{t(`tasm.type.${source.type}`)}</span>
                            <span>{t(`tasm.mode.${source.mode}`)}</span>
                            {source.mode === 'ONLINE' && <span>{t('tasm.count', { n: source.questionCount, points: source.totalPoints })}</span>}
                            <span className="tabular-nums">{windowText(source, zone, lang)}</span>
                            {!source.canManage && <span>{t('tasm.from.otherTeacher')}</span>}
                          </span>
                        </label>
                        <a
                          href={`/teacher/courses/${classSubjectId}/penilaian/${source.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                          {t('tasm.picker.show')}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {picked && (
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
                sourceText={windowText(picked, zone, lang)}
                requiredKey="tasm.from.windowRequired"
                bounds={data.span ? { min: data.span.first, max: data.span.last } : null}
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
          <button type="button" onClick={submit} disabled={busy || !picked} className={modalConfirmClass('brand', busy)}>
            <Copy className="w-4 h-4 inline -mt-0.5 mr-1.5" aria-hidden="true" />
            {busy ? t('common.loading') : t('tasm.from.submit')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CopyFromDialog;
