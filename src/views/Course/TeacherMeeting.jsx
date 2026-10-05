import React, { useState } from 'react';
import { Ban, CalendarClock } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { useT } from '../../i18n/LanguageContext';
import { teachAttendanceErrorMessage } from '../../i18n/apiError';
import { sessionsService } from '../../services/sessionsService';
import { meetingWhen } from '../Classroom/myClasses';
import { sessionPhase } from './teaching';
import TeacherAttendance from './TeacherAttendance';
import TeacherMaterials from './TeacherMaterials';

/*
  One meeting on a teacher's subject page (owner, 2026-10-04): which meeting and
  where it stands, then its attendance (TeacherAttendance) and its materials
  (TeacherMaterials), side by side on a wide screen. A meeting the timetable made
  already past (`needsCompletion`) can be said not to have taken place
  (`POST /sessions/:id/not-held`) instead of being confirmed.

  Keyed on the meeting by its parent, so another meeting starts fresh.

  @param onChanged(session) the meeting changed on the server (confirmed, not held)
*/

const PHASE_PILL = {
  upcoming: 'bg-slate-100 text-slate-600',
  running: 'bg-emerald-50 text-emerald-700',
  awaiting: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-50 text-rose-700',
};

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';

export const TeacherMeeting = ({ meeting, onChanged, showToast, readOnly = false }) => {
  const { t, lang } = useT();
  const phase = sessionPhase(meeting);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const canSayNotHeld =
    !readOnly && meeting.needsCompletion && meeting.status === 'SCHEDULED' && phase !== 'upcoming' && phase !== 'confirmed';

  const notHeld = async () => {
    setBusy(true);
    try {
      const updated = await sessionsService.notHeld(meeting.id);
      showToast?.(t('teach.notHeld.done', { n: meeting.number }), 'success');
      setAsking(false);
      onChanged?.(updated);
    } catch (err) {
      setAsking(false);
      showToast?.(teachAttendanceErrorMessage(err, t), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className={`${card} flex flex-col sm:flex-row sm:items-start justify-between gap-3`}>
        <div className="space-y-2 min-w-0">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{t('meeting.title', { n: meeting.number })}</h2>
          <p className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-700 tabular-nums">
            <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5 text-brand shrink-0" aria-hidden="true" />
            {meetingWhen(meeting, lang, { withEnd: true, weekday: 'long' })}
          </p>
          {meeting.topic && <p className="text-sm font-semibold text-slate-600">{t('classroom.topic', { topic: meeting.topic })}</p>}
          {meeting.status === 'CANCELLED' && (
            <p className="text-sm font-semibold text-rose-700">{t(`timetable.session.cancelled.${meeting.cancelReason ?? 'OTHER'}`)}</p>
          )}
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${PHASE_PILL[phase]}`}>{t(`teach.phase.${phase}`)}</span>
          {canSayNotHeld && (
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-700 hover:bg-rose-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
            >
              <Ban className="w-3.5 h-3.5" aria-hidden="true" />
              {t('teach.notHeld.action')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        <div className={card}>
          <TeacherAttendance
            session={meeting}
            phase={phase}
            readOnly={readOnly}
            showToast={showToast}
            onConfirmed={(session) => onChanged?.({ ...meeting, completedAt: session?.completedAt ?? new Date().toISOString(), needsCompletion: false })}
          />
        </div>
        <div className={card}>
          <TeacherMaterials session={meeting} showToast={showToast} readOnly={readOnly} />
        </div>
      </div>

      <ConfirmDialog
        open={asking}
        tone="danger"
        icon={Ban}
        title={t('teach.notHeld.title', { n: meeting.number })}
        body={t('teach.notHeld.body')}
        confirmLabel={t('teach.notHeld.action')}
        cancelLabel={t('common.cancel')}
        busy={busy}
        onConfirm={notHeld}
        onCancel={() => setAsking(false)}
      />
    </div>
  );
};

export default TeacherMeeting;
