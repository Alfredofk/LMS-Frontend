import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';
import Button from '../../../components/ui/Button';
import { Bone, HomeCard, HomeEmpty, HomeError } from './HomeCard';
import TodoRow from './TodoRow';

/*
  "Perlu dikerjakan" (owner, 2026-10-27: the first design of the mockup): what
  waits to be done across every subject, soonest deadline first, from
  GET /assessments/mine. A date box tinted by how near the deadline is, the
  title with its state pill, a slash line placing it, and the row opening in
  place into its facts and the way in (TodoRow, shared with a subject's tab). Text-only tabs by type, only the types
  present. Five rows at most; the rest is on /assessment.
*/

const MAX_ROWS = 5;
const TYPES = ['TUGAS', 'KUIS', 'UTS', 'UAS', 'LATIHAN'];

/**
 * @param todo   the TODO entries (todoAcross), undefined while reading, null when the read failed
 * @param zone   the school's time zone
 * @param today  the school's date, 'YYYY-MM-DD'
 * @param onRetry  reads the menu again
 */
export const TodoCard = ({ todo, zone, today, onRetry }) => {
  const { t } = useT();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('ALL');
  const [openId, setOpenId] = useState(null);

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

  const rows = list.slice(0, MAX_ROWS).map((entry) => (
    <TodoRow
      key={entry.assessment.id}
      entry={entry}
      open={openId === entry.assessment.id}
      onToggle={() => setOpenId(openId === entry.assessment.id ? null : entry.assessment.id)}
      onLater={() => setOpenId(null)}
      zone={zone}
      today={today}
    />
  ));

  return card(
    <>
      {tabs}
      <ul>{rows}</ul>
      {list.length > MAX_ROWS && <p className="mt-2 px-2 text-xs font-semibold text-slate-500">{t('dash.assessment.more', { n: list.length - MAX_ROWS })}</p>}
    </>
  );
};

export default TodoCard;
