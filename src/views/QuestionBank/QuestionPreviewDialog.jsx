import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Archive, ArchiveRestore, Check, CheckCircle2, Circle, Copy, Pencil, X } from 'lucide-react';

import Select from '../../components/ui/Select';
import SubjectLabel from '../../components/ui/SubjectLabel';
import QuestionImage from '../../components/questionBank/QuestionImage';
import { useT } from '../../i18n/LanguageContext';
import { questionBankErrorMessage, isStaleQuestion } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import { duplicateGrades, formatQuestionDate } from './questionBank';

/*
  One question in full, with its answer key (owner, 2026-10-07: the list shows
  cards, a card opens this). Whoever sees a question sees its key - the server's
  rule (assessment.bank.js). What may be done here is the reader's: at the
  Teacher's desk the author edits, archives and restores (`canEdit`), and anyone
  duplicates into a grade of the same subject they teach now; at the Principal's
  or a Vice Principal's desk it is read only.

  @param question   a questionView
  @param pairs      what the reader teaches now (taughtPairs), [] at a leader's desk
  @param writable   the Teacher's desk
  @param onEdit     () => void
  @param onChanged  (question, toastKey) => void - archived, restored or duplicated
  @param onStale    () => void - the list is behind; read it again
*/

const tool =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';

/** The answer key, by kind. Shared with the editor's preview. */
export const QuestionAnswer = ({ question, t }) => {
  if (question.kind === 'MCQ') {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-bold text-slate-500">{t(`qbank.scoring.${question.mcqScoring ?? 'SINGLE'}`)}</p>
        <ol className="space-y-2">
          {(question.options ?? []).map((option, i) => (
            <li
              key={option.id ?? i}
              className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 ${
                option.correct ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}
            >
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-xs font-extrabold flex items-center justify-center shrink-0">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="min-w-0 flex-1 space-y-1.5">
                {option.text && <span className="block text-sm font-semibold text-slate-800 break-words">{option.text}</span>}
                {option.imageId && <QuestionImage imageId={option.imageId} questionId={question.id} className="max-h-32" />}
              </span>
              {option.correct ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 shrink-0">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  {t('qbank.correct')}
                </span>
              ) : (
                <Circle className="w-4 h-4 text-slate-300 shrink-0" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (question.kind === 'TF') {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-extrabold text-emerald-700">
        <Check className="w-4 h-4" aria-hidden="true" />
        {t(question.value ? 'qbank.tf.true' : 'qbank.tf.false')}
      </p>
    );
  }
  if (question.kind === 'SHORT') {
    return (
      <div className="space-y-2">
        <ul className="flex flex-wrap gap-1.5">
          {(question.accepted ?? []).map((answer) => (
            <li key={answer} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-bold break-all">
              {answer}
            </li>
          ))}
        </ul>
        <p className="text-[11px] font-medium text-slate-500">{t('qbank.short.hint')}</p>
      </div>
    );
  }
  return <p className="text-sm font-semibold text-slate-600">{t('qbank.essay.note')}</p>;
};

export const QuestionPreviewDialog = ({ question, pairs = [], writable = false, onClose, onEdit, onChanged, onStale }) => {
  const { t, lang } = useT();
  const closeRef = useRef(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const grades = writable ? duplicateGrades(question, pairs) : [];
  /* The grade picked, else its own when taught, else the first taught - so a
     dialog opened before the pairs arrived still names a grade. */
  const [picked, setPicked] = useState('');
  const grade = grades.includes(Number(picked)) ? Number(picked) : grades.includes(question.gradeLevel) ? question.gradeLevel : grades[0];

  /* Focus moves in once and back to the card on close; Escape is its own listener,
     so a re-render never moves focus. */
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  const act = async (kind) => {
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'archive') onChanged(await assessmentService.archive(question.id), 'qbank.toast.archived');
      else if (kind === 'restore') onChanged(await assessmentService.restore(question.id), 'qbank.toast.restored');
      else onChanged(await assessmentService.duplicate(question.id, grade), 'qbank.toast.duplicated');
    } catch (err) {
      setError(questionBankErrorMessage(err, t));
      if (isStaleQuestion(err)) onStale?.();
    } finally {
      setBusy(null);
    }
  };

  const canEdit = writable && question.canEdit;

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qbank-preview-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full max-h-[90dvh] overflow-y-auto p-5 sm:p-7 space-y-5"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <h2 id="qbank-preview-title" className="flex flex-wrap items-center gap-2 text-base font-extrabold text-slate-900">
              <span className="px-2 py-0.5 rounded-md bg-brand-tint text-brand text-xs font-extrabold">{t(`qbank.kind.${question.kind}`)}</span>
              <SubjectLabel code={question.subject?.code} name={question.subject?.name} />
              <span className="text-xs font-bold text-slate-500">{t('classes.grade', { n: question.gradeLevel })}</span>
            </h2>
            <p className="text-xs font-semibold text-slate-500">
              {t(question.author?.left ? 'qbank.byLeft' : 'qbank.by', { name: question.author?.fullName ?? '' })}
              {' - '}
              {t('qbank.updated', { date: formatQuestionDate(question.updatedAt, lang) })}
              {question.duplicatedFromId && ` - ${t('qbank.duplicate.from')}`}
              {question.archived && ` - ${t('qbank.archivedOn', { date: formatQuestionDate(question.archivedAt, lang) })}`}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            disabled={Boolean(busy)}
            aria-label={t('common.close')}
            className="w-9 h-9 -mr-2 -mt-2 rounded-xl text-slate-500 hover:bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="content-html text-sm text-slate-800" dangerouslySetInnerHTML={{ __html: question.body ?? '' }} />
          {question.imageId && <QuestionImage imageId={question.imageId} questionId={question.id} className="max-h-72" />}
        </div>

        <section className="space-y-2" aria-labelledby="qbank-preview-key">
          <h3 id="qbank-preview-key" className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
            {t('qbank.answerKey')}
          </h3>
          <QuestionAnswer question={question} t={t} />
        </section>

        {error && (
          <p className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
            {error}
          </p>
        )}

        {writable && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            {canEdit && !question.archived && (
              <button type="button" onClick={onEdit} disabled={Boolean(busy)} className={`${tool} mt-3 bg-brand text-white hover:bg-brand-deep`}>
                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                {t('qbank.edit')}
              </button>
            )}
            {grades.length > 0 && !question.archived && (
              <span className="mt-3 inline-flex items-center gap-2">
                {grades.length > 1 && (
                  <Select size="sm" aria-label={t('qbank.duplicate.grade')} value={String(grade)} onChange={(e) => setPicked(e.target.value)} className="w-32">
                    {grades.map((g) => (
                      <option key={g} value={String(g)}>
                        {t('classes.grade', { n: g })}
                      </option>
                    ))}
                  </Select>
                )}
                <button type="button" onClick={() => act('duplicate')} disabled={Boolean(busy)} className={`${tool} border border-slate-200 text-slate-700 hover:bg-slate-50`}>
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                  {busy === 'duplicate' ? t('common.loading') : t('qbank.duplicate.action')}
                </button>
              </span>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => act(question.archived ? 'restore' : 'archive')}
                disabled={Boolean(busy)}
                className={`${tool} mt-3 sm:ml-auto border border-slate-200 text-slate-700 hover:bg-slate-50`}
              >
                {question.archived ? <ArchiveRestore className="w-3.5 h-3.5" aria-hidden="true" /> : <Archive className="w-3.5 h-3.5" aria-hidden="true" />}
                {busy === 'archive' || busy === 'restore' ? t('common.loading') : t(question.archived ? 'qbank.restore' : 'qbank.archive')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default QuestionPreviewDialog;
