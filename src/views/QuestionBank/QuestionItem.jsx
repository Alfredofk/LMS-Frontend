import React, { useState } from 'react';
import { Archive, ArchiveRestore, Check, CheckCircle2, ChevronRight, Circle, Copy, Pencil } from 'lucide-react';

import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Select from '../../components/ui/Select';
import FactLine from '../../components/ui/FactLine';
import { Unfold } from '../Dashboard/components/HomeCard';
import QuestionImage from '../../components/questionBank/QuestionImage';
import { questionBankErrorMessage, isStaleQuestion } from '../../i18n/apiError';
import { assessmentService } from '../../services/assessmentService';
import { duplicateGrades, formatQuestionDate, formatSchoolDay, isPrivateOn, plainTextOf } from './questionBank';
import { BusyLabel } from '../../components/ui/ModalHeading';

/*
  One question as a row of the bank's list, opened in place (owner, 2026-10-28,
  the reviewed mockup, choice B; it was every question in full, 2026-10-07). Closed:
  its number, its first line as plain text, and one grey line (kind / subject /
  grade / "Soal saya" / with an image). Open: who wrote it and when, the body in
  full, its image, the answer key and the actions. Whoever sees a question sees its key - the server's rule
  (assessment.bank.js). What may be done here is the reader's: at the Teacher's
  desk the author edits, archives and restores (`canEdit`), and anyone
  duplicates into a grade of the same subject they teach now; at the
  Principal's or a Vice Principal's desk it is read only.

  @param question   a questionView
  @param number     its place in the list shown, from 1
  @param pairs      what the reader teaches now (taughtPairs), [] at a leader's desk
  @param writable   the Teacher's desk
  @param onEdit     () => void
  @param onChanged  (question, toastKey) => void - archived, restored or duplicated
  @param onStale    () => void - the list is behind; read it again
  @param today      the school's date, 'YYYY-MM-DD': a privacy over by then is
                    not shown (backend abbb3d5 sends the day still)
  @param open       whether the row is open (one at a time, the list's)
  @param onToggle   () => void
*/

const tool =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';

/**
 * The answer key, by kind. `imageSource` says where its images are read: the bank
 * question by default, or `{ assessmentId }` for an Assessment's copy.
 */
