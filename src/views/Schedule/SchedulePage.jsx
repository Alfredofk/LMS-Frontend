import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  User, 
  Award 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useT } from '../../i18n/LanguageContext';
import { ROLES } from '../../constants/roles';
import { getAccessToken } from '../../services/apiClient';

export const SchedulePage = () => {
  const { activeRole } = useAuth();
  const { t, lang } = useT();
  const locale = lang === 'id' ? 'id-ID' : 'en-GB';
  const role = activeRole || ROLES.STUDENT;

  // State Management
  const [weeklySchedules, setWeeklySchedules] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calendar State (0-indexed month)
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(today);

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

  // Fetch Schedules & Deadlines from Backend
  const fetchScheduleData = async () => {
    setLoading(true);
    try {
      const token = getAccessToken();
      if (!token) return;

      // Lowercased only here: the role name is uppercase everywhere in this app,
      // but this path segment is a URL, and this endpoint does not exist yet
      // anyway — its real shape is the backend's to decide.
      const endpoint = `/api/schedule/${role.toLowerCase()}`;
      const res = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWeeklySchedules(data.weeklySchedules || []);
        setDeadlines(data.deadlines || []);
      }
    } catch (err) {
      console.error('Fetch Schedule Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScheduleData();
  }, [role]);

  // Calendar Calculation Helpers
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const daysInCurrentMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDayIndex = getFirstDayOfMonth(currentMonth, currentYear);

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const daysInPrevMonth = getDaysInMonth(prevMonth, prevYear);

  // Build calendar cells grid array
  const calendarCells = [];

  // 1. Padding days from the previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayVal = daysInPrevMonth - i;
    calendarCells.push({
      day: dayVal,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false
    });
  }

  // 2. Days of the current month
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    calendarCells.push({
      day: i,
      month: currentMonth,
      year: currentYear,
      isCurrentMonth: true
    });
  }

  // 3. Padding days from the next month to fill grid rows
  const remainingCells = 42 - calendarCells.length; // standard 6-row grid
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({
      day: i,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false
    });
  }

  // Check if a cell date has weekly class schedules
  const hasClassesOnDay = (cell) => {
    const dateObj = new Date(cell.year, cell.month, cell.day);
    const dayOfWeek = dateObj.getDay();
    return weeklySchedules.some(s => s.dayOfWeek === dayOfWeek);
  };

  // Check if a cell date has deadlines
  const getDeadlinesOnDay = (cell) => {
    const cellDateStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
    return deadlines.filter(d => d.deadline.substring(0, 10) === cellDateStr);
  };

  // Navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  // Filter schedules and deadlines for the SELECTED date
  const selectedDayOfWeek = selectedDate.getDay();
  const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

  const selectedClasses = weeklySchedules.filter(s => s.dayOfWeek === selectedDayOfWeek);
  const selectedDeadlines = deadlines.filter(d => d.deadline.substring(0, 10) === selectedDateStr);

  return (
    /* The row below becomes two side-by-side columns at xl, so a heading dropped
       straight into it would be a third column rather than a title above one.
       Hence the wrapper. */
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
        {t('shell.schedule')}
      </h1>

      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8 font-sans flex flex-col xl:flex-row gap-6">
      
      {/* LEFT COLUMN: The Interactive Calendar */}
      <div className="flex-1 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col">
        {/* Calendar Nav Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 select-none">
          <div className="flex flex-wrap items-center gap-3">
            {/* Month Select */}
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value, 10))}
              className="bg-white border border-slate-200 rounded-2xl px-4 py-2 text-sm font-extrabold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand cursor-pointer shadow-sm"
              aria-label={t('sch.pickMonth')}
            >
              {monthNames.map((name, index) => (
                <option key={index} value={index}>{name}</option>
              ))}
            </select>

            {/* Year Select */}
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
              className="bg-white border border-slate-200 rounded-2xl px-4 py-2 text-sm font-extrabold text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand cursor-pointer shadow-sm"
              aria-label={t('sch.pickYear')}
            >
              {Array.from({ length: 11 }, (_, idx) => today.getFullYear() - 5 + idx).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-bold block sm:hidden">
              {t('sch.pickDate')}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const now = new Date();
                  setCurrentMonth(now.getMonth());
                  setCurrentYear(now.getFullYear());
                  setSelectedDate(now);
                }}
                className="px-3.5 py-2 text-xs font-extrabold text-brand hover:text-white bg-brand-tint hover:bg-brand rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                {t('att.today')}
              </button>
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-slate-50 text-slate-600 hover:text-brand border border-slate-100 rounded-xl transition-all cursor-pointer"
                aria-label={t('att.prevMonth')}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-slate-50 text-slate-600 hover:text-brand border border-slate-100 rounded-xl transition-all cursor-pointer"
                aria-label={t('att.nextMonth')}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Days of Week Headers */}
        <div className="grid grid-cols-7 gap-1 text-center border-b border-slate-100 pb-3 text-xs font-extrabold text-slate-500 uppercase select-none">
          {weekdayNames.map((name) => (
            <div key={name}>{name}</div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-1.5 mt-3 flex-1 select-none">
          {loading ? (
            <div className="col-span-7 py-24 text-center text-slate-500 font-semibold text-xs animate-pulse">
              {t('sch.loading')}
            </div>
          ) : (
            calendarCells.map((cell, idx) => {
              const isSelected = selectedDate.getDate() === cell.day && 
                                 selectedDate.getMonth() === cell.month && 
                                 selectedDate.getFullYear() === cell.year;
              
              const isToday = today.getDate() === cell.day && 
                              today.getMonth() === cell.month && 
                              today.getFullYear() === cell.year;
              
              const hasClasses = hasClassesOnDay(cell);
              const cellDeadlines = getDeadlinesOnDay(cell);
              const hasDeadlines = cellDeadlines.length > 0;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(new Date(cell.year, cell.month, cell.day))}
                  className={`
                    min-h-[70px] sm:min-h-[85px] border rounded-2xl p-2 flex flex-col justify-between cursor-pointer transition-all duration-200 relative group
                    ${!cell.isCurrentMonth ? 'border-slate-50 bg-slate-50/20 text-slate-300' : 'border-slate-100 text-slate-800 hover:border-slate-300'}
                    ${isToday ? 'bg-violet-50/30 border-violet-100' : ''}
                    ${isSelected ? 'border-brand bg-white ring-2 ring-brand/10' : 'bg-white'}
                  `}
                >
                  {/* Date Number */}
                  <span className={`text-xs font-bold leading-none
                    ${isSelected ? 'text-brand font-extrabold' : ''}
                    ${isToday ? 'w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center font-extrabold' : ''}
                  `}>
                    {cell.day}
                  </span>

                  {/* Indicators Bottom Row */}
                  <div className="flex flex-col gap-1 items-start mt-auto">
                    {/* Class indicator: Purple banner */}
                    {hasClasses && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand block" title={t('sch.dot.class')} />
                    )}
                    {/* Deadline indicator: Orange banner */}
                    {hasDeadlines && (
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 block" title={t('sch.dot.deadline')} />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Selected Day's Agenda */}
      <div className="w-full xl:w-96 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col select-none">
        <h2 className="text-base font-extrabold text-slate-800 tracking-tight mb-1">
          {t('sch.agenda')}
        </h2>
        <p className="text-xs text-slate-500 font-bold mb-6">
          {selectedDate.toLocaleDateString(locale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-10 bg-slate-100 rounded-xl" />
            <div className="h-10 bg-slate-100 rounded-xl" />
          </div>
        ) : selectedClasses.length === 0 && selectedDeadlines.length === 0 ? (
          <div className="flex-1 py-16 flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <h3 className="text-xs font-extrabold text-slate-700">{t('sch.agenda.empty')}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1 max-w-[200px] leading-relaxed">
              {t('sch.agenda.emptyDetail')}
            </p>
          </div>
        ) : (
          <div className="space-y-6 overflow-y-auto flex-1 pr-1">
            
            {/* 1. Classes Section */}
            {selectedClasses.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{t('sch.classes')}</h4>
                <div className="space-y-2.5">
                  {selectedClasses.map((cls) => (
                    <div key={cls.id} className="border border-slate-100 hover:border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 transition-all">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-violet-50 text-brand flex items-center justify-center shrink-0">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-extrabold text-slate-800 leading-tight truncate">{cls.subjectName}</h5>
                          <span className="text-[9px] text-slate-500 font-bold block mt-0.5">{cls.subjectCode}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50 text-[10px] text-slate-500 font-bold">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{cls.startTime.substring(0, 5)} - {cls.endTime.substring(0, 5)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{cls.room}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-bold pt-1">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {role === ROLES.TEACHER
                            ? t('sch.teaching', { class: cls.className })
                            : t('sch.teacher', { name: cls.teacherName })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Deadlines Section */}
            {selectedDeadlines.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">{t('sch.deadlines')}</h4>
                <div className="space-y-2.5">
                  {selectedDeadlines.map((dl) => (
                    <div key={dl.id} className="border border-orange-100 bg-orange-50/10 rounded-2xl p-4 shadow-sm space-y-2.5 transition-all">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
                          <Award className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h5 className="text-xs font-extrabold text-slate-800 leading-tight truncate">{dl.title}</h5>
                          <span className="text-[9px] text-slate-500 font-bold block mt-0.5">{dl.subjectName}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] text-orange-600 font-extrabold pt-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>
                          {t('sch.dueAt', {
                            time: new Date(dl.deadline).toLocaleTimeString(locale, {
                              hour: '2-digit',
                              minute: '2-digit',
                              // The key says WIB, so the clock has to be WIB.
                              timeZone: 'Asia/Jakarta',
                            }),
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      </div>
    </div>
  );
};

export default SchedulePage;
