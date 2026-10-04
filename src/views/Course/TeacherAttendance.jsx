import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Clock, History, Hourglass, MapPinOff, Pencil, RefreshCw } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { teachAttendanceErrorMessage } from '../../i18n/apiError';
import { attendanceService } from '../../services/attendanceService';
import { STATUSES, STATUS_TILE, localOf } from '../Attendance/attendance';
import { formatDay } from '../Classes/format';
import { confirmStatuses, confirmTally, defaultStatusOf } from './teaching';

/*
  A meeting's attendance, for the teacher who answers for it (owner, 2026-10-04) -
  attendance.service.js rosterView, confirm, correct, history.

  - Before it begins: the roster, nothing to set yet.
  - Begun, not confirmed: each student with their check-in (time, late, outside
    the school) and a choice of Hadir/Sakit/Izin/Alpa, starting at the server's
    default - Hadir for a check-in, Alpa for anyone else. A note may go with a
    change. "Confirm" names only the changed ones (confirmStatuses) and says how
    the roster will read first; the server marks the rest.
  - Confirmed: each status, with "Change" for a correction (a note of 3+ characters
    required, kept with the record) and the record's history.
  - Cancelled: nothing to take.
*/

const segment = (on, status) =>
  `px-2.5 py-1.5 text-[11px] font-extrabold rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed ${
    on ? STATUS_TILE[status] + ' ring-1 ring-inset ring-slate-900/10' : 'text-slate-500 hover:bg-slate-100'
  }`;

const pill = 'px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap';

const StatusPicker = ({ value, onPick, disabled, name, t }) => (
  <div role="radiogroup" aria-label={t('teach.att.statusFor', { name })} className="inline-flex flex-wrap gap-1 p-0.5 rounded-xl bg-slate-50 border border-slate-200">
    {STATUSES.map((status) => (
      <button
        key={status}
        type="button"
        role="radio"
        aria-checked={value === status}
        disabled={disabled}
        onClick={() => onPick(status)}
        className={segment(value === status, status)}
      >
        {t(`att.status.${status}`)}
      </button>
    ))}
  </div>
);

