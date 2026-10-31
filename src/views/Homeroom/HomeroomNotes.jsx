import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Select from '../../components/ui/Select';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage, isNotesLocked, isStaleNotes, notesErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { gradingService } from '../../services/gradingService';
import { defaultSemesterOf } from '../Subjects/subjects';
import { RosterError } from '../Attendance/RosterParts';
import { CardSkeleton, SaveBar, StudentHead, ToneWord } from './HomeroomCardParts';
import { NOTE_MAX, NOTE_TABS, noteChanged, noteErrors, noteRows, notesBody, noteTabCounts, noteTextOf, rowsInTab, willClear } from './notes';

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

  The look is the mockup catatan-kenaikan-wali.html (owner, 2026-10-30, items 1-7):
  a slash line under the title, the count over a green bar, text tabs Semua / Belum
  diisi / Sudah diisi (by what is saved), a row's state as a coloured word at the
  right, the save bar sticking to the bottom while anything waits, rose error boxes
  with "Coba lagi", a saved Note read in a pale box.

  @param classId         the class
  @param academicYearId  its year, for the semesters
  @param canEdit         the homeroom teacher's desk
  @param onDirty         (dirty) => void, for the host's own way back
  @param onToast         (message, type) => void
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const tabClass = (on) =>
  `shrink-0 whitespace-nowrap px-2.5 py-2 text-sm font-bold border-b-2 transition-colors cursor-pointer focus:outline-none focus-visible:text-brand ${
    on ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
  }`;

