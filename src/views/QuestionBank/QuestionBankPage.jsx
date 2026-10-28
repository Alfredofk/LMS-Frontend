import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { FileQuestion, Plus, Search } from 'lucide-react';

import Select from '../../components/ui/Select';
import EmptyCard from '../../components/ui/EmptyCard';
import FactLine from '../../components/ui/FactLine';
import { HomeError } from '../Dashboard/components/HomeCard';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import { useT } from '../../i18n/LanguageContext';
import { questionBankErrorMessage } from '../../i18n/apiError';
import { useSchoolToday } from '../../hooks/useSchoolToday';
import { useNarrow } from '../../hooks/useNarrow';
import { academicsService } from '../../services/academicsService';
import { assessmentService } from '../../services/assessmentService';
import { KINDS, filterChoices, filterQuestions, taughtPairs } from './questionBank';
import QuestionItem from './QuestionItem';

/*
  "Bank Soal" (backend ed46340, assessment ticket 01; owner 2026-10-07): the
  school's questions, kept per subject and grade level, for the Teacher, the
  Principal and Vice Principals.

  - At the Teacher's desk: the questions of what they teach now plus their own,
    and "Tulis soal" for a subject x grade they teach now (`taughtPairs`, from
    `?mine=true` and the open years). At the Principal's or a Vice Principal's
    desk: the whole bank, read only - a leader who teaches writes as a Teacher.
  - Two tabs: live questions (the pick list) and archived ones (a teacher's own,
    every one for a leader) - two reads, both on arrival since 2026-10-28, so each
    tab can say how many it holds.
  - Filters run in the browser (subject, grade, kind, "mine", words), offering
    only what the bank holds. Each question is a row of one card, opened in place
    for its body, key and actions, one at a time (QuestionItem; owner 2026-10-28,
    the reviewed mockup, choice B - it was every question in full, 2026-10-07).
  - The look since 2026-10-28: the slash line, the dashboards' text tabs with
    counts, and their failed and empty states.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-6 max-sm:p-[18px] shadow-sm';
const TABS = ['live', 'archived'];

export const QuestionBankPage = () => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const { showToast } = useOutletContext() ?? {};
  const { activeRole, membership } = useAuth();
  /* On a phone the three filters share one row, so each says only what it filters (owner, 2026-10-08). */
  const narrow = useNarrow();
  /* The school's date, which a question's privacy is read against. */
  const today = useSchoolToday();
  const writable = activeRole === ROLES.TEACHER;
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'archived' ? 'archived' : 'live';

  /* undefined: reading · array · { error } */
  const [lists, setLists] = useState({ live: undefined, archived: undefined });
  const [attempt, setAttempt] = useState({ live: 0, archived: 0 });
  /* What the Teacher writes for: undefined while reading, null when it could not be read. */
  const [pairs, setPairs] = useState(writable ? undefined : []);
  const [filters, setFilters] = useState({ subjectId: '', gradeLevel: '', kind: '', mine: false, query: '' });

  /* One read per tab, each again on its own attempt. */
  const readTab = useCallback(
    (key) => {
      let cancelled = false;
      assessmentService
        .list({ archived: key === 'archived' })
        .then((list) => !cancelled && setLists((prev) => ({ ...prev, [key]: list })))
        .catch((err) => !cancelled && setLists((prev) => ({ ...prev, [key]: { error: questionBankErrorMessage(err, t) } })));
      return () => {
        cancelled = true;
      };
    },
    [t]
  );
  useEffect(() => readTab('live'), [readTab, attempt.live]);
  useEffect(() => readTab('archived'), [readTab, attempt.archived]);

  /* The one row open; a new tab or filter closes it. */
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    if (!writable) return undefined;
    let cancelled = false;
    Promise.all([academicsService.myClassSubjects(), academicsService.academicYears().catch(() => null)])
      .then(([rows, years]) => !cancelled && setPairs(taughtPairs(rows, years)))
      .catch(() => !cancelled && setPairs(null));
    return () => {
      cancelled = true;
    };
  }, [writable]);

  const reload = useCallback((which) => {
    const tabs = which ? [which] : TABS;
    setLists((prev) => ({ ...prev, ...Object.fromEntries(tabs.map((key) => [key, undefined])) }));
    setAttempt((prev) => ({ ...prev, ...Object.fromEntries(tabs.map((key) => [key, prev[key] + 1])) }));
  }, []);

  const list = lists[tab];
  const questions = useMemo(() => (Array.isArray(list) ? list : []), [list]);
  const choices = useMemo(() => filterChoices(questions), [questions]);
  const shown = useMemo(() => filterQuestions(questions, filters), [questions, filters]);
  const filtered = Object.entries(filters).some(([, value]) => Boolean(value));

  const setFilter = (key) => (e) => {
    setFilters((prev) => ({ ...prev, [key]: e.target.value }));
    setOpenId(null);
  };

  /* The slash line, as on the dashboards (owner, 2026-10-28, the reviewed mockup). */
  const countOf = (key) => (Array.isArray(lists[key]) ? lists[key].length : null);
  const taughtSubjects = Array.isArray(pairs) ? new Set(pairs.map((pair) => pair.subject.id)).size : null;
  const facts = [
    membership?.school?.name ?? membership?.schoolName,
    writable ? taughtSubjects !== null && t('subjects.subtitle.taught', { n: taughtSubjects }) : t('qbank.readOnly'),
    countOf('live') !== null && t('qbank.liveCount', { n: countOf('live') }),
  ];
  const goTab = (next) => {
    setSearchParams(next === 'archived' ? { tab: 'archived' } : {});
    setFilters({ subjectId: '', gradeLevel: '', kind: '', mine: false, query: '' });
    setOpenId(null);
  };

  const onChanged = (_question, toastKey) => {
    showToast?.(t(toastKey), 'success');
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('qbank.title')}</h1>
          <FactLine className="mt-2" facts={facts} />
        </div>
        {writable && pairs?.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/question-bank/new')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-extrabold hover:bg-brand-deep cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 shrink-0"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            {t('qbank.write')}
          </button>
        )}
      </div>

      {writable && pairs?.length === 0 && (
        <p className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">{t('qbank.noPairs')}</p>
      )}
      {writable && pairs === null && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{t('qbank.pairsFailed')}</p>
      )}

      {/* The dashboards' text tabs with a count (the reviewed mockup, owner 2026-10-28). */}
      <div role="tablist" aria-label={t('qbank.title')} className="flex gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)]">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => goTab(key)}
            className={`shrink-0 whitespace-nowrap px-2.5 py-2 text-sm font-bold border-b-2 transition-colors cursor-pointer focus:outline-none focus-visible:text-brand ${
              tab === key ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {t(`qbank.tab.${key}`)}
            {countOf(key) !== null && (
              <span className={`ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums ${tab === key ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'}`}>
                {countOf(key)}
              </span>
            )}
          </button>
        ))}
      </div>

      {questions.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] gap-2 sm:gap-2.5 items-center">
          <label className="relative col-span-3 sm:col-span-2 lg:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={filters.query}
              onChange={setFilter('query')}
              placeholder={t('qbank.filter.search')}
              aria-label={t('qbank.filter.search')}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </label>
          <Select size="sm" aria-label={t('qbank.filter.subject')} value={filters.subjectId} onChange={setFilter('subjectId')}>
            <option value="">{t(narrow ? 'qbank.filter.subjectShort' : 'qbank.filter.allSubjects')}</option>
            {choices.subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {`${subject.code} - ${subject.name}`}
              </option>
            ))}
          </Select>
          <Select size="sm" aria-label={t('qbank.filter.grade')} value={filters.gradeLevel} onChange={setFilter('gradeLevel')}>
            <option value="">{t(narrow ? 'qbank.filter.gradeShort' : 'qbank.filter.allGrades')}</option>
            {choices.grades.map((grade) => (
              <option key={grade} value={String(grade)}>
                {t('classes.grade', { n: grade })}
              </option>
            ))}
          </Select>
          <Select size="sm" aria-label={t('qbank.filter.kind')} value={filters.kind} onChange={setFilter('kind')}>
            <option value="">{t(narrow ? 'qbank.filter.kindShort' : 'qbank.filter.allKinds')}</option>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`qbank.kind.${kind}`)}
              </option>
            ))}
          </Select>
          {writable && tab === 'live' && (
            <label className="col-span-3 sm:col-span-1 inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.mine}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, mine: e.target.checked }));
                  setOpenId(null);
                }}
                className="w-4 h-4 accent-brand cursor-pointer"
              />
              {t('qbank.filter.mine')}
            </label>
          )}
        </div>
      )}

      {list === undefined ? (
        <div className={card} aria-busy="true" aria-label={t('common.loading')}>
          {[0, 1, 2].map((n) => (
            <div key={n} className="flex items-start gap-3 py-3">
              <div className="w-7 h-7 rounded-full bg-slate-100 animate-pulse shrink-0" />
              <div className="flex-1">
                <div className="h-3.5 w-3/5 rounded-[10px] bg-slate-100 animate-pulse" />
                <div className="h-3 w-2/5 mt-2 rounded-[10px] bg-slate-100 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : list.error ? (
        <HomeError message={list.error} retryLabel={t('att.error.retry')} onRetry={() => reload(tab)} />
      ) : shown.length === 0 ? (
        <EmptyCard
          icon={filtered ? Search : FileQuestion}
          title={t(filtered ? 'qbank.empty.filtered' : tab === 'archived' ? 'qbank.empty.archived' : writable ? 'qbank.empty.teacher' : 'qbank.empty.leader')}
        />
      ) : (
        <>
          <p className="text-xs font-semibold text-slate-500">{t('qbank.count', { n: shown.length, total: questions.length })}</p>
          <ul className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden min-w-0">
            {shown.map((question, i) => (
              <QuestionItem
                key={question.id}
                question={question}
                number={i + 1}
                pairs={pairs ?? []}
                writable={writable}
                onEdit={() => navigate(`/question-bank/${question.id}/edit`)}
                onChanged={onChanged}
                onStale={() => reload()}
                today={today}
                t={t}
                lang={lang}
                open={openId === question.id}
                onToggle={() => setOpenId((current) => (current === question.id ? null : question.id))}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

export default QuestionBankPage;