export const TeacherAttendance = ({ session, phase, onConfirmed, showToast }) => {
  const { t, lang } = useT();
  const { membership } = useAuth();
  const zone = membership?.school?.timeZone ?? null;
  const [roster, setRoster] = useState(undefined);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [picks, setPicks] = useState({});
  const [notes, setNotes] = useState({});
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  /* The correction open on one record: { student, status, note, error } */
  const [fixing, setFixing] = useState(null);
  /* attendanceId → { open, changes, error } */
  const [histories, setHistories] = useState({});

  useEffect(() => {
    let stop = false;
    attendanceService
      .roster(session.id)
      .then((answer) => {
        if (stop) return;
        setRoster(answer);
        setError(null);
      })
      .catch((err) => !stop && setError(teachAttendanceErrorMessage(err, t)));
    return () => {
      stop = true;
    };
  }, [session.id, attempt, t]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const students = roster?.students ?? [];
  const confirmed = phase === 'confirmed' || Boolean(roster?.session?.confirmed);
  const editable = !confirmed && (phase === 'running' || phase === 'awaiting');
  const tally = confirmTally(students, picks);
  const changed = confirmStatuses(students, picks, notes);
  const timeOf = (instant) => (instant ? localOf(instant, zone)?.time ?? '' : '');

  const confirm = async () => {
    setBusy(true);
    try {
      const answer = await attendanceService.confirm(session.id, changed);
      setRoster(answer);
      setPicks({});
      setNotes({});
      setAsking(false);
      showToast?.(t('teach.att.confirmedToast', { n: session.number }), 'success');
      onConfirmed?.(answer?.session ?? null);
    } catch (err) {
      setAsking(false);
      showToast?.(teachAttendanceErrorMessage(err, t), 'error');
      reload();
    } finally {
      setBusy(false);
    }
  };

  const saveCorrection = async () => {
    const note = fixing.note.trim();
    if (note.length < 3) {
      setFixing((prev) => ({ ...prev, error: t('teach.att.error.noteRequired') }));
      return;
    }
    if (fixing.status === fixing.student.status) {
      setFixing((prev) => ({ ...prev, error: t('teach.att.error.same') }));
      return;
    }
    setBusy(true);
    try {
      const updated = await attendanceService.correct(fixing.student.attendanceId, { status: fixing.status, note });
      setRoster((prev) => ({
        ...prev,
        students: prev.students.map((row) => (row.attendanceId === updated?.id ? { ...row, status: updated.status } : row)),
      }));
      setHistories((prev) => {
        const next = { ...prev };
        delete next[fixing.student.attendanceId];
        return next;
      });
      showToast?.(t('teach.att.correctedToast', { name: fixing.student.fullName ?? '' }), 'success');
      setFixing(null);
    } catch (err) {
      setFixing((prev) => ({ ...prev, error: teachAttendanceErrorMessage(err, t) }));
    } finally {
      setBusy(false);
    }
  };

  const toggleHistory = (attendanceId) => {
    const current = histories[attendanceId];
    if (current) {
      setHistories((prev) => ({ ...prev, [attendanceId]: { ...current, open: !current.open } }));
      return;
    }
    setHistories((prev) => ({ ...prev, [attendanceId]: { open: true, changes: null, error: null } }));
    attendanceService
      .history(attendanceId)
      .then((data) => setHistories((prev) => ({ ...prev, [attendanceId]: { open: true, changes: data?.changes ?? [], error: null } })))
      .catch((err) =>
        setHistories((prev) => ({ ...prev, [attendanceId]: { open: true, changes: null, error: teachAttendanceErrorMessage(err, t) } }))
      );
  };

  let intro = null;
  if (phase === 'upcoming') intro = t('teach.att.upcoming');
  else if (phase === 'cancelled') intro = t('teach.att.cancelled');
  else if (editable) intro = t('teach.att.editable');

  return (
    <section className="space-y-3" aria-labelledby={`attendance-${session.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`attendance-${session.id}`} className="text-base font-extrabold text-slate-800">
          {t('meeting.attendance')}
        </h3>
        {roster && (
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold ${confirmed ? 'text-emerald-700' : 'text-amber-700'}`}>
            {confirmed ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <Hourglass className="w-3.5 h-3.5" aria-hidden="true" />}
            {t(confirmed ? 'roster.confirmed' : 'roster.notConfirmed')}
          </span>
        )}
      </div>
      {intro && <p className="text-xs font-semibold text-slate-500 leading-relaxed">{intro}</p>}

      {error ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm font-semibold text-rose-700">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('att.error.retry')}
          </button>
        </div>
      ) : roster === undefined ? (
        <div className="h-28 rounded-2xl bg-slate-100 animate-pulse" aria-label={t('common.loading')} />
      ) : students.length === 0 ? (
        <p className="text-xs font-semibold text-slate-500">{t('roster.empty')}</p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
            {students.map((student) => {
              const id = student.studentProfileId;
              const current = picks[id] ?? defaultStatusOf(student);
              const differs = editable && current !== defaultStatusOf(student);
              const history = student.attendanceId ? histories[student.attendanceId] : null;
              const isFixing = fixing?.student.studentProfileId === id;
              return (
                <li key={id} className="px-3.5 sm:px-4 py-3 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-extrabold text-slate-800 break-words">{student.fullName ?? t('progress.unnamed')}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-500 tabular-nums">
                        {student.checkedInAt ? t('att.checkedInAt', { time: timeOf(student.checkedInAt) }) : phase === 'upcoming' ? null : t('teach.att.noCheckIn')}
                        {student.late && (
                          <span className={`${pill} bg-amber-50 text-amber-700 inline-flex items-center gap-1`}>
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {t('att.flag.late')}
                          </span>
                        )}
                        {student.outsideSchool && (
                          <span className={`${pill} bg-slate-100 text-slate-600 inline-flex items-center gap-1`}>
                            <MapPinOff className="w-3 h-3" aria-hidden="true" />
                            {t('att.flag.outside')}
                          </span>
                        )}
                      </span>
                    </span>

                    {editable ? (
                      <StatusPicker
                        value={current}
                        disabled={busy}
                        name={student.fullName ?? ''}
                        t={t}
                        onPick={(status) => setPicks((prev) => ({ ...prev, [id]: status }))}
                      />
                    ) : confirmed && student.status ? (
                      <span className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                        <span className={`${pill} ${STATUS_TILE[student.status]}`}>{t(`att.status.${student.status}`)}</span>
                        {!isFixing && student.attendanceId && (
                          <>
                            <button
                              type="button"
                              onClick={() => setFixing({ student, status: student.status, note: '', error: null })}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-brand hover:bg-brand-tint cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" aria-hidden="true" />
                              {t('teach.att.change')}
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleHistory(student.attendanceId)}
                              aria-expanded={Boolean(history?.open)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                            >
                              <History className="w-3 h-3" aria-hidden="true" />
                              {t('roster.history')}
                            </button>
                          </>
                        )}
                      </span>
                    ) : null}
                  </div>

                  {differs && (
                    <input
                      type="text"
                      value={notes[id] ?? ''}
                      maxLength={500}
                      disabled={busy}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [id]: e.target.value }))}
                      placeholder={t('teach.att.notePlaceholder')}
                      aria-label={t('teach.att.noteFor', { name: student.fullName ?? '' })}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                    />
                  )}

                  {isFixing && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2.5">
                      <StatusPicker
                        value={fixing.status}
                        disabled={busy}
                        name={student.fullName ?? ''}
                        t={t}
                        onPick={(status) => setFixing((prev) => ({ ...prev, status, error: null }))}
                      />
                      <input
                        type="text"
                        value={fixing.note}
                        maxLength={500}
                        disabled={busy}
                        onChange={(e) => setFixing((prev) => ({ ...prev, note: e.target.value, error: null }))}
                        placeholder={t('teach.att.correctionNote')}
                        aria-label={t('teach.att.correctionNote')}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                      />
                      {fixing.error && <p className="text-[11px] font-semibold text-red-600" role="alert">{fixing.error}</p>}
                      <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setFixing(null)} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
                          {t('common.cancel')}
                        </button>
                        <button type="button" onClick={saveCorrection} disabled={busy} className="px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-extrabold hover:bg-brand-deep cursor-pointer disabled:opacity-60">
                          {busy ? t('common.loading') : t('teach.att.saveCorrection')}
                        </button>
                      </div>
                    </div>
                  )}

                  {history?.open && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-[11px] font-semibold text-slate-600 space-y-1.5">
                      {history.error ? (
                        <p className="text-rose-700">{history.error}</p>
                      ) : history.changes === null ? (
                        <p className="animate-pulse">{t('common.loading')}</p>
                      ) : history.changes.length === 0 ? (
                        <p>{t('roster.history.none')}</p>
                      ) : (
                        history.changes.map((change) => {
                          const local = localOf(change.at, zone);
                          return (
                            <p key={change.id} className="leading-relaxed">
                              <span className="font-extrabold text-slate-700">
                                {change.fromStatus ? t(`att.status.${change.fromStatus}`) : '-'} → {t(`att.status.${change.toStatus}`)}
                              </span>{' '}
                              {t('roster.history.by', {
                                name: change.changedBy?.fullName ?? '',
                                when: local ? `${formatDay(local.date, lang)} ${local.time}` : '',
                              })}
                              {change.note && <span className="block text-slate-500">{change.note}</span>}
                            </p>
                          );
                        })
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {editable && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-brand-tint/60 px-4 py-3">
              <p className="text-xs font-semibold text-slate-700 tabular-nums">
                {STATUSES.map((status) => `${t(`att.status.${status}`)} ${tally[status]}`).join(', ')}
              </p>
              <button
                type="button"
                onClick={() => setAsking(true)}
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-extrabold hover:bg-brand-deep cursor-pointer disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
                {t('teach.att.confirm')}
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={asking}
        tone="brand"
        icon={ClipboardCheck}
        title={t('teach.att.confirmTitle', { n: session.number })}
        body={t('teach.att.confirmBody', {
          tally: STATUSES.map((status) => `${t(`att.status.${status}`)} ${tally[status]}`).join(', '),
        })}
        confirmLabel={t('teach.att.confirm')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setAsking(false)}
      />
    </section>
  );
};

export default TeacherAttendance;
