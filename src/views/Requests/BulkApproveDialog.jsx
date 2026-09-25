import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

import SelectField from '../../components/ui/SelectField';
import { membershipReviewService } from '../../services/membershipReviewService';
import { academicsService } from '../../services/academicsService';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage, decisionErrorMessage } from '../../i18n/apiError';
import { ROLE_LABEL_KEY, releasableInPov } from '../../constants/roles';
import { classesFor, groupForApproval, planCalls, summarise } from './bulk';

/*
  Releasing the ticked requests, in one go.

  Three steps in one dialog: choose a class for each grade of students ticked
  (the owner's choice, 2026-09-24 — the backend takes one class per call), run
  the calls, then say what happened. A mixed outcome is normal, not an error:
  somebody may have decided one of them a moment ago, or a class may be full of
  a NISN already taken. Each failure is named with the applicant and the reason.

  Built like RemoveMemberDialog: portal, alertdialog, focus handed back, Escape
  and the backdrop answering "no" — except while the calls run.

  Render it only while open, keyed on nothing: mounting starts it fresh.
*/

export const BulkApproveDialog = ({ requests, onClose, onDone }) => {
  const { t } = useT();
  const { membership, activeRole } = useAuth();

  const groups = groupForApproval(requests, activeRole);
  const needsClasses = groups.students.length > 0;

  const [classes, setClasses] = useState(null);
  const [classesError, setClassesError] = useState(null);
  const [classByGrade, setClassByGrade] = useState({});
  const [phase, setPhase] = useState('choose');
  const [outcome, setOutcome] = useState(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);

  const nameOf = (id) => requests.find((request) => request.id === id)?.applicant?.fullName ?? '—';

  useEffect(() => {
    openerRef.current = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (phase === 'running' || e.key !== 'Escape') return;
      e.preventDefault();
      if (phase === 'done') onDone();
      else onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [phase, onClose, onDone]);

  /* The reader's classes, once, when a student is among the ticked. One
     possible class for a grade is chosen for them, still shown in the select. */
  useEffect(() => {
    if (!needsClasses) return;
    academicsService
      .classes()
      .then((list) => {
        setClasses(list);
        const preset = {};
        for (const { grade } of groupForApproval(requests, activeRole).students) {
          const { open } = classesFor(list, membership?.id, grade);
          if (open.length === 1) preset[grade] = open[0].id;
        }
        setClassByGrade(preset);
      })
      .catch((err) => setClassesError(apiErrorMessage(err, t)));
    // Once per opening; the ticked requests do not change while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const everyGradeHasClass = groups.students.every(({ grade }) => classByGrade[grade]);
  const ready = !needsClasses || (classes !== null && everyGradeHasClass);

  /* Released alongside: a role this reader may release from their other desk
     goes with the request, the same thing the single review warns about. */
  const alongside = requests.some((request) =>
    (request.roles ?? []).some(
      (entry) => entry.canRelease && !releasableInPov(request, activeRole).includes(entry)
    )
  );

  const run = async () => {
    setPhase('running');
    const lists = [];
    for (const { ids, classId } of planCalls(groups, classByGrade)) {
      try {
        const answer = await membershipReviewService.approveMany(ids, classId);
        lists.push(answer?.results ?? []);
      } catch (err) {
        /* The whole call was refused (a session gone, the network): every id in
           it is reported with that one reason. */
        lists.push(ids.map((id) => ({ id, ok: false, error: { code: err.code, message: err.message } })));
      }
    }
    setOutcome(summarise(lists));
    setPhase('done');
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={phase === 'running' ? undefined : phase === 'done' ? onDone : onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="bulk-approve-title"
        aria-busy={phase === 'running'}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full max-h-[90dvh] overflow-y-auto p-6 sm:p-7 space-y-4 text-left focus:outline-none"
      >
        {phase === 'done' && outcome ? (
          <>
            <div className="flex items-start gap-3">
              {outcome.failed.length === 0 ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" aria-hidden="true" />
              )}
              <div className="space-y-1 min-w-0">
                <h2 id="bulk-approve-title" className="text-base font-extrabold text-slate-900 tracking-tight">
                  {t('requests.bulk.done.title', { n: outcome.released })}
                </h2>
                {outcome.failed.length > 0 && (
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {t('requests.bulk.done.failed', { n: outcome.failed.length })}
                  </p>
                )}
              </div>
            </div>

            {outcome.failed.length > 0 && (
              <ul className="space-y-2">
                {outcome.failed.map((entry) => (
                  <li key={entry.id} className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5">
                    <p className="text-xs font-extrabold text-slate-800 break-words">{nameOf(entry.id)}</p>
                    <p className="text-[11px] font-semibold text-rose-700 break-words mt-0.5">
                      {/* Told apart on the server's own words — a NISN already at this
                          school is not "decided by somebody else" (decisionErrorMessage). */}
                      {decisionErrorMessage(entry.error ?? {}, t)}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={onDone}
                className="px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-brand hover:bg-brand-deep shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {t('requests.bulk.done.close')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <h2 id="bulk-approve-title" className="text-base font-extrabold text-slate-900 tracking-tight">
                {t('requests.bulk.title', { n: requests.length })}
              </h2>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">{t('requests.bulk.body')}</p>
              {alongside && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 font-semibold leading-relaxed">
                  {t('requests.bulk.alongside')}
                </p>
              )}
            </div>

            {needsClasses && (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                {classesError ? (
                  <p className="text-xs font-semibold text-red-600" role="alert">{classesError}</p>
                ) : classes === null ? (
                  <div className="h-12 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />
                ) : (
                  groups.students.map(({ grade, ids }) => {
                    const { open, closedOnly } = classesFor(classes, membership?.id, grade);
                    const label = t('requests.bulk.classFor', { n: ids.length, grade: grade ?? '—' });
                    return open.length === 0 ? (
                      <p
                        key={grade}
                        className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 leading-relaxed"
                      >
                        {label} — {t(closedOnly ? 'requests.class.onlyClosed' : 'requests.class.none', { n: grade ?? '—' })}{' '}
                        {t('requests.bulk.untick')}
                      </p>
                    ) : (
                      <SelectField
                        key={grade}
                        id={`bulkClass-${grade}`}
                        label={label}
                        value={classByGrade[grade] ?? ''}
                        disabled={phase === 'running'}
                        onChange={(e) => setClassByGrade((prev) => ({ ...prev, [grade]: e.target.value }))}
                      >
                        <option value="" disabled>
                          {t('requests.class.placeholder')}
                        </option>
                        {open.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name} · {entry.academicYear?.label}
                          </option>
                        ))}
                      </SelectField>
                    );
                  })
                )}
              </div>
            )}

            {/* Who is on the list, so nobody releases a name they did not mean to. */}
            <details className="text-xs text-slate-600">
              <summary className="cursor-pointer font-bold text-slate-500 select-none">
                {t('requests.bulk.who', { n: requests.length })}
              </summary>
              <ul className="mt-2 space-y-1 pl-1">
                {requests.map((request) => (
                  <li key={request.id} className="break-words">
                    {request.applicant?.fullName ?? '—'}
                    <span className="text-slate-500">
                      {' · '}
                      {/* A further child reads as such, the way its queue row does. */}
                      {request.status !== 'PENDING' && (request.children ?? []).some((link) => link.status === 'PENDING')
                        ? t('requests.link.row', {
                            names: request.children.filter((link) => link.status === 'PENDING').map((link) => link.student?.fullName).join(', '),
                          })
                        : (request.roles ?? []).map((entry) => t(ROLE_LABEL_KEY[entry.role] ?? 'requests.role.unknown')).join(', ')}
                      {request.student?.gradeLevel != null ? ` · ${t('requests.field.grade', { n: request.student.gradeLevel })}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </details>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={phase === 'running'}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold text-slate-600 border border-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                  phase === 'running' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'
                }`}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={run}
                disabled={!ready || phase === 'running'}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 bg-brand focus-visible:ring-brand ${
                  !ready || phase === 'running' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-brand-deep cursor-pointer'
                }`}
              >
                {phase === 'running' ? t('common.loading') : t('requests.bulk.confirm', { n: requests.length })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default BulkApproveDialog;
