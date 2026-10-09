import React from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, Circle, Plus, Square, SquareCheck, Trash2 } from 'lucide-react';

import Select from '../../components/ui/Select';
import ImagePicker from '../../components/questionBank/ImagePicker';
import TextEditor from '../Course/TextEditor';
import { MAX_ACCEPTED, MAX_OPTIONS, MAX_OPTION_TEXT, MCQ_SCORINGS, MIN_OPTIONS, blankOption, markCorrect, moveOption } from './questionBank';

/*
  What a question says and how it is marked: the body and its image, then an
  MCQ's scoring and options, TF's answer, SHORT's accepted answers, or ESSAY's
  note. Shared by the bank's editor and an assessment's copy (backend 6380e3e:
  a copy is edited in place, of the bank's shape; owner 2026-10-09).

  @param imageSource  where a saved image is read: `{ questionId }` for a bank
                      question, `{ assessmentId }` for a copy
  @param editorKey    the version read: the body's editor takes its HTML once, so
                      a reload remounts it
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const tool =
  'inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-40 disabled:cursor-not-allowed';
/* An icon button's own padding: a caller's px-1.5 loses to the px-2.5 above (measured 34px wide). */
const iconTool = tool.replace('px-2.5', 'px-1.5');
const fieldLabel = 'block text-sm font-bold text-slate-700';
const errorText = 'text-xs font-semibold text-red-600';

const OptionRow = ({ option, index, count, scoring, error, disabled, imageSource, onChange, onCorrect, onMove, onRemove, t }) => {
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
            className={`w-full resize-y rounded-xl border bg-white px-3 py-2 text-sm font-medium text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand ${
              error ? 'border-red-400' : 'border-slate-200'
            }`}
          />
          <ImagePicker
            compact
            imageId={option.imageId}
            {...imageSource}
            disabled={disabled}
            label={t('qbank.editor.optionImage')}
            onChange={(imageId) => onChange({ imageId })}
          />
          {error && <p className={errorText}>{t(error)}</p>}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button type="button" onClick={() => onMove(-1)} disabled={disabled || index === 0} aria-label={t('qbank.editor.moveUp', { letter })} className={`${iconTool} text-slate-500 hover:bg-slate-100`}>
            <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={disabled || index === count - 1} aria-label={t('qbank.editor.moveDown', { letter })} className={`${iconTool} text-slate-500 hover:bg-slate-100`}>
            <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button type="button" onClick={onRemove} disabled={disabled || count <= MIN_OPTIONS} aria-label={t('qbank.editor.removeOption', { letter })} className={`${iconTool} text-rose-600 hover:bg-rose-50`}>
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </li>
  );
};

export const QuestionContentFields = ({ draft, setDraft, update, errors, setErrors, busy, baseId, editorKey, imageSource, t }) => {
  const options = draft.options ?? [];
  const updateOption = (key, patch) =>
    setDraft((prev) => ({ ...prev, options: prev.options.map((option) => (option.key === key ? { ...option, ...patch } : option)) }));

  return (
    <>
      <section className={`${card} space-y-4`}>
        <div className="space-y-1.5">
          <span id={`${baseId}-body`} className={fieldLabel}>
            {t('qbank.editor.body')}
          </span>
          {/* Keyed on the version read: the editor takes its HTML once, so a reload remounts it. */}
          <TextEditor key={editorKey} id={`${baseId}-body-box`} labelledBy={`${baseId}-body`} value={draft.body} onChange={(html) => update({ body: html })} disabled={busy} invalid={Boolean(errors.body)} />
          {errors.body && <p className={errorText}>{t(errors.body)}</p>}
        </div>
        <ImagePicker imageId={draft.imageId} {...imageSource} disabled={busy} label={t('qbank.editor.bodyImage')} onChange={(imageId) => update({ imageId })} />
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
                  imageSource={imageSource}
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
                className={`${iconTool} text-rose-600 hover:bg-rose-50`}
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
    </>
  );
};

export default QuestionContentFields;
