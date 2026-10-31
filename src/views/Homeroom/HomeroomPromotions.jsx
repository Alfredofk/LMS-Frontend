import React, { useEffect, useState } from 'react';
import { Clock, Info } from 'lucide-react';

import Button from '../../components/ui/Button';
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
  outcomeCounts,
  promotionChanged,
  promotionsBody,
  promotionsShown,
  resultShown,
} from './promotions';
import { RosterError } from '../Attendance/RosterParts';
import { CardSkeleton, SaveBar, StudentHead, ToneWord } from './HomeroomCardParts';

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

  The look is the mockup catatan-kenaikan-wali.html (owner, 2026-10-30, items 8-13):
  the count in a slash line, the results as cells over a bar, the KKTP line under a
  name coloured, why it cannot be decided in an amber box, a result read as a
  coloured word (staying rose), the Notes' save bar and error boxes.

  @param classId         the class
  @param academicYearId  its year, for Semester 2
  @param canEdit         the homeroom teacher's desk
  @param onDirty         (dirty) => void, for the host's own way back
  @param onToast         (message, type) => void
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
/* A result's colour (item 12): going up green, staying rose, none yet amber. */
const toneOf = (result) => (!result ? 'amber' : result === 'RETAINED' ? 'rose' : 'emerald');

export const HomeroomPromotions = ({ classId, academicYearId, canEdit = false, onDirty, onToast }) => {
  const { t } = useT();
  /* undefined reading · Semester 2 (or null) · { error } */
  const [semester, setSemester] = useState(undefined);
  const [yearAttempt, setYearAttempt] = useState(0);
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
  }, [academicYearId, yearAttempt, t]);

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
  const counts = outcomeCounts(students, drafts, automaticOutcome);

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

  const retry = (onClick) => (
    <Button size="sm" variant="outline" onClick={onClick}>
      {t('att.error.retry')}
    </Button>
  );

  const heading = (
    <div className="min-w-0">
      <h3 id={`promo-${classId}`} className="text-base font-extrabold text-slate-900 tracking-tight">
        {t('homeroom.promo.title')}
      </h3>
      {read && !read.error && (
        <p className="mt-0.5 text-[13px] font-medium text-slate-500">
          <span className="whitespace-nowrap">{t('grading.fin.semesterOption', { n: 2, year: read.academicYear })}</span>
          {students.length > 0 && (
            <>
              {' '}
              <span className="mx-1 text-slate-300" aria-hidden="true">
                /
              </span>{' '}
              <span className="whitespace-nowrap">{t('homeroom.promo.count', { n: decidedCount(students, drafts, automaticOutcome), total: students.length })}</span>
            </>
          )}
        </p>
      )}
    </div>
  );

  let body;
  if (semester?.error) {
    body = (
      <RosterError
        action={retry(() => {
          setSemester(undefined);
          setYearAttempt((n) => n + 1);
        })}
      >
        {semester.error}
      </RosterError>
    );
  } else if (read === undefined) body = <CardSkeleton />;
  else if (read.error) {
    body = (
      <RosterError
        action={retry(() => {
          setRead(undefined);
          setAttempt((n) => n + 1);
        })}
      >
        {read.error}
      </RosterError>
    );
  } else if (students.length === 0) body = <p className="text-[13px] font-medium text-slate-600">{t('homeroom.promo.none')}</p>;
  else {
    const cells = [
      { key: 'advance', label: outcomeWord(automaticOutcome), n: counts.advance, tone: 'text-emerald-700' },
      { key: 'RETAINED', label: outcomeWord('RETAINED'), n: counts.RETAINED, tone: 'text-rose-700' },
      { key: 'undecided', label: t('homeroom.promo.undecided'), n: counts.undecided, tone: 'text-amber-700' },
    ];
    body = (
      <>
        {/* Summary first (item 9): the results as they stand with the choices on screen. */}
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5">
          <dl className="grid grid-cols-3 gap-2">
            {cells.map((cell) => (
              <div key={cell.key} className="min-w-0">
                <dt className="block text-[10px] font-bold tracking-wider uppercase text-slate-500">{cell.label}</dt>
                <dd className={`text-[22px] font-extrabold tracking-tight leading-tight tabular-nums ${cell.tone}`}>{cell.n}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3 flex h-2 rounded-full overflow-hidden bg-slate-200" aria-hidden="true">
            <span className="h-full bg-emerald-500" style={{ width: `${(counts.advance / students.length) * 100}%` }} />
            <span className="h-full bg-rose-500" style={{ width: `${(counts.RETAINED / students.length) * 100}%` }} />
          </div>
        </div>

        {why ? (
          <p className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-3 text-[13px] font-semibold leading-relaxed text-amber-800" role="status">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            {t(why.key, why.vars)}
          </p>
        ) : (
          <p className="flex items-start gap-2 text-[13px] font-medium text-slate-600 leading-relaxed">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" aria-hidden="true" />
            {t(canEdit ? 'homeroom.promo.intro' : 'homeroom.promo.readIntro', { outcome: outcomeWord(automaticOutcome).toLowerCase() })}
          </p>
        )}

        <ul className="divide-y divide-slate-100">
          {students.map((student) => {
            const id = student.studentProfileId;
            const result = resultShown(student, drafts, automaticOutcome);
            const hint =
              student.automatic === true ? (
                <span className="block text-[12.5px] font-semibold text-emerald-700">{t('homeroom.promo.reached')}</span>
              ) : student.automatic === false ? (
                <span className="block text-[12.5px] font-semibold text-amber-700">{t('homeroom.promo.notReached')}</span>
              ) : null;
            return (
              <li key={id} className="py-3.5 px-1">
                <StudentHead
                  name={nameOf.get(id)}
                  nameProps={{ id: `promo-${id}` }}
                  below={hint}
                  marker={editing && promotionChanged(student, drafts) && <span className="ml-1.5 text-[11.5px] font-bold text-brand">{t('homeroom.changed')}</span>}
                >
                  {editing ? (
                    <div className="w-full sm:w-56 shrink-0">
                      <Select size="sm" value={choiceOf(student, drafts)} onChange={(e) => pick(id, e.target.value)} aria-label={t('homeroom.promo.choiceFor', { name: nameOf.get(id) })}>
                        <option value={AUTOMATIC}>{student.automatic ? t('homeroom.promo.auto', { outcome: outcomeWord(automaticOutcome) }) : t('homeroom.promo.undecided')}</option>
                        {(read.choices ?? []).map((choice) => (
                          <option key={choice} value={choice}>
                            {outcomeWord(choice)}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ) : (
                    <ToneWord tone={toneOf(result)}>{result ? outcomeWord(result) : t('homeroom.promo.undecided')}</ToneWord>
                  )}
                </StudentHead>
              </li>
            );
          })}
        </ul>

        {message && <RosterError>{message}</RosterError>}

        {editing && <SaveBar count={changed.length} saveLabel={t('homeroom.promo.save')} onCancel={cancel} onSave={save} saving={saving} />}
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
