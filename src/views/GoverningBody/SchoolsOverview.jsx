import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, ChevronRight, GraduationCap, Link2, Mail, Plus, Power, School, ShieldCheck, UserX, Users } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import Button from '../../components/ui/Button';
import StatCard from '../Dashboard/components/StatCard';
import { Bone, HomeCard, HomeEmpty, HomeError } from '../Dashboard/components/HomeCard';
import { GOVERNING_BODY_SCHOOLS } from '../../constants/roles';
import { attentionOf, readinessOf, totalsOf } from './bodyOverview';

/*
  The top of a Governing Body's home, in the design the owner approved on 2026-10-27
  (the skill `.claude/skills/eduforid-design`, the yayasan mockup):

  - `SchoolsSummary`: Sekolah / Siswa / Guru as stat cards leading to the Schools tab,
    and "Kesiapan sekolah" (`readinessOf`) - how many have a Principal, are switched on,
    and are both. No list of Schools (owner 2026-10-26, decision 1).
  - `AttentionCard`: "Perlu perhatian" (`attentionOf`), a row per thing only when there
    is one, its icon and count coloured by kind - amber waiting on a decision, rose
    switched off, purple a request - with a fixed line saying what to do. A row about one
    School opens it; about several, the Schools tab.

  Both take the reads of `useSchoolsOverview`; the identity and the code below do not
  wait for them.
*/

const ROW = {
  PRINCIPAL_APPLICATIONS: { keys: ['gbo.row.applications.one', 'gbo.row.applications.many'], hint: 'gbo.hint.applications', tone: 'warn', icon: Mail },
  AFFILIATION_REQUESTS: { keys: ['gbo.row.affiliation.one', 'gbo.row.affiliation.many'], hint: 'gbo.hint.affiliation', tone: 'info', icon: Link2 },
  ADMIN_APPLICATIONS: { keys: ['gbo.row.admins', 'gbo.row.admins'], hint: 'gbo.hint.admins', tone: 'info', icon: ShieldCheck },
  NO_PRINCIPAL: { keys: ['gbo.row.noPrincipal.one', 'gbo.row.noPrincipal.many'], hint: 'gbo.hint.noPrincipal', tone: 'warn', icon: UserX },
  SWITCHED_OFF: { keys: ['gbo.row.off.one', 'gbo.row.off.many'], hint: 'gbo.hint.off', tone: 'bad', icon: Power },
};

const TONE = {
  warn: 'bg-amber-50 text-amber-700',
  /* 700, not 600: rose-600 on rose-50 measured 4.12:1 for the count (2026-10-27). */
  bad: 'bg-rose-50 text-rose-700',
  info: 'bg-brand-tint text-brand',
};

/* One count of the readiness card, with its bar: green once every School has it. */
const ReadyBar = ({ label, part, total }) => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const full = total > 0 && part === total;
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-1 text-xs text-slate-600">
      <span>{label}</span>
      <b className="font-extrabold text-slate-700 tabular-nums">
        {part}/{total}
      </b>
      <div className="col-span-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <i
          className={`block h-full rounded-full transition-[width] duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${full ? 'bg-emerald-600' : 'bg-brand'}`}
          style={{ width: shown && total > 0 ? `${(part / total) * 100}%` : '0%' }}
        />
      </div>
    </div>
  );
};

