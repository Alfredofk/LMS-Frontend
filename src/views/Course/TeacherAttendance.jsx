import React, { useCallback, useEffect, useState } from 'react';
import { CircleCheck, Clock, ClipboardCheck, Info, RefreshCw } from 'lucide-react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { teachAttendanceErrorMessage } from '../../i18n/apiError';
import { attendanceService } from '../../services/attendanceService';
import { STATUSES, STATUS_TEXT, STATUS_TILE, checkInFactsOf, rosterCounts } from '../Attendance/attendance';
import { AttendanceSummary, HistoryTimeline, PersonLine, RosterError, RosterSkeleton, StatusWord, rowPanel } from '../Attendance/RosterParts';
import { attendanceCount, confirmStatuses, confirmTally, defaultStatusOf } from './teaching';

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
  - Begun, not confirmed, nobody in the class: "Confirm" still shows - the
    server takes an empty confirmation as "the meeting happened" and clears its
    needs-completion mark; without it the Principal's waiting card never empties
    (owner, 2026-10-17).
  - Cancelled: nothing to take.

  The look is the mockup kehadiran-guru-wali.html (owner, 2026-10-30, items 1-7):
  the counts first, a row per student with initials and a slash line, the choice
  beside the name, the confirmation under a rule, the status a coloured word once
  confirmed, a correction and the history opened under the name.
*/

const segment = (on, status) =>
  `px-3 py-1.5 text-[12.5px] font-bold rounded-[9px] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed ${
    on ? STATUS_TILE[status] + ' ring-1 ring-inset ring-slate-900/10' : 'text-slate-600 hover:bg-slate-100'
  }`;

const textLink = 'px-2 py-1 rounded-lg text-[12.5px] font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand';
const field =
  'w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';

