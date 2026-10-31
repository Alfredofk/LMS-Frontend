import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CircleCheck, Clock, Info } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { attendanceService } from '../../services/attendanceService';
import { formatDay } from '../Classes/format';
import { dayName, timeRange } from './timetable';
import { checkInFactsOf, rosterCounts } from '../Attendance/attendance';
import { AttendanceSummary, HistoryTimeline, PersonLine, RosterError, RosterSkeleton, StatusWord } from '../Attendance/RosterParts';

/*
  One meeting's attendance, read only, inside ScheduleDialog (owner, 2026-10-02):
  `GET /attendance/sessions/:id` (backend deb95e8) — every student placed in the
  class at its start, by name. Confirming and correcting are the teacher's.
  Before the teacher confirms, only check-ins carry a status; everyone else reads
  "no record yet". Each student with a record can open its changes
  (`GET /attendance/:id/history`) — fetched on the click, not for the whole roster
  at once — which is where the teacher's notes are, since a student never sees
  them. Times are the school's own (`localOf`, from the timetable's zone).

  Its look is the teacher's (mockup kehadiran-guru-wali.html, item 12): the
  counts over one bar, a row per student with initials, the status a coloured
  word, the history a timeline.
*/

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

  const students = roster.data?.students ?? [];
  const confirmed = roster.data?.session?.confirmed ?? Boolean(session.completedAt);
  const counts = rosterCounts(students);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-brand hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        {t('roster.back')}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-extrabold text-slate-900 tracking-tight">{t('timetable.session.number', { n: session.number })}</h3>
          <p className="mt-0.5 text-[13px] font-medium text-slate-500 tabular-nums">
            {t('timetable.session.when', {
              day: dayName(session.local.dayOfWeek, lang, 'short'),
              date: formatDay(session.local.date, lang),
              time: timeRange(session.local.start, session.local.end),
            })}
          </p>
        </div>
        <p className={`inline-flex items-center gap-1.5 pt-0.5 text-[12.5px] font-extrabold ${confirmed ? 'text-emerald-700' : 'text-amber-700'}`}>
          {confirmed ? <CircleCheck className="w-3.5 h-3.5" aria-hidden="true" /> : <Clock className="w-3.5 h-3.5" aria-hidden="true" />}
          {t(confirmed ? 'roster.confirmed' : 'roster.notConfirmed')}
        </p>
      </div>

      {roster.error ? (
        <RosterError>{roster.error}</RosterError>
      ) : roster.data === null ? (
        <RosterSkeleton />
      ) : students.length === 0 ? (
        <p className="text-[13px] font-medium text-slate-500">{t('roster.empty')}</p>
      ) : (
        <>
          <AttendanceSummary counts={counts} extra={counts.unmarked > 0 || !confirmed ? { label: t('roster.unmarked'), n: counts.unmarked } : null} total={students.length} />
          {!confirmed && (
            <p className="flex items-start gap-2 text-[13px] font-medium text-slate-600 leading-relaxed">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-500" aria-hidden="true" />
              {t('roster.notConfirmedBody')}
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {students.map((student) => {
              const history = student.attendanceId ? histories[student.attendanceId] : null;
              const panelId = `roster-history-${student.studentProfileId}`;
              return (
                <li key={student.studentProfileId} className="py-3 px-1">
                  <PersonLine name={student.fullName ?? '-'} facts={checkInFactsOf(student, zone, t)}>
                    <span className="flex flex-wrap items-center gap-1">
                      <StatusWord status={student.status} unmarkedLabel={t('roster.unmarked')} />
                      {student.attendanceId && (
                        <button
                          type="button"
                          onClick={() => toggleHistory(student.attendanceId)}
                          aria-expanded={Boolean(history?.open)}
                          aria-controls={panelId}
                          className={`ml-2 px-2 py-1 rounded-lg text-[12.5px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                            history?.open ? 'bg-slate-100' : ''
                          }`}
                        >
                          {t('roster.history')}
                        </button>
                      )}
                    </span>
                  </PersonLine>
                  {history?.open && <HistoryTimeline history={history} zone={zone} id={panelId} />}
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
