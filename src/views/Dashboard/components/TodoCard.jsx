import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, ChevronRight } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import Button from '../../../components/ui/Button';
import FactLine from '../../../components/ui/FactLine';
import { localOf } from '../../Attendance/attendance';
import { pathOf, wordOf } from '../../StudentAssessment/studentMenu';
import { daysUntil, dueToneOf } from '../studentHome';
import { Bone, FactCell, HomeCard, HomeEmpty, HomeError, Unfold } from './HomeCard';

/*
  "Perlu dikerjakan" (owner, 2026-10-27: the first design of the mockup): what
  waits to be done across every subject, soonest deadline first, from
  GET /assessments/mine. A date box tinted by how near the deadline is, the
  title with its state pill, a slash line placing it, and the row opening in
  place into its facts and the way in. Text-only tabs by type, only the types
  present. Five rows at most; the rest is on /assessment.
*/

const MAX_ROWS = 5;
const TYPES = ['TUGAS', 'KUIS', 'UTS', 'UAS', 'LATIHAN'];

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

/**
 * @param todo   the TODO entries (todoAcross), undefined while reading, null when the read failed
 * @param zone   the school's time zone
 * @param today  the school's date, 'YYYY-MM-DD'
 * @param onRetry  reads the menu again
 */
export const TodoCard = ({ todo, zone, today, onRetry }) => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('ALL');
  const [openId, setOpenId] = useState(null);
  const locale = lang === 'en' ? 'en-GB' : 'id-ID';

  const types = useMemo(() => TYPES.filter((type) => (todo ?? []).some((entry) => entry.assessment.type === type)), [todo]);
  const shownType = filter === 'ALL' || types.includes(filter) ? filter : 'ALL';
  const list = (todo ?? []).filter((entry) => shownType === 'ALL' || entry.assessment.type === shownType);

  const card = (body) => (
    <HomeCard id="home-todo" title={t('dash.todo.title')} linkLabel={t('dash.todo.all')} linkTo="/assessment">
      {body}
    </HomeCard>
  );

  if (todo === undefined) {
    return card(
      <div aria-busy="true">
        <Bone className="h-8 w-3/5" />
        {[0, 1, 2].map((n) => (
          <div key={n} className="flex items-center gap-3.5 mt-4">
            <Bone className="w-[46px] h-[42px] shrink-0" />
            <div className="flex-1">
              <Bone className="h-3.5 w-4/5" />
              <Bone className="h-3 w-1/2 mt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (todo === null) return card(<HomeError message={t('dash.todo.failed')} retryLabel={t('att.error.retry')} onRetry={onRetry} />);

  const tab = (key, label, count) => {
    const on = shownType === key;
    return (
      <button
        key={key}
        type="button"
        role="tab"
        aria-selected={on}
        onClick={() => {
          setFilter(key);
          setOpenId(null);
        }}
        className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-t-lg ${
          on ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
        }`}
      >
        {label}
        <span className={`ml-1.5 px-1.5 rounded-full text-[11px] ${on ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'}`}>{count}</span>
      </button>
    );
  };

  /* The line under the tabs is an inset shadow, not a border the tabs overlap by -1px:
     in a row that scrolls sideways that overlap made it 1px taller than itself, and the
     browser drew a vertical scrollbar beside the tabs (owner's screenshot, 2026-10-27). */
  const tabs = todo.length > 0 && (
    <div role="tablist" className="flex gap-0.5 mb-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
      {tab('ALL', t('dash.todo.tabAll'), todo.length)}
      {types.map((type) => tab(type, t(`tasm.type.${type}`), todo.filter((entry) => entry.assessment.type === type).length))}
    </div>
  );

  if (todo.length === 0) {
    return card(
      <HomeEmpty
        icon={CheckCheck}
        title={t('dash.todo.empty.title')}
        body={t('dash.todo.empty.body')}
        action={
          <Button size="sm" variant="outline" onClick={() => navigate('/assessment')}>
            {t('dash.todo.all')}
          </Button>
        }
      />
    );
  }

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

  const rows = list.slice(0, MAX_ROWS).map((entry) => {
    const { assessment } = entry;
    const open = openId === assessment.id;
    const tone = dueToneOf(assessment.closesAt);
    const at = localOf(assessment.closesAt, zone);
    const word = wordOf(entry);
    const pillKey = word === 'IN_PROGRESS' || word === 'VOIDED' ? word : tone === 'late' ? 'late' : 'open';
    const pillText = pillKey === 'open' ? t('dash.todo.pill.open') : pillKey === 'late' ? t('dash.todo.pill.late') : t(`smenu.status.${pillKey}`);
    const online = assessment.mode === 'ONLINE';
    return (
      <li key={assessment.id} className="border-b border-slate-100 last:border-0">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpenId(open ? null : assessment.id)}
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
              code={assessment.classSubject?.subject?.code}
              name={assessment.classSubject?.subject?.name}
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
              <Button size="sm" onClick={() => navigate(pathOf(entry))}>
                {entry.inProgressId ? t('dash.todo.continue') : t('dash.todo.start')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpenId(null)}>
                {t('dash.todo.later')}
              </Button>
            </div>
          </div>
        </Unfold>
      </li>
    );
  });

  return card(
    <>
      {tabs}
      <ul>{rows}</ul>
      {list.length > MAX_ROWS && <p className="mt-2 px-2 text-xs font-semibold text-slate-500">{t('dash.assessment.more', { n: list.length - MAX_ROWS })}</p>}
    </>
  );
};

export default TodoCard;