export const QuestionAnswer = ({ question, t, imageSource = null }) => {
  const source = imageSource ?? { questionId: question.id };
  if (question.kind === 'MCQ') {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-bold text-slate-500">{t(`qbank.scoring.${question.mcqScoring ?? 'SINGLE'}`)}</p>
        <ol className="space-y-2">
          {(question.options ?? []).map((option, i) => (
            <li
              key={option.id ?? i}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 ${
                option.correct ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}
            >
              <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 text-xs font-extrabold flex items-center justify-center shrink-0">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="min-w-0 flex-1 space-y-1.5">
                {option.text && <span className="block text-sm font-semibold text-slate-800 break-words">{option.text}</span>}
                {option.imageId && <QuestionImage imageId={option.imageId} {...source} className="max-h-32" />}
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

export const QuestionItem = ({ question, number, pairs = [], writable = false, onEdit, onChanged, onStale, today = '', t, lang, open = false, onToggle }) => {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  /* A copy is a permanent row - the bank has no delete (assessment.bank.js
     duplicateQuestion) - so it is asked first (owner, 2026-10-08). */
  const [confirming, setConfirming] = useState(false);
  const grades = writable ? duplicateGrades(question, pairs) : [];
  /* The grade picked, else its own when taught, else the first taught - so an
     item drawn before the pairs arrived still names a grade. */
  const [picked, setPicked] = useState('');
  const grade = grades.includes(Number(picked)) ? Number(picked) : grades.includes(question.gradeLevel) ? question.gradeLevel : grades[0];

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
      setConfirming(false);
    }
  };

  const canEdit = writable && question.canEdit;
  const canDuplicate = grades.length > 0 && !question.archived;
  const titleId = `qbank-${question.id}-title`;
  const keyId = `qbank-${question.id}-key`;

  const facts = [
    t(`qbank.kind.${question.kind}`),
    [question.subject?.code, question.subject?.name].filter(Boolean).join(' - '),
    t('classes.grade', { n: question.gradeLevel }),
    question.mine && t('qbank.mineBadge'),
    question.imageId && t('qbank.hasImage'),
  ];
  const about = [
    t(question.author?.left ? 'qbank.byLeft' : 'qbank.by', { name: question.author?.fullName ?? '' }),
    t('qbank.updated', { date: formatQuestionDate(question.updatedAt, lang) }),
    question.duplicatedFromId && t('qbank.duplicate.from'),
    question.archived && t('qbank.archivedOn', { date: formatQuestionDate(question.archivedAt, lang) }),
    isPrivateOn(question, today) && t('qbank.private.listed', { date: formatSchoolDay(question.privateUntil, lang) }),
  ];
  const panelId = `qbank-${question.id}-panel`;

  return (
    <li className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`w-full flex items-start gap-3 px-[18px] py-3.5 text-left transition-colors cursor-pointer hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand ${
          open ? 'bg-slate-50' : ''
        }`}
      >
        <span className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 text-xs font-extrabold flex items-center justify-center shrink-0">{number}</span>
        <span className="min-w-0 flex-1">
          {/* Closed, its first line; open, the body in full below takes its place. */}
          {!open && (
            <span id={titleId} className="block text-sm font-bold text-slate-900 truncate">
              {plainTextOf(question.body) || t('qbank.imageOnly')}
            </span>
          )}
          <FactLine size="xs" wrap facts={facts} className={open ? 'pt-1' : 'mt-0.5'} />
        </span>
        <ChevronRight
          className={`w-4 h-4 mt-1.5 shrink-0 text-slate-400 transition-transform duration-300 ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      </button>

      <Unfold open={open}>
      <article id={panelId} aria-labelledby={open ? keyId : undefined} className="pl-[58px] max-sm:pl-[18px] pr-[18px] pb-5 space-y-4 bg-slate-50">
      <FactLine size="xs" wrap facts={about} />

      <div className="space-y-3">
        <div id={open ? titleId : undefined} className="content-html text-sm text-slate-800 break-words" dangerouslySetInnerHTML={{ __html: question.body ?? '' }} />
        {question.imageId && open && <QuestionImage imageId={question.imageId} questionId={question.id} className="max-h-72" />}
      </div>

      <section className="space-y-2" aria-labelledby={keyId}>
        <h3 id={keyId} className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
          {t('qbank.answerKey')}
        </h3>
        <QuestionAnswer question={question} t={t} />
      </section>

      {error && (
        <p className="rounded-xl bg-rose-50 p-3.5 text-[13px] text-rose-700 font-semibold" role="alert">
          {error}
        </p>
      )}

      {(canEdit || canDuplicate) && (
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200">
          {canEdit && !question.archived && (
            <button type="button" onClick={onEdit} disabled={Boolean(busy)} className={`${tool} bg-brand text-white hover:bg-brand-deep`}>
              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
              {t('qbank.edit')}
            </button>
          )}
          {canDuplicate && (
            <span className="inline-flex items-center gap-2">
              {grades.length > 1 && (
                <Select size="sm" aria-label={t('qbank.duplicate.grade')} value={String(grade)} onChange={(e) => setPicked(e.target.value)} className="w-32">
                  {grades.map((g) => (
                    <option key={g} value={String(g)}>
                      {t('classes.grade', { n: g })}
                    </option>
                  ))}
                </Select>
              )}
              <button type="button" onClick={() => setConfirming(true)} disabled={Boolean(busy)} className={`${tool} border border-slate-200 text-slate-700 hover:bg-slate-50`}>
                {busy !== 'duplicate' && <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                <BusyLabel busy={busy === 'duplicate'}>{t('qbank.duplicate.action')}</BusyLabel>
              </button>
            </span>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => act(question.archived ? 'restore' : 'archive')}
              disabled={Boolean(busy)}
              className={`${tool} sm:ml-auto border border-slate-200 text-slate-700 hover:bg-slate-50`}
            >
              {busy !== 'archive' && busy !== 'restore' && (question.archived ? <ArchiveRestore className="w-3.5 h-3.5" aria-hidden="true" /> : <Archive className="w-3.5 h-3.5" aria-hidden="true" />)}
              <BusyLabel busy={busy === 'archive' || busy === 'restore'}>{t(question.archived ? 'qbank.restore' : 'qbank.archive')}</BusyLabel>
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        tone="brand"
        icon={Copy}
        title={t('qbank.duplicate.confirmTitle')}
        body={[
          t('qbank.duplicate.confirmBody', { grade: t('classes.grade', { n: grade }) }),
          isPrivateOn(question, today) ? t('qbank.duplicate.confirmPrivate', { date: formatSchoolDay(question.privateUntil, lang) }) : '',
        ].filter(Boolean).join(' ')}
        confirmLabel={t('qbank.duplicate.action')}
        cancelLabel={t('common.cancel')}
        busy={busy === 'duplicate'}
        onConfirm={() => act('duplicate')}
        onCancel={() => setConfirming(false)}
      />
      </article>
      </Unfold>
    </li>
  );
};

export default QuestionItem;
