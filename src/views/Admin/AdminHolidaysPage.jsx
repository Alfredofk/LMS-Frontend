import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { CalendarOff, ChevronLeft, ChevronRight, DownloadCloud, Plus } from 'lucide-react';

import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SelectField from '../../components/ui/SelectField';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyCard from '../../components/ui/EmptyCard';
import { Bone, HomeError } from '../Dashboard/components/HomeCard';
import { ADMIN_CARD, CARD_TITLE, SlashFacts } from './adminParts';
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

  The look since 2026-10-29 (owner, mockup libur-nasional.html, all nine items):
  a slash line of the year's counts, no frame around the page, the list one card
  of rows per month (the kind a coloured word, the rest grey slashes), select-all
  as a bar over it, "Tarik" dangerOutline, the add form a card, and the
  dashboards' tabs and states.
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

  const busyList = holidays === null && !error;
  const draftCount = byStatus.DRAFT.length;

  /* The list by month, as on the school calendar (the reviewed mockup). */
  const byMonth = new Map();
  for (const entry of [...shown].sort((a, b) => a.date.localeCompare(b.date))) {
    const month = entry.date.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month).push(entry);
  }
  const months = [...byMonth.entries()];
  const monthName = (yyyymm) =>
    new Date(`${yyyymm}-01T00:00:00Z`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', { month: 'long', timeZone: 'UTC' });

  const summary = [
    String(year),
    holidays !== null && !error && t('adminHoliday.summary.confirmed', { n: byStatus.CONFIRMED.length }),
    holidays !== null && !error && (
      <span className={draftCount > 0 ? 'font-bold text-amber-700' : ''}>{t('adminHoliday.summary.draft', { n: draftCount })}</span>
    ),
  ];

  let list;
  if (error) {
    list = (
      <div className={ADMIN_CARD}>
        <HomeError message={error} retryLabel={t('att.error.retry')} onRetry={load} />
      </div>
    );
  } else if (busyList) {
    list = (
      <div className={`${ADMIN_CARD} px-4 sm:px-5 py-2`} aria-busy="true" aria-label={t('common.loading')}>
        {[0, 1, 2].map((n) => (
          <div key={n} className="py-3.5 flex items-center gap-3">
            <Bone className="w-14 h-11 shrink-0" />
            <div className="flex-1">
              <Bone className="h-3.5 w-2/5" />
              <Bone className="h-3 w-3/5 mt-2" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (shown.length === 0) {
    list = (
      <EmptyCard
        icon={CalendarOff}
        title={t(`adminHoliday.empty.${tab}`, { year })}
        body={tab === 'DRAFT' ? t('adminHoliday.empty.DRAFT.body') : undefined}
        action={
          tab === 'DRAFT' && (
            <Button size="sm" variant="outline" isLoading={busy === 'fetch'} onClick={fetchDrafts}>
              <DownloadCloud className="w-4 h-4 mr-1" aria-hidden="true" />
              {t('adminHoliday.fetch')}
            </Button>
          )
        }
      />
    );
  } else {
    list = (
      <div className="space-y-4">
        {/* Select all and confirm: a bar over the list, the boxes inside the rows. */}
        {tab === 'DRAFT' && (
          <div
            className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-100 px-4 py-2.5 ${
              ticked.size > 0 ? 'bg-brand-tint' : 'bg-white shadow-sm'
            }`}
          >
            <label
              className={`inline-flex items-center gap-2.5 text-[13px] cursor-pointer ${
                ticked.size > 0 ? 'font-extrabold text-brand' : 'font-bold text-slate-600'
              }`}
            >
              <input
                type="checkbox"
                className="accent-brand"
                checked={allTicked}
                onChange={() => setTicked(allTicked ? new Set() : new Set(shown.map((entry) => entry.id)))}
              />
              {ticked.size > 0 ? t('adminHoliday.selected', { n: ticked.size }) : t('adminHoliday.selectAll', { n: shown.length })}
            </label>
            <Button size="sm" isDisabled={ticked.size === 0} isLoading={busy === 'confirm'} onClick={confirmTicked}>
              {t('adminHoliday.confirm', { n: ticked.size })}
            </Button>
          </div>
        )}

        {months.map(([month, entries]) => (
          <div key={month} className="space-y-2">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-extrabold text-slate-900 capitalize">{monthName(month)}</h3>
              <span className="h-px flex-1 bg-slate-100" aria-hidden="true" />
            </div>
            <ul className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              {entries.map((entry) => {
                const past = entry.date < today;
                return (
                  <li
                    key={entry.id}
                    data-day={entry.date}
                    /* A past or withdrawn day is told by its grey date and its name, not by
                       opacity: a faded row put the grey line at 2.7:1. */
                    className={`px-4 py-3 border-b border-slate-100 last:border-0 flex flex-wrap sm:flex-nowrap items-center gap-3 transition-colors ${
                      selected === entry.date ? 'bg-brand-tint' : ''
                    }`}
                  >
                    {tab === 'DRAFT' && editing?.id !== entry.id && (
                      <input
                        type="checkbox"
                        className="accent-brand"
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
                        {editErrors.global && <ErrorBox>{editErrors.global}</ErrorBox>}
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
                        <div className="flex items-center gap-3 min-w-0 flex-1 basis-56">
                          <DateChip start={entry.date} lang={lang} past={past} />
                          <div className="min-w-0">
                            <p className={`text-sm font-bold break-words ${entry.status === 'WITHDRAWN' ? 'text-slate-500 line-through' : past ? 'text-slate-600' : 'text-slate-800'}`}>
                              {entry.name}
                            </p>
                            {/* The kind as a coloured word, the rest grey with slashes: no chips. */}
                            <SlashFacts
                              className="mt-0.5 block text-[12.5px] font-medium text-slate-500"
                              parts={[
                                <span className={`font-bold ${(KIND_STYLE[entry.kind] ?? KIND_STYLE.NATIONAL).word}`}>{t(`holiday.kind.${entry.kind}`)}</span>,
                                entry.status !== 'WITHDRAWN' && when(entry),
                                entry.source === 'manual' || !entry.source
                                  ? t('adminHoliday.source.manual')
                                  : t('adminHoliday.source.fetched', { source: entry.source }),
                              ]}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-auto">
                          {entry.status === 'DRAFT' && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditing({ id: entry.id, date: entry.date, name: entry.name, kind: entry.kind });
                                setEditErrors({});
                              }}
                              className="text-[13px] font-bold text-brand hover:text-brand-deep cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                            >
                              {t('adminHoliday.edit')}
                            </button>
                          )}
                          {entry.status !== 'WITHDRAWN' && (
                            <Button size="sm" variant="dangerOutline" onClick={() => setWithdrawing(entry)}>
                              {t('adminHoliday.withdraw')}
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="select-none">
        <h1 className="text-3xl max-sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{t('adminHoliday.title')}</h1>
        <SlashFacts className="block mt-2 text-sm font-medium text-slate-500" parts={summary} />
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-1" role="group" aria-label={t('holiday.year')}>
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              disabled={year <= 2020}
              aria-label={t('holiday.year.prev')}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-brand disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
              className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-brand disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
      </div>

      {holidays !== null && !error && (
        <div className="space-y-4">
          <SummaryCards stats={stats} next={next} lang={lang} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Legend kinds={['NATIONAL', 'JOINT_LEAVE']} draft />
            <ViewToggle view={view} onChange={setView} />
          </div>
          <div className={view === 'calendar' ? '' : 'hidden sm:block'}>
            <YearCalendar year={year} index={index} today={today} selected={selected} onPick={pick} lang={lang} />
          </div>
        </div>
      )}

      {adding && (
        <form onSubmit={handleAdd} noValidate className={`${ADMIN_CARD} max-w-2xl space-y-3`}>
          <div>
            <h2 className={CARD_TITLE}>{t('adminHoliday.add')}</h2>
            <p className="mt-1 text-[13px] text-slate-500">{t('adminHoliday.add.hint')}</p>
          </div>
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
          {formErrors.global && <ErrorBox>{formErrors.global}</ErrorBox>}
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

      <div className="space-y-4">
        {/* The dashboards' text tabs; the drafts' count amber while any wait. */}
        <div
          role="tablist"
          className="flex gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shadow-[inset_0_-1px_0_var(--color-slate-100)] select-none"
        >
          {STATUSES.map((status) => {
            const on = tab === status;
            const count = byStatus[status].length;
            const waiting = status === 'DRAFT' && count > 0;
            return (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setTab(status);
                  setTicked(new Set());
                  setEditing(null);
                }}
                className={`px-2.5 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-t-lg ${
                  on ? 'text-brand border-brand' : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                {t(`adminHoliday.status.${status}`)}
                <span
                  className={`ml-1.5 px-1.5 rounded-full text-[11px] tabular-nums ${
                    waiting ? 'bg-amber-50 text-amber-700' : on ? 'bg-brand-tint text-brand' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* On a phone the list hides behind "Kalender"; a failed or first read is shown either way. */}
        <div ref={listRef} className={view === 'list' || error || busyList ? '' : 'hidden sm:block'}>
          {list}
        </div>
      </div>

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

/* A refusal under a form: the rose box, not the old red accent bar. */
const ErrorBox = ({ children }) => (
  <div className="p-3 rounded-xl bg-rose-50 text-[13px] font-semibold text-rose-700" role="alert">
    {children}
  </div>
);

export default AdminHolidaysPage;
