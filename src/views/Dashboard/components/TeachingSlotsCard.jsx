import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import SubjectLabel from '../../../components/ui/SubjectLabel';
import { formatNumber } from '../../TeacherAssessment/results';
import { barWidth, signalPath, signalView } from '../teachingDashboard';

/*
  "Kelas semester ini" on the teacher's dashboard (owner 2026-10-27, items B and
  C): one row per subject taught this semester, from `GET /dashboard/teaching`'s
  slots - its students placed now, materials completed of those possible and
  attendance at confirmed sessions, each with a bar - and under it the students
  needing support, opened in place. Each signal is one grey line leading to the
  subject page's tab that shows its evidence (signalView). The subject's name
  opens its page.

  @param board      readTeachingDashboard's answer: undefined while reading, null
                    when it could not be read
  @param className  the grid placement
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm text-left';

const Metric = ({ label, value, percent, bar }) => (
  <div className="space-y-1">
    <p className="flex flex-wrap justify-between gap-x-3 text-xs">
      <span className="font-semibold text-slate-500">{label}</span>
      <span className="font-bold text-slate-700 tabular-nums">{value}</span>
    </p>
    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden" aria-hidden="true">
      <div className={`h-full rounded-full ${bar}`} style={{ width: `${barWidth(percent)}%` }} />
    </div>
  </div>
);

const SlotRow = ({ slot, thresholds }) => {
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const { classSubject, content, attendance, studentsNeedingSupport: support = [] } = slot;
  const panelId = `slot-support-${classSubject.id}`;

  return (
    <li className="py-4 first:pt-0 last:pb-0 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <Link
          to={`/teacher/courses/${classSubject.id}`}
          className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
        >
          <SubjectLabel code={classSubject.subject?.code} name={classSubject.subject?.name} />
          <span className="text-slate-300" aria-hidden="true">/</span>
          <span className="font-semibold text-slate-600">{classSubject.class?.name}</span>
        </Link>
        <span className="text-xs font-semibold text-slate-500">{t('teacherDash.slots.students', { n: slot.studentsPlacedNow })}</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Metric
          label={t('teacherDash.slots.content')}
          value={
            content?.possible
              ? t('teacherDash.slots.contentValue', { done: content.completed, total: content.possible, p: content.percent })
              : t('teacherDash.slots.contentNone')
          }
          percent={content?.percent}
          bar="bg-brand"
        />
        <Metric
          label={t('teacherDash.slots.attendance')}
          value={attendance?.counted ? `${attendance.percent}%` : t('teacherDash.slots.attendanceNone')}
          percent={attendance?.percent}
          bar="bg-emerald-500"
        />
      </div>

      {support.length === 0 ? (
        <p className="text-xs font-semibold text-slate-500">{t('teacherDash.slots.supportNone')}</p>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:underline cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
          >
            {t('teacherDash.slots.support', { n: support.length })}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {open && (
            <ul id={panelId} className="mt-2 space-y-2">
              {support.map((student) => (
                <li key={student.studentProfileId} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs font-bold text-slate-800 break-words">{student.fullName ?? '-'}</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {student.signals.map((signal) => {
                      const view = signalView(signal, thresholds);
                      if (!view) return null;
                      const vars = view.number ? { ...view.vars, n: formatNumber(view.vars.n, lang) } : view.vars;
                      return (
                        <li key={signal.type}>
                          <Link
                            to={signalPath(classSubject.id, view.tab)}
                            className="text-[11px] font-semibold text-slate-600 hover:text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded"
                          >
                            {t(view.key, vars)}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
};

export const TeachingSlotsCard = ({ board, className = '' }) => {
  const { t } = useT();
  const reading = board === undefined;
  const semester = board?.semester ?? null;

  let body;
  if (reading) {
    body = <div className="h-32 rounded-xl bg-slate-50 animate-pulse" aria-label={t('common.loading')} />;
  } else if (board === null) {
    body = <p className="text-xs font-semibold text-rose-700" role="alert">{t('teacherDash.slots.failed')}</p>;
  } else if (!semester) {
    body = <p className="text-xs font-semibold text-slate-500">{t('teacherDash.slots.noSemester')}</p>;
  } else if ((board.slots ?? []).length === 0) {
    body = <p className="text-xs font-semibold text-slate-500">{t('teacherDash.slots.none')}</p>;
  } else {
    body = (
      <ul className="divide-y divide-slate-100">
        {board.slots.map((slot) => (
          <SlotRow key={slot.classSubject.id} slot={slot} thresholds={board.thresholds} />
        ))}
      </ul>
    );
  }

  return (
    <section className={`${card} ${className}`} aria-labelledby="teacher-slots-heading" aria-busy={reading}>
      <div className="mb-4">
        <h2 id="teacher-slots-heading" className="text-base font-extrabold text-slate-800 tracking-tight">
          {t('teacherDash.slots.title')}
        </h2>
        {semester && (
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {t('teacherDash.slots.semester', { n: semester.ordinal, year: semester.academicYear?.label })}
          </p>
        )}
      </div>
      {body}
    </section>
  );
};

export default TeachingSlotsCard;
