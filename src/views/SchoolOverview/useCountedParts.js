import { useT } from '../../i18n/LanguageContext';
import { formatDay } from '../Classes/format';
import { localOf } from '../Attendance/attendance';

/** "Data per 28 Okt 2026 pukul 09.33" and "dibanding 21 Okt 2026", as parts of a slash line. */
export function useCountedParts(answer, zone) {
  const { t, lang } = useT();
  const parts = [];
  const local = answer?.asOf ? localOf(answer.asOf, zone) : null;
  if (local) parts.push(t('overview.asOf', { date: formatDay(local.date, lang), time: local.time.replace(':', '.') }));
  if (answer?.comparedWith) parts.push(t('overview.comparedWith', { date: formatDay(answer.comparedWith, lang) }));
  return parts;
}
