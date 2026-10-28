import React, { useEffect, useState } from 'react';
import { BarChart3, CalendarX } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import { dashboardService } from '../../../services/dashboardService';
import { useSchoolZoneState } from '../../../hooks/useSchoolToday';
import { CARD_FIGURES, isCounted } from '../../SchoolOverview/schoolOverview';
import { FigureTile, SlashLine } from '../../SchoolOverview/FigureParts';
import { useCountedParts } from '../../SchoolOverview/useCountedParts';
import { Bone, HomeCard, HomeEmpty, HomeError } from './HomeCard';

/*
  The School's line on the Principal's and Vice Principal's dashboard (owner,
  2026-10-28), from `GET /dashboard/school` for the current Semester: five
  numbers with their change against 7 days before, when they were counted, and a
  link to the whole overview (/headmaster/overview). The Students placed are left
  out: a stat card above already counts them.
*/

export const SchoolOverviewCard = () => {
  const { t } = useT();
  const { zone } = useSchoolZoneState();
  /* undefined while reading, null when the read failed. */
  const [answer, setAnswer] = useState(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    dashboardService
      .school()
      .then((found) => !cancelled && setAnswer(found))
      .catch(() => !cancelled && setAnswer(null));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const counted = useCountedParts(answer, zone);

  const card = (body, link = true) => (
    <HomeCard
      id="school-overview-title"
      title={t('overview.title')}
      linkLabel={link ? t('overview.open') : undefined}
      linkTo={link ? '/headmaster/overview' : undefined}
    >
      {body}
    </HomeCard>
  );

  if (answer === undefined) {
    return card(
      <div aria-busy="true" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {CARD_FIGURES.map(({ key }) => (
          <Bone key={key} className="h-[74px]" />
        ))}
      </div>
    );
  }
  if (answer === null) {
    return card(
      <HomeError
        message={t('overview.failed')}
        retryLabel={t('att.error.retry')}
        onRetry={() => {
          setAnswer(undefined);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (!answer.semester) return card(<HomeEmpty icon={CalendarX} title={t('overview.noSemester')} body={t('overview.noSemesterBody')} />, false);
  if (!isCounted(answer)) return card(<HomeEmpty icon={BarChart3} title={t('overview.notYet')} body={t('overview.notYetBody')} />, false);

  return card(
    <>
      <SlashLine parts={counted} small className="-mt-2 mb-3" />
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {CARD_FIGURES.map(({ key }) => (
          <FigureTile key={key} row={answer.school} figureKey={key} />
        ))}
      </dl>
    </>
  );
};

export default SchoolOverviewCard;
