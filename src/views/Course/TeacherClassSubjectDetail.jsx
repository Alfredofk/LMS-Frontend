import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, BookOpen, RefreshCw } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import MeetingStrip from '../../components/meetings/MeetingStrip';
import SubjectHeader from '../../components/meetings/SubjectHeader';
import SubjectProgress from '../Subjects/SubjectProgress';
import { defaultMeetingId, progressOf, shownSessions } from '../Classroom/myClasses';
import { readMyTeaching, forgetMyTeaching } from './readMyTeaching';
import { sessionPhase, unconfirmedCount } from './teaching';
import TeacherMeeting from './TeacherMeeting';

/*
  One subject a teacher teaches (owner, 2026-10-04; it replaced the teammate's
  sample-data page): the same shape as a student's subject page - the subject and
  its facts, then two tabs.

  - "Pertemuan": the meetings as a row of tabs (MeetingStrip), a dot on each one
    begun and not yet confirmed; the chosen one (`?pertemuan=<id>`, else the one on
    now or next - defaultMeetingId) renders TeacherMeeting: its attendance to
    confirm or correct, and its materials to add, publish, order and delete.
  - "Progres" (`?tab=progres`): the class's learning progress, per student and per
    material (SubjectProgress, the panel the Principal opens from the timetable).

  The subject and its meetings come from readMyTeaching; a meeting changed here
  (confirmed, said not held) updates in place and drops that cache.
*/

const SECTIONS = ['pertemuan', 'progres'];
const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm';

export const TeacherClassSubjectDetail = () => {
  const { classSubjectId } = useParams();
  const { t } = useT();
  const { showToast } = useOutletContext() ?? {};
  const { membership } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /* Meetings changed on this page, by id, over what was read. */
  const [changedById, setChangedById] = useState({});

  useEffect(() => {
    let cancelled = false;
    readMyTeaching(membership?.id, { fresh: attempt > 0 })
      .then((answer) => {
        if (cancelled) return;
        setData(answer);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [attempt, membership?.id]);

  const entry = data?.rows.find((row) => row.id === classSubjectId) ?? null;
  const live = Boolean(entry && entry.status === 'ACTIVE' && !entry.endedAt);
  const raw = data?.sessionsById?.[classSubjectId];
  const sessions = useMemo(
    () =>
      Array.isArray(raw)
        ? shownSessions(raw.map((session) => changedById[session.id] ?? session)).sort((a, b) => a.number - b.number)
        : null,
    [raw, changedById]
  );

  const section = SECTIONS.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'pertemuan';
  const asked = searchParams.get('pertemuan');
  const selectedId = sessions ? (sessions.some((session) => session.id === asked) ? asked : defaultMeetingId(sessions)) : null;
  const selected = sessions?.find((session) => session.id === selectedId) ?? null;
  const progress = progressOf(sessions);
  const percent = progress?.total ? Math.round((progress.held / progress.total) * 100) : 0;
  const owed = sessions ? unconfirmedCount(sessions) : 0;

  const pick = (id) => setSearchParams({ pertemuan: id });
  const goSection = (next) => setSearchParams(next === 'pertemuan' ? (selectedId ? { pertemuan: selectedId } : {}) : { tab: next });

  const onChanged = (session) => {
    if (!session) return;
    forgetMyTeaching();
    setChangedById((prev) => ({ ...prev, [session.id]: { ...(prev[session.id] ?? sessions.find((s) => s.id === session.id)), ...session } }));
  };

  if (failed && !data) {
    return (
      <div className={`${card} flex flex-col items-center text-center gap-3 py-10`} role="alert">
        <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-700">{t('teach.failed')}</p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          {t('att.error.retry')}
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t('common.loading')}>
        <div className="h-36 rounded-2xl bg-white border border-slate-100 animate-pulse" />
        <div className="h-64 rounded-2xl bg-white border border-slate-100 animate-pulse" />
      </div>
    );
  }

  if (!live) {
    return (
      <div className={`${card} flex flex-col items-center text-center gap-3 py-10`}>
        <BookOpen className="w-8 h-8 text-slate-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-600 max-w-sm">{t(entry ? 'teach.notLive' : 'teach.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SubjectHeader
        code={entry.subject.code}
        name={entry.subject.name}
        facts={[
          { label: t('person.class'), value: entry.class.name },
          { label: t('classroom.semesters'), value: entry.semester.ordinal },
          { label: t('person.year'), value: entry.semester.academicYear },
          {
            label: t('teach.fact.unconfirmed'),
            value: <span className={owed > 0 ? 'text-amber-700' : 'text-slate-800'}>{sessions ? owed : '-'}</span>,
          },
        ]}
        progress={progress?.total > 0 ? { label: t('classroom.progress', { held: progress.held, total: progress.total }), percent } : null}
      />

      <div role="tablist" aria-label={t('meeting.sections')} className="flex gap-6 border-b border-slate-200">
        {SECTIONS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={section === key}
            onClick={() => goSection(key)}
            className={`px-1 pb-3 -mb-px text-sm font-extrabold border-b-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-t ${
              section === key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(`teach.section.${key}`)}
          </button>
        ))}
      </div>

      {section === 'progres' ? (
        <div className={`${card} sm:p-6`}>
          <SubjectProgress classSubjectId={entry.id} zone={membership?.school?.timeZone ?? null} />
        </div>
      ) : sessions === null ? (
        <p className={`${card} text-sm font-semibold text-amber-700`}>{t('classroom.meetingsFailed')}</p>
      ) : sessions.length === 0 ? (
        <p className={`${card} text-sm font-semibold text-slate-600`}>{t('teach.noTimetable')}</p>
      ) : (
        <div className="space-y-5">
          <MeetingStrip
            sessions={sessions}
            selectedId={selectedId}
            onPick={pick}
            dotOf={(session) => (['running', 'awaiting'].includes(sessionPhase(session)) ? 'bg-amber-400' : null)}
          />
          {selected && <TeacherMeeting key={selected.id} meeting={selected} onChanged={onChanged} showToast={showToast} />}
        </div>
      )}
    </div>
  );
};

export default TeacherClassSubjectDetail;
