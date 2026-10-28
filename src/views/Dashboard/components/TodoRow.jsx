import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import Button from '../../../components/ui/Button';
import FactLine from '../../../components/ui/FactLine';
import { localOf } from '../../Attendance/attendance';
import { pathOf, wordOf } from '../../StudentAssessment/studentMenu';
import { daysUntil, dueToneOf } from '../studentHome';
import { FactCell, Unfold } from './HomeCard';

/*
  One row of "Perlu dikerjakan" (owner, 2026-10-27: the first design of the
  dashboard mockup), shared by the dashboard's TodoCard and a subject's
  "Penilaian" tab (owner, 2026-10-28): a date box tinted by how near the
  deadline is, the title with its state pill, a slash line placing it, and the
  row opening in place into its facts and the way in.

  @param entry        a TODO entry of the menu
  @param open         whether its details are showing
  @param onToggle     () => void
  @param onLater      () => void - "Nanti", closes it
  @param zone         the school's time zone
  @param today        the school's date, 'YYYY-MM-DD'
  @param showSubject  false on a subject's own page: the line leaves the subject out
  @param onStart      (entry) => void before going in (a subject's tab notes where Back returns)
*/

/* Rose text on a rose-50 fill is 700: 600 measured 4.12:1 there (2026-10-27). */
const DUE_BOX = {
  late: 'bg-rose-50 text-rose-700',
  soon: 'bg-amber-50 text-amber-700',
  '': 'bg-slate-100 text-slate-900',
};

/* The pill after the title: Aktif, else what the menu says about it. */
const PILL = {
  open: 'bg-emerald-50 text-emerald-700',
  late: 'bg-rose-50 text-rose-700',
  IN_PROGRESS: 'bg-brand-tint text-brand',
  VOIDED: 'bg-amber-50 text-amber-700',
};

export const TodoRow = ({ entry, open, onToggle, onLater, zone, today, showSubject = true, onStart = null }) => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const locale = lang === 'en' ? 'en-GB' : 'id-ID';
  const { assessment } = entry;

  const dueWords = (closesAt) => {
    const days = daysUntil(closesAt, today, zone);
    const time = localOf(closesAt, zone)?.time ?? '';
    if (new Date(closesAt) <= new Date()) return days < 0 ? t('dash.todo.due.late', { n: -days }) : t('dash.todo.due.lateToday');
    if (days === 0) return t('dash.todo.due.today', { time });
    if (days === 1) return t('dash.todo.due.tomorrow', { time });
    return t('dash.todo.due.inDays', { n: days });
  };

  const closesLabel = (closesAt) => {
    const at = localOf(closesAt, zone);
    if (!at) return '-';
    const date = new Date(`${at.date}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
    return `${date}, ${at.time}`;
  };

  const tone = dueToneOf(assessment.closesAt);
  const at = localOf(assessment.closesAt, zone);
  const word = wordOf(entry);
  const pillKey = word === 'IN_PROGRESS' || word === 'VOIDED' ? word : tone === 'late' ? 'late' : 'open';
  const pillText = pillKey === 'open' ? t('dash.todo.pill.open') : pillKey === 'late' ? t('dash.todo.pill.late') : t(`smenu.status.${pillKey}`);
  const online = assessment.mode === 'ONLINE';

  return (
    <li className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full flex items-center gap-3.5 px-2 py-3.5 text-left rounded-xl hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className={`w-[46px] shrink-0 rounded-[10px] py-1.5 text-center leading-tight tabular-nums ${DUE_BOX[tone]}`}>
          <b className="block text-base font-extrabold">{at ? Number(at.date.slice(8)) : '-'}</b>
          <small className={`text-[10px] font-bold uppercase ${tone ? '' : 'text-slate-500'}`}>
            {at ? new Date(`${at.date}T00:00:00Z`).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }).replace('.', '') : ''}
          </small>
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-slate-900 break-words">
            {assessment.title}
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${PILL[pillKey]}`}>{pillText}</span>
          </span>
          <FactLine
            size="xs"
            wrap
            className="mt-0.5"
            code={showSubject ? assessment.classSubject?.subject?.code : null}
            name={showSubject ? assessment.classSubject?.subject?.name : null}
            facts={[t(`tasm.type.${assessment.type}`), dueWords(assessment.closesAt)]}
          />
        </span>
        <ChevronRight className={`w-4 h-4 shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
      </button>
      <Unfold open={open}>
        <div className="pl-[68px] max-sm:pl-2 pr-2 pb-4">
          <div className="flex flex-wrap gap-x-7 gap-y-2 mb-3.5">
            <FactCell label={t('dash.todo.cell.mode')}>{t(`tasm.mode.${assessment.mode}`)}</FactCell>
            {online && <FactCell label={t('dash.todo.cell.items')}>{t('dash.todo.questions', { n: assessment.questionCount ?? 0 })}</FactCell>}
            {online && (
              <FactCell label={t('dash.todo.cell.time')}>
                {assessment.timeLimitMinutes ? t('dash.todo.minutes', { n: assessment.timeLimitMinutes }) : t('dash.todo.noLimit')}
              </FactCell>
            )}
            <FactCell label={t('dash.todo.cell.closes')}>{closesLabel(assessment.closesAt)}</FactCell>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                onStart?.(entry);
                navigate(pathOf(entry));
              }}
            >
              {entry.inProgressId ? t('dash.todo.continue') : t('dash.todo.start')}
            </Button>
            <Button size="sm" variant="outline" onClick={onLater}>
              {t('dash.todo.later')}
            </Button>
          </div>
        </div>
      </Unfold>
    </li>
  );
};

export default TodoRow;