export const HomeroomNotes = ({ classId, academicYearId, canEdit = false, onDirty, onToast }) => {
  const { t } = useT();
  const [year, setYear] = useState(undefined);
  const [yearAttempt, setYearAttempt] = useState(0);
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
  /* The text tab over the boxes (NOTE_TABS). */
  const [tab, setTab] = useState('all');

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
  }, [academicYearId, yearAttempt, t]);

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
  const semester = semesters.find((entry) => entry.id === semesterId) ?? null;
  const counts = noteTabCounts(rows);
  const shownRows = rowsInTab(rows, tab);

  const switchTo = (id) => {
    setRead(undefined);
    setDrafts({});
    setErrors({});
    setMessage(null);
    setLocked(false);
    setTab('all');
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
      const namesOf = (list) => list.map((id) => nameOf.get(id) ?? t('tasm.results.unnamed')).join(', ');
      setMessage(notesErrorMessage(err, t, namesOf(ids), namesOf));
      if (isNotesLocked(err)) setLocked(true);
      if (isStaleNotes(err)) setAttempt((n) => n + 1);
    } finally {
      setSaving(false);
    }
  };

  /* A row's state at the right (item 3): what saving would do first, then what is saved. */
  const stateOf = (row) => {
    if (editing && willClear(row, drafts)) return { tone: 'rose', key: 'homeroom.notes.state.clear' };
    if (editing && noteChanged(row, drafts)) return { tone: 'brand', key: 'homeroom.changed' };
    if ((row.saved?.text ?? '').trim()) return editing ? { tone: 'emerald', key: 'homeroom.notes.state.filled' } : null;
    return { tone: 'amber', key: 'homeroom.notes.missing' };
  };

  const retry = (onClick) => (
    <Button size="sm" variant="outline" onClick={onClick}>
      {t('att.error.retry')}
    </Button>
  );

  const heading = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 id={`notes-${classId}`} className="text-base font-extrabold text-slate-900 tracking-tight">
          {t('homeroom.notes.title')}
        </h3>
        {semester && year && !year.error && (
          <p className="mt-0.5 text-[13px] font-medium text-slate-500">
            <span className="whitespace-nowrap">{t('grading.fin.semesterOption', { n: semester.ordinal, year: year.label })}</span>
            {rows.length > 0 && (
              <>
                {' '}
                <span className="mx-1 text-slate-300" aria-hidden="true">
                  /
                </span>{' '}
                <span className="whitespace-nowrap">{t('homeroom.notes.count', { n: counts.filled, total: counts.all })}</span>
              </>
            )}
          </p>
        )}
      </div>
      {semesters.length > 1 && (
        <div className="w-full sm:w-44">
          <Select value={semesterId ?? ''} onChange={(e) => pickSemester(e.target.value)} aria-label={t('homeroom.att.semester')}>
            {semesters.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {t('classes.semester.name', { n: entry.ordinal })}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );

  let body;
  if (year?.error) {
    body = (
      <RosterError
        action={retry(() => {
          setYear(undefined);
          setYearAttempt((n) => n + 1);
        })}
      >
        {year.error}
      </RosterError>
    );
  } else if (year !== undefined && !semesterId) body = <p className="text-[13px] font-medium text-slate-600">{t('homeroom.notes.noSemester')}</p>;
  else if (read === undefined) body = <CardSkeleton />;
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
  } else if (rows.length === 0) body = <p className="text-[13px] font-medium text-slate-600">{t('homeroom.notes.none')}</p>;
  else {
    body = (
      <>
        {/* Summary first (item 2): how many have a Note, over one green bar. */}
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5">
          <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <b className="text-2xl font-extrabold tracking-tight leading-none tabular-nums text-slate-900">
              {t('homeroom.notes.summary', { n: counts.filled, total: counts.all })}
            </b>
            <span className="text-[13px] font-semibold text-slate-600">{t('homeroom.notes.summaryOf')}</span>
            {counts.missing > 0 && <span className="text-[13px] font-bold text-amber-700">{t('homeroom.notes.missingCount', { n: counts.missing })}</span>}
          </p>
          <div className="mt-2.5 flex h-2 rounded-full overflow-hidden bg-slate-200" aria-hidden="true">
            <span className="h-full bg-emerald-500" style={{ width: `${counts.all ? (counts.filled / counts.all) * 100 : 0}%` }} />
          </div>
        </div>

        <div role="tablist" aria-label={t('homeroom.notes.title')} className="flex gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
          {NOTE_TABS.map((key) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={tabClass(tab === key)}>
              {t(`homeroom.notes.tab.${key}`)}
              <span
                className={`ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums ${
                  tab === key ? 'bg-brand-tint text-brand' : key === 'missing' && counts.missing > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {counts[key]}
              </span>
            </button>
          ))}
        </div>

        <p className="flex items-start gap-2 text-[13px] font-medium text-slate-600 leading-relaxed">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" aria-hidden="true" />
          {canEdit && closed ? t('homeroom.notes.closed') : t(canEdit ? 'homeroom.notes.intro' : 'homeroom.notes.readIntro')}
        </p>

        {shownRows.length === 0 ? (
          <p className="text-[13px] font-medium text-slate-500">{t(`homeroom.notes.tabEmpty.${tab}`)}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shownRows.map((row) => {
              const id = row.studentProfileId;
              const text = noteTextOf(row, drafts);
              const length = text.trim().length;
              const error = errors[id];
              const state = stateOf(row);
              return (
                <li key={id} className="py-3.5 px-1">
                  <StudentHead name={nameOf.get(id)} nameAs={editing ? 'label' : 'p'} nameProps={editing ? { htmlFor: `note-${id}` } : {}}>
                    {state && <ToneWord tone={state.tone}>{t(state.key)}</ToneWord>}
                  </StudentHead>
                  {editing ? (
                    <div className="mt-2.5 sm:ml-[46px]">
                      <textarea
                        id={`note-${id}`}
                        rows={3}
                        value={text}
                        onChange={(event) => type(id, event.target.value)}
                        placeholder={t('homeroom.notes.placeholder')}
                        aria-invalid={Boolean(error)}
                        aria-describedby={`note-${id}-hint`}
                        className={`block w-full field-sizing-content min-h-[4.5rem] px-3 py-2 rounded-xl border bg-white text-[13.5px] text-slate-800 leading-relaxed resize-y placeholder:text-slate-400 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 ${error ? 'border-rose-300' : 'border-slate-200'}`}
                      />
                      <div id={`note-${id}-hint`} className="mt-1 flex flex-wrap justify-between gap-x-4 text-xs font-semibold">
                        <span className="text-rose-700">{error ? t(`homeroom.notes.error.${error}`) : ''}</span>
                        <span className={`tabular-nums ${length > NOTE_MAX ? 'text-rose-700' : 'text-slate-500'}`}>{t('homeroom.notes.counter', { n: length, max: NOTE_MAX })}</span>
                      </div>
                    </div>
                  ) : row.saved?.text ? (
                    <p className="mt-2.5 sm:ml-[46px] rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-[13.5px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                      {row.saved.text}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        {message && <RosterError>{message}</RosterError>}

        {editing && <SaveBar count={changed.length} saveLabel={t('homeroom.notes.save')} onCancel={cancel} onSave={save} saving={saving} />}
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
