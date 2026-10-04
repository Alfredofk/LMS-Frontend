import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ChevronLeft, ChevronRight, DownloadCloud, Pencil, Plus } from 'lucide-react';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SelectField from '../../components/ui/SelectField';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { holidaysService } from '../../services/holidaysService';
import { useT } from '../../i18n/LanguageContext';
import { apiErrorMessage } from '../../i18n/apiError';
import { DateChip, Legend, SummaryCards, ViewToggle, YearCalendar } from '../../components/holidays/HolidayParts';
import { KIND_STYLE } from '../../components/holidays/kindStyle';
import { validateHolidayName } from '../../utils/validation';
import { daysBetween, daysIndex, nextHoliday, todayIso } from '../../utils/holidays';

/*
  The national holiday calendar — the Platform Admin's, backend 9dee2e2
  (teaching-and-learning ticket 08). Only CONFIRMED days reach any school.

  **There is no official source.** The SKB 3 Menteri is a document, not an API,
  so "Fetch drafts" asks an unofficial community one and everything it gives is
  a DRAFT to be checked against the SKB before confirming. The backend says so in
  its own answer, and so does this page. Fetching twice changes nothing already
  there.

  - Drafts are corrected here (date, name, kind) and confirmed, one or many.
  - A confirmed day cannot be corrected — it may already have kept lessons from
    being generated — so it is withdrawn and added again by hand.
  - Added by hand is CONFIRMED at once: the admin is the one checking.

  Laid out as the school calendar is (components/holidays/HolidayParts.jsx;
  owner, 2026-09-28): the confirmed counts and the next holiday, twelve months
  with drafts painted washed out behind a dashed border, and the list by status
  underneath, where everything is done. Picking a day in the calendar opens the
  tab that holds it and scrolls to its row.
*/

const STATUSES = ['DRAFT', 'CONFIRMED', 'WITHDRAWN'];
const KINDS = ['NATIONAL', 'JOINT_LEAVE'];

const EMPTY = { date: '', name: '', kind: 'NATIONAL' };

