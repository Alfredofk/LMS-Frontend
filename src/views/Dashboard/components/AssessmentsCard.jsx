import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardList } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import { assessmentService } from '../../../services/assessmentService';
import StateWord from '../../TeacherAssessment/StateWord';
import { dashboardAssessments, windowText } from '../../TeacherAssessment/teacherAssessment';

/*
  The teacher's assessments on the dashboard (owner, 2026-10-08), in the place
  "Pengumpulan terbaru" held while it had no route: what is open now, what opens
  next and drafts not yet published, across every subject taught now
  (dashboardAssessments). One GET /assessments/class-subjects/:id per live
  assignment; a list that fails is left out, and only every one failing says so.
  At most five rows, the rest counted with a way to "Kelas Saya". A row opens the
  assessment's page through the teacher's own class subject.

  @param live       the live `?mine=true` rows (liveAssignments): undefined while
                    reading, null when they could not be read
  @param zone       the school's zone, for the windows
  @param className  the grid placement
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-left';

export const AssessmentsCard = ({ live, zone, className = '' }) => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  /* undefined: reading · { items, more, counts } · null: every list failed */
  const [data, setData] = useState(undefined);

  useEffect(() => {
    if (!live) return undefined;
    let cancelled = false;
    Promise.allSettled(live.map((row) => assessmentService.listFor(row.id).then((assessments) => ({ row, assessments })))).then((results) => {
      if (cancelled) return;
      const lists = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
      setData(live.length > 0 && lists.length === 0 ? null : dashboardAssessments(lists));
    });
    return () => {
      cancelled = true;
    };
  }, [live]);

  const reading = live === undefined || (live && data === undefined);
  const empty = live?.length === 0 || data?.items.length === 0;

  let body;
  if (reading) {
    body = <div className="h-40 rounded-xl bg-slate-50 animate-pulse" aria-label={t('common.loading')} />;
  } else if (live === null || data === null) {
    body = <p className="text-xs font-semibold text-rose-700" role="alert">{t('teacherDash.asm.failed')}</p>;
  } else if (empty) {
    body = (
      <div className="py-10 px-4 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
        <ClipboardList className="w-7 h-7 text-slate-300 mb-2" aria-hidden="true" />
        <p className="text-xs font-semibold text-slate-600">{t('teacherDash.asm.empty')}</p>
        <p className="mt-1 text-[11px] font-medium text-slate-500 max-w-xs">{t('teacherDash.asm.emptyHint')}</p>
      </div>
    );
  } else {
    body = (
      <div className="space-y-1">
        <ul className="space-y-1">
          {data.items.map(({ assessment, row, group }, i) => {
            /* A group is named above its first row. */
            const heading = i === 0 || data.items[i - 1].group !== group ? group : null;
            return (
              <li key={assessment.id}>
                {heading && (
                  <p className="px-1 pt-2 pb-1 text-[11px] font-bold text-slate-500">
                    {t(`teacherDash.asm.group.${heading}`, { n: data.counts[heading] })}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/teacher/courses/${row.id}/penilaian/${assessment.id}`)}
                  className="w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2 hover:bg-slate-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 text-sm font-bold text-slate-800 break-words">{assessment.title}</span>
                      <StateWord assessment={assessment} t={t} />
                    </span>
                    <span className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] font-semibold text-slate-500">
                      <span>{row.class?.name}</span>
                      <span>{row.subject?.code}</span>
                      <span>{t(`tasm.type.${assessment.type}`)}</span>
                    </span>
                    <span className="block text-[11px] font-semibold text-slate-500 tabular-nums">{windowText(assessment, zone, lang)}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
        {data.more > 0 && (
          <Link to="/teacher/courses" className="block px-1 pt-2 text-xs font-semibold text-brand hover:underline">
            {t('teacherDash.asm.more', { n: data.more })}
          </Link>
        )}
      </div>
    );
  }

  return (
    <section className={`${card} flex flex-col ${className}`} aria-labelledby="teacher-asm-heading" aria-busy={reading}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-brand-tint text-brand flex items-center justify-center shrink-0">
            <ClipboardList className="w-4.5 h-4.5" aria-hidden="true" />
          </span>
          <h2 id="teacher-asm-heading" className="text-base font-extrabold text-slate-800 tracking-tight">
            {t('teacherDash.asm.title')}
          </h2>
        </div>
        <Link to="/teacher/courses" className="shrink-0 text-xs font-semibold text-brand hover:underline">
          {t('common.seeAll')}
        </Link>
      </div>
      {body}
    </section>
  );
};

export default AssessmentsCard;
