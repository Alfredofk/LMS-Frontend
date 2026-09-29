import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarOff, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { DateChip, Legend, SummaryCards, ViewToggle, YearCalendar } from '../../components/holidays/HolidayParts';
import { KIND_STYLE } from '../../components/holidays/kindStyle';
import { holidaysService } from '../../services/holidaysService';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { calendarItems, daysBetween, daysIndex, nextHoliday, offDaysOf, todayIso } from '../../utils/holidays';
import { validateHolidayName, validateHolidayRange } from '../../utils/validation';

/*
  The school's holiday calendar — backend 9dee2e2, on /schedule, above the
  lesson timetable that is still "not available yet".

  Laid out as the national page is (components/holidays/HolidayParts.jsx; owner,
  2026-09-28): counts and the next day off, twelve months with each holiday a
  coloured day, and the same holidays as a list by month where everything is
  done. On a phone the calendar and the list take turns (ViewToggle).

  What a day is comes from the server alone: `observed` for a national or
  joint-leave day (a joint-leave day this school stays open on is painted
  IN_SCHOOL, not as a holiday), and the school's own standing holidays. Only
  days the school is actually off count towards "next".

  **The Principal keeps it** (`canManage`): the default for joint leave, a
  choice per joint-leave day, and the school's own holidays — a day or a run of
  fewer than 90 (`validateHolidayRange`), withdrawn when made by mistake. The
  server re-reads PRINCIPAL; this only decides what to offer.
*/

const JOINT_CHOICES = [
  { value: 'default', choice: null, key: 'holiday.joint.choice.default' },
  { value: 'off', choice: true, key: 'holiday.joint.choice.off' },
  { value: 'in', choice: false, key: 'holiday.joint.choice.in' },
];

const EMPTY_FORM = { name: '', startDate: '', endDate: '' };