export const AdminHolidaysPage = () => {
  const { showToast } = useOutletContext();
  const { t, lang } = useT();

  const [year, setYear] = useState(() => new Date().getFullYear());
  const [holidays, setHolidays] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('DRAFT');
  const [ticked, setTicked] = useState(() => new Set());
  const [busy, setBusy] = useState(null); // 'fetch' | 'confirm' | 'add' | id

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formErrors, setFormErrors] = useState({});
  const [editing, setEditing] = useState(null); // { id, date, name, kind }
  const [editErrors, setEditErrors] = useState({});
  const [withdrawing, setWithdrawing] = useState(null);
  const [view, setView] = useState('calendar');
  const [selected, setSelected] = useState(null);
  const listRef = useRef(null);
  const today = todayIso();

  const load = useCallback(async () => {
    setError(null);
    try {
      setHolidays(await holidaysService.listNational(year));
    } catch (err) {
      setHolidays(null);
      setError(apiErrorMessage(err, t));
    }
  }, [year, t]);

  useEffect(() => {
    load();
    setTicked(new Set());
  }, [load]);

  const byStatus = useMemo(() => {
    const out = Object.fromEntries(STATUSES.map((status) => [status, []]));
    for (const entry of holidays ?? []) (out[entry.status] ?? out.DRAFT).push(entry);
    return out;
  }, [holidays]);
  const shown = byStatus[tab] ?? [];

  /* The calendar paints what is still in play: drafts and confirmed days. */
  const painted = useMemo(
    () =>
      [...byStatus.CONFIRMED, ...byStatus.DRAFT]
        .map((entry) => ({ ...entry, start: entry.date, end: entry.date, draft: entry.status === 'DRAFT' }))
        .sort((a, b) => a.start.localeCompare(b.start)),
    [byStatus]
  );
  const index = useMemo(() => daysIndex(painted), [painted]);
  const confirmed = painted.filter((entry) => !entry.draft);
  const next = year === Number(today.slice(0, 4)) ? nextHoliday(confirmed, today) : null;
  const stats = [
    { key: 'holiday.kind.NATIONAL', kind: 'NATIONAL', value: confirmed.filter((entry) => entry.kind === 'NATIONAL').length },
    { key: 'holiday.kind.JOINT_LEAVE', kind: 'JOINT_LEAVE', value: confirmed.filter((entry) => entry.kind === 'JOINT_LEAVE').length },
  ];

  const pick = (day) => {
    const hit = index.get(day)?.[0];
    if (!hit) return;
    setSelected((prev) => (prev === day ? null : day));
    setTab(hit.status);
    setEditing(null);
    setView('list');
    requestAnimationFrame(() => {
      listRef.current?.querySelector(`[data-day="${day}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const when = (entry) => {
    if (entry.date < today) return t('holiday.when.past');
    if (entry.date === today) return t('holiday.next.today');
    return t('holiday.next.in', { n: daysBetween(today, entry.date) });
  };

  const fetchDrafts = async () => {
    setBusy('fetch');
    try {
      const answer = await holidaysService.fetchDrafts(year);
      setHolidays(answer?.holidays ?? holidays);
      setTab('DRAFT');
      showToast(t('adminHoliday.fetch.done', { fetched: answer?.fetched ?? 0, added: answer?.added ?? 0 }), 'success');
    } catch (err) {
      showToast(err?.code === 'HOLIDAY_SOURCE_FAILED' ? t('adminHoliday.fetch.failed') : apiErrorMessage(err, t), 'error');
    } finally {
      setBusy(null);
    }
  };

  const confirmTicked = async () => {
    setBusy('confirm');
    try {
      const answer = await holidaysService.confirm([...ticked]);
      const skipped = answer?.skipped?.length ?? 0;
      showToast(
        t(skipped ? 'adminHoliday.confirm.doneSkipped' : 'adminHoliday.confirm.done', {
          n: answer?.confirmed?.length ?? 0,
          skipped,
        }),
        'success'
      );
      setTicked(new Set());
      await load();
    } catch (err) {
      showToast(apiErrorMessage(err, t), 'error');
    } finally {
      setBusy(null);
    }
  };

  const toggle = (id) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allTicked = shown.length > 0 && shown.every((entry) => ticked.has(entry.id));

  const handleAdd = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.date) next.date = t('validation.holiday.dateRequired');
    const nameFail = validateHolidayName(form.name);
    if (nameFail) next.name = t(nameFail.key, nameFail.vars);
    setFormErrors(next);
    if (Object.keys(next).length) return;

    setBusy('add');
    try {
      const holiday = await holidaysService.addNational({ date: form.date, name: form.name.trim(), kind: form.kind });
      setAdding(false);
      setForm(EMPTY);
      const landed = Number(String(holiday?.date ?? form.date).slice(0, 4));
      setTab('CONFIRMED');
      if (landed && landed !== year) setYear(landed);
      else await load();
      showToast(t('adminHoliday.add.done', { name: holiday?.name ?? form.name.trim() }), 'success');
    } catch (err) {
      setFormErrors({ global: apiErrorMessage(err, t) });
    } finally {
      setBusy(null);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!editing.date) next.date = t('validation.holiday.dateRequired');
    const nameFail = validateHolidayName(editing.name);
    if (nameFail) next.name = t(nameFail.key, nameFail.vars);
    setEditErrors(next);
    if (Object.keys(next).length) return;

    const original = holidays.find((entry) => entry.id === editing.id);
    const changes = {};
    if (editing.date !== original.date) changes.date = editing.date;
    if (editing.name.trim() !== original.name) changes.name = editing.name.trim();
    if (editing.kind !== original.kind) changes.kind = editing.kind;
    if (Object.keys(changes).length === 0) {
      setEditing(null);
      return;
    }

    setBusy(editing.id);
    try {
      await holidaysService.updateDraft(editing.id, changes);
      setEditing(null);
      await load();
      showToast(t('adminHoliday.edit.done'), 'success');
    } catch (err) {
      setEditErrors({ global: apiErrorMessage(err, t) });
    } finally {
      setBusy(null);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawing) return;
    setBusy(withdrawing.id);
    try {
      await holidaysService.withdrawNational(withdrawing.id);
      showToast(t('adminHoliday.withdraw.done', { name: withdrawing.name }), 'success');
    } catch (err) {
      showToast(apiErrorMessage(err, t), 'error');
    } finally {
      await load();
      setBusy(null);
      setWithdrawing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="select-none">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('adminHoliday.title')}</h1>
        <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1 max-w-2xl leading-relaxed">{t('adminHoliday.subtitle')}</p>
      </div>

      <section className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-1" role="group" aria-label={t('holiday.year')}>
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              disabled={year <= 2020}
              aria-label={t('holiday.year.prev')}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-50 hover:text-brand disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="min-w-14 text-center text-base font-extrabold text-slate-800 tabular-nums" aria-live="polite">
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
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" isLoading={busy === 'fetch'} onClick={fetchDrafts}>
              <DownloadCloud className="w-4 h-4 mr-1" aria-hidden="true" />
              {t('adminHoliday.fetch')}
            </Button>
            {!adding && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus className="w-4 h-4 mr-1" aria-hidden="true" />
                {t('adminHoliday.add')}
              </Button>
            )}
          </div>
        </div>

        <p className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-800 leading-relaxed">
          {t('adminHoliday.sourceNote')}
        </p>

        {holidays !== null && !error && (
          <>
            <SummaryCards stats={stats} next={next} lang={lang} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Legend kinds={['NATIONAL', 'JOINT_LEAVE']} draft />
              <ViewToggle view={view} onChange={setView} />
            </div>
            <div className={view === 'calendar' ? '' : 'hidden sm:block'}>
              <YearCalendar year={year} index={index} today={today} selected={selected} onPick={pick} lang={lang} />
            </div>
          </>
        )}

        {adding && (
          <form onSubmit={handleAdd} noValidate className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3 max-w-xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                id="nationalDate"
                name="date"
                label={t('adminHoliday.field.date')}
                type="date"
                value={form.date}
                error={formErrors.date || undefined}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, date: e.target.value }));
                  setFormErrors((prev) => ({ ...prev, date: null, global: null }));
                }}
              />
              <SelectField
                id="nationalKind"
                label={t('adminHoliday.field.kind')}
                value={form.kind}
                onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value }))}
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`holiday.kind.${kind}`)}
                  </option>
                ))}
              </SelectField>
            </div>
            <Input
              id="nationalName"
              name="name"
              label={t('adminHoliday.field.name')}
              type="text"
              autoComplete="off"
              value={form.name}
              error={formErrors.name || undefined}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, name: e.target.value }));
                setFormErrors((prev) => ({ ...prev, name: null, global: null }));
              }}
            />
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{t('adminHoliday.add.hint')}</p>
            {formErrors.global && (
              <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
                {formErrors.global}
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setAdding(false);
                  setForm(EMPTY);
                  setFormErrors({});
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" size="sm" isLoading={busy === 'add'}>
                {t('adminHoliday.add.save')}
              </Button>
            </div>
          </form>
        )}

        <div className="border-b border-slate-100 flex gap-6 select-none overflow-x-auto">
          {STATUSES.map((status) => {
            const active = tab === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setTab(status);
                  setTicked(new Set());
                  setEditing(null);
                }}
                className={`pb-3 text-sm font-extrabold transition-all border-b-2 cursor-pointer focus:outline-none focus-visible:text-brand flex items-center gap-2 shrink-0 whitespace-nowrap ${
                  active ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-slate-600'
                }`}
              >
                {t(`adminHoliday.status.${status}`)}
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${active ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'}`}>
                  {byStatus[status].length}
                </span>
              </button>
            );
          })}
        </div>

        <div ref={listRef} className={`space-y-4 ${view === 'list' ? '' : 'hidden sm:block'}`}>
        {tab === 'DRAFT' && shown.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                className="accent-brand"
                checked={allTicked}
                onChange={() => setTicked(allTicked ? new Set() : new Set(shown.map((entry) => entry.id)))}
              />
              {t('adminHoliday.selectAll', { n: shown.length })}
            </label>
            <Button size="sm" isDisabled={ticked.size === 0} isLoading={busy === 'confirm'} onClick={confirmTicked}>
              {t('adminHoliday.confirm', { n: ticked.size })}
            </Button>
          </div>
        )}

        {error ? (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
            {error}
          </div>
        ) : holidays === null ? (
          <div className="h-32 bg-slate-50 rounded-2xl animate-pulse" aria-label={t('common.loading')} />
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-xs font-semibold text-slate-500">{t(`adminHoliday.empty.${tab}`, { year })}</p>
        ) : (
          <ul className="space-y-2">
            {shown.map((entry) => (
              <li
                key={entry.id}
                data-day={entry.date}
                className={`rounded-2xl border bg-white p-3 flex items-center gap-3 transition-shadow ${
                  selected === entry.date ? 'border-brand ring-2 ring-brand/20 shadow-md' : 'border-slate-100 shadow-sm'
                } ${entry.status === 'WITHDRAWN' || entry.date < today ? 'opacity-70' : ''}`}
              >
                {tab === 'DRAFT' && editing?.id !== entry.id && (
                  <input
                    type="checkbox"
                    className="accent-brand self-start sm:self-auto"
                    checked={ticked.has(entry.id)}
                    onChange={() => toggle(entry.id)}
                    aria-label={t('adminHoliday.tick', { name: entry.name })}
                  />
                )}
                {editing?.id === entry.id ? (
                  <form onSubmit={handleEdit} noValidate className="flex-1 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input
                        id={`draftDate-${entry.id}`}
                        name="date"
                        label={t('adminHoliday.field.date')}
                        type="date"
                        value={editing.date}
                        error={editErrors.date || undefined}
                        onChange={(e) => setEditing((prev) => ({ ...prev, date: e.target.value }))}
                      />
                      <Input
                        id={`draftName-${entry.id}`}
                        name="name"
                        label={t('adminHoliday.field.name')}
                        type="text"
                        autoComplete="off"
                        value={editing.name}
                        error={editErrors.name || undefined}
                        onChange={(e) => setEditing((prev) => ({ ...prev, name: e.target.value }))}
                      />
                      <SelectField
                        id={`draftKind-${entry.id}`}
                        label={t('adminHoliday.field.kind')}
                        value={editing.kind}
                        onChange={(e) => setEditing((prev) => ({ ...prev, kind: e.target.value }))}
                      >
                        {KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {t(`holiday.kind.${kind}`)}
                          </option>
                        ))}
                      </SelectField>
                    </div>
                    {editErrors.global && (
                      <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-xs text-red-700 font-semibold" role="alert">
                        {editErrors.global}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>
                        {t('common.cancel')}
                      </Button>
                      <Button type="submit" size="sm" isLoading={busy === entry.id}>
                        {t('classes.edit.save')}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <DateChip start={entry.date} lang={lang} past={entry.date < today} />
                      <div className="min-w-0">
                        <p className={`text-sm font-bold break-words ${entry.status === 'WITHDRAWN' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                          {entry.name}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${(KIND_STYLE[entry.kind] ?? KIND_STYLE.NATIONAL).soft}`}>
                            {t(`holiday.kind.${entry.kind}`)}
                          </span>
                          {entry.status !== 'WITHDRAWN' && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">{when(entry)}</span>
                          )}
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                            {entry.source === 'manual' || !entry.source ? t('adminHoliday.source.manual') : t('adminHoliday.source.fetched', { source: entry.source })}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 shrink-0">
                      {entry.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditing({ id: entry.id, date: entry.date, name: entry.name, kind: entry.kind });
                            setEditErrors({});
                          }}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-brand hover:bg-brand-tint/60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        >
                          <Pencil className="w-3 h-3" aria-hidden="true" />
                          {t('adminHoliday.edit')}
                        </button>
                      )}
                      {entry.status !== 'WITHDRAWN' && (
                        <button
                          type="button"
                          onClick={() => setWithdrawing(entry)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                        >
                          {t('adminHoliday.withdraw')}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(withdrawing)}
        tone="danger"
        title={t('adminHoliday.withdraw.title', { name: withdrawing?.name ?? '' })}
        body={t(withdrawing?.status === 'CONFIRMED' ? 'adminHoliday.withdraw.bodyConfirmed' : 'adminHoliday.withdraw.bodyDraft')}
        confirmLabel={t('adminHoliday.withdraw')}
        cancelLabel={t('common.cancel')}
        busy={Boolean(withdrawing) && busy === withdrawing?.id}
        busyLabel={t('common.loading')}
        onConfirm={handleWithdraw}
        onCancel={() => setWithdrawing(null)}
      />
    </div>
  );
};

export default AdminHolidaysPage;
