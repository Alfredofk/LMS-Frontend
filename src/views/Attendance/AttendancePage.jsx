import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Flame,
  UserCheck,
  AlertCircle,
  Search,
  BookOpen,
} from 'lucide-react';

import { useT } from '../../i18n/LanguageContext';
import { getAccessToken } from '../../services/apiClient';

/*
  A student's own attendance record.

  `/api/attendance/student/summary` does not exist — there is no Attendance
  model anywhere in the schema, and no Session for one to hang off — so the fetch
  below always fails and the page renders its empty state. It is left in place
  because the shape it expects is the one to argue with when the endpoint is
  designed, not because it works.

  Month and weekday names are generated from `Intl` rather than stored as
  nineteen dictionary entries. A calendar that spells its own months is a
  calendar that has to be re-translated every time a language is added, and the
  browser already knows them.
*/

/* The statuses the (future) API would send. Unknown values render as-is rather
   than as a raw key, so an unfamiliar status is readable instead of broken. */
const STATUS_KEYS = {
  Hadir: 'att.status.Hadir',
  Izin: 'att.status.Izin',
  Sakit: 'att.status.Sakit',
  Alpa: 'att.status.Alpa',
};

const STATUS_CELL = {
  Hadir: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/60',
  Izin: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/60',
  Sakit: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/60',
  Alpa: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/60',
};

const STATUS_PILL = {
  Hadir: 'bg-emerald-50 text-emerald-700',
  Alpa: 'bg-rose-50 text-rose-700',
};

