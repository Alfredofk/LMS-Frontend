import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronDown, Clock, Hourglass, MapPinOff } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { attendanceService } from '../../services/attendanceService';
import { formatDay } from '../Classes/format';
import { dayName, timeRange } from './timetable';
import { STATUSES, localOf, rosterCounts } from '../Attendance/attendance';

/*
  One meeting's attendance, read only, inside ScheduleDialog (owner, 2026-10-02):
  `GET /attendance/sessions/:id` (backend deb95e8) — every student placed in the
  class at its start, by name. Confirming and correcting are the teacher's.

  Before the teacher confirms, only check-ins carry a status; everyone else reads
  "no record yet". Each student with a record can open its changes
  (`GET /attendance/:id/history`) — fetched on the click, not for the whole roster
  at once — which is where the teacher's notes are, since a student never sees
  them. Times are the school's own (`localOf`, from the timetable's zone).
*/

const STATUS_PILL = {
  PRESENT: 'bg-emerald-50 text-emerald-700',
  SICK: 'bg-amber-50 text-amber-700',
  EXCUSED: 'bg-amber-50 text-amber-700',
  ABSENT: 'bg-rose-50 text-rose-700',
};
const pill = 'px-2 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap';

export const SessionRoster = ({ session, zone, onBack }) => {
  const { t, lang } = useT();
  const [roster, setRoster] = useState({ data: null, error: null });
  /* attendanceId → { open, changes: null | [], error } */
  const [histories, setHistories] = useState({});

  useEffect(() => {
    let cancelled = false;
    attendanceService
      .roster(session.id)
      .then((data) => !cancelled && setRoster({ data, error: null }))
      .catch((err) => !cancelled && setRoster({ data: null, error: apiErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [session.id, t]);

  const toggleHistory = useCallback(
    (attendanceId) => {
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
          setHistories((prev) => ({ ...prev, [attendanceId]: { open: true, changes: null, error: apiErrorMessage(err, t) } }))
        );
    },
    [histories, t]
  );

  const statusLabel = (status) => t(`att.status.${status}`);
  const when = (instant) => {
    const local = localOf(instant, zone);
    return local ? `${formatDay(local.date, lang)} ${local.time}` : '';
  };

  const students = roster.data?.students ?? [];
  const confirmed = roster.data?.session?.confirmed ?? Boolean(session.completedAt);
  const counts = rosterCounts(students);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-brand hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        {t('roster.back')}
      </button>

      <div className="space-y-1">
        <h3 className="text-sm font-extrabold text-slate-800">{t('timetable.session.number', { n: session.number })}</h3>
        <p className="text-[11px] font-semibold text-slate-500 tabular-nums">
          {t('timetable.session.when', {
            day: dayName(session.local.dayOfWeek, lang, 'short'),
            date: formatDay(session.local.date, lang),
            time: timeRange(session.local.start, session.local.end),
          })}
        </p>
        <p className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold ${confirmed ? 'text-emerald-700' : 'text-amber-700'}`}>
          {confirmed ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <Hourglass className="w-3.5 h-3.5" aria-hidden="true" />}
          {t(confirmed ? 'roster.confirmed' : 'roster.notConfirmed')}
        </p>
      </div>

      {roster.error ? (
        <p className="text-xs font-semibold text-red-600" role="alert">
          {roster.error}
        </p>
      ) : roster.data === null ? (
        <div className="h-24 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />
      ) : students.length === 0 ? (
        <p className="text-xs font-semibold text-slate-500">{t('roster.empty')}</p>
      ) : (
        <>
          <p className="flex flex-wrap gap-1.5">
            {STATUSES.map((status) => (
              <span key={status} className={`${pill} ${STATUS_PILL[status]} tabular-nums`}>
                {statusLabel(status)} {counts[status]}
              </span>
            ))}
            {counts.unmarked > 0 && (
              <span className={`${pill} bg-slate-100 text-slate-600 tabular-nums`}>
                {t('roster.unmarked')} {counts.unmarked}
              </span>
            )}
          </p>
          {!confirmed && <p className="text-[11px] font-semibold text-slate-500 leading-relaxed">{t('roster.notConfirmedBody')}</p>}

          <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {students.map((student) => {
              const history = student.attendanceId ? histories[student.attendanceId] : null;
              const panelId = `roster-history-${student.studentProfileId}`;
              const checkedIn = student.checkedInAt ? localOf(student.checkedInAt, zone) : null;
              return (
                <li key={student.studentProfileId} className="px-3 py-2 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-800 break-words">{student.fullName ?? '—'}</span>
                      {checkedIn && (
                        <span className="block text-[11px] font-semibold text-slate-500 tabular-nums">
                          {t('att.checkedInAt', { time: checkedIn.time })}
                        </span>
                      )}
                      {(student.late || student.outsideSchool) && (
                        <span className="flex flex-wrap gap-1 mt-0.5">
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
                      )}
                    </span>
                    <span className="flex flex-col items-end gap-1 shrink-0">
                      {student.status ? (
                        <span className={`${pill} ${STATUS_PILL[student.status] ?? 'bg-slate-100 text-slate-600'}`}>{statusLabel(student.status)}</span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-500">{t('roster.unmarked')}</span>
                      )}
                      {student.attendanceId && (
                        <button
                          type="button"
                          onClick={() => toggleHistory(student.attendanceId)}
                          aria-expanded={Boolean(history?.open)}
                          aria-controls={panelId}
                          className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-brand hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                        >
                          {t('roster.history')}
                          <ChevronDown className={`w-3 h-3 transition-transform ${history?.open ? 'rotate-180' : ''}`} aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  </div>

                  {history?.open && (
                    <div id={panelId} className="rounded-lg bg-slate-50 px-3 py-2">
                      {history.error ? (
                        <p className="text-[11px] font-semibold text-red-600" role="alert">
                          {history.error}
                        </p>
                      ) : history.changes === null ? (
                        <p className="text-[11px] font-semibold text-slate-500">{t('common.loading')}</p>
                      ) : history.changes.length === 0 ? (
                        <p className="text-[11px] font-semibold text-slate-500">{t('roster.history.none')}</p>
                      ) : (
                        <ol className="space-y-1.5">
                          {history.changes.map((change) => (
                            <li key={change.id} className="text-[11px] leading-relaxed">
                              <span className="block font-extrabold text-slate-800">
                                {statusLabel(change.fromStatus)} → {statusLabel(change.toStatus)}
                              </span>
                              {change.note && <span className="block font-semibold text-slate-600 break-words">“{change.note}”</span>}
                              <span className="block font-semibold text-slate-500 tabular-nums">
                                {t('roster.history.by', { name: change.changedBy?.fullName ?? '—', when: when(change.at) })}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
};

export default SessionRoster;
