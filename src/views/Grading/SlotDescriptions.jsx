import React, { useState } from 'react';

import { useT } from '../../i18n/LanguageContext';
import { descriptionsErrorMessage, isDescriptionsLocked, isStaleDescriptions } from '../../i18n/apiError';
import { gradingService } from '../../services/gradingService';
import { formatNumber } from '../TeacherAssessment/results';
import { belowKktp } from '../Gradebook/gradebook';
import {
  DESCRIPTION_MAX,
  descriptionErrors,
  descriptionRows,
  descriptionsBody,
  draftsAfterSave,
  isChanged,
  savedCount,
  shownRows,
  textOf,
  willClear,
} from './descriptions';

/*
  "Deskripsi rapor" under the gradebook (owner, 2026-10-18; backend 483be5a): every
  student the slot describes, their final grade beside the name (red under the
  KKTP), a box that grows with its text and a counter to 1,000, "12 dari 30 sudah
  diisi" in the head, and one "Simpan deskripsi" sending the changed ones in one PUT
  (descriptions.js). Optional since backend eadf680 (owner, 2026-10-18): a saved one
  emptied reads "Akan dihapus saat disimpan" and is cleared. Readers (Principal, Vice
  Principals, the homeroom teacher), a closed semester or year, and a finalised slot
  (`grades.finalised`, ticket 04 - its teacher undoes it first) get the texts, read
  only.

  It opens closed (owner, 2026-10-18: thirty open boxes ran to six screens): the
  title, "12 dari 30 sudah diisi" and "Tulis deskripsi" (a reader: "Lihat deskripsi");
  open, "Semua / Belum diisi" (shownRows) and "Tutup". It opens by itself while typing
  waits unsaved, and closing keeps that typing.

  The drafts live in the host (`drafts`, `onDrafts`): switching the subject page's
  tab unmounts this card and only changes the query, which the leave guard lets
  through, so typing kept here would be lost without a word.

  @param classSubjectId  the slot
  @param grades          the gradebook's grade read: undefined reading · the answer · { failed: true }
  @param kktp            the KKTP that applies, for the red final grade
  @param canEdit         the answering teacher in an open year
  @param drafts          { [studentProfileId]: text } typed and not saved
  @param onDrafts        (drafts) => void
  @param onReload        () => void - read the grades again (a stale row, a student gone)
  @param onToast         (message, type) => void
*/

const card = 'bg-white border border-slate-100 rounded-2xl p-5 sm:p-6 shadow-sm';
const button =
  'inline-flex items-center justify-center px-4 py-2 rounded-xl text-sm font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-50 disabled:cursor-not-allowed';

