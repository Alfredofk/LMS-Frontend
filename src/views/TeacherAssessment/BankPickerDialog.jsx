import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Library, Lock, Search, X } from 'lucide-react';

import FactLine from '../../components/ui/FactLine';
import Select from '../../components/ui/Select';
import QuestionImage from '../../components/questionBank/QuestionImage';
import { modalActions, modalCancelClass, modalConfirmClass } from '../../components/ui/modalStyles';
import { useT } from '../../i18n/LanguageContext';
import { questionBankErrorMessage } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import { KINDS, bodyText, filterQuestions, formatSchoolDay, isPrivateOn } from '../QuestionBank/questionBank';
import { QuestionAnswer } from '../QuestionBank/QuestionItem';

/*
  Picking bank questions for an assessment (owner, 2026-10-08): the live questions
  of its subject and grade the teacher sees (GET /assessments/questions
  ?subjectId&gradeLevel - the server's pickableQuestionsOf takes the same), with a
  search and a kind filter. Several are ticked and added at once; one already in
  the assessment is shown but cannot be ticked again. A row opens to show the
  question whole, key included. New questions are written in the bank itself.

  @param subject     `{ id, code, name }`
  @param gradeLevel  the class's grade
  @param held        Set of bank question ids already in the list
  @param today       the school's date, for "private until"
  @param onAdd       (questions) => void - the bank questions ticked, in list order
  @param onClose     () => void
*/
export const BankPickerDialog = ({ subject, gradeLevel, held, today, onAdd, onClose }) => {
  const { t, lang } = useT();
  const baseId = useId();
  /* undefined: reading · array · { error } */
  const [list, setList] = useState(undefined);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [ticked, setTicked] = useState(() => new Set());
  const [open, setOpen] = useState(null);
  const searchRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    assessmentService
      .list({ subjectId: subject.id, gradeLevel })
      .then((rows) => !cancelled && setList(rows))
      .catch((err) => !cancelled && setList({ error: questionBankErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
  }, [subject.id, gradeLevel, t]);

  useEffect(() => {
    openerRef.current = document.activeElement;
    searchRef.current?.focus();
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, [onClose]);

  const shown = useMemo(() => (Array.isArray(list) ? filterQuestions(list, { kind, query }) : []), [list, kind, query]);

  const toggle = (id) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const add = () => {
    onAdd((list ?? []).filter((question) => ticked.has(question.id)));
    onClose();
  };

  const titleId = `${baseId}-title`;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full p-5 sm:p-6 space-y-4 text-left max-h-[90dvh] flex flex-col"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-extrabold text-slate-900">
              {t('tasm.picker.title')}
            </h2>
            <FactLine size="xs" code={subject.code} name={subject.name} facts={[t('classes.grade', { n: gradeLevel })]} />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <label className="relative flex-1">
            <span className="sr-only">{t('qbank.filter.search')}</span>
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('qbank.filter.search')}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-base sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </label>
          <Select size="sm" aria-label={t('qbank.filter.kind')} value={kind} onChange={(e) => setKind(e.target.value)} className="sm:w-44">
            <option value="">{t('qbank.filter.allKinds')}</option>
            {KINDS.map((value) => (
              <option key={value} value={value}>
                {t(`qbank.kind.${value}`)}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto -mx-1 px-1">
          {list === undefined ? (
            <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />
          ) : list.error ? (
            <p className="text-sm font-semibold text-rose-700" role="alert">
              {list.error}
            </p>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-2 py-8">
              <Library className="w-8 h-8 text-slate-400" aria-hidden="true" />
              <p className="text-sm font-bold text-slate-700">{t('tasm.picker.empty')}</p>
              <a href="/question-bank/new" target="_blank" rel="noreferrer" className="text-xs font-bold text-brand hover:underline">
                {t('tasm.picker.write')}
              </a>
            </div>
          ) : shown.length === 0 ? (
            <p className="py-6 text-center text-sm font-semibold text-slate-500">{t('tasm.picker.noMatch')}</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
              {shown.map((question) => {
                const already = held.has(question.id);
                const expanded = open === question.id;
                const text = bodyText(question.body);
                return (
                  <li key={question.id} className="px-3.5 py-3 space-y-2">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={already || ticked.has(question.id)}
                        disabled={already}
                        onChange={() => toggle(question.id)}
                        aria-label={t('tasm.picker.tick', { text: text.slice(0, 80) })}
                        className="mt-1 w-4 h-4 accent-brand cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="block text-sm font-semibold text-slate-800 break-words">
                          {text.length > 180 ? `${text.slice(0, 180)}...` : text}
                        </span>
                        <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold text-slate-500">
                          <span>{t(`qbank.kind.${question.kind}`)}</span>
                          <span>{t(question.author?.left ? 'qbank.byLeft' : 'qbank.by', { name: question.author?.fullName ?? '' })}</span>
                          {isPrivateOn(question, today) && (
                            <span className="inline-flex items-center gap-1">
                              <Lock className="w-3 h-3" aria-hidden="true" />
                              {t('qbank.private.listed', { date: formatSchoolDay(question.privateUntil, lang) })}
                            </span>
                          )}
                          {already && <span className="text-brand">{t('tasm.picker.already')}</span>}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpen(expanded ? null : question.id)}
                        aria-expanded={expanded}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer shrink-0"
                      >
                        {expanded ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
                        {t(expanded ? 'tasm.picker.hide' : 'tasm.picker.show')}
                      </button>
                    </div>
                    {expanded && (
                      <div className="pl-7 space-y-3">
                        <div className="content-html text-sm text-slate-800 break-words" dangerouslySetInnerHTML={{ __html: question.body ?? '' }} />
                        {question.imageId && <QuestionImage imageId={question.imageId} questionId={question.id} className="max-h-56" />}
                        <QuestionAnswer question={question} t={t} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={modalActions}>
          <button type="button" onClick={onClose} className={modalCancelClass(false)}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={add} disabled={ticked.size === 0} className={modalConfirmClass('brand', false)}>
            {t('tasm.picker.add', { n: ticked.size })}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BankPickerDialog;
