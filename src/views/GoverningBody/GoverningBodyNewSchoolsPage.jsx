import React, { useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Plus } from 'lucide-react';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { LocationFields, TimeZoneField } from '../../components/SchoolPlaceFields';
import { useAuth } from '../../context/AuthContext';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage, bodySchoolsErrorMessage } from '../../i18n/apiError';
import { governingBodyService } from '../../services/governingBodyService';
import { GOVERNING_BODY_SCHOOLS } from '../../constants/roles';
import { SCHOOL_TYPE_NAMES, SCHOOL_TYPES, choosesDuration } from '../../constants/schoolTypes';
import { ADMIN_CARD, CARD_TITLE, SlashFacts } from '../Admin/adminParts';
import { MAX_SCHOOLS_AT_ONCE, createBodyOf, emptyRow, rowTouched, rowsErrorsOf, serverRowErrorsOf } from './bodySchools';

/*
  /governing-body/schools/new: a Governing Body's admin creates up to ten Schools in
  one submission (backend ed0d304, `POST /governing-body/schools`; owner 2026-10-25:
  a page of its own, a card per School, "Tambah sekolah lain" up to ten). All are
  created or none: a refusal marks the cards it names and creates nothing.

  Each card is a School Registration's fields without the phone and the KTP - NPSN,
  name, type (an SMK's duration), city, the point and the zone. "Use my current
  location" is not offered (owner): the admin fills this from an office, not from
  each school; a pair pasted from Google Maps still fills both boxes.

  Leaving with anything typed asks first (`useUnsavedGuard`). Done, the list opens
  with a toast; each School is live at once, with its code, waiting for a Principal.

  Since 2026-10-29 (owner, mockup yayasan-sekolah-admin.html): a slash line under the
  title, a shorter lead, the cards in the dashboards' frame, a rose refusal box, and
  "Hapus sekolah N" in rose without an underline.
*/

const say = (t, fail) => (!fail ? undefined : fail.key ? t(fail.key, fail.vars) : fail.text);

