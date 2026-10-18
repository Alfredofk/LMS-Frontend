import { useEffect, useMemo, useState } from 'react';

import { holidaysService } from '../../services/holidaysService';
import { examWeekItems, examWeekReminder, examWeeksForGrades, reminderYears } from './examWeeks';

/*
  The Exam Week a dashboard reminds its reader of (owner 2026-10-18): the school's
  calendar for today's year (and the next, across New Year), the weeks of the
  reader's own grades, and `examWeekReminder`'s answer. `grades` null while not
  known yet; the read waits for it. Answers undefined while reading, null when
  there is nothing to say or the read failed: a reminder is never worth an error.
*/
export function useMyExamWeek(grades, today) {
  const years = useMemo(() => reminderYears(today), [today]);
  const yearsKey = years.join(',');
  const [items, setItems] = useState(undefined);

  useEffect(() => {
    if (!yearsKey) return undefined;
    let cancelled = false;
    Promise.all(yearsKey.split(',').map((year) => holidaysService.calendar(Number(year))))
      .then((answers) => !cancelled && setItems(answers.flatMap((data) => examWeekItems(data))))
      .catch(() => !cancelled && setItems(null));
    return () => {
      cancelled = true;
    };
  }, [yearsKey]);

  return useMemo(() => {
    if (items === undefined || grades === null) return undefined;
    if (items === null) return null;
    return examWeekReminder(examWeeksForGrades(items, grades), today);
  }, [items, grades, today]);
}

export default useMyExamWeek;
