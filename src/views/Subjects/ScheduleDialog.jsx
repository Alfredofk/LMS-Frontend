import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { modalActions, modalCancelClass, modalConfirmClass } from '../../components/ui/modalStyles';
import { BarChart3, ClipboardList, Plus, Trash2 } from 'lucide-react';

import Select from '../../components/ui/Select';

import { sessionsService } from '../../services/sessionsService';
import { useT } from '../../i18n/LanguageContext';
import { timetableErrorMessage } from '../../i18n/apiError';
import { formatDay } from '../Classes/format';
import {
  ALL_DAYS,
  MAX_SLOTS,
  changeStage,
  classClash,
  dayName,
  parseClash,
  payloadOf,
  slotErrors,
  slotsValid,
} from './timetable';
import SessionList from './SessionList';
import SessionRoster from './SessionRoster';
import SubjectProgress from './SubjectProgress';
import AssessmentReader from '../TeacherAssessment/AssessmentReader';
import SessionContentDrawer from '../../components/content/SessionContentDrawer';

/*
  One subject in one class: its weekly timetable, what it has made, and — for the
  Principal or a Vice Principal while the semester is open — changing it
  (backend 7cdc46d; owner, 2026-09-30).

  **View** shows the slots, the counts `scheduleView` gives, and every Session
  (`GET …/sessions`, read only — answering one is the teacher's). A meeting that
  has begun and was not cancelled opens its attendance in place (`SessionRoster`,
  backend deb95e8; owner, 2026-10-02), with a way back. **Edit** replaces
  the whole week (`PUT …/schedule`). The form holds the server's own rules
  (`slotErrors`) and the half of its clash check this page can see — the other
  subjects of the class (`classClash`). A clash with the same teacher elsewhere
  comes back as a 409 whose sentence `parseClash` turns into words.

  What a change reaches depends on where the semester stands (`changeStage`):
  before it starts every meeting is planned again; after it, from `replansFrom`;
  a first timetable after the start also creates the meetings already past,
  which then wait for the teacher.
*/
const blankRow = () => ({ dayOfWeek: '', start: '', end: '' });


