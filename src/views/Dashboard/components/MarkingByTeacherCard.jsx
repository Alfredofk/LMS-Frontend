import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCheck } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import { dashboardService } from '../../../services/dashboardService';
import Button from '../../../components/ui/Button';
import { FIRST_ROWS, markingSummaryOf } from '../markingByTeacher';
import { initialsOf } from '../../Homeroom/homeroomSummary';
import { Bone, HomeCard, HomeEmpty, HomeError } from './HomeCard';

/*
  Marking per teacher - the Principal's and Vice Principal's dashboard (owner,
  2026-10-28), from `GET /dashboard/marking-by-teacher` (backend 0eefba2).

  For watching, not acting: the rows open nothing, since the backend gives totals
  only (no assessment, no student). Only the teachers with something waiting, the
  most to mark first, five and then "Lihat semua" in place; the rest one grey line.
  What waits in a slot nobody answers for is its own row, first, saying a successor
  is assigned in Subjects. The read takes seconds on a big School, so
  the card reads on its own and the page does not wait for it.
*/

export const MarkingByTeacherCard = ({ className = '' }) => {
  const { t } = useT();
  /* undefined while reading, null when the read failed. */
  const [answer, setAnswer] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    dashboardService
      .markingByTeacher()
      .then((found) => !cancelled && setAnswer(found ?? { teachers: [], unanswered: null }))
      .catch(() => !cancelled && setAnswer(null));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const card = (body) => (
    <HomeCard id="marking-by-teacher-title" title={t('markingByTeacher.title')} className={className}>
      {body}
    </HomeCard>
  );

  if (answer === undefined) {
    return card(
      <div aria-busy="true">
        <Bone className="h-3 w-1/2 mb-4" />
        {[0, 1, 2].map((n) => (
          <div key={n} className="flex items-center gap-3 mt-3.5 first:mt-0">
            <Bone className="w-[34px] h-[34px] rounded-full shrink-0" />
            <div className="flex-1">
              <Bone className="h-3.5 w-1/3" />
              <Bone className="h-3 w-1/4 mt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (answer === null) {
    return card(
      <HomeError
        message={t('markingByTeacher.failed')}
        retryLabel={t('att.error.retry')}
        onRetry={() => {
          setAnswer(undefined);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const { waiting, idle, teachers, totals, unanswered } = markingSummaryOf(answer);
  if (teachers === 0 && !unanswered) {
    return card(<HomeEmpty icon={CheckCheck} title={t('markingByTeacher.noTeachers')} body={t('markingByTeacher.noTeachersBody')} />);
  }
  if (waiting.length === 0 && !unanswered) {
    return card(<HomeEmpty icon={CheckCheck} title={t('markingByTeacher.none')} body={t('markingByTeacher.noneBody')} />);
  }

  /* "3 perlu dinilai / 2 siap dirilis", a zero left out. */
  const countsLine = ({ marking, release }) =>
    [marking > 0 && t('teacherDash.asm.toMark', { n: marking }), release > 0 && t('teacherDash.asm.toRelease', { n: release })]
      .filter(Boolean)
      .map((part, i) => (
        <React.Fragment key={part}>
          {i > 0 && (
            <>
              {' '}
              <span className="mx-1 text-slate-300" aria-hidden="true">
                /
              </span>{' '}
            </>
          )}
          <span className="whitespace-nowrap">{part}</span>
        </React.Fragment>
      ));

  const shown = showAll ? waiting : waiting.slice(0, FIRST_ROWS);

  return card(
    <>
      <p className="-mt-2 mb-3 text-xs text-slate-500 leading-relaxed">{countsLine(totals)}</p>
      <ul>
        {unanswered && (
          <li className="flex items-center gap-3 px-2 py-3 border-b border-slate-100 last:border-0">
            <span className="grid place-items-center w-[34px] h-[34px] rounded-full bg-rose-50 text-rose-700 shrink-0">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] font-bold text-rose-700">{t('markingByTeacher.unanswered')}</span>
              <span className="block text-xs text-slate-500">{countsLine(unanswered)}</span>
              <span className="block text-xs text-slate-500">{t('markingByTeacher.unansweredBody')}</span>
            </span>
          </li>
        )}
        {shown.map((teacher) => (
          <li key={teacher.membershipId} className="flex items-center gap-3 px-2 py-3 border-b border-slate-100 last:border-0">
            <span className="grid place-items-center w-[34px] h-[34px] rounded-full bg-brand-tint text-brand text-[11px] font-extrabold shrink-0">
              {initialsOf(teacher.fullName)}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] font-bold text-slate-900 break-words">{teacher.fullName}</span>
              <span className="block text-xs text-slate-500">{countsLine(teacher)}</span>
            </span>
            {teacher.marking > 0 && (
              <span className="min-w-[26px] px-2 py-0.5 rounded-full text-xs font-extrabold text-center tabular-nums bg-amber-50 text-amber-700">
                {teacher.marking}
                <span className="sr-only"> {t('teacherDash.asm.toMark', { n: teacher.marking })}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {(waiting.length > FIRST_ROWS || idle > 0) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{idle > 0 ? t('markingByTeacher.idle', { n: idle }) : ''}</p>
          {waiting.length > FIRST_ROWS && (
            <Button size="sm" variant="outline" onClick={() => setShowAll((open) => !open)} aria-expanded={showAll}>
              {showAll ? t('markingByTeacher.showLess') : t('markingByTeacher.showAll', { n: waiting.length })}
            </Button>
          )}
        </div>
      )}
    </>
  );
};

export default MarkingByTeacherCard;