export const SchoolsSummary = ({ read, failed, onRetry }) => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const toSchools = () => navigate(GOVERNING_BODY_SCHOOLS);
  const number = (n) => n.toLocaleString(lang === 'en' ? 'en-GB' : 'id-ID');

  if (failed) return <HomeError message={t('gbo.failed')} retryLabel={t('gb.retry')} onRetry={onRetry} />;

  const grid = 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1.6fr] gap-5 max-sm:gap-3';
  if (!read) {
    return (
      <div className={grid} aria-busy="true" aria-label={t('common.loading')}>
        {[0, 1, 2].map((n) => (
          <div key={n} className={`bg-white border border-slate-100 rounded-2xl p-5 shadow-sm ${n === 0 ? 'max-sm:col-span-2' : ''}`}>
            <Bone className="h-3 w-1/2" />
            <Bone className="h-6 w-1/3 mt-4" />
            <Bone className="h-2.5 w-2/3 mt-3" />
          </div>
        ))}
        <div className="col-span-2 md:col-span-3 lg:col-span-1 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <Bone className="h-3 w-2/5" />
          <Bone className="h-6 w-1/3 mt-3" />
          <Bone className="h-1.5 w-full mt-4" />
          <Bone className="h-1.5 w-full mt-3.5" />
        </div>
      </div>
    );
  }

  const totals = totalsOf(read.schools);
  const ready = readinessOf(read.schools);

  return (
    <div className={grid}>
      <StatCard
        className="max-sm:col-span-2"
        title={t('gbo.count.schools')}
        value={number(totals.schools)}
        subtext={totals.schools ? t('gbo.sub.schools', { on: ready.active, off: totals.schools - ready.active }) : t('gbo.empty')}
        icon={School}
        onClick={toSchools}
      />
      <StatCard title={t('gbo.count.students')} value={number(totals.students)} subtext={t('gbo.sub.students')} icon={Users} onClick={toSchools} />
      <StatCard title={t('gbo.count.teachers')} value={number(totals.teachers)} subtext={t('gbo.sub.teachers')} icon={GraduationCap} onClick={toSchools} />

      <section aria-labelledby="gbo-ready" className="col-span-2 md:col-span-3 lg:col-span-1 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-left flex flex-col">
        {ready.total === 0 ? (
          <HomeEmpty
            icon={School}
            title={t('gbo.empty')}
            body={t('gbo.ready.emptyBody')}
            action={
              <Button size="sm" onClick={() => navigate(`${GOVERNING_BODY_SCHOOLS}/new`)}>
                <span className="inline-flex items-center gap-1.5">
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  {t('gbs.create')}
                </span>
              </Button>
            }
          />
        ) : (
          <>
            <h2 id="gbo-ready" className="text-xs font-medium text-slate-500">
              {t('gbo.ready.title')}
            </h2>
            <p className="mt-2.5 flex flex-wrap items-baseline gap-x-2">
              <b className="text-2xl font-extrabold text-slate-900 tracking-tight leading-none tabular-nums">{t('gbo.ready.count', { n: ready.ready, total: ready.total })}</b>
              <span className="text-xs text-slate-500">{t('gbo.ready.sub')}</span>
            </p>
            <div className="mt-3.5 space-y-2.5">
              <ReadyBar label={t('gbo.ready.led')} part={ready.led} total={ready.total} />
              <ReadyBar label={t('gbo.ready.active')} part={ready.active} total={ready.total} />
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export const AttentionCard = ({ read, failed, onRetry }) => {
  const { t } = useT();
  const navigate = useNavigate();

  const card = (body) => (
    <HomeCard id="gbo-attention" title={t('gbo.attention')}>
      {body}
    </HomeCard>
  );

  if (failed) return card(<HomeError message={t('gbo.failed')} retryLabel={t('gb.retry')} onRetry={onRetry} />);
  if (!read) {
    return card(
      <div aria-busy="true">
        {[0, 1, 2].map((n) => (
          <div key={n} className="flex items-center gap-3.5 mt-3.5 first:mt-0">
            <Bone className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex-1">
              <Bone className="h-3.5 w-3/4" />
              <Bone className="h-3 w-1/2 mt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const items = attentionOf(read.schools, read);
  if (items.length === 0) return card(<HomeEmpty icon={CheckCheck} title={t('gbo.none')} body={t('gbo.noneBody')} />);

  return card(
    <ul className="divide-y divide-slate-100">
      {items.map((item) => {
        const row = ROW[item.kind];
        const Icon = row.icon;
        return (
          <li key={item.kind}>
            <button
              type="button"
              onClick={() => navigate(item.to)}
              className="group w-full flex items-center gap-3.5 px-2 py-3 text-left rounded-xl hover:bg-slate-50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className={`grid place-items-center w-9 h-9 rounded-full shrink-0 ${TONE[row.tone]}`}>
                <Icon className="w-4 h-4" aria-hidden="true" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-900 break-words">
                  {t(row.keys[item.school ? 0 : 1], { n: item.count, school: item.school ?? '', at: item.at ?? 0 })}
                </span>
                <span className="block text-xs text-slate-500">{t(row.hint)}</span>
              </span>
              <span className={`min-w-[26px] px-2 py-0.5 rounded-full text-xs font-extrabold text-center tabular-nums ${TONE[row.tone]}`}>{item.count}</span>
              <ChevronRight className="w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export default SchoolsSummary;
