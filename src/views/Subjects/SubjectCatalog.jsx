import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Plus } from 'lucide-react';

import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { academicsService } from '../../services/academicsService';
import { useT } from '../../i18n/LanguageContext';
import { subjectsErrorMessage } from '../../i18n/apiError';
import { normaliseSubjectCode, validateSubjectCode, validateSubjectName } from '../../utils/validation';
import { selectionChanges } from './subjects';

/*
  The subjects a school can teach — `GET /academics/subjects`: the national
  catalog every school shares (seeded by a migration, read-only) and this
  school's local subjects (muatan lokal), which the Principal adds here.

  A local code may repeat a national one (partial-indexes.sql) but not another
  local one; the code is folded to upper case, as the server does, so what is
  typed is what gets stored. There is no route to rename or delete a subject,
  so the form says so before the press.

  Which national subjects the school uses (backend a852609, owner 2026-10-04): a
  box per subject, ticked when in use, saved at once as the whole list
  (`selectionChanges`). One still taught or asked for is warned about before it is
  unticked: what runs carries on, nothing new starts on it. A local subject is the
  school's own and always in use, so it has no box. The Principal and Vice
  Principals both reach this page, and both may choose.
*/
export const SubjectCatalog = ({ subjects, onCreated, onSaved, showToast }) => {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const national = subjects.filter((subject) => subject.national);
  const local = subjects.filter((subject) => !subject.national);

  /* The ticks on screen, reset whenever the server's list changes. */
  const serverTicks = useMemo(
    () => new Set(national.filter((subject) => subject.selected !== false).map((subject) => subject.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `national` is derived from `subjects` each render
    [subjects]
  );
  const [ticked, setTicked] = useState(serverTicks);
  useEffect(() => setTicked(serverTicks), [serverTicks]);
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState(false);
  const [selectionError, setSelectionError] = useState(null);
  const changes = selectionChanges(subjects, ticked);

  const toggle = (id) => {
    setSelectionError(null);
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setWarning(false);
    setSaving(true);
    setSelectionError(null);
    try {
      const fresh = await academicsService.selectSubjects(changes.selectedIds);
      showToast(t('subjects.selection.saved'), 'success');
      onSaved(fresh);
    } catch (err) {
      setSelectionError(subjectsErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };
  const askToSave = () => (changes.stillRunning.length > 0 ? setWarning(true) : save());

  const runningLine = (subject) =>
    [
      subject.activeClassSubjects > 0 && t('subjects.selection.running', { n: subject.activeClassSubjects }),
      subject.pendingRequests > 0 && t('subjects.selection.waiting', { n: subject.pendingRequests }),
    ]
      .filter(Boolean)
      .join(', ');

  const reset = () => {
    setIsOpen(false);
    setCode('');
    setName('');
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const next = {};
    const codeFail = validateSubjectCode(code);
    const nameFail = validateSubjectName(name);
    if (codeFail) next.code = t(codeFail.key);
    if (nameFail) next.name = t(nameFail.key);
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const created = await academicsService.createSubject({ code: normaliseSubjectCode(code), name: name.trim() });
      showToast(t('subjects.catalog.created', { code: created?.code ?? '', name: created?.name ?? '' }), 'success');
      reset();
      onCreated(created);
    } catch (err) {
      const message = subjectsErrorMessage(err, t);
      setErrors(String(err?.message ?? '').includes('subject with that code') ? { code: message } : { global: message });
    } finally {
      setBusy(false);
    }
  };

  const list = (heading, rows, empty) => (
    <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3">
      <h2 className="text-base font-extrabold text-slate-900">
        {heading} ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="text-xs font-semibold text-slate-500">{empty}</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y divide-slate-100 sm:divide-y-0">
          {rows.map((subject) => (
            <li key={subject.id} className="py-2 flex items-baseline gap-2 min-w-0">
              <span className="w-14 shrink-0 text-[11px] font-extrabold tabular-nums text-slate-500">{subject.code}</span>
              <span className="text-sm font-semibold text-slate-800 break-words">{subject.name}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="space-y-4">
      {list(t('subjects.kind.local'), local, t('subjects.catalog.noLocal'))}

      {isOpen ? (
        <form onSubmit={handleSubmit} noValidate className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-extrabold text-slate-900">{t('subjects.catalog.add')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              id="subject-code"
              name="code"
              label={t('subjects.catalog.code')}
              value={code}
              placeholder="MULOK1"
              maxLength={10}
              autoCapitalize="characters"
              error={errors.code || undefined}
              disabled={busy}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                if (errors.code || errors.global) setErrors((prev) => ({ ...prev, code: null, global: null }));
              }}
            />
            <div className="sm:col-span-2">
              <Input
                id="subject-name"
                name="name"
                label={t('subjects.catalog.name')}
                value={name}
                placeholder={t('subjects.catalog.namePlaceholder')}
                maxLength={100}
                error={errors.name || undefined}
                disabled={busy}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name || errors.global) setErrors((prev) => ({ ...prev, name: null, global: null }));
                }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('subjects.catalog.permanent')}</p>
          {errors.global && (
            <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
              {errors.global}
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <Button type="button" variant="outline" size="sm" onClick={reset} isDisabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" size="sm" isLoading={busy}>
              {t('subjects.catalog.save')}
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          {t('subjects.catalog.add')}
        </Button>
      )}

      <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-3" aria-labelledby="national-subjects">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id="national-subjects" className="text-base font-extrabold text-slate-900">
              {t('subjects.kind.national')} ({t('subjects.selection.count', { n: ticked.size, total: national.length })})
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500 leading-relaxed">{t('subjects.selection.hint')}</p>
          </div>
          {national.length > 0 && ticked.size < national.length && (
            <button
              type="button"
              onClick={() => setTicked(new Set(national.map((subject) => subject.id)))}
              disabled={saving}
              className="shrink-0 text-xs font-extrabold text-brand hover:underline cursor-pointer disabled:opacity-60"
            >
              {t('subjects.selection.all')}
            </button>
          )}
        </div>

        {national.length === 0 ? (
          <p className="text-xs font-semibold text-slate-500">{t('subjects.catalog.noNational')}</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {national.map((subject) => {
              const on = ticked.has(subject.id);
              const running = runningLine(subject);
              return (
                <li key={subject.id}>
                  <label
                    className={`flex items-start gap-3 rounded-xl px-2 py-2 -mx-2 cursor-pointer hover:bg-slate-50 ${saving ? 'pointer-events-none' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={on}
                      onChange={() => toggle(subject.id)}
                      disabled={saving}
                    />
                    <span
                      className={`mt-0.5 w-5 h-5 shrink-0 rounded-md border-2 flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-brand ${
                        on ? 'bg-brand border-brand text-white' : 'bg-white border-slate-300 text-transparent'
                      }`}
                      aria-hidden="true"
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="w-12 shrink-0 text-[11px] font-extrabold tabular-nums text-slate-500">{subject.code}</span>
                        <span className={`text-sm font-semibold break-words ${on ? 'text-slate-800' : 'text-slate-500 line-through'}`}>
                          {subject.name}
                        </span>
                      </span>
                      {running && <span className="block pl-14 text-[11px] font-semibold text-slate-500">{running}</span>}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        {selectionError && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
            {selectionError}
          </div>
        )}

        {changes.dirty && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-600" role="status">
              {t('subjects.selection.pending', { n: changes.selecting.length + changes.deselecting.length })}
            </p>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setTicked(serverTicks)} isDisabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button type="button" size="sm" onClick={askToSave} isLoading={saving}>
                {t('subjects.selection.save')}
              </Button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={warning}
        tone="danger"
        icon={AlertTriangle}
        title={t('subjects.selection.warnTitle', { n: changes.stillRunning.length })}
        body={t('subjects.selection.warnBody', {
          list: changes.stillRunning.map((subject) => `${subject.name} (${runningLine(subject)})`).join('; '),
        })}
        confirmLabel={t('subjects.selection.warnConfirm')}
        cancelLabel={t('common.cancel')}
        busy={saving}
        onConfirm={save}
        onCancel={() => setWarning(false)}
      />
    </div>
  );
};

export default SubjectCatalog;
