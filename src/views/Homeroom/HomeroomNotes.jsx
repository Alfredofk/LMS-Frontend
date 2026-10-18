import React, { useEffect, useState } from 'react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage, isNotesLocked, isStaleNotes, notesErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { gradingService } from '../../services/gradingService';
import { defaultSemesterOf } from '../Subjects/subjects';
import { NOTE_MAX, notedCount, noteChanged, noteErrors, noteRows, notesBody, noteTextOf, willClear } from './notes';

/*
  "Catatan wali kelas" (owner, 2026-10-18; backend 483be5a): the Homeroom Teacher's
  Note on each student placed in the class now, for one semester of its year - its
  own semester choice, opening on the one running today as the attendance card
  does. A box per student that grows with its text, a counter to 1,000, "5 dari 30
  ada catatan" and "N belum disimpan" in the head, one "Simpan catatan" sending the
  changed boxes in one PUT (notes.js). Required before the semester closes since
  backend eadf680 (owner, 2026-10-18): a student with none reads "Belum diisi" in
  amber, here and for the leaders. It may still be cleared to be written again: a
  saved one emptied says "Akan dihapus saat disimpan", with no further question.

  Unsaved typing is held: a move off the page asks (useUnsavedGuard), so does a
  semester switch here, and the host asks before "back to the class list" through
  `onDirty`. The Principal and the Vice Principals read the same card on
  /headmaster/classes, read only - forced there even for a Principal who is this
  class's homeroom teacher, as at every leader's desk. A closed semester or year is
  read only too.

  @param classId         the class
  @param academicYearId  its year, for the semesters
  @param canEdit         the homeroom teacher's desk
  @param onDirty         (dirty) => void, for the host's own way back
  @param onToast         (message, type) => void
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const button =
  'inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';

export const HomeroomNotes = ({ classId, academicYearId, canEdit = false, onDirty, onToast }) => {
  const { t } = useT();
  const [year, setYear] = useState(undefined);
  const [semesterId, setSemesterId] = useState(null);
  /* undefined reading · the read · { error } */
  const [read, setRead] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  const [drafts, setDrafts] = useState({});
  /* What this card saved since the read, by student id. */
  const [overlay, setOverlay] = useState({});
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  /* A semester asked for while typing waits unsaved: held until the dialog answers. */
  const [askedSemester, setAskedSemester] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);
    academicsService
      .academicYears()
      .then((years) => {
        if (cancelled) return;
        const found = years.find((entry) => entry.id === academicYearId) ?? null;
        setYear(found);
        setSemesterId(defaultSemesterOf(found, today));
      })
      .catch((err) => !cancelled && setYear({ error: apiErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [academicYearId, t]);

  useEffect(() => {
    if (!semesterId) return undefined;
    let cancelled = false;
    gradingService
      .notes(classId, semesterId)
      .then((answer) => {
        if (cancelled) return;
        setRead(answer);
        setOverlay({});
      })
      .catch((err) => !cancelled && setRead({ error: notesErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [classId, semesterId, attempt, t]);

  const rows = read && !read.error ? noteRows(read, overlay) : [];
  const changed = rows.filter((row) => noteChanged(row, drafts));
  const dirty = changed.length > 0;
  const guard = useUnsavedGuard(dirty);

  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);

  const closed = read?.semester?.status === 'CLOSED' || (year && !year.error && year.status !== 'ACTIVE');
  const editing = canEdit && !locked && !closed;
  const nameOf = new Map(rows.map((row) => [row.studentProfileId, row.fullName ?? t('tasm.results.unnamed')]));
  const semesters = year && !year.error ? (year.semesters ?? []) : [];

  const switchTo = (id) => {
    setRead(undefined);
    setDrafts({});
    setErrors({});
    setMessage(null);
    setLocked(false);
    setSemesterId(id);
  };
  const pickSemester = (id) => (dirty ? setAskedSemester(id) : switchTo(id));

  const type = (studentProfileId, text) => {
    setDrafts((now) => ({ ...now, [studentProfileId]: text }));
    if (errors[studentProfileId]) {
      setErrors((now) => {
        const next = { ...now };
        delete next[studentProfileId];
        return next;
      });
    }
  };

  const cancel = () => {
    setDrafts({});
    setErrors({});
    setMessage(null);
  };

  const save = async () => {
    const found = noteErrors(rows, drafts);
    setErrors(found);
    if (Object.keys(found).length) {
      setMessage(t('homeroom.notes.error.fix'));
      return;
    }
    const body = notesBody(rows, drafts);
    if (body.length === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const answer = await gradingService.writeNotes(classId, semesterId, body);
      setOverlay((now) => ({ ...now, ...Object.fromEntries(answer.map((row) => [row.studentProfileId, { text: row.text, updatedAt: row.updatedAt }])) }));
      setDrafts((now) => {
        const next = { ...now };
        for (const row of body) delete next[row.studentProfileId];
        return next;
      });
      onToast?.(t('homeroom.notes.saved', { n: body.length }), 'success');
    } catch (err) {
      const ids = Array.isArray(err?.details?.studentProfileIds) ? err.details.studentProfileIds : [];
      const names = ids.map((id) => nameOf.get(id) ?? t('tasm.results.unnamed')).join(', ');
      setMessage(notesErrorMessage(err, t, names));
      if (isNotesLocked(err)) setLocked(true);
      if (isStaleNotes(err)) setAttempt((n) => n + 1);
    } finally {
      setSaving(false);
    }
  };

  const heading = (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <h3 id={`notes-${classId}`} className="text-base font-extrabold text-slate-900">
        {t('homeroom.notes.title')}
      </h3>
      {semesters.length > 1 && (
        <label className="flex items-center gap-2">
          <span className="sr-only">{t('homeroom.att.semester')}</span>
          <select
            value={semesterId ?? ''}
            onChange={(e) => pickSemester(e.target.value)}
            className="w-full sm:w-44 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand cursor-pointer"
          >
            {semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                {t('classes.semester.name', { n: semester.ordinal })}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );

  let body;
  if (year?.error) body = <p className="text-sm font-semibold text-amber-700">{year.error}</p>;
  else if (year !== undefined && !semesterId) body = <p className="text-sm font-semibold text-slate-600">{t('homeroom.notes.noSemester')}</p>;
  else if (read === undefined) body = <div className="h-32 rounded-xl bg-slate-50 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
  else if (read.error) body = <p className="text-sm font-semibold text-amber-700">{read.error}</p>;
  else if (rows.length === 0) body = <p className="text-sm font-semibold text-slate-600">{t('homeroom.notes.none')}</p>;
  else {
    body = (
      <>
        <div className="space-y-1">
          <p className="flex flex-wrap gap-x-4 text-xs font-semibold text-slate-500">
            <span>{t('homeroom.notes.count', { n: notedCount(rows), total: rows.length })}</span>
            {editing && dirty && <span className="text-amber-700">{t('homeroom.notes.unsaved', { n: changed.length })}</span>}
          </p>
          <p className="text-xs font-medium text-slate-500 leading-relaxed">
            {canEdit && closed ? t('homeroom.notes.closed') : t(canEdit ? 'homeroom.notes.intro' : 'homeroom.notes.readIntro')}
          </p>
        </div>

        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const id = row.studentProfileId;
            const text = noteTextOf(row, drafts);
            const length = text.trim().length;
            const error = errors[id];
            const clearing = willClear(row, drafts);
            return (
              <li key={id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                <label htmlFor={`note-${id}`} className="block text-sm font-bold text-slate-900 break-words">
                  {nameOf.get(id)}
                </label>
                {editing ? (
                  <>
                    <textarea
                      id={`note-${id}`}
                      rows={3}
                      value={text}
                      onChange={(event) => type(id, event.target.value)}
                      placeholder={t('homeroom.notes.placeholder')}
                      aria-invalid={Boolean(error)}
                      aria-describedby={`note-${id}-hint`}
                      className={`block w-full field-sizing-content min-h-[4.5rem] px-3 py-2 rounded-xl border bg-white text-sm text-slate-800 leading-relaxed resize-y placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${error ? 'border-rose-300' : 'border-slate-200'}`}
                    />
                    <div id={`note-${id}-hint`} className="flex flex-wrap justify-between gap-x-4 text-[11px] font-semibold">
                      <span className={error ? 'text-rose-700' : 'text-amber-700'}>
                        {error
                          ? t(`homeroom.notes.error.${error}`)
                          : clearing
                            ? t('homeroom.notes.willClear')
                            : length === 0
                              ? t('homeroom.notes.missing')
                              : ''}
                      </span>
                      <span className={`tabular-nums ${length > NOTE_MAX ? 'text-rose-700' : 'text-slate-500'}`}>
                        {t('homeroom.notes.counter', { n: length, max: NOTE_MAX })}
                      </span>
                    </div>
                  </>
                ) : row.saved?.text ? (
                  <p id={`note-${id}`} className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                    {row.saved.text}
                  </p>
                ) : (
                  <p id={`note-${id}`} className="text-xs font-semibold text-amber-700">
                    {t('homeroom.notes.missing')}
                  </p>
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
              {t('homeroom.notes.save')}
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <section className={`${card} space-y-4`} aria-labelledby={`notes-${classId}`}>
      {heading}
      {body}
      {guard.dialog}
      <ConfirmDialog
        open={askedSemester !== null}
        tone="danger"
        title={t('unsaved.title')}
        body={t('unsaved.body')}
        confirmLabel={t('unsaved.leave')}
        cancelLabel={t('unsaved.stay')}
        onConfirm={() => {
          const id = askedSemester;
          setAskedSemester(null);
          switchTo(id);
        }}
        onCancel={() => setAskedSemester(null)}
      />
    </section>
  );
};

export default HomeroomNotes;
