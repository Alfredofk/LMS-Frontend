import React from 'react';
import { CalendarDays, CalendarRange, Sparkles } from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { monthGrid } from '../../utils/holidays';
import { KIND_STYLE } from './kindStyle';

/*
  The pieces both holiday screens are built from (owner, 2026-09-28: "more
  modern" — the list alone made a reader count through twenty-four rows to see
  when anything was). /admin/holidays and the calendar on /schedule share them,
  so the two read the same:

    SummaryCards   counts per kind, and the next holiday counted down
    YearCalendar   twelve months at a glance, each holiday a coloured day;
                   a cluster such as Nyepi and Idul Fitri reads as one block
    Legend         what each colour means
    DateChip       the date as a tile, the anchor of every row in the list

  The kinds and their colours are one table (KIND_STYLE), so a day, its legend
  entry and its row's badge can never disagree. A DRAFT is the colour washed out
  behind a dashed border: there, but not yet true.
*/


const localeOf = (lang) => (lang === 'en' ? 'en-GB' : 'id-ID');

const monthLabel = (year, month, lang, style = 'long') =>
  new Date(Date.UTC(year, month, 1)).toLocaleDateString(localeOf(lang), { month: style, timeZone: 'UTC' });

/*
  Monday first: 2 January 2023 was a Monday. 'short', not 'narrow' — narrow
  Indonesian is S S R K J S M, three days reading "S".
*/
const weekdayLabels = (lang) =>
  Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2023, 0, 2 + i))
      .toLocaleDateString(localeOf(lang), { weekday: 'short', timeZone: 'UTC' })
      .replace('.', '')
      .slice(0, 3)
  );

/** A date, or a run of days, as a tile: the day large, the month small. */
export const DateChip = ({ start, end, lang, past = false }) => {
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${(end ?? start)}T00:00:00Z`);
  const sameMonth = s.getUTCMonth() === e.getUTCMonth();
  const days = start === (end ?? start) ? s.getUTCDate() : sameMonth ? `${s.getUTCDate()}-${e.getUTCDate()}` : s.getUTCDate();
  const month = s.toLocaleDateString(localeOf(lang), { month: 'short', timeZone: 'UTC' });
  return (
    <div
      className={`w-14 shrink-0 rounded-xl border text-center py-1.5 select-none ${
        past ? 'border-slate-100 bg-slate-50 text-slate-500' : 'border-slate-200 bg-white text-slate-800'
      }`}
      aria-hidden="true"
    >
      <div className="text-base font-extrabold leading-tight tabular-nums">{days}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{month}</div>
    </div>
  );
};

/**
 * Counts, and the next holiday. `stats`: [{ key, value, kind }]; `next`: the
 * item from nextHoliday() with a `name`, or null.
 */
export const SummaryCards = ({ stats, next, lang }) => {
  const { t } = useT();
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div key={stat.key} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${KIND_STYLE[stat.kind]?.dot ?? 'bg-slate-300'}`} aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">{t(stat.key)}</span>
          </div>
          <p className="mt-1.5 text-2xl font-extrabold text-slate-900 tabular-nums">{stat.value}</p>
        </div>
      ))}

      {/* The purple tile stays (owner, 2026-10-07: a white card read too plain). */}
      <div className="col-span-2 rounded-2xl bg-gradient-to-br from-brand to-brand-deep p-4 text-white shadow-sm relative overflow-hidden">
        <Sparkles className="absolute -right-2 -top-2 w-20 h-20 text-white/10" aria-hidden="true" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/90">{t('holiday.next')}</p>
        {next ? (
          <>
            <p className="mt-1 text-base font-extrabold leading-snug break-words">{next.name}</p>
            <p className="mt-0.5 text-xs font-semibold text-white/90">
              {new Date(`${next.start}T00:00:00Z`).toLocaleDateString(localeOf(lang), {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                timeZone: 'UTC',
              })}
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-extrabold">
              <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
              {next.days === 0 ? t('holiday.next.today') : t('holiday.next.in', { n: next.days })}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm font-semibold text-white/90">{t('holiday.next.none')}</p>
        )}
      </div>
    </div>
  );
};

