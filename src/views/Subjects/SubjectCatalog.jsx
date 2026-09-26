import React, { useState } from 'react';
import { Plus } from 'lucide-react';

import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { academicsService } from '../../services/academicsService';
import { useT } from '../../i18n/LanguageContext';
import { subjectsErrorMessage } from '../../i18n/apiError';
import { normaliseSubjectCode, validateSubjectCode, validateSubjectName } from '../../utils/validation';

/*
  The subjects a school can teach — `GET /academics/subjects`: the national
  catalog every school shares (seeded by a migration, read-only) and this
  school's local subjects (muatan lokal), which the Principal adds here.

  A local code may repeat a national one (partial-indexes.sql) but not another
  local one; the code is folded to upper case, as the server does, so what is
  typed is what gets stored. There is no route to rename or delete a subject,
  so the form says so before the press.
*/
export const SubjectCatalog = ({ subjects, onCreated, showToast }) => {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const national = subjects.filter((subject) => subject.national);
  const local = subjects.filter((subject) => !subject.national);

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
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
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

      {list(t('subjects.kind.national'), national, t('subjects.catalog.noNational'))}
    </div>
  );
};

export default SubjectCatalog;
