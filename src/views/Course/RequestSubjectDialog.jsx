import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BookPlus } from 'lucide-react';

import { modalActions, modalCancelClass, modalConfirmClass } from '../../components/ui/modalStyles';
import ModalHeading from '../../components/ui/ModalHeading';
import SelectField from '../../components/ui/SelectField';
import { academicsService } from '../../services/academicsService';
import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { subjectsErrorMessage } from '../../i18n/apiError';
import { formatDay } from '../Classes/format';
import { requestChoices, requestableSemesters } from './teaching';

/*
  A teacher asks to teach a subject in a class for a semester (owner, 2026-10-04) -
  `POST /academics/class-subjects` { classId, subjectId, semesterId }.

  Only what the server would take is offered: an OPEN semester of an ACTIVE year
  whose sign-up deadline has not passed (`requestableSemesters`), and per class the
  subjects the school uses that nobody teaches or waits for there
  (`requestChoices`, from the semester's board). The Principal approves it - or,
  when the reader is that class's homeroom teacher, it is theirs at once (the
  server decides; the dialog says so beforehand). Every refusal stays inside.
*/
export const RequestSubjectDialog = ({ onClose, onRequested }) => {
  const { t, lang } = useT();
  const { membership } = useAuth();
  const [years, setYears] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [pickedSemesterId, setSemesterId] = useState('');
  /* The board read for one semester: `{ semesterId, board }`. */
  const [boardOf, setBoardOf] = useState(null);
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const openerRef = useRef(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
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

  useEffect(() => {
    let cancelled = false;
    Promise.all([academicsService.academicYears(), academicsService.subjects()])
      .then(([yearList, subjectList]) => {
        if (cancelled) return;
        setYears(yearList);
        setCatalog(subjectList);
      })
      .catch((err) => !cancelled && setErrors({ global: subjectsErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [t]);

  const semesters = useMemo(() => requestableSemesters(years), [years]);
  const open = semesters.filter((semester) => !semester.closed);

  /* One semester open: chosen for the reader. */
  const semesterId = pickedSemesterId || (open.length === 1 ? open[0].id : '');

  useEffect(() => {
    if (!semesterId) return undefined;
    let cancelled = false;
    academicsService
      .subjectBoard(semesterId)
      .then((answer) => !cancelled && setBoardOf({ semesterId, board: answer }))
      .catch((err) => !cancelled && setErrors({ global: subjectsErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [semesterId, t]);
  const board = boardOf?.semesterId === semesterId ? boardOf.board : null;

  const choices = useMemo(() => (board && catalog ? requestChoices(board, catalog) : null), [board, catalog]);
  const choice = choices?.find((entry) => entry.class.id === classId) ?? null;
  const subject = choice?.subjects.find((entry) => entry.id === subjectId) ?? null;
  const semester = semesters.find((entry) => entry.id === semesterId) ?? null;
  const ownClass = Boolean(choice && membership?.id && choice.class.homeroomTeacher?.membershipId === membership.id);

  const handleSend = async () => {
    const next = {};
    if (!semester) next.semester = t('teach.request.semesterRequired');
    if (!choice) next.class = t('teach.request.classRequired');
    if (!subject) next.subject = t('subjects.assign.subjectRequired');
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const created = await academicsService.requestClassSubject({ classId: choice.class.id, subjectId: subject.id, semesterId: semester.id });
      onRequested(created);
    } catch (err) {
      setBusy(false);
      setErrors({ global: subjectsErrorMessage(err, t) });
    }
  };

  const loading = years === null && !errors.global;
  const nothingOpen = years !== null && open.length === 0;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-subject-title"
        aria-describedby="request-subject-body"
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-md w-full p-6 sm:p-7 space-y-4 text-left max-h-[90dvh] overflow-y-auto"
      >
        <ModalHeading
          tone="brand"
          icon={BookPlus}
          titleId="request-subject-title"
          title={t('teach.request.title')}
          bodyId="request-subject-body"
          body={t('teach.request.body')}
        />

        {loading ? (
          <div className="h-24 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />
        ) : nothingOpen ? (
          <p className="text-xs font-semibold text-slate-600 leading-relaxed">
            {semesters.length > 0 ? t('teach.request.deadlinePassed') : t('teach.request.noSemester')}
          </p>
        ) : (
          years !== null && (
            <>
              <SelectField
                id="request-semester"
                label={t('teach.request.semester')}
                value={semesterId}
                disabled={busy}
                error={errors.semester}
                onChange={(e) => {
                  setSemesterId(e.target.value);
                  setClassId('');
                  setSubjectId('');
                  setErrors({});
                }}
              >
                <option value="">{t('teach.request.semesterPlaceholder')}</option>
                {semesters.map((entry) => (
                  <option key={entry.id} value={entry.id} disabled={entry.closed}>
                    {t('teach.request.semesterOption', { n: entry.ordinal, year: entry.yearLabel })}
                    {entry.closed ? ` (${t('teach.request.closed')})` : ''}
                  </option>
                ))}
              </SelectField>

              {semester?.classSubjectRegistrationDeadline && (
                <p className="-mt-2 text-[11px] font-semibold text-slate-500">
                  {t('teach.request.deadline', { date: formatDay(semester.classSubjectRegistrationDeadline, lang) })}
                </p>
              )}

              {semesterId &&
                (choices === null ? (
                  <div className="h-12 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />
                ) : choices.length === 0 ? (
                  <p className="text-xs font-semibold text-slate-600 leading-relaxed">{t('teach.request.noneFree')}</p>
                ) : (
                  <>
                    <SelectField
                      id="request-class"
                      label={t('teach.request.class')}
                      value={classId}
                      disabled={busy}
                      error={errors.class}
                      onChange={(e) => {
                        setClassId(e.target.value);
                        setSubjectId('');
                        setErrors({});
                      }}
                    >
                      <option value="">{t('teach.request.classPlaceholder')}</option>
                      {choices.map((entry) => (
                        <option key={entry.class.id} value={entry.class.id}>
                          {entry.class.name}
                        </option>
                      ))}
                    </SelectField>

                    {choice && (
                      <SelectField
                        id="request-subject"
                        label={t('subjects.assign.subject')}
                        value={subjectId}
                        disabled={busy}
                        error={errors.subject}
                        onChange={(e) => {
                          setSubjectId(e.target.value);
                          setErrors({});
                        }}
                      >
                        <option value="">{t('subjects.assign.subjectPlaceholder')}</option>
                        {choice.subjects.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.code} - {entry.name}
                          </option>
                        ))}
                      </SelectField>
                    )}
                  </>
                ))}

              {subject && (
                <p className={`text-xs font-semibold leading-relaxed ${ownClass ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {t(ownClass ? 'teach.request.ownClass' : 'teach.request.waits', { subject: subject.name, className: choice.class.name })}
                </p>
              )}
            </>
          )
        )}

        {errors.global && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
            {errors.global}
          </div>
        )}

        <div className={modalActions}>
          <button type="button" onClick={onClose} disabled={busy} className={modalCancelClass(busy)}>
            {t('common.cancel')}
          </button>
          {!nothingOpen && years !== null && (
            <button type="button" onClick={handleSend} disabled={busy} className={modalConfirmClass('brand', busy)}>
              {busy ? t('common.loading') : t('teach.request.send')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RequestSubjectDialog;