const StatusPicker = ({ value, onPick, disabled, name, t }) => (
  <div role="radiogroup" aria-label={t('teach.att.statusFor', { name })} className="inline-flex flex-wrap gap-1 p-[3px] rounded-xl bg-slate-50 border border-slate-200">
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

export const TeacherAttendance = ({ session, phase, onConfirmed, onCount, showToast, readOnly = false }) => {
  const { t } = useT();
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
  /* readOnly: a closed year's subject, looked back at (owner, 2026-10-05). */
  const editable = !readOnly && !confirmed && (phase === 'running' || phase === 'awaiting');
  const tally = confirmTally(students, picks);
  const changed = confirmStatuses(students, picks, notes);

  /* The count beside TeacherMeeting's "Kehadiran" sub-tab. */
  useEffect(() => {
    onCount?.(attendanceCount(roster?.students, confirmed));
  }, [roster, confirmed, onCount]);

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
  else if (editable) intro = roster && students.length === 0 ? t('teach.att.editableEmpty') : t('teach.att.editable');

  const tallyText = STATUSES.map((status) => `${t(`att.status.${status}`)} ${tally[status]}`).join(', ');
  /* The counts at the top (item 1): what confirming will record while it can be confirmed, the records once it is. */
  const summary =
    students.length === 0 || phase === 'upcoming' || phase === 'cancelled'
      ? null
      : editable
        ? { counts: tally, extra: { label: t('teach.att.noCheckIn'), n: students.filter((student) => !student.checkedInAt).length } }
        : (() => {
            const counts = rosterCounts(students);
            return { counts, extra: confirmed ? null : { label: t('roster.unmarked'), n: counts.unmarked } };
          })();

  const confirmBar = editable && (
    <div className={`flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 ${students.length > 0 ? 'justify-between' : 'justify-end'}`}>
      {students.length > 0 && (
        <p className="text-[13px] font-semibold text-slate-600 tabular-nums">
          {STATUSES.map((status, i) => (
            <React.Fragment key={status}>
              {i > 0 && (
                <span className="mx-1.5 text-slate-300" aria-hidden="true">
                  /
                </span>
              )}
              <span className={tally[status] > 0 ? `font-extrabold ${STATUS_TEXT[status]}` : ''}>
                {t(`att.status.${status}`)} {tally[status]}
              </span>
            </React.Fragment>
          ))}
        </p>
      )}
      <Button size="sm" onClick={() => setAsking(true)} isDisabled={busy}>
        <ClipboardCheck className="w-4 h-4 mr-2" aria-hidden="true" />
        {t('teach.att.confirm')}
      </Button>
    </div>
  );

  return (
    <section className="space-y-4" aria-labelledby={`attendance-${session.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`attendance-${session.id}`} className="text-[15px] font-extrabold text-slate-900 tracking-tight">
          {t('teach.att.heading', { n: session.number })}
        </h3>
        {roster && (
          <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-extrabold ${confirmed ? 'text-emerald-700' : 'text-amber-700'}`}>
            {confirmed ? <CircleCheck className="w-3.5 h-3.5" aria-hidden="true" /> : <Clock className="w-3.5 h-3.5" aria-hidden="true" />}
            {t(confirmed ? 'roster.confirmed' : 'roster.notConfirmed')}
          </span>
        )}
      </div>

      {error ? (
        <RosterError
          action={
            <Button size="sm" variant="outline" onClick={reload}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              {t('att.error.retry')}
            </Button>
          }
        >
          {error}
        </RosterError>
      ) : roster === undefined ? (
        <RosterSkeleton />
      ) : (
        <>
          {summary && <AttendanceSummary counts={summary.counts} extra={summary.extra} total={students.length} />}
          {intro && (
            <p className="flex items-start gap-2 text-[13px] font-medium text-slate-600 leading-relaxed">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" aria-hidden="true" />
              {intro}
            </p>
          )}

          {students.length === 0 ? (
            <p className="text-[13px] font-medium text-slate-500">{t('roster.empty')}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {students.map((student) => {
                const id = student.studentProfileId;
                const name = student.fullName ?? t('progress.unnamed');
                const current = picks[id] ?? defaultStatusOf(student);
                const differs = editable && current !== defaultStatusOf(student);
                const history = student.attendanceId ? histories[student.attendanceId] : null;
                const isFixing = fixing?.student.studentProfileId === id;
                const facts = checkInFactsOf(student, zone, t, { noCheckIn: phase === 'upcoming' ? null : t('teach.att.noCheckIn') });
                return (
                  <li key={id} className="py-3 px-1">
                    <PersonLine
                      name={name}
                      facts={facts}
                      marker={differs && <span className="ml-1.5 text-[11.5px] font-bold text-brand">{t('teach.att.changed')}</span>}
                    >
                      {editable ? (
                        <StatusPicker value={current} disabled={busy} name={name} t={t} onPick={(status) => setPicks((prev) => ({ ...prev, [id]: status }))} />
                      ) : confirmed && student.status ? (
                        <span className="flex flex-wrap items-center gap-1">
                          <StatusWord status={student.status} />
                          {!readOnly && !isFixing && student.attendanceId && (
                            <>
                              <button
                                type="button"
                                onClick={() => setFixing({ student, status: student.status, note: '', error: null })}
                                className={`${textLink} ml-2 text-brand hover:bg-brand-tint`}
                              >
                                {t('teach.att.change')}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleHistory(student.attendanceId)}
                                aria-expanded={Boolean(history?.open)}
                                aria-controls={`att-history-${id}`}
                                className={`${textLink} text-slate-600 hover:bg-slate-100 ${history?.open ? 'bg-slate-100' : ''}`}
                              >
                                {t('roster.history')}
                              </button>
                            </>
                          )}
                        </span>
                      ) : null}
                    </PersonLine>

                    {differs && (
                      <input
                        type="text"
                        value={notes[id] ?? ''}
                        maxLength={500}
                        disabled={busy}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [id]: e.target.value }))}
                        placeholder={t('teach.att.notePlaceholder')}
                        aria-label={t('teach.att.noteFor', { name })}
                        className={`${field} mt-2.5 sm:ml-[46px] sm:w-[calc(100%-46px)]`}
                      />
                    )}

                    {isFixing && (
                      <div className={`${rowPanel} space-y-3`}>
                        <StatusPicker
                          value={fixing.status}
                          disabled={busy}
                          name={name}
                          t={t}
                          onPick={(status) => setFixing((prev) => ({ ...prev, status, error: null }))}
                        />
                        <div>
                          <input
                            type="text"
                            value={fixing.note}
                            maxLength={500}
                            disabled={busy}
                            onChange={(e) => setFixing((prev) => ({ ...prev, note: e.target.value, error: null }))}
                            placeholder={t('teach.att.correctionNote')}
                            aria-label={t('teach.att.correctionNote')}
                            aria-describedby={`fix-hint-${id}`}
                            className={field}
                          />
                          {/* The rule stays on screen: a placeholder alone was cut at 320px and gone once typing (audit 2026-10-08). */}
                          <p id={`fix-hint-${id}`} className="mt-1 text-xs font-medium text-slate-500 leading-relaxed">
                            {t('teach.att.correctionHint')}
                          </p>
                        </div>
                        {fixing.error && <RosterError>{fixing.error}</RosterError>}
                        <div className="flex flex-wrap gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setFixing(null)} isDisabled={busy}>
                            {t('common.cancel')}
                          </Button>
                          <Button size="sm" onClick={saveCorrection} isLoading={busy}>
                            {t('teach.att.saveCorrection')}
                          </Button>
                        </div>
                      </div>
                    )}

                    {history?.open && <HistoryTimeline history={history} zone={zone} id={`att-history-${id}`} />}
                  </li>
                );
              })}
            </ul>
          )}

          {confirmBar}
        </>
      )}

      <ConfirmDialog
        open={asking}
        tone="brand"
        icon={ClipboardCheck}
        title={t('teach.att.confirmTitle', { n: session.number })}
        body={students.length > 0 ? t('teach.att.confirmBody', { tally: tallyText }) : t('teach.att.confirmBodyEmpty')}
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