const HolidayCalendar = ({ canManage = false, showToast }) => {
  const { t, lang } = useT();
  const today = todayIso();

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [view, setView] = useState('calendar');
  const [selected, setSelected] = useState(null);
  const listRef = useRef(null);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await holidaysService.calendar(year));
    } catch (err) {
      setData(null);
      setError(apiErrorMessage(err, t));
    }
  }, [year, t]);

  useEffect(() => {
    load();
    setSelected(null);
  }, [load]);

  /* One shape for all three sources: { id, kind, name, start, end, … }. */
  const items = useMemo(() => calendarItems(data), [data]);

  const index = useMemo(() => daysIndex(items), [items]);
  const offDays = offDaysOf(items);
  const next = year === Number(today.slice(0, 4)) ? nextHoliday(offDays, today) : null;
  /* Two counts beside the next day off — the summary row holds four columns. */
  const stats = [
    { key: 'holiday.kind.NATIONAL', kind: 'NATIONAL', value: items.filter((item) => item.kind === 'NATIONAL').length },
    { key: 'holiday.stat.jointOff', kind: 'JOINT_LEAVE', value: items.filter((item) => item.kind === 'JOINT_LEAVE').length },
  ];

  const months = useMemo(() => {
    const byMonth = new Map();
    for (const item of items) {
      const month = item.start.slice(0, 7);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month).push(item);
    }
    return [...byMonth.entries()];
  }, [items]);

  const pick = (day) => {
    setSelected((prev) => (prev === day ? null : day));
    setView('list');
    requestAnimationFrame(() => {
      listRef.current?.querySelector(`[data-days~="${day}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const monthName = (yyyymm) =>
    new Date(`${yyyymm}-01T00:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', { month: 'long', timeZone: 'UTC' });

  const setDefault = async () => {
    setBusyId('default');
    try {
      await holidaysService.setJointLeave(!data.observesJointLeave);
      await load();
      showToast?.(t(!data.observesJointLeave ? 'holiday.joint.default.on' : 'holiday.joint.default.off'), 'success');
    } catch (err) {
      showToast?.(apiErrorMessage(err, t), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const setDay = async (entry, value) => {
    const picked = JOINT_CHOICES.find((option) => option.value === value);
    setBusyId(entry.id);
    try {
      await holidaysService.setJointLeaveDay(entry.id, picked.choice);
      await load();
    } catch (err) {
      showToast?.(apiErrorMessage(err, t), 'error');
    } finally {
      setBusyId(null);
    }
  };

  const change = (name) => (e) => {
    const { value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: null, global: null }));
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const fails = {};
    const nameFail = validateHolidayName(form.name);
    if (nameFail) fails.name = t(nameFail.key, nameFail.vars);
    const range = validateHolidayRange(form.startDate, form.endDate);
    if (range.start) fails.startDate = t(range.start.key, range.start.vars);
    if (range.end) fails.endDate = t(range.end.key, range.end.vars);
    setFormErrors(fails);
    if (Object.keys(fails).length) return;

    setIsSaving(true);
    try {
      const holiday = await holidaysService.addSchoolHoliday({
        name: form.name.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
      });
      setAdding(false);
      setForm(EMPTY_FORM);
      const landed = Number(String(holiday?.startDate ?? form.startDate).slice(0, 4));
      if (landed && landed !== year) setYear(landed);
      else await load();
      showToast?.(t('holiday.school.added', { name: holiday?.name ?? form.name.trim() }), 'success');
    } catch (err) {
      setFormErrors({ global: apiErrorMessage(err, t) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawing) return;
    setIsWithdrawing(true);
    try {
      await holidaysService.withdrawSchoolHoliday(withdrawing.id);
      showToast?.(t('holiday.school.withdrawn', { name: withdrawing.name }), 'success');
    } catch (err) {
      showToast?.(apiErrorMessage(err, t), 'error');
    } finally {
      await load();
      setIsWithdrawing(false);
      setWithdrawing(null);
    }
  };

  const when = (item) => {
    if (item.end < today) return t('holiday.when.past');
    if (item.start <= today) return t('holiday.next.today');
    return t('holiday.next.in', { n: daysBetween(today, item.start) });
  };

  return (
    <section className="space-y-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-slate-500">
          <CalendarOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          <h2 className="text-[11px] font-bold uppercase tracking-wider">{t('holiday.title')}</h2>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-0.5" role="group" aria-label={t('holiday.year')}>
          <button
            type="button"
            onClick={() => setYear((y) => y - 1)}
            disabled={year <= 2020}
            aria-label={t('holiday.year.prev')}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-brand disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </button>
          <span className="min-w-14 text-center text-sm font-extrabold text-slate-800 tabular-nums" aria-live="polite">
            {year}
          </span>
          <button
            type="button"
            onClick={() => setYear((y) => y + 1)}
            disabled={year >= 2100}
            aria-label={t('holiday.year.next')}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-brand disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
          {error}
        </div>
      ) : data === null ? (
        <div className="space-y-3" aria-label={t('common.loading')}>
          <div className="h-24 bg-white border border-slate-100 rounded-2xl animate-pulse" />
          <div className="h-64 bg-white border border-slate-100 rounded-2xl animate-pulse" />
        </div>
      ) : (
        <>
          <SummaryCards stats={stats} next={next} lang={lang} />

          {canManage && (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p id="joint-default-label" className="text-sm font-semibold text-slate-800">
                    {t('holiday.joint.default')}
                  </p>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5">{t('holiday.joint.default.hint')}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(data.observesJointLeave)}
                  aria-labelledby="joint-default-label"
                  disabled={busyId === 'default'}
                  onClick={setDefault}
                  className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                    data.observesJointLeave ? 'bg-brand' : 'bg-slate-300'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      data.observesJointLeave ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {!adding ? (
                <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                  <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                  {t('holiday.school.add')}
                </Button>
              ) : (
                <form onSubmit={handleAdd} noValidate className="space-y-3 pt-1">
                  <Input
                    id="holidayName"
                    name="name"
                    label={t('holiday.school.name')}
                    placeholder={t('holiday.school.namePlaceholder')}
                    type="text"
                    autoComplete="off"
                    value={form.name}
                    error={formErrors.name || undefined}
                    onChange={change('name')}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      id="holidayStart"
                      name="startDate"
                      label={t('classes.field.startDate')}
                      type="date"
                      value={form.startDate}
                      error={formErrors.startDate || undefined}
                      onChange={change('startDate')}
                    />
                    <Input
                      id="holidayEnd"
                      name="endDate"
                      label={t('classes.field.endDate')}
                      type="date"
                      value={form.endDate}
                      error={formErrors.endDate || undefined}
                      onChange={change('endDate')}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('holiday.school.hint')}</p>
                  {formErrors.global && (
                    <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
                      {formErrors.global}
                    </div>
                  )}
                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdding(false);
                        setForm(EMPTY_FORM);
                        setFormErrors({});
                      }}
                      isDisabled={isSaving}
                    >
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit" size="sm" isLoading={isSaving}>
                      {t('holiday.school.save')}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {items.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-slate-200 rounded-2xl bg-white select-none">
              <CalendarOff className="w-7 h-7 text-slate-300 mx-auto" aria-hidden="true" />
              <p className="mt-2 text-xs font-extrabold text-slate-500">{t('holiday.empty', { year })}</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500 max-w-sm mx-auto leading-relaxed">{t('holiday.empty.hint')}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Legend kinds={['NATIONAL', 'JOINT_LEAVE', 'IN_SCHOOL', 'SCHOOL']} />
                <ViewToggle view={view} onChange={setView} />
              </div>

              <div className={view === 'calendar' ? '' : 'hidden sm:block'}>
                <YearCalendar year={year} index={index} today={today} selected={selected} onPick={pick} lang={lang} />
              </div>

              <div ref={listRef} className={`space-y-4 ${view === 'list' ? '' : 'hidden sm:block'}`}>
                {months.map(([month, entries]) => (
                  <div key={month} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 capitalize">{monthName(month)}</h3>
                      <span className="h-px flex-1 bg-slate-100" aria-hidden="true" />
                    </div>
                    <ul className="space-y-2">
                      {entries.map((entry) => {
                        const past = entry.end < today;
                        const days = entry.start === entry.end ? entry.start : `${entry.start} ${entry.end}`;
                        const isHit = selected && selected >= entry.start && selected <= entry.end;
                        return (
                          <li
                            key={`${entry.source}-${entry.id}`}
                            data-days={days}
                            className={`rounded-2xl border bg-white p-3 flex flex-col sm:flex-row sm:items-center gap-3 transition-shadow ${
                              isHit ? 'border-brand ring-2 ring-brand/20 shadow-md' : 'border-slate-100 shadow-sm'
                            } ${past ? 'opacity-70' : ''}`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <DateChip start={entry.start} end={entry.end} lang={lang} past={past} />
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-800 break-words">{entry.name}</p>
                                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-slate-500">
                                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${KIND_STYLE[entry.kind].soft}`}>
                                    {t(`holiday.kind.${entry.kind}`)}
                                  </span>
                                  <span>{when(entry)}</span>
                                  {entry.source === 'JOINT_LEAVE' && entry.choice !== null && entry.choice !== undefined && (
                                    <span className="text-[10px] font-bold text-slate-500">· {t('holiday.joint.chosen')}</span>
                                  )}
                                </p>
                              </div>
                            </div>

                            {canManage && entry.source === 'JOINT_LEAVE' && (
                              <select
                                aria-label={t('holiday.joint.choice.label', { name: entry.name })}
                                value={entry.choice === true ? 'off' : entry.choice === false ? 'in' : 'default'}
                                disabled={busyId === entry.id}
                                onChange={(e) => setDay(entry, e.target.value)}
                                className="self-start sm:self-auto shrink-0 rounded-lg border border-slate-200 bg-white py-1.5 pl-2 pr-7 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand cursor-pointer disabled:cursor-wait"
                              >
                                {JOINT_CHOICES.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {t(option.key)}
                                  </option>
                                ))}
                              </select>
                            )}

                            {canManage && entry.source === 'SCHOOL' && (
                              <button
                                type="button"
                                onClick={() => setWithdrawing(entry)}
                                className="self-start sm:self-auto shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                              >
                                {t('holiday.school.withdraw')}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(withdrawing)}
        tone="danger"
        title={t('holiday.school.withdraw.title', { name: withdrawing?.name ?? '' })}
        body={t('holiday.school.withdraw.body')}
        confirmLabel={t('holiday.school.withdraw')}
        cancelLabel={t('common.cancel')}
        busy={isWithdrawing}
        busyLabel={t('common.loading')}
        onConfirm={handleWithdraw}
        onCancel={() => setWithdrawing(null)}
      />
    </section>
  );
};

export default HolidayCalendar;