export const Legend = ({ kinds, draft = false }) => {
  const { t } = useT();
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-semibold text-slate-600">
      {kinds.map((kind) => (
        <li key={kind} className="inline-flex items-center gap-1.5">
          <span className={`w-3 h-3 rounded ${KIND_STYLE[kind].solid}`} aria-hidden="true" />
          {t(`holiday.kind.${kind}`)}
        </li>
      ))}
      {draft && (
        <li className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-dashed border-slate-400 bg-slate-50" aria-hidden="true" />
          {t('holiday.legend.draft')}
        </li>
      )}
    </ul>
  );
};

/**
 * Twelve months. `index` is daysIndex(): day → items, each item carrying
 * `kind` (a KIND_STYLE key), `name` and optionally `draft`. The first item on a
 * day paints it. `onPick(day)` is offered only on days that hold something.
 */
export const YearCalendar = ({ year, index, today, selected, onPick, lang }) => {
  const { t } = useT();
  const weekdays = weekdayLabels(lang);

  return (
    <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {Array.from({ length: 12 }, (_, month) => {
        const weeks = monthGrid(year, month);
        const count = new Set(
          weeks.flat().filter((day) => day && index.has(day)).flatMap((day) => index.get(day))
        ).size;
        return (
          <section key={month} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm" aria-label={monthLabel(year, month, lang)}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-extrabold text-slate-800 capitalize">{monthLabel(year, month, lang)}</h3>
              {count > 0 && (
                <span className="text-[10px] font-bold text-slate-500 tabular-nums">{t('holiday.month.count', { n: count })}</span>
              )}
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {weekdays.map((label, i) => (
                <span key={`${label}-${i}`} className={`text-[9px] font-bold ${i === 6 ? 'text-rose-600' : 'text-slate-500'}`} aria-hidden="true">
                  {label}
                </span>
              ))}
              {weeks.flat().map((day, i) => {
                if (!day) return <span key={`blank-${month}-${i}`} />;
                const items = index.get(day);
                const number = Number(day.slice(8, 10));
                const isToday = day === today;
                const isSunday = i % 7 === 6;
                if (!items) {
                  return (
                    <span
                      key={day}
                      className={`h-7 flex items-center justify-center rounded-md text-[11px] font-semibold tabular-nums ${
                        isToday ? 'ring-2 ring-brand text-brand font-extrabold' : isSunday ? 'text-rose-600' : 'text-slate-600'
                      }`}
                    >
                      {number}
                    </span>
                  );
                }
                const first = items[0];
                const style = KIND_STYLE[first.kind] ?? KIND_STYLE.NATIONAL;
                const label = items.map((item) => item.name).join(', ');
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => onPick?.(day)}
                    title={label}
                    aria-label={`${number} ${monthLabel(year, month, lang)}: ${label}`}
                    aria-pressed={selected === day}
                    className={`h-7 flex items-center justify-center rounded-md text-[11px] font-extrabold tabular-nums cursor-pointer transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      first.draft ? `${style.soft} border border-dashed border-current` : style.solid
                    } ${isToday ? 'ring-2 ring-brand ring-offset-1' : ''} ${selected === day ? 'ring-2 ring-slate-900 ring-offset-1' : ''}`}
                  >
                    {number}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

/** Calendar | List, for phones — both show side by side from `sm` up. */
export const ViewToggle = ({ view, onChange }) => {
  const { t } = useT();
  return (
    <div className="sm:hidden inline-flex rounded-xl bg-slate-100 p-1" role="group" aria-label={t('holiday.view')}>
      {[
        { value: 'calendar', icon: CalendarRange, key: 'holiday.view.calendar' },
        { value: 'list', icon: CalendarDays, key: 'holiday.view.list' },
      ].map(({ value, icon: Icon, key }) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
            view === value ? 'bg-white text-brand shadow-sm' : 'text-slate-600'
          }`}
        >
          {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
          {t(key)}
        </button>
      ))}
    </div>
  );
};