export const SlotDescriptions = ({ classSubjectId, grades, kktp = null, canEdit = false, drafts = {}, onDrafts, onReload, onToast }) => {
  const { t, lang } = useT();
  /* What this card saved since the grade read, by student id; dropped when a new read arrives. */
  const [overlay, setOverlay] = useState({});
  const [seenGrades, setSeenGrades] = useState(grades);
  if (grades !== seenGrades) {
    setSeenGrades(grades);
    setOverlay({});
  }
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null);
  /* A refusal saying this slot takes no more change: shown, and the boxes go read only. */
  const [locked, setLocked] = useState(null);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(() => Object.keys(drafts).length > 0);
  const [filter, setFilter] = useState('all');
  /* Rows typed in since the filter was picked: "Belum diisi" keeps them after a save. */
  const [typed, setTyped] = useState(() => new Set());

  if (grades === undefined) return <div className="h-40 rounded-2xl bg-slate-50 animate-pulse" aria-busy="true" aria-label={t('common.loading')} />;
  if (grades.failed) return <p className={`${card} text-sm font-semibold text-amber-700`}>{t('grading.desc.failed')}</p>;

  const rows = descriptionRows(grades, overlay);
  const finalised = Boolean(grades.finalised);
  const editing = canEdit && !locked && !finalised;
  const changed = rows.filter((row) => isChanged(row, drafts));
  const nameOf = new Map(rows.map((row) => [row.studentProfileId, row.fullName ?? t('tasm.results.unnamed')]));

  const missingCount = rows.filter((row) => (row.saved?.text ?? '').trim() === '').length;
  const shown = shownRows(rows, drafts, filter, typed);
  const pickFilter = (next) => {
    setFilter(next);
    setTyped(new Set());
  };

  const type = (studentProfileId, text) => {
    onDrafts({ ...drafts, [studentProfileId]: text });
    if (!typed.has(studentProfileId)) setTyped((now) => new Set(now).add(studentProfileId));
    if (errors[studentProfileId]) {
      setErrors((now) => {
        const next = { ...now };
        delete next[studentProfileId];
        return next;
      });
    }
  };

  const cancel = () => {
    onDrafts({});
    setErrors({});
    setMessage(null);
  };

  const save = async () => {
    const found = descriptionErrors(rows, drafts);
    setErrors(found);
    if (Object.keys(found).length) {
      setMessage(t('grading.desc.error.fix'));
      return;
    }
    const body = descriptionsBody(rows, drafts);
    if (body.length === 0) return;
    setSaving(true);
    setMessage(null);
    try {
      const answer = await gradingService.writeDescriptions(classSubjectId, body);
      setOverlay((now) => ({ ...now, ...Object.fromEntries(answer.map((row) => [row.studentProfileId, { text: row.text, updatedAt: row.updatedAt }])) }));
      onDrafts(draftsAfterSave(drafts, body));
      onToast?.(t('grading.desc.saved', { n: body.length }), 'success');
    } catch (err) {
      const ids = Array.isArray(err?.details?.studentProfileIds) ? err.details.studentProfileIds : [];
      const names = ids.map((id) => nameOf.get(id) ?? t('tasm.results.unnamed')).join(', ');
      setMessage(descriptionsErrorMessage(err, t, names));
      if (isDescriptionsLocked(err)) setLocked(true);
      if (isStaleDescriptions(err) || /does not describe/.test(String(err?.message ?? ''))) onReload?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`${card} space-y-4`} aria-labelledby="slot-descriptions-title">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="space-y-0.5 min-w-0">
          <h2 id="slot-descriptions-title" className="text-base font-extrabold text-slate-900">
            {t('grading.desc.title')}
          </h2>
          {rows.length > 0 && (
            <p className="flex flex-wrap gap-x-4 text-xs font-semibold text-slate-500">
              <span>{t('grading.desc.count', { n: savedCount(rows), total: rows.length })}</span>
              {editing && changed.length > 0 && <span className="text-amber-700">{t('grading.desc.unsaved', { n: changed.length })}</span>}
            </p>
          )}
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((now) => !now)}
            aria-expanded={open}
            aria-controls="slot-descriptions-body"
            className={`${button} ${open ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            {open ? t('common.close') : t(editing ? 'grading.desc.open' : 'grading.desc.view')}
          </button>
        )}
      </div>

      {open && (
        <p className="text-xs font-medium text-slate-500 leading-relaxed">
          {t(canEdit && finalised ? 'grading.finalised.locked' : canEdit ? 'grading.desc.intro' : 'grading.desc.readIntro')}
        </p>
      )}

      {open && rows.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('grading.desc.filter.label')}>
          {[
            ['all', t('grading.desc.filter.all', { n: rows.length })],
            ['missing', t('grading.desc.filter.missing', { n: missingCount })],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => pickFilter(key)}
              aria-pressed={filter === key}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                filter === key ? 'bg-brand-tint text-brand' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm font-semibold text-slate-600">{t('grading.desc.none')}</p>
      ) : !open ? null : shown.length === 0 ? (
        <p className="text-sm font-semibold text-slate-600">{t('grading.desc.allWritten')}</p>
      ) : (
        <ul id="slot-descriptions-body" className="divide-y divide-slate-100">
          {shown.map((row) => {
            const id = row.studentProfileId;
            const text = textOf(row, drafts);
            const length = text.trim().length;
            const error = errors[id];
            const red = belowKktp({ score: row.finalValue }, kktp);
            return (
              <li key={id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <label htmlFor={`desc-${id}`} className="text-sm font-bold text-slate-900 break-words">
                    {nameOf.get(id)}
                  </label>
                  <span className={`text-xs font-semibold tabular-nums ${red ? 'text-rose-700' : 'text-slate-500'}`}>
                    {t('grading.desc.final', { value: formatNumber(row.finalValue, lang) })}
                    {red && <span className="sr-only"> ({t('gradebook.kktp.below')})</span>}
                  </span>
                </div>
                {editing ? (
                  <>
                    <textarea
                      id={`desc-${id}`}
                      rows={3}
                      value={text}
                      onChange={(event) => type(id, event.target.value)}
                      placeholder={t('grading.desc.placeholder')}
                      aria-invalid={Boolean(error)}
                      aria-describedby={`desc-${id}-note`}
                      className={`block w-full field-sizing-content min-h-[4.5rem] px-3 py-2 rounded-xl border bg-white text-sm text-slate-800 leading-relaxed resize-y placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${error ? 'border-rose-300' : 'border-slate-200'}`}
                    />
                    <div id={`desc-${id}-note`} className="flex flex-wrap justify-between gap-x-4 text-[11px] font-semibold">
                      <span className={error ? 'text-rose-700' : 'text-amber-700'}>
                        {error ? t(`grading.desc.error.${error}`) : willClear(row, drafts) ? t('grading.desc.willClear') : ''}
                      </span>
                      <span className={`tabular-nums ${length > DESCRIPTION_MAX ? 'text-rose-700' : 'text-slate-500'}`}>
                        {t('grading.desc.counter', { n: length, max: DESCRIPTION_MAX })}
                      </span>
                    </div>
                  </>
                ) : row.saved?.text ? (
                  <p id={`desc-${id}`} className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                    {row.saved.text}
                  </p>
                ) : (
                  <p id={`desc-${id}`} className="text-xs font-semibold text-slate-500">
                    {t('grading.desc.noDescription')}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {message && (
        <p className="text-xs font-semibold text-rose-700 leading-relaxed" role="alert">
          {message}
        </p>
      )}

      {open && editing && rows.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={cancel} disabled={saving || changed.length === 0} className={`${button} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={save} disabled={saving || changed.length === 0} className={`${button} bg-brand text-white hover:bg-brand-deep`}>
            {t('grading.desc.save')}
          </button>
        </div>
      )}
    </section>
  );
};

export default SlotDescriptions;
