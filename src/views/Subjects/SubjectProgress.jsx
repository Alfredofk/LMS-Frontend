import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { trackingService } from '../../services/trackingService';
import { formatDay } from '../Classes/format';
import { localOf } from '../Attendance/attendance';
import { rateOf } from '../Classroom/myProgress';

/*
  One subject's learning progress, read only, inside ScheduleDialog (owner,
  2026-10-04): `GET /tracking/class-subjects/:id/progress` (backend 0dd8b44/39fda6c,
  teaching-and-learning ticket 06) - `{ classSubject, confirmedSessions, rosterSize,
  contents: [{ id, title, type, session: { id, number }, publishedAt, opened,
  completed }], students: [{ studentProfileId, fullName, placedNow, contents:
  { published, opened, completed }, attendance: { counted, present, ... },
  lastActivityAt }] }`, over the subject's whole slot.

  Two views: per student (materials completed, attendance over confirmed
  meetings, last activity) and per material (how many of the roster opened and
  completed it). A student no longer in the class keeps their row, marked.
*/

const VIEWS = ['students', 'contents'];

export const SubjectProgress = ({ classSubjectId, zone, onBack }) => {
  const { t, lang } = useT();
  const [state, setState] = useState({ data: null, error: null });
  const [view, setView] = useState('students');

  useEffect(() => {
    let cancelled = false;
    trackingService
      .classSubjectProgress(classSubjectId)
      .then((data) => !cancelled && setState({ data, error: null }))
      .catch((err) => !cancelled && setState({ data: null, error: apiErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [classSubjectId, t]);

  const when = (instant) => {
    const local = instant ? localOf(instant, zone) : null;
    return local ? `${formatDay(local.date, lang)}, ${local.time}` : null;
  };

  const data = state.data;

  return (
    <div className="space-y-3">
      {/* In the timetable dialog it is opened in place and goes back; on a teacher's
          subject page it is a tab of its own (owner, 2026-10-04). */}
      {onBack && (
        <>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-brand hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            {t('progress.back')}
          </button>
          <h3 className="text-sm font-extrabold text-slate-800">{t('progress.title')}</h3>
        </>
      )}

      {state.error ? (
        <p className="text-xs font-semibold text-red-600" role="alert">
          {state.error}
        </p>
      ) : data === null ? (
        <div className="h-24 bg-slate-50 rounded-xl animate-pulse" aria-label={t('common.loading')} />
      ) : (
        <>
          <p className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs font-medium text-slate-500 tabular-nums">
            <span>{t('progress.rosterSize', { n: data.rosterSize })}</span>
            <span>{t('progress.contentCount', { n: data.contents.length })}</span>
            <span>{t('progress.confirmedSessions', { n: data.confirmedSessions })}</span>
          </p>

          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100" role="tablist" aria-label={t('progress.title')}>
            {VIEWS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={`py-1.5 rounded-lg text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  view === key ? 'bg-white text-brand shadow-sm' : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {t(`progress.view.${key}`)}
              </button>
            ))}
          </div>

          {view === 'students' ? (
            data.students.length === 0 ? (
              <p className="text-xs font-semibold text-slate-500">{t('progress.noStudents')}</p>
            ) : (
              <ul className="divide-y divide-slate-100" role="tabpanel">
                {data.students.map((student) => {
                  const done = rateOf(student.contents?.completed ?? 0, student.contents?.published ?? 0);
                  const present = rateOf(student.attendance?.present ?? 0, student.attendance?.counted ?? 0);
                  const last = when(student.lastActivityAt);
                  return (
                    <li key={student.studentProfileId} className="py-2.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-xs font-extrabold text-slate-800 break-words">
                            {student.fullName ?? t('progress.unnamed')}
                            {!student.placedNow && (
                              <span className="ml-1.5 align-middle px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                                {t('progress.notPlacedNow')}
                              </span>
                            )}
                          </span>
                          <span className="block text-[11px] font-semibold text-slate-500">
                            {last ? t('progress.lastActivity', { when: last }) : t('progress.noActivity')}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-[11px] font-semibold text-slate-500 tabular-nums">
                          <span className="block">
                            {t('progress.attendance')}{' '}
                            <span className="font-extrabold text-slate-800">{present === null ? '-' : `${present}%`}</span>
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${done ?? 0}%` }} />
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold text-slate-500 tabular-nums">
                          {t('progress.materialsDone', {
                            done: student.contents?.completed ?? 0,
                            total: student.contents?.published ?? 0,
                          })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : data.contents.length === 0 ? (
            <p className="text-xs font-semibold text-slate-500">{t('progress.noContents')}</p>
          ) : (
            <ul className="divide-y divide-slate-100" role="tabpanel">
              {data.contents.map((content) => {
                const done = rateOf(content.completed, data.rosterSize);
                return (
                  <li key={content.id} className="py-2.5 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block text-xs font-extrabold text-slate-800 break-words">{content.title}</span>
                        <span className="block text-[11px] font-semibold text-slate-500">
                          {t('timetable.session.number', { n: content.session?.number })}, {t(`content.type.${content.type}`)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-500 tabular-nums text-right">
                        {t('progress.opened', { n: content.opened, total: data.rosterSize })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
                        <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${done ?? 0}%` }} />
                      </span>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-500 tabular-nums">
                        {t('progress.completedBy', { n: content.completed, total: data.rosterSize })}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default SubjectProgress;
