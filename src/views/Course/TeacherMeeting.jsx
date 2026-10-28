import React, { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Ban } from 'lucide-react';

import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import FactLine from '../../components/ui/FactLine';
import { useT } from '../../i18n/LanguageContext';
import { teachAttendanceErrorMessage } from '../../i18n/apiError';
import { sessionsService } from '../../services/sessionsService';
import { meetingWhen } from '../Classroom/myClasses';
import { sessionPhase } from './teaching';
import TeacherAttendance from './TeacherAttendance';
import TeacherMaterials from './TeacherMaterials';

/*
  One meeting on a teacher's subject page (owner, 2026-10-04): which meeting and
  where it stands, then two sub-tabs (owner, 2026-10-12: a roster of 30 beside the
  materials pushed them out of sight): "Materi" (TeacherMaterials) and
  "Kehadiran 12/30" (TeacherAttendance; checked in so far, or present once
  confirmed). Both stay mounted, the other one hidden, so statuses picked and not
  yet confirmed survive a switch and the count shows before the tab is opened. It
  opens on Kehadiran while the meeting runs or waits for its confirmation, else on
  Materi; a choice lives in `?bagian=`. A meeting the timetable made
  already past (`needsCompletion`) can be said not to have taken place
  (`POST /sessions/:id/not-held`) instead of being confirmed.

  Keyed on the meeting by its parent, so another meeting starts fresh.

  @param onChanged(session) the meeting changed on the server (confirmed, not held)
*/

/* Where the meeting stands, a coloured word opening its grey line rather than a pill
   (owner, 2026-10-28, the reviewed mockup; as on the student's meeting). */
const PHASE_WORD = {
  upcoming: 'text-slate-600',
  running: 'text-emerald-700',
  awaiting: 'text-amber-700',
  confirmed: 'text-emerald-700',
  cancelled: 'text-rose-700',
};

const card = 'bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm';

const PARTS = ['materi', 'kehadiran'];

export const TeacherMeeting = ({ meeting, onChanged, showToast, readOnly = false }) => {
  const { t, lang } = useT();
  const phase = sessionPhase(meeting);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [count, setCount] = useState(null);
  const onCount = useCallback((next) => setCount(next), []);
  const asked = searchParams.get('bagian');
  const part = PARTS.includes(asked) ? asked : phase === 'running' || phase === 'awaiting' ? 'kehadiran' : 'materi';
  const choosePart = (next) => {
    const params = new URLSearchParams(searchParams);
    params.set('bagian', next);
    setSearchParams(params, { replace: true });
  };
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
          <FactLine
            wrap
            className="tabular-nums"
            facts={[
              <span key="phase" className={`font-bold ${PHASE_WORD[phase]}`}>
                {t(`teach.phase.${phase}`)}
              </span>,
              meetingWhen(meeting, lang, { withEnd: true, weekday: 'long' }),
              meeting.topic && t('classroom.topic', { topic: meeting.topic }),
            ]}
          />
          {meeting.status === 'CANCELLED' && (
            <p className="text-sm font-semibold text-rose-700">{t(`timetable.session.cancelled.${meeting.cancelReason ?? 'OTHER'}`)}</p>
          )}
        </div>
        {canSayNotHeld && (
          <Button size="sm" variant="dangerOutline" className="self-start shrink-0" onClick={() => setAsking(true)}>
            {t('teach.notHeld.action')}
          </Button>
        )}
      </div>

      <div className={`${card} space-y-5`}>
        {/* The dashboards' text tabs, the count in a grey round (owner, 2026-10-28). */}
        <div role="tablist" aria-label={t('teach.part.label')} className="flex gap-0.5 select-none shadow-[inset_0_-1px_0_var(--color-slate-100)]">
          {PARTS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`meeting-part-${key}`}
              aria-selected={part === key}
              aria-controls={`meeting-panel-${key}`}
              onClick={() => choosePart(key)}
              className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:text-brand ${
                part === key ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              {t(`teach.part.${key}`)}
              {key === 'kehadiran' && count && phase !== 'upcoming' && phase !== 'cancelled' && (
                <span className="ml-1.5 px-1.5 rounded-full text-[11px] bg-slate-100 text-slate-600 tabular-nums">{t('teach.part.count', count)}</span>
              )}
            </button>
          ))}
        </div>
        <div id="meeting-panel-materi" role="tabpanel" aria-labelledby="meeting-part-materi" hidden={part !== 'materi'}>
          <TeacherMaterials session={meeting} showToast={showToast} readOnly={readOnly} />
        </div>
        <div id="meeting-panel-kehadiran" role="tabpanel" aria-labelledby="meeting-part-kehadiran" hidden={part !== 'kehadiran'}>
          <TeacherAttendance
            session={meeting}
            phase={phase}
            readOnly={readOnly}
            showToast={showToast}
            onCount={onCount}
            onConfirmed={(session) => onChanged?.({ ...meeting, completedAt: session?.completedAt ?? new Date().toISOString(), needsCompletion: false })}
          />
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