export const ScheduleDialog = ({ row, boardClass, semester, schedule, others, writable, onClose, onSaved }) => {
  const { t, lang } = useT();
  const baseId = useId();
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState({ rows: [] });
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState({ list: null, error: null });
  /* The meeting whose attendance is open in place of the view, or null. */
  const [rosterSession, setRosterSession] = useState(null);
  /* The subject's learning progress open in place of the view (backend 0dd8b44). */
  const [progressOpen, setProgressOpen] = useState(false);
  /* Its assessments, read only, open in place of the view (backend 0bb4598, owner 2026-10-08). */
  const [assessmentsOpen, setAssessmentsOpen] = useState(false);
  /* The meeting whose materials are open in the side panel (drafts shown: staff). */
  const [contentOf, setContentOf] = useState(null);
  const openerRef = useRef(null);
  const panelRef = useRef(null);

  const loadSessions = useCallback(() => {
    sessionsService
      .sessions(row.classSubjectId)
      .then((list) => setSessions({ list, error: null }))
      .catch((err) => setSessions({ list: null, error: timetableErrorMessage(err, t) }));
  }, [row.classSubjectId, t]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    openerRef.current = document.activeElement;
    panelRef.current?.focus();
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

  const stage = changeStage(schedule, semester);
  const canEdit = writable && stage !== 'NO_ZONE';
  const slotText = (slot) => t('timetable.slot', { day: dayName(slot.dayOfWeek, lang), start: slot.start, end: slot.end });

  const startEditing = () => {
    setRows(schedule.slots.length ? schedule.slots.map((slot) => ({ ...slot, dayOfWeek: String(slot.dayOfWeek) })) : [blankRow()]);
    setErrors({ rows: [] });
    setEditing(true);
  };

  const change = (i, field, value) => {
    setRows((prev) => prev.map((entry, j) => (j === i ? { ...entry, [field]: value } : entry)));
    setErrors((prev) => ({
      ...prev,
      global: null,
      form: null,
      rows: prev.rows.map((entry, j) => (j === i ? { ...entry, [field === 'dayOfWeek' ? 'day' : field]: null } : entry)),
    }));
  };

  const handleSave = async () => {
    const found = slotErrors(rows);
    if (!slotsValid(found)) {
      setErrors(found);
      return;
    }
    const slots = payloadOf(rows);
    const clash = classClash(slots, others);
    if (clash) {
      setErrors({
        rows: [],
        global: t('timetable.clash.class', {
          mine: slotText(clash.mine),
          className: boardClass.name,
          subject: clash.row.subject.name,
          theirs: slotText(clash.theirs),
        }),
      });
      return;
    }

    setBusy(true);
    try {
      const saved = await sessionsService.setSchedule(row.classSubjectId, slots);
      setBusy(false);
      setEditing(false);
      onSaved(saved);
      loadSessions();
    } catch (err) {
      setBusy(false);
      const parsed = parseClash(err?.message);
      setErrors({
        rows: [],
        global: parsed
          ? t(parsed.kind === 'teacher' ? 'timetable.clash.teacher' : 'timetable.clash.class', {
              mine: slotText(parsed.mine),
              className: parsed.className,
              subject: parsed.subject,
              theirs: slotText(parsed.theirs),
            })
          : timetableErrorMessage(err, t),
      });
    }
  };

  const stageNote = {
    NO_ZONE: { tone: 'amber', text: t('timetable.stage.noZone') },
    BEFORE_START: { tone: 'slate', text: t('timetable.stage.before') },
    AFTER_START: { tone: 'slate', text: t('timetable.stage.after', { date: formatDay(schedule.replansFrom, lang) }) },
    FIRST_AFTER_START: {
      tone: 'amber',
      text: t('timetable.stage.firstAfter', { start: formatDay(semester.startDate, lang), teacher: row.teacher.fullName }),
    },
  }[stage];

  const note = stageNote && (
    <p
      className={`rounded-xl px-3 py-2 text-[11px] font-semibold leading-relaxed ${
        stageNote.tone === 'amber' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-50 text-slate-600 border border-slate-200'
      }`}
    >
      {stageNote.text}
    </p>
  );

  const counts = [
    ['timetable.count.scheduled', schedule.sessions.scheduled],
    ['timetable.count.cancelled', schedule.sessions.cancelled],
    ['timetable.count.needsCompletion', schedule.sessions.needsCompletion],
  ];

  const fieldClass =
    'block w-full rounded-xl border bg-white py-2 px-3 text-sm text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand disabled:bg-slate-50';

  const view = (
    <>
      <div className="space-y-1.5">
        <h3 className="text-sm font-extrabold text-slate-900">{t('timetable.slots')}</h3>
        {schedule.slots.length === 0 ? (
          <p className="text-xs font-semibold text-slate-500">{t('timetable.noSlots')}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {schedule.slots.map((slot) => (
              <li
                key={`${slot.dayOfWeek}-${slot.start}`}
                className="px-2.5 py-1 rounded-lg bg-brand-tint text-brand text-[11px] font-extrabold tabular-nums"
              >
                {slotText(slot)}
              </li>
            ))}
          </ul>
        )}
        {schedule.timeZone && (
          <p className="text-[11px] font-semibold text-slate-500">{t('timetable.zone', { zone: schedule.timeZone })}</p>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {counts.map(([key, value]) => (
          <div key={key} className="rounded-xl border border-slate-200 px-2 sm:px-3 py-2 min-w-0">
            <dt className="text-[10px] font-bold text-slate-500 leading-tight">{t(key)}</dt>
            <dd className="text-lg font-extrabold text-slate-800 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {writable && note}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => setProgressOpen(true)}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-brand bg-brand-tint hover:bg-brand hover:text-white rounded-xl transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
        {t('progress.open')}
      </button>
      <button
        type="button"
        onClick={() => setAssessmentsOpen(true)}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-brand bg-brand-tint hover:bg-brand hover:text-white rounded-xl transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <ClipboardList className="w-3.5 h-3.5" aria-hidden="true" />
        {t('tasm.reader.open')}
      </button>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-sm font-extrabold text-slate-900">{t('timetable.sessions')}</h3>
        {sessions.error ? (
          <p className="text-xs font-semibold text-red-600" role="alert">
            {sessions.error}
          </p>
        ) : sessions.list === null ? (
          <div className="h-24 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />
        ) : sessions.list.length === 0 ? (
          <p className="text-xs font-semibold text-slate-500">{t('timetable.noSessions')}</p>
        ) : (
          <>
            <SessionList sessions={sessions.list} onOpen={setRosterSession} onOpenContent={setContentOf} />
            {contentOf && (
              <SessionContentDrawer
                key={contentOf.id}
                sessionId={contentOf.id}
                staff
                heading={{
                  subject: row.subject.name,
                  lines: [
                    formatDay(contentOf.local?.date, lang),
                    t('timetable.session.number', { n: contentOf.number }),
                    boardClass.name,
                  ],
                }}
                onClose={() => setContentOf(null)}
              />
            )}
          </>
        )}
      </div>
    </>
  );

  const form = (
    <>
      {note}
      <ul className="space-y-2">
        {rows.map((entry, i) => {
          const rowErrors = errors.rows[i] ?? {};
          /* One sentence once: an empty start and end would otherwise say "fill in the time" twice. */
          const messages = [...new Set([rowErrors.day, rowErrors.start, rowErrors.end].filter(Boolean))];
          return (
            <li key={i} className="space-y-1">
              {/* One line from 640px; below it two — the day and the remove button,
                  then the two times side by side — because at 320px four columns
                  left a time box 57px wide, showing only its clock icon (2026-09-30). */}
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5 items-center">
                <Select
                  size="row"
                  className="col-span-2 sm:col-span-1"
                  aria-label={t('timetable.form.day', { n: i + 1 })}
                  value={entry.dayOfWeek}
                  disabled={busy}
                  onChange={(e) => change(i, 'dayOfWeek', e.target.value)}
                  invalid={!!rowErrors.day}
                >
                  <option value="">{t('timetable.form.dayPlaceholder')}</option>
                  {ALL_DAYS.map((day) => (
                    <option key={day} value={String(day)}>
                      {dayName(day, lang)}
                    </option>
                  ))}
                </Select>
                <input
                  type="time"
                  aria-label={t('timetable.form.start', { n: i + 1 })}
                  value={entry.start}
                  disabled={busy}
                  onChange={(e) => change(i, 'start', e.target.value)}
                  aria-invalid={!!rowErrors.start}
                  className={`${fieldClass} tabular-nums ${rowErrors.start ? 'border-red-400' : 'border-slate-200'}`}
                />
                <input
                  type="time"
                  aria-label={t('timetable.form.end', { n: i + 1 })}
                  value={entry.end}
                  disabled={busy}
                  onChange={(e) => change(i, 'end', e.target.value)}
                  aria-invalid={!!rowErrors.end}
                  className={`${fieldClass} tabular-nums ${rowErrors.end ? 'border-red-400' : 'border-slate-200'}`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setRows((prev) => prev.filter((_, j) => j !== i));
                    setErrors({ rows: [] });
                  }}
                  disabled={busy || rows.length === 1}
                  aria-label={t('timetable.form.remove', { n: i + 1 })}
                  className="row-start-1 col-start-3 sm:row-start-auto sm:col-start-auto p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              {messages.length > 0 && (
                <p className="text-[11px] text-red-600 font-semibold" role="alert">
                  {messages.map((key) => t(key)).join(' ')}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => {
          setRows((prev) => [...prev, blankRow()]);
          setErrors((prev) => ({ ...prev, form: null, global: null }));
        }}
        disabled={busy || rows.length >= MAX_SLOTS}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold text-brand hover:bg-brand-tint transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
        {t('timetable.form.add')}
      </button>
      <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">{t('timetable.form.hint', { zone: schedule.timeZone ?? '' })}</p>
      {errors.form && (
        <p className="text-xs text-red-600 font-semibold" role="alert">
          {t(errors.form)}
        </p>
      )}
    </>
  );

  const secondary = modalCancelClass(busy);
  const primary = modalConfirmClass('brand', busy);

  return createPortal(
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${baseId}-title`}
        aria-describedby={`${baseId}-body`}
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-lg w-full p-6 sm:p-7 space-y-4 text-left max-h-[90dvh] overflow-y-auto focus:outline-none"
      >
        <div className="space-y-1.5">
          <h2 id={`${baseId}-title`} className="text-base font-extrabold text-slate-900 tracking-tight break-words">
            {t(editing ? 'timetable.editTitle' : 'timetable.title', { subject: row.subject.name, className: boardClass.name })}
          </h2>
          <p id={`${baseId}-body`} className="text-xs text-slate-500 font-medium leading-relaxed">
            {t('timetable.body', { teacher: row.teacher.fullName, n: semester.ordinal, year: semester.academicYear })}
          </p>
        </div>

        {editing ? (
          form
        ) : rosterSession ? (
          <SessionRoster session={rosterSession} zone={schedule.timeZone} onBack={() => setRosterSession(null)} />
        ) : progressOpen ? (
          <SubjectProgress classSubjectId={row.classSubjectId} zone={schedule.timeZone} onBack={() => setProgressOpen(false)} />
        ) : assessmentsOpen ? (
          <AssessmentReader classSubjectId={row.classSubjectId} onBack={() => setAssessmentsOpen(false)} />
        ) : (
          view
        )}

        {errors.global && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
            {errors.global}
          </div>
        )}

        <div className={modalActions}>
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setErrors({ rows: [] });
                }}
                disabled={busy}
                className={secondary}
              >
                {t('common.cancel')}
              </button>
              <button type="button" onClick={handleSave} disabled={busy} className={primary}>
                {busy ? t('common.loading') : t('timetable.form.save')}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onClose} className={secondary}>
                {t('timetable.close')}
              </button>
              {canEdit && !rosterSession && !progressOpen && !assessmentsOpen && (
                <button type="button" onClick={startEditing} className={primary}>
                  {t(schedule.slots.length ? 'timetable.edit' : 'timetable.set')}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ScheduleDialog;
