import React, { useEffect, useState } from 'react';

import Select from '../../components/ui/Select';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage, isPromotionsLocked, isStalePromotions, promotionsErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { gradingService } from '../../services/gradingService';
import {
  AUTOMATIC,
  choiceOf,
  decidedCount,
  evenSemesterOf,
  notDecidableView,
  promotionChanged,
  promotionsBody,
  promotionsShown,
  resultShown,
} from './promotions';

/*
  "Kenaikan kelas" (owner, 2026-10-22; backend 4dae152, ticket 09): the Homeroom
  Teacher's Promotion Outcome for each student of the class, decided once a year in
  Semester 2 - a card under the Notes, shown only while Semester 2 is being finalised
  or once it is closed (promotions.js). One choice per student: the automatic rule
  ("Otomatis: Naik kelas" for a student whose every final grade of both semesters
  reaches its KKTP, "Belum diputuskan" for anyone else), or an outcome the class's
  grade takes (Naik kelas / Tinggal kelas, on the top grade Lulus / Tinggal kelas).
  "N dari M sudah ditetapkan" and "N belum disimpan" in the head, one "Simpan" sending
  the changed choices in one PUT. Until every subject of the class is finalised the
  card says which wait and stays read only; closing Semester 2 waits for every student
  with no result.

  Unsaved choices are held (useUnsavedGuard), and the host asks before "back to the
  class list" through `onDirty`. The Principal and the Vice Principals read the same
  card on /headmaster/classes, read only.

  @param classId         the class
  @param academicYearId  its year, for Semester 2
  @param canEdit         the homeroom teacher's desk
  @param onDirty         (dirty) => void, for the host's own way back
  @param onToast         (message, type) => void
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const button =
  'inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';

export const HomeroomPromotions = ({ classId, academicYearId, canEdit = false, onDirty, onToast }) => {
  const { t } = useT();
  /* undefined reading · Semester 2 (or null) · { error } */
  const [semester, setSemester] = useState(undefined);
  /* undefined reading · the read · { error } */
  const [read, setRead] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  const [drafts, setDrafts] = useState({});
  const [message, setMessage] = useState(null);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    academicsService
      .academicYears()
      .then((years) => !cancelled && setSemester(evenSemesterOf(years.find((entry) => entry.id === academicYearId))))
      .catch((err) => !cancelled && setSemester({ error: apiErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [academicYearId, t]);

  const shown = Boolean(semester?.error) || promotionsShown(semester);

  useEffect(() => {
    if (!semester?.id || !promotionsShown(semester)) return undefined;
    let cancelled = false;
    gradingService
      .promotions(classId, semester.id)
      .then((answer) => !cancelled && setRead(answer))
      .catch((err) => !cancelled && setRead({ error: promotionsErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [classId, semester, attempt, t]);

  const students = read && !read.error ? (read.students ?? []) : [];
  const changed = students.filter((student) => promotionChanged(student, drafts));
  const dirty = changed.length > 0;
  const guard = useUnsavedGuard(dirty);

  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);

  if (!shown) return null;

  const editing = canEdit && !locked && Boolean(read?.decidable);
  const automaticOutcome = read?.automaticOutcome ?? 'PROMOTED';
  const why = notDecidableView(read && !read.error ? read : null);
  const nameOf = new Map(students.map((student) => [student.studentProfileId, student.fullName ?? t('tasm.results.unnamed')]));
  const outcomeWord = (outcome) => t(`homeroom.promo.outcome.${outcome}`);

  const pick = (studentProfileId, value) => setDrafts((now) => ({ ...now, [studentProfileId]: value }));

  const cancel = () => {
    setDrafts({});
    setMessage(null);
  };

  const save = async () => {
    const body = promotionsBody(students, drafts);
    if (body.length === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const answer = await gradingService.writePromotions(classId, semester.id, body);
      setRead(answer);
      setDrafts((now) => {
        const next = { ...now };
        for (const row of body) delete next[row.studentProfileId];
        return next;
      });
      onToast?.(t('homeroom.promo.saved', { n: body.length }), 'success');
    } catch (err) {
      const namesOf = (ids) => ids.map((id) => nameOf.get(id) ?? t('tasm.results.unnamed')).join(', ');
      setMessage(promotionsErrorMessage(err, t, namesOf));
      if (isPromotionsLocked(err)) setLocked(true);
      if (isStalePromotions(err)) setAttempt((n) => n + 1);
    } finally {
      setSaving(false);
    }
  };

  const heading = (
    <div className="space-y-1">
      <h3 id={`promo-${classId}`} className="text-base font-extrabold text-slate-900">
        {t('homeroom.promo.title')}
      </h3>
      {read && !read.error && (
        <p className="text-xs sm:text-sm text-slate-500 font-bold">
          {t('classes.semester.name', { n: 2 })}
          <span className="font-light text-slate-300"> / </span>
          {read.academicYear}
        </p>
      )}
    </div>
  );

  let body;
  if (semester?.error) body = <p className="text-sm font-semibold text-amber-700">{semester.error}</p>;
  else if (read === undefined) body = <div className="h-32 rounded-xl bg-slate-50 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
  else if (read.error) body = <p className="text-sm font-semibold text-amber-700">{read.error}</p>;
  else if (students.length === 0) body = <p className="text-sm font-semibold text-slate-600">{t('homeroom.promo.none')}</p>;
  else {
    body = (
      <>
        <div className="space-y-1">
          <p className="flex flex-wrap gap-x-4 text-xs font-semibold text-slate-500">
            <span>{t('homeroom.promo.count', { n: decidedCount(students, drafts, automaticOutcome), total: students.length })}</span>
            {editing && dirty && <span className="text-amber-700">{t('homeroom.promo.unsaved', { n: changed.length })}</span>}
          </p>
          <p className="text-xs font-medium text-slate-500 leading-relaxed">
            {t(canEdit ? 'homeroom.promo.intro' : 'homeroom.promo.readIntro', { outcome: outcomeWord(automaticOutcome).toLowerCase() })}
          </p>
          {why && (
            <p className="text-xs font-semibold text-amber-700 leading-relaxed" role="status">
              {t(why.key, why.vars)}
            </p>
          )}
        </div>

        <ul className="divide-y divide-slate-100">
          {students.map((student) => {
            const id = student.studentProfileId;
            const result = resultShown(student, drafts, automaticOutcome);
            const hint = student.automatic === true ? t('homeroom.promo.reached') : student.automatic === false ? t('homeroom.promo.notReached') : null;
            return (
              <li key={id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <p id={`promo-${id}`} className="text-sm font-bold text-slate-900 break-words">
                    {nameOf.get(id)}
                  </p>
                  {hint && <p className="text-xs font-medium text-slate-500">{hint}</p>}
                </div>
                {editing ? (
                  <Select size="sm" value={choiceOf(student, drafts)} onChange={(e) => pick(id, e.target.value)} aria-label={t('homeroom.promo.choiceFor', { name: nameOf.get(id) })} className="w-full sm:w-56 shrink-0">
                    <option value={AUTOMATIC}>{student.automatic ? t('homeroom.promo.auto', { outcome: outcomeWord(automaticOutcome) }) : t('homeroom.promo.undecided')}</option>
                    {(read.choices ?? []).map((choice) => (
                      <option key={choice} value={choice}>
                        {outcomeWord(choice)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className={`text-sm font-bold shrink-0 ${result ? 'text-slate-900' : 'text-amber-700'}`}>{result ? outcomeWord(result) : t('homeroom.promo.undecided')}</p>
                )}
              </li>
            );
          })}
        </ul>

        {message && (
          <p className="text-xs font-semibold text-rose-700 leading-relaxed" role="alert">
            {message}
          </p>
        )}

        {editing && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={cancel} disabled={saving || !dirty} className={`${button} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
              {t('common.cancel')}
            </button>
            <button type="button" onClick={save} disabled={saving || !dirty} className={`${button} bg-brand text-white hover:bg-brand-deep`}>
              {t('homeroom.promo.save')}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <section className={`${card} space-y-4`} aria-labelledby={`promo-${classId}`}>
      {heading}
      {body}
      {guard.dialog}
    </section>
  );
};

export default HomeroomPromotions;
