import React, { useEffect, useId, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertCircle, ArrowDown, ArrowUp, CheckCircle2, Circle, Lock, Plus, RefreshCw, Square, SquareCheck, Trash2 } from 'lucide-react';

import FactLine from '../../components/ui/FactLine';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import ImagePicker from '../../components/questionBank/ImagePicker';
import { useT } from '../../i18n/LanguageContext';
import { isStaleQuestion, questionBankErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { assessmentService } from '../../services/assessmentService';
import TextEditor from '../Course/TextEditor';
import { useSchoolToday } from '../../hooks/useSchoolToday';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import {
  KINDS,
  MAX_ACCEPTED,
  MAX_OPTIONS,
  MAX_OPTION_TEXT,
  MCQ_SCORINGS,
  MIN_OPTIONS,
  blankOption,
  draftChanged,
  draftFrom,
  emptyDraft,
  formatSchoolDay,
  markCorrect,
  moveOption,
  pairKey,
  questionErrors,
  questionPayload,
  taughtPairs,
  withKind,
  yearAhead,
} from './questionBank';

/*
  Writing or editing one question (backend ed46340; owner 2026-10-07: a full page,
  at the Teacher's desk only). /question-bank/new and /question-bank/:id/edit.

  - New: the subject x grade they teach now (`taughtPairs`) and the kind; neither
    changes afterwards - a question goes to another grade by duplicating it.
  - The body in the materials' TextEditor, an optional image, then what the kind
    holds: an MCQ's scoring and 2-6 options (text, image or both; SINGLE marks one
    correct, the others at least one), TF's answer, SHORT's accepted answers, or
    for an ESSAY nothing - it is marked by hand.
  - Saved whole (PUT sends the whole content again). Two edits at once: the second
    is told the question changed meanwhile and may reload it.
  - Only the author edits; anyone else opening the address reads why.
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const tool =
  'inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40 disabled:cursor-not-allowed';
const fieldLabel = 'block text-sm font-bold text-slate-700';
const errorText = 'text-xs font-semibold text-red-600';

const OptionRow = ({ option, index, count, scoring, error, disabled, questionId, onChange, onCorrect, onMove, onRemove, t }) => {
  const single = scoring === 'SINGLE';
  const MarkIcon = option.correct ? (single ? CheckCircle2 : SquareCheck) : single ? Circle : Square;
  const letter = String.fromCharCode(65 + index);
  return (
    <li className={`rounded-2xl border p-3 sm:p-4 space-y-2.5 ${option.correct ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          role={single ? 'radio' : 'checkbox'}
          aria-checked={option.correct}
          aria-label={t('qbank.editor.markCorrect', { letter })}
          disabled={disabled}
          onClick={() => onCorrect(!option.correct)}
          className={`mt-1.5 shrink-0 rounded-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${option.correct ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <MarkIcon className="w-5 h-5" aria-hidden="true" />
        </button>
        <span className="mt-1.5 w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-xs font-extrabold flex items-center justify-center shrink-0">{letter}</span>
        <div className="min-w-0 flex-1 space-y-2">
          <textarea
            rows={2}
            value={option.text}
            maxLength={MAX_OPTION_TEXT}
            disabled={disabled}
            onChange={(e) => onChange({ text: e.target.value })}
            aria-label={t('qbank.editor.optionText', { letter })}
            aria-invalid={Boolean(error)}
            placeholder={t('qbank.editor.optionPlaceholder')}
            className={`w-full resize-y rounded-xl border bg-white px-3 py-2 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand ${
              error ? 'border-red-400' : 'border-slate-200'
            }`}
          />
          <ImagePicker
            compact
            imageId={option.imageId}
            questionId={questionId}
            disabled={disabled}
            label={t('qbank.editor.optionImage')}
            onChange={(imageId) => onChange({ imageId })}
          />
          {error && <p className={errorText}>{t(error)}</p>}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button type="button" onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label={t('qbank.editor.moveUp', { letter })} className={`${tool} text-slate-500 hover:bg-slate-100 px-1.5`}>
            <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={disabled || index === count - 1} aria-label={t('qbank.editor.moveDown', { letter })} className={`${tool} text-slate-500 hover:bg-slate-100 px-1.5`}>
            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button type="button" onClick={onRemove} disabled={disabled || count <= MIN_OPTIONS} aria-label={t('qbank.editor.removeOption', { letter })} className={`${tool} text-rose-600 hover:bg-rose-50 px-1.5`}>
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
};

const QuestionEditor = () => {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const { id } = useParams();
  const editing = Boolean(id);
  /* The school's date today, which a privacy day is read against (the server's todayOf). */
  const today = useSchoolToday();
  const baseId = useId();
  const { showToast } = useOutletContext() ?? {};

  /* undefined: reading · array · null: could not be read */
  const [pairs, setPairs] = useState(undefined);
  /* The saved question being edited: undefined reading · object · { error } */
  const [question, setQuestion] = useState(editing ? undefined : null);
  const [attempt, setAttempt] = useState(0);
  const [draft, setDraft] = useState(editing ? null : () => emptyDraft());
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  /* The saved question as a draft, what an edit is measured against. */
  const [baseline, setBaseline] = useState(null);
  /* Unsaved work holds a move away (owner, 2026-10-08). */
  const guard = useUnsavedGuard(editing ? Boolean(baseline) && draftChanged(draft, baseline) : draftChanged(draft));

  useEffect(() => {
    if (editing) return undefined;
    let cancelled = false;
    Promise.all([academicsService.myClassSubjects(), academicsService.academicYears().catch(() => null)])
      .then(([rows, years]) => {
        if (cancelled) return;
        const found = taughtPairs(rows, years);
        setPairs(found);
        /* One pair taught: chosen already. */
        if (found.length === 1) setDraft((prev) => ({ ...prev, subjectId: found[0].subject.id, gradeLevel: found[0].gradeLevel }));
      })
      .catch(() => !cancelled && setPairs(null));
    return () => {
      cancelled = true;
    };
  }, [editing]);

  useEffect(() => {
    if (!editing) return undefined;
    let cancelled = false;
    assessmentService
      .get(id)
      .then((saved) => {
        if (cancelled) return;
        setQuestion(saved);
        setDraft(draftFrom(saved, today));
        setBaseline(draftFrom(saved, today));
        setErrors({});
        setFailure(null);
      })
      .catch((err) => !cancelled && setQuestion({ error: questionBankErrorMessage(err, t) }));
    return () => {
      cancelled = true;
    };
    // today is read once per load: a draft is not rebuilt at midnight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, id, attempt, t]);

  const update = (patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setFailure(null);
  };
  const updateOption = (key, patch) =>
    setDraft((prev) => ({ ...prev, options: prev.options.map((option) => (option.key === key ? { ...option, ...patch } : option)) }));

  const save = async () => {
    const found = questionErrors(draft, { editing, today });
    setErrors(found);
    if (Object.keys(found).length) {
      setFailure({ message: t('qbank.editor.fixErrors') });
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const body = questionPayload(draft, { editing });
      if (editing) await assessmentService.update(id, body);
      else await assessmentService.create(body);
      showToast?.(t(editing ? 'qbank.toast.saved' : 'qbank.toast.created'), 'success');
      guard.release();
      navigate('/question-bank');
    } catch (err) {
      setBusy(false);
      setFailure({ message: questionBankErrorMessage(err, t), stale: editing && isStaleQuestion(err) });
    }
  };

  /* ---- what cannot be edited here ---- */

  if (editing && question === undefined) {
    return <div className="h-96 rounded-2xl bg-white border border-slate-100 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
  }
  if (editing && question?.error) {
    return (
      <div className={`${card} flex flex-col items-center text-center gap-3 py-10`} role="alert">
        <AlertCircle className="w-8 h-8 text-rose-500" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-700">{question.error}</p>
        <button type="button" onClick={() => navigate('/question-bank')} className={`${tool} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
          {t('qbank.back')}
        </button>
      </div>
    );
  }
  if (editing && !question.canEdit) {
    return (
      <div className={`${card} flex flex-col items-center text-center gap-3 py-10`}>
        <Lock className="w-8 h-8 text-slate-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-600 max-w-sm">{t('qbank.editor.notAuthor')}</p>
        <button type="button" onClick={() => navigate('/question-bank')} className={`${tool} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
          {t('qbank.back')}
        </button>
      </div>
    );
  }
  if (!editing && pairs !== undefined && !pairs?.length) {
    return (
      <div className={`${card} flex flex-col items-center text-center gap-3 py-10`}>
        <Lock className="w-8 h-8 text-slate-400" aria-hidden="true" />
        <p className="text-sm font-semibold text-slate-600 max-w-sm">{t(pairs === null ? 'qbank.pairsFailed' : 'qbank.noPairs')}</p>
        <button type="button" onClick={() => navigate('/question-bank')} className={`${tool} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
          {t('qbank.back')}
        </button>
      </div>
    );
  }

  const questionId = editing ? id : null;
  const options = draft.options ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {t(editing ? 'qbank.editor.editTitle' : 'qbank.editor.newTitle')}
        </h1>
        {editing && (
          <FactLine code={question.subject?.code} name={question.subject?.name} facts={[t('classes.grade', { n: question.gradeLevel }), t(`qbank.kind.${question.kind}`)]} />
        )}
      </div>

      {editing && question.archived && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{t('qbank.editor.archivedNote')}</p>
      )}

      {!editing && (
        <section className={`${card} space-y-4`}>
          <div className="space-y-1.5">
            <label htmlFor={`${baseId}-pair`} className={fieldLabel}>
              {t('qbank.editor.pair')}
            </label>
            {pairs === undefined ? (
              <span className="block h-11 rounded-xl bg-slate-100 animate-pulse" />
            ) : (
              <Select
                id={`${baseId}-pair`}
                value={draft.subjectId ? pairKey(draft.subjectId, draft.gradeLevel) : ''}
                invalid={Boolean(errors.pair)}
                disabled={busy}
                onChange={(e) => {
                  const pair = pairs.find((item) => item.key === e.target.value);
                  update({ subjectId: pair?.subject.id ?? '', gradeLevel: pair?.gradeLevel ?? '' });
                  setErrors((prev) => ({ ...prev, pair: undefined }));
                }}
              >
                <option value="">{t('qbank.editor.pairPick')}</option>
                {pairs.map((pair) => (
                  <option key={pair.key} value={pair.key}>
                    {`${pair.subject.code} - ${pair.subject.name} / ${t('classes.grade', { n: pair.gradeLevel })}`}
                  </option>
                ))}
              </Select>
            )}
            <p className="text-[11px] font-medium text-slate-500">{t('qbank.editor.pairHint')}</p>
            {errors.pair && <p className={errorText}>{t(errors.pair)}</p>}
          </div>

          <div className="space-y-1.5">
            <span id={`${baseId}-kind`} className={fieldLabel}>
              {t('qbank.editor.kind')}
            </span>
            <div role="radiogroup" aria-labelledby={`${baseId}-kind`} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {KINDS.map((kind) => {
                const on = draft.kind === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={busy}
                    onClick={() => {
                      if (on) return;
                      setDraft((prev) => withKind(prev, kind));
                      setErrors({});
                    }}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-extrabold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      on ? 'border-brand bg-brand-tint text-brand' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t(`qbank.kind.${kind}`)}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] font-medium text-slate-500">{t('qbank.editor.kindHint')}</p>
          </div>
        </section>
      )}

      <section className={`${card} space-y-4`}>
        <div className="space-y-1.5">
          <span id={`${baseId}-body`} className={fieldLabel}>
            {t('qbank.editor.body')}
          </span>
          {/* Keyed on the version read: the editor takes its HTML once, so a reload remounts it. */}
          <TextEditor key={editing ? question.updatedAt : 'new'} id={`${baseId}-body-box`} labelledBy={`${baseId}-body`} value={draft.body} onChange={(html) => update({ body: html })} disabled={busy} invalid={Boolean(errors.body)} />
          {errors.body && <p className={errorText}>{t(errors.body)}</p>}
        </div>
        <ImagePicker imageId={draft.imageId} questionId={questionId} disabled={busy} label={t('qbank.editor.bodyImage')} onChange={(imageId) => update({ imageId })} />
      </section>

      <section className={`${card} space-y-4`} aria-labelledby={`${baseId}-answer`}>
        <h2 id={`${baseId}-answer`} className="text-base font-extrabold text-slate-900">
          {t('qbank.answerKey')}
        </h2>

        {draft.kind === 'MCQ' && (
          <>
            <div className="space-y-1.5">
              <label htmlFor={`${baseId}-scoring`} className={fieldLabel}>
                {t('qbank.editor.scoring')}
              </label>
              <Select id={`${baseId}-scoring`} value={draft.mcqScoring} disabled={busy} onChange={(e) => update({ mcqScoring: e.target.value })}>
                {MCQ_SCORINGS.map((scoring) => (
                  <option key={scoring} value={scoring}>
                    {t(`qbank.scoring.${scoring}`)}
                  </option>
                ))}
              </Select>
              <p className="text-[11px] font-medium text-slate-500">{t(`qbank.scoringHint.${draft.mcqScoring}`)}</p>
            </div>

            <ol className="space-y-2.5">
              {options.map((option, index) => (
                <OptionRow
                  key={option.key}
                  option={option}
                  index={index}
                  count={options.length}
                  scoring={draft.mcqScoring}
                  error={errors.option?.[option.key]}
                  disabled={busy}
                  questionId={questionId}
                  t={t}
                  onChange={(patch) => updateOption(option.key, patch)}
                  onCorrect={(correct) => setDraft((prev) => markCorrect(prev, option.key, correct))}
                  onMove={(step) => setDraft((prev) => ({ ...prev, options: moveOption(prev.options, option.key, step) }))}
                  onRemove={() => setDraft((prev) => ({ ...prev, options: prev.options.filter((item) => item.key !== option.key) }))}
                />
              ))}
            </ol>
            {options.length < MAX_OPTIONS && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setDraft((prev) => ({ ...prev, options: [...prev.options, blankOption()] }))}
                className={`${tool} border border-dashed border-slate-300 text-slate-700 hover:bg-slate-50`}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                {t('qbank.editor.addOption')}
              </button>
            )}
            {errors.options && <p className={errorText}>{t(errors.options)}</p>}
          </>
        )}

        {draft.kind === 'TF' && (
          <div className="space-y-1.5">
            <div role="radiogroup" aria-label={t('qbank.answerKey')} className="grid grid-cols-2 gap-2 max-w-sm">
              {[true, false].map((value) => {
                const on = draft.value === value;
                return (
                  <button
                    key={String(value)}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={busy}
                    onClick={() => {
                      update({ value });
                      setErrors((prev) => ({ ...prev, value: undefined }));
                    }}
                    className={`px-3 py-2.5 rounded-xl border text-sm font-extrabold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      on ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t(value ? 'qbank.tf.true' : 'qbank.tf.false')}
                  </button>
                );
              })}
            </div>
            {errors.value && <p className={errorText}>{t(errors.value)}</p>}
          </div>
        )}

        {draft.kind === 'SHORT' && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-slate-500">{t('qbank.short.hint')}</p>
            <ul className="space-y-2">
              {draft.accepted.map((answer, index) => (
                <li key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={answer}
                    maxLength={200}
                    disabled={busy}
                    aria-label={t('qbank.editor.acceptedN', { n: index + 1 })}
                    onChange={(e) => update({ accepted: draft.accepted.map((item, i) => (i === index ? e.target.value : item)) })}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                  />
                  <button
                    type="button"
                    disabled={busy || draft.accepted.length <= 1}
                    onClick={() => update({ accepted: draft.accepted.filter((_, i) => i !== index) })}
                    aria-label={t('qbank.editor.removeAccepted', { n: index + 1 })}
                    className={`${tool} text-rose-600 hover:bg-rose-50 px-1.5`}
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {draft.accepted.length < MAX_ACCEPTED && (
              <button
                type="button"
                disabled={busy}
                onClick={() => update({ accepted: [...draft.accepted, ''] })}
                className={`${tool} border border-dashed border-slate-300 text-slate-700 hover:bg-slate-50`}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                {t('qbank.editor.addAccepted')}
              </button>
            )}
            {errors.accepted && <p className={errorText}>{t(errors.accepted)}</p>}
          </div>
        )}

        {draft.kind === 'ESSAY' && <p className="text-sm font-semibold text-slate-600">{t('qbank.essay.note')}</p>}
      </section>

      <section className={`${card} space-y-3`} aria-labelledby={`${baseId}-privacy`}>
        <h2 id={`${baseId}-privacy`} className="text-base font-extrabold text-slate-900">
          {t('qbank.private.title')}
        </h2>
        <label className="flex items-start gap-2.5 text-sm font-bold text-slate-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={draft.isPrivate}
            disabled={busy}
            onChange={(e) => {
              update({ isPrivate: e.target.checked });
              setErrors((prev) => ({ ...prev, privateUntil: undefined }));
            }}
            className="mt-0.5 w-4 h-4 accent-brand cursor-pointer"
          />
          <span className="inline-flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            {t('qbank.private.toggle')}
          </span>
        </label>
        {draft.isPrivate && (
          <div className="pl-6 space-y-2 max-w-xs">
            <Input
              id={`${baseId}-private-until`}
              name="privateUntil"
              type="date"
              label={t('qbank.private.until')}
              value={draft.privateUntil}
              min={today || undefined}
              max={today ? yearAhead(today) : undefined}
              disabled={busy}
              error={errors.privateUntil ? t(errors.privateUntil) : undefined}
              onChange={(e) => {
                update({ privateUntil: e.target.value });
                setErrors((prev) => ({ ...prev, privateUntil: undefined }));
              }}
            />
          </div>
        )}
        <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
          {draft.isPrivate
            ? t('qbank.private.hintOn', { date: today ? formatSchoolDay(yearAhead(today), lang) : '-' })
            : t('qbank.private.hintOff')}
        </p>
      </section>

      {failure && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold space-y-2" role="alert">
          <p>{failure.message}</p>
          {failure.stale && (
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className={`${tool} bg-white border border-red-200 text-red-700 hover:bg-red-50`}>
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              {t('qbank.editor.reload')}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        <button type="button" onClick={() => navigate('/question-bank')} disabled={busy} className={`${tool} px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-100`}>
          {t('common.cancel')}
        </button>
        <button type="button" onClick={save} disabled={busy} className={`${tool} px-5 py-2.5 text-sm bg-brand text-white hover:bg-brand-deep`}>
          {busy ? t('common.loading') : t(editing ? 'qbank.editor.saveChanges' : 'qbank.editor.save')}
        </button>
      </div>
      {guard.dialog}
    </div>
  );
};

/*
  Keyed on the address: going from one question's edit page to another's (or to
  /new) starts afresh, so a draft read for one question is never sent to another.
*/
export const QuestionEditorPage = () => {
  const { id } = useParams();
  return <QuestionEditor key={id ?? 'new'} />;
};

export default QuestionEditorPage;
