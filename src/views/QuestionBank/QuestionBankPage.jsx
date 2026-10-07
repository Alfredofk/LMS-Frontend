import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { AlertCircle, FileQuestion, ImageIcon, Plus, RefreshCw, Search, UserRound } from 'lucide-react';

import Select from '../../components/ui/Select';
import SubjectLabel from '../../components/ui/SubjectLabel';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../constants/roles';
import { useT } from '../../i18n/LanguageContext';
import { questionBankErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { assessmentService } from '../../services/assessmentService';
import { KINDS, bodyText, filterChoices, filterQuestions, formatQuestionDate, taughtPairs } from './questionBank';
import QuestionPreviewDialog from './QuestionPreviewDialog';

/*
  "Bank Soal" (backend ed46340, assessment ticket 01; owner 2026-10-07): the
  school's questions, kept per subject and grade level, for the Teacher, the
  Principal and Vice Principals.

  - At the Teacher's desk: the questions of what they teach now plus their own,
    and "Tulis soal" for a subject x grade they teach now (`taughtPairs`, from
    `?mine=true` and the open years). At the Principal's or a Vice Principal's
    desk: the whole bank, read only - a leader who teaches writes as a Teacher.
  - Two tabs: live questions (the pick list) and archived ones (a teacher's own,
    every one for a leader) - two reads, the second on first opening it.
  - Filters run in the browser (subject, grade, kind, "mine", words), offering
    only what the bank holds. A card opens QuestionPreviewDialog with the key.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 shadow-sm';
const TABS = ['live', 'archived'];

const QuestionCard = ({ question, onOpen, t, lang }) => {
  const words = bodyText(question.body);
  const images = [question.imageId, ...(question.options ?? []).map((o) => o.imageId)].filter(Boolean).length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`${card} w-full text-left hover:shadow-md hover:border-brand/30 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand flex flex-col gap-3`}
    >
      <span className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
        <span className="px-2 py-0.5 rounded-md bg-brand-tint text-brand text-[11px] font-extrabold">{t(`qbank.kind.${question.kind}`)}</span>
        <SubjectLabel code={question.subject?.code} name={question.subject?.name} />
        <span className="text-slate-500">{t('classes.grade', { n: question.gradeLevel })}</span>
        {question.mine && (
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold">{t('qbank.mineBadge')}</span>
        )}
      </span>
      <span className="block text-sm font-semibold text-slate-800 leading-relaxed line-clamp-2 break-words">{words || '-'}</span>
      <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1 min-w-0">
          <UserRound className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{t(question.author?.left ? 'qbank.byLeft' : 'qbank.by', { name: question.author?.fullName ?? '' })}</span>
        </span>
        <span>{formatQuestionDate(question.updatedAt, lang)}</span>
        {images > 0 && (
          <span className="inline-flex items-center gap-1">
            <ImageIcon className="w-3 h-3" aria-hidden="true" />
            {t('qbank.images', { n: images })}
          </span>
        )}
        {question.duplicatedFromId && <span>{t('qbank.duplicate.from')}</span>}
      </span>
    </button>
  );
};

export const QuestionBankPage = () => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const { showToast } = useOutletContext() ?? {};
  const { activeRole } = useAuth();
  const writable = activeRole === ROLES.TEACHER;
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'archived' ? 'archived' : 'live';

  /* undefined: reading · array · { error } */
  const [lists, setLists] = useState({ live: undefined, archived: undefined });
  const [attempt, setAttempt] = useState({ live: 0, archived: 0 });
  /* What the Teacher writes for: undefined while reading, null when it could not be read. */
  const [pairs, setPairs] = useState(writable ? undefined : []);
  const [filters, setFilters] = useState({ subjectId: '', gradeLevel: '', kind: '', mine: false, query: '' });
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let cancelled = false;
    assessmentService
      .list({ archived: tab === 'archived' })
      .then((list) => !cancelled && setLists((prev) => ({ ...prev, [tab]: list })))
      .catch((err) => !cancelled && setLists((prev) => ({ ...prev, [tab]: { error: questionBankErrorMessage(err, t) } })));
    return () => {
      cancelled = true;
    };
  }, [tab, attempt, t]);

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

  const setFilter = (key) => (e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }));
  const goTab = (next) => {
    setSearchParams(next === 'archived' ? { tab: 'archived' } : {});
    setFilters({ subjectId: '', gradeLevel: '', kind: '', mine: false, query: '' });
  };

  const onChanged = (_question, toastKey) => {
    setOpen(null);
    showToast?.(t(toastKey), 'success');
    reload();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:justify-between">
        <div className="space-y-1 min-w-0">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('qbank.title')}</h1>
          <p className="text-sm text-slate-500 font-medium">{t(writable ? 'qbank.subtitle.teacher' : 'qbank.subtitle.leader')}</p>
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

      <div role="tablist" aria-label={t('qbank.title')} className="flex gap-6 border-b border-slate-200">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => goTab(key)}
            className={`px-1 pb-3 -mb-px text-sm font-extrabold border-b-2 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-t ${
              tab === key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t(`qbank.tab.${key}`)}
          </button>
        ))}
      </div>

      {questions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] gap-2.5 items-center">
          <label className="relative sm:col-span-2 lg:col-span-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={filters.query}
              onChange={setFilter('query')}
              placeholder={t('qbank.filter.search')}
              aria-label={t('qbank.filter.search')}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </label>
          <Select size="sm" aria-label={t('qbank.filter.subject')} value={filters.subjectId} onChange={setFilter('subjectId')}>
            <option value="">{t('qbank.filter.allSubjects')}</option>
            {choices.subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {`${subject.code} - ${subject.name}`}
              </option>
            ))}
          </Select>
          <Select size="sm" aria-label={t('qbank.filter.grade')} value={filters.gradeLevel} onChange={setFilter('gradeLevel')}>
            <option value="">{t('qbank.filter.allGrades')}</option>
            {choices.grades.map((grade) => (
              <option key={grade} value={String(grade)}>
                {t('classes.grade', { n: grade })}
              </option>
            ))}
          </Select>
          <Select size="sm" aria-label={t('qbank.filter.kind')} value={filters.kind} onChange={setFilter('kind')}>
            <option value="">{t('qbank.filter.allKinds')}</option>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`qbank.kind.${kind}`)}
              </option>
            ))}
          </Select>
          {writable && tab === 'live' && (
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.mine}
                onChange={(e) => setFilters((prev) => ({ ...prev, mine: e.target.checked }))}
                className="w-4 h-4 accent-brand cursor-pointer"
              />
              {t('qbank.filter.mine')}
            </label>
          )}
        </div>
      )}

      {list === undefined ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-busy="true" aria-label={t('common.loading')}>
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-32 rounded-2xl bg-white border border-slate-100 animate-pulse" />
          ))}
        </div>
      ) : list.error ? (
        <div className={`${card} flex flex-col items-center text-center gap-3 py-10`} role="alert">
          <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
          <p className="text-sm font-bold text-slate-700">{list.error}</p>
          <button
            type="button"
            onClick={() => reload(tab)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            {t('att.error.retry')}
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className={`${card} flex flex-col items-center text-center gap-3 py-10`}>
          <FileQuestion className="w-8 h-8 text-slate-400" aria-hidden="true" />
          <p className="text-sm font-semibold text-slate-600 max-w-sm">
            {t(filtered ? 'qbank.empty.filtered' : tab === 'archived' ? 'qbank.empty.archived' : writable ? 'qbank.empty.teacher' : 'qbank.empty.leader')}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs font-semibold text-slate-500">{t('qbank.count', { n: shown.length, total: questions.length })}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shown.map((question) => (
              <QuestionCard key={question.id} question={question} onOpen={() => setOpen(question)} t={t} lang={lang} />
            ))}
          </div>
        </>
      )}

      {open && (
        <QuestionPreviewDialog
          key={open.id}
          question={open}
          pairs={pairs ?? []}
          writable={writable}
          onClose={() => setOpen(null)}
          onEdit={() => navigate(`/question-bank/${open.id}/edit`)}
          onChanged={onChanged}
          onStale={() => reload()}
        />
      )}
    </div>
  );
};

export default QuestionBankPage;