export const GoverningBodyNewSchoolsPage = () => {
  const { governingBody: cached } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const { showToast } = useOutletContext() ?? {};

  const nextKey = useRef(1);
  const [rows, setRows] = useState(() => [emptyRow('row-0')]);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [global, setGlobal] = useState(null);
  const [sending, setSending] = useState(false);

  const guard = useUnsavedGuard(rows.some(rowTouched));
  const clientErrors = submitted ? rowsErrorsOf(rows) : {};
  const errorOf = (index, field) => say(t, clientErrors[index]?.[field] ?? serverErrors[index]?.[field]);

  const change = (index, field, value) => {
    setRows((prev) => prev.map((row, at) => (at === index ? { ...row, [field]: value } : row)));
    setServerErrors((prev) => (prev[index]?.[field] ? { ...prev, [index]: { ...prev[index], [field]: undefined } } : prev));
  };

  const addRow = () => {
    if (rows.length >= MAX_SCHOOLS_AT_ONCE) return;
    /* Outside the updater, which StrictMode runs twice. */
    const key = `row-${nextKey.current++}`;
    setRows((prev) => [...prev, emptyRow(key)]);
  };

  /* Removing a card renumbers the rest, so what the server said about them goes. */
  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, at) => at !== index));
    setServerErrors({});
  };

  const leave = () => navigate(GOVERNING_BODY_SCHOOLS);

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSubmitted(true);
    setGlobal(null);

    const errors = rowsErrorsOf(rows);
    const wrong = Object.keys(errors).map((index) => Number(index) + 1);
    if (wrong.length) {
      setGlobal(t('gbs.new.error.check', { rows: wrong.join(', ') }));
      return;
    }

    setSending(true);
    try {
      const created = await governingBodyService.createSchools(createBodyOf(rows).schools);
      guard.release();
      showToast?.(t('gbs.new.done', { n: created.length || rows.length }), 'success');
      navigate(GOVERNING_BODY_SCHOOLS);
    } catch (err) {
      if (err?.status === 403) {
        setGlobal(t('gb.gone.body'));
        return;
      }
      const { rows: marked, rowNumbers } = serverRowErrorsOf(err);
      setServerErrors(marked);
      if (err?.code === 'BAD_REQUEST' && rowNumbers.length) setGlobal(t('gbs.new.error.check', { rows: rowNumbers.join(', ') }));
      else if (err?.code === 'CONFLICT') setGlobal(bodySchoolsErrorMessage(err, t));
      else setGlobal(apiErrorMessage(err, t));
    } finally {
      setSending(false);
    }
  };

  const name = cached?.name ?? '';

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('gbs.new.title')}</h1>
        <SlashFacts className="block mt-2 text-sm font-medium text-slate-500" parts={[name, t('gbs.title')]} />
        <p className="text-[13px] text-slate-500 leading-relaxed mt-3">{t('gbs.new.lead')}</p>
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        {rows.map((row, index) => {
          const id = (field) => `${row.key}-${field}`;
          const field = (key, labelKey, extra = {}) => (
            <Input
              id={id(key)}
              name={key}
              label={t(labelKey)}
              autoComplete="off"
              spellCheck={false}
              value={row[key]}
              error={errorOf(index, key)}
              onChange={(e) => change(index, key, e.target.value)}
              {...extra}
            />
          );
          return (
            <section key={row.key} className={`${ADMIN_CARD} space-y-4`} aria-labelledby={id('title')}>
              <div className="flex items-center justify-between gap-3">
                <h2 id={id('title')} className={CARD_TITLE}>
                  {t('gbs.new.card', { n: index + 1 })}
                </h2>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="text-[13px] font-bold text-rose-700 hover:text-rose-800 cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                  >
                    {t('gbs.new.remove', { n: index + 1 })}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  {field('npsn', 'reg.field.npsn', { inputMode: 'numeric' })}
                  {!errorOf(index, 'npsn') && <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('reg.field.npsn.hint')}</p>}
                </div>
                {field('schoolName', 'reg.field.schoolName')}
                <div className="space-y-1.5">
                  <label htmlFor={id('schoolType')} className="text-sm font-semibold text-slate-700 block">
                    {t('reg.field.schoolType')}
                  </label>
                  <Select
                    id={id('schoolType')}
                    name="schoolType"
                    value={row.schoolType}
                    onChange={(e) => {
                      change(index, 'schoolType', e.target.value);
                      change(index, 'durationYears', '');
                    }}
                  >
                    {SCHOOL_TYPE_NAMES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </div>
                {field('city', 'reg.field.city')}
                {choosesDuration(row.schoolType) && (
                  <div className="space-y-1.5">
                    <label htmlFor={id('durationYears')} className="text-sm font-semibold text-slate-700 block">
                      {t('reg.field.duration')}
                    </label>
                    <Select
                      id={id('durationYears')}
                      name="durationYears"
                      value={row.durationYears}
                      invalid={!!errorOf(index, 'durationYears')}
                      onChange={(e) => change(index, 'durationYears', e.target.value)}
                    >
                      <option value="">{t('reg.field.duration.placeholder')}</option>
                      {SCHOOL_TYPES[row.schoolType].allowedDurationYears.map((years) => (
                        <option key={years} value={years}>
                          {t('reg.field.duration.years', { n: years })}
                        </option>
                      ))}
                    </Select>
                    {errorOf(index, 'durationYears') && (
                      <span className="text-xs text-red-600 font-medium" role="alert">
                        {errorOf(index, 'durationYears')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <fieldset className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-700">{t('place.legend')}</legend>
                <LocationFields
                  idPrefix={row.key}
                  locate={false}
                  values={row}
                  errors={{ latitude: errorOf(index, 'latitude'), longitude: errorOf(index, 'longitude') }}
                  onChange={(key, value) => change(index, key, value)}
                />
                <TimeZoneField id={id('timeZone')} value={row.timeZone} error={errorOf(index, 'timeZone')} onChange={(value) => change(index, 'timeZone', value)} />
              </fieldset>
            </section>
          );
        })}

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={addRow} isDisabled={rows.length >= MAX_SCHOOLS_AT_ONCE}>
            <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />
            {t('gbs.new.add')}
          </Button>
          <span className="text-xs font-semibold text-slate-500" aria-live="polite">
            {rows.length >= MAX_SCHOOLS_AT_ONCE ? t('gbs.new.full', { max: MAX_SCHOOLS_AT_ONCE }) : t('gbs.new.count', { n: rows.length, max: MAX_SCHOOLS_AT_ONCE })}
          </span>
        </div>

        {global && (
          <div className="p-3.5 rounded-xl bg-rose-50 text-[13px] font-semibold text-rose-700" role="alert">
            {global}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" onClick={leave} isDisabled={sending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={sending}>
            {sending ? t('gbs.new.sending') : t('gbs.new.submit', { n: rows.length })}
          </Button>
        </div>
      </form>

      {guard.dialog}
    </div>
  );
};

export default GoverningBodyNewSchoolsPage;