export const AttendancePage = () => {
  const { t, lang } = useT();
  const locale = lang === 'id' ? 'id-ID' : 'en-GB';

  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    hadir: 0,
    izin: 0,
    sakit: 0,
    alpa: 0,
    percentage: 100,
    dailyStreak: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, m) =>
        new Date(2000, m, 1).toLocaleDateString(locale, { month: 'long' })
      ),
    [locale]
  );

  /* 2 January 2000 was a Sunday, so this starts the week where the grid does. */
  const weekdayNames = useMemo(
    () =>
      Array.from({ length: 7 }, (_, d) =>
        new Date(2000, 0, 2 + d).toLocaleDateString(locale, { weekday: 'short' })
      ),
    [locale]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const token = getAccessToken();
        if (!token) return;

        const res = await fetch('/api/attendance/student/summary', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          setHistory(data.history || []);
          if (data.summary) setSummary(data.summary);
        }
      } catch (err) {
        console.error('Fetch Attendance Summary Error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const daysInCurrentMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDayIndex = getFirstDayOfMonth(currentMonth, currentYear);

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const daysInPrevMonth = getDaysInMonth(prevMonth, prevYear);

  const calendarCells = [];

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarCells.push({ day: daysInPrevMonth - i, month: prevMonth, year: prevYear, isCurrentMonth: false });
  }
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    calendarCells.push({ day: i, month: currentMonth, year: currentYear, isCurrentMonth: true });
  }
  const remainingCells = 42 - calendarCells.length;
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({ day: i, month: nextMonth, year: nextYear, isCurrentMonth: false });
  }

  const getAttendanceForDay = (cell) => {
    const cellDateStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
    return (history || []).find((h) => h && h.date === cellDateStr);
  };

  const statusLabel = (status) => (STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const filteredHistory = (history || []).filter((h) => {
    const needle = searchQuery.toLowerCase();
    return (
      (h.subjectName || '').toLowerCase().includes(needle) ||
      statusLabel(h.status || '').toLowerCase().includes(needle)
    );
  });

  try {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8 font-sans flex flex-col gap-6">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 leading-tight">
              {t('att.title')}
            </h1>
            <p className="text-xs text-slate-400 font-bold mt-1">{t('att.subtitle')}</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              placeholder={t('att.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 select-none">

          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-5 md:col-span-2">
            <div className="relative w-20 h-20 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-brand"
                  strokeDasharray={`${summary.percentage}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-slate-800">
                {summary.percentage}%
              </div>
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-700">{t('att.ratio')}</h4>
              <p className="text-[10px] text-slate-400 font-bold mt-1 max-w-[220px] leading-relaxed">
                {t('att.ratio.detail')}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-5">
            <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
              <Flame className="w-6 h-6 fill-current" aria-hidden="true" />
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                {t('att.streak')}
              </span>
              <span className="text-xl font-extrabold text-slate-800 mt-0.5 block">
                {t('att.days', { n: summary.dailyStreak })}
              </span>
              <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                {t('att.streak.detail')}
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-5">
            <div className="w-12 h-12 bg-violet-50 text-brand rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
              <UserCheck className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">
                {t('att.totalLogs')}
              </span>
              <span className="text-xl font-extrabold text-slate-800 mt-0.5 block">
                {t('att.days', { n: summary.total })}
              </span>
              <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                {t('att.breakdown', {
                  h: summary.hadir,
                  i: summary.izin,
                  s: summary.sakit,
                  a: summary.alpa,
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-6">

          <div className="flex-1 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col select-none">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(parseInt(e.target.value, 10))}
                  className="bg-white border border-slate-200 rounded-2xl px-4 py-2 text-sm font-extrabold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand cursor-pointer shadow-sm"
                >
                  {monthNames.map((name, index) => (
                    <option key={name} value={index}>{name}</option>
                  ))}
                </select>

                <select
                  value={currentYear}
                  onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
                  className="bg-white border border-slate-200 rounded-2xl px-4 py-2 text-sm font-extrabold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand cursor-pointer shadow-sm"
                >
                  {Array.from({ length: 11 }, (_, idx) => today.getFullYear() - 5 + idx).map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setCurrentMonth(now.getMonth());
                    setCurrentYear(now.getFullYear());
                  }}
                  className="px-3.5 py-2 text-xs font-extrabold text-brand hover:text-white bg-brand-tint hover:bg-brand rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  {t('att.today')}
                </button>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label={t('att.prevMonth')}
                  className="p-2 hover:bg-slate-50 text-slate-600 hover:text-brand border border-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label={t('att.nextMonth')}
                  className="p-2 hover:bg-slate-50 text-slate-600 hover:text-brand border border-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center border-b border-slate-100 pb-3 text-xs font-extrabold text-slate-400 uppercase">
              {weekdayNames.map((name) => (
                <div key={name}>{name}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5 mt-3 flex-1">
              {loading ? (
                <div className="col-span-7 py-24 text-center text-slate-400 font-semibold text-xs animate-pulse">
                  {t('att.loading')}
                </div>
              ) : (
                calendarCells.map((cell) => {
                  const record = getAttendanceForDay(cell);
                  const cellBgClass =
                    STATUS_CELL[record?.status] ??
                    'bg-white border-slate-100 hover:border-slate-300 text-slate-800';

                  return (
                    <div
                      key={`${cell.year}-${cell.month}-${cell.day}`}
                      className={`
                        min-h-[60px] sm:min-h-[75px] border rounded-2xl p-2 flex flex-col justify-between transition-all duration-200 relative group
                        ${!cell.isCurrentMonth ? 'border-slate-100 bg-slate-50/40 text-slate-300' : 'border-slate-100'}
                        ${cell.isCurrentMonth ? cellBgClass : ''}
                      `}
                    >
                      <span className="text-xs font-bold leading-none">{cell.day}</span>

                      {record && (
                        <span
                          className="text-[8px] font-extrabold uppercase tracking-wider block mt-auto truncate"
                          title={statusLabel(record.status)}
                        >
                          {statusLabel(record.status)}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap gap-4 mt-5 text-[10px] text-slate-400 font-bold select-none border-t border-slate-100 pt-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md border border-emerald-200 bg-emerald-50" />
                <span>{t('att.legend.present')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md border border-amber-200 bg-amber-50" />
                <span>{t('att.legend.excused')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-md border border-rose-200 bg-rose-50" />
                <span>{t('att.legend.absent')}</span>
              </div>
            </div>
          </div>

          <div className="w-full xl:w-96 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col select-none max-h-[500px]">
            <h2 className="text-base font-extrabold text-slate-800 tracking-tight mb-4">
              {t('att.log.title')}
            </h2>

            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-10 bg-slate-100 rounded-xl" />
                <div className="h-10 bg-slate-100 rounded-xl" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="flex-1 py-16 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
                  <CalendarIcon className="w-6 h-6" aria-hidden="true" />
                </div>
                <h3 className="text-xs font-extrabold text-slate-700">{t('att.log.empty')}</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  {searchQuery ? t('att.log.emptySearch') : t('att.log.emptyNone')}
                </p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-brand font-extrabold">{formatDate(item.date)}</span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-wider ${
                          STATUS_PILL[item.status] ?? 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                      <BookOpen className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.subjectName}</span>
                    </div>

                    {item.notes && (
                      <p className="text-[9px] text-slate-400 font-semibold leading-tight">
                        {t('att.note', { note: item.notes })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    );
  } catch (err) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-3xl text-red-700 font-sans max-w-2xl mx-auto my-12 shadow-sm">
        <h2 className="font-extrabold text-base flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
          {t('att.error.title')}
        </h2>
        <p className="text-xs font-bold text-slate-500 mt-1">{t('att.error.body')}</p>
        <pre className="mt-4 text-[10px] font-mono bg-white p-4 rounded-2xl border border-red-100 overflow-auto max-h-60 leading-relaxed text-red-600">
          {err.stack || err.message || String(err)}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer"
        >
          {t('att.error.refresh')}
        </button>
      </div>
    );
  }
};

export default AttendancePage;
