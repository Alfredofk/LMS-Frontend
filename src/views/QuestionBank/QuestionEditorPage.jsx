import React, { useEffect, useId, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { AlertCircle, Lock, RefreshCw } from 'lucide-react';

import FactLine from '../../components/ui/FactLine';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useT } from '../../i18n/LanguageContext';
import { isStaleQuestion, questionBankErrorMessage } from '../../i18n/apiError';
import { academicsService } from '../../services/academicsService';
import { assessmentService } from '../../services/assessmentService';
import { useSchoolToday } from '../../hooks/useSchoolToday';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import {
  KINDS,
  draftChanged,
  draftFrom,
  emptyDraft,
  formatSchoolDay,
  pairKey,
  questionErrors,
  questionPayload,
  taughtPairs,
  withKind,
  yearAhead,
} from './questionBank';
import QuestionContentFields from './QuestionContentFields';

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
      if (editing) await assessmentService.update(id, body, question.updatedAt);
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

      <QuestionContentFields
        draft={draft}
        setDraft={setDraft}
        update={update}
        errors={errors}
        setErrors={setErrors}
        busy={busy}
        baseId={baseId}
        editorKey={editing ? question.updatedAt : 'new'}
        imageSource={{ questionId }}
        t={t}
      />

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
