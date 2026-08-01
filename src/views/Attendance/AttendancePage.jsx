import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Flame, 
  UserCheck, 
  AlertCircle, 
  Search,
  BookOpen
} from 'lucide-react';

export const AttendancePage = () => {
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    hadir: 0,
    izin: 0,
    sakit: 0,
    alpa: 0,
    percentage: 100,
    dailyStreak: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Calendar states
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const fetchAttendanceSummary = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch('/api/attendance/student/summary', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('Fetch Attendance Summary Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceSummary();
  }, []);

  // Calendar Logic
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const daysInCurrentMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDayIndex = getFirstDayOfMonth(currentMonth, currentYear);

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const daysInPrevMonth = getDaysInMonth(prevMonth, prevYear);

  const calendarCells = [];

  // Padding previous month
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarCells.push({
      day: daysInPrevMonth - i,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false
    });
  }

  // Current month
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    calendarCells.push({
      day: i,
      month: currentMonth,
      year: currentYear,
      isCurrentMonth: true
    });
  }

  // Padding next month
  const remainingCells = 42 - calendarCells.length;
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

  // Get attendance record for specific calendar cell
  const getAttendanceForDay = (cell) => {
    const cellDateStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
    // Find matching record
    return (history || []).find(h => h && h.date === cellDateStr);
  };

  // Status mapping colors
  const getStatusColor = (status) => {
    switch (status) {
      case 'Hadir':
        return 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100/60';
      case 'Izin':
      case 'Sakit':
        return 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/60';
      case 'Alpa':
        return 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100/60';
      default:
        return 'bg-white border-slate-100 hover:border-slate-350 text-slate-800';
    }
  };

  // Nav Month Handlers
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return dateStr;
      }
      return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const filteredHistory = (history || []).filter(h => {
    const subjectName = h.subjectName || '';
    const status = h.status || '';
    return subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           status.toLowerCase().includes(searchQuery.toLowerCase());
  });

  try {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 sm:p-8 font-sans flex flex-col gap-6">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 leading-tight">
            Riwayat Kehadiran (Attendance)
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1">
            Pantau statistik partisipasi kehadiran dan ketaatan presensi mandiri Anda
          </p>
        </div>

        {/* Search filter */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari mata pelajaran..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-xs font-semibold text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Grid Summary Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 select-none">
        
        {/* Card 1: Percentage Progress Circle */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-5 md:col-span-2">
          {/* Circular Progress Ring */}
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-full h-full transform -rotate-95" viewBox="0 0 36 36">
              <path
                className="text-slate-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-[#7047EB]"
                strokeDasharray={`${summary.percentage}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-800">
              {summary.percentage}%
            </div>
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-700">Rasio Kehadiran Global</h4>
            <p className="text-[10px] text-slate-400 font-bold mt-1 max-w-[220px] leading-relaxed">
              Persentase total kehadiran murni (Hadir) Anda dari keseluruhan kelas mata pelajaran terdaftar.
            </p>
          </div>
        </div>

        {/* Card 2: Streak Card */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shrink-0 shadow-sm animate-pulse">
            <Flame className="w-6 h-6 fill-current" />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Streak Presensi</span>
            <span className="text-xl font-black text-slate-800 mt-0.5 block">{summary.dailyStreak} Hari</span>
            <span className="text-[9px] text-slate-450 font-bold block mt-0.5">Check-in berturut-turut</span>
          </div>
        </div>

        {/* Card 3: Total Logs */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 bg-violet-50 text-[#7047EB] rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Total Log Masuk</span>
            <span className="text-xl font-black text-slate-800 mt-0.5 block">{summary.total} Hari</span>
            <span className="text-[9px] text-slate-450 font-bold block mt-0.5">
              H: {summary.hadir} | I: {summary.izin} | S: {summary.sakit} | A: {summary.alpa}
            </span>
          </div>
        </div>
      </div>

      {/* Main Section: Heatmap Calendar & Detailed Logs */}
      <div className="flex flex-col xl:flex-row gap-6">
        
        {/* Left Card: Calendar Heatmap */}
        <div className="flex-1 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col select-none">
          
          {/* Calendar Nav Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(parseInt(e.target.value, 10))}
                className="bg-white border border-slate-200 rounded-2xl px-4 py-2 text-sm font-black text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 cursor-pointer shadow-sm"
              >
                {monthNames.map((name, index) => (
                  <option key={index} value={index}>{name}</option>
                ))}
              </select>

              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
                className="bg-white border border-slate-200 rounded-2xl px-4 py-2 text-sm font-black text-slate-800 focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500 cursor-pointer shadow-sm"
              >
                {Array.from({ length: 11 }, (_, idx) => today.getFullYear() - 5 + idx).map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const now = new Date();
                  setCurrentMonth(now.getMonth());
                  setCurrentYear(now.getFullYear());
                }}
                className="px-3.5 py-2 text-xs font-black text-[#7047EB] hover:text-white bg-[#F1EEFF] hover:bg-[#7047EB] rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                Hari Ini
              </button>
              <button
                onClick={handlePrevMonth}
                className="p-2 hover:bg-slate-50 text-slate-600 hover:text-violet-650 border border-slate-100 rounded-xl transition-all cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 hover:bg-slate-50 text-slate-600 hover:text-violet-650 border border-slate-100 rounded-xl transition-all cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Calendar Week Headers */}
          <div className="grid grid-cols-7 gap-1 text-center border-b border-slate-100 pb-3 text-xs font-black text-slate-400 uppercase">
            <div>Min</div>
            <div>Sen</div>
            <div>Sel</div>
            <div>Rab</div>
            <div>Kam</div>
            <div>Jum</div>
            <div>Sab</div>
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 gap-1.5 mt-3 flex-1">
            {loading ? (
              <div className="col-span-7 py-24 text-center text-slate-400 font-semibold text-xs animate-pulse">
                Memuat data riwayat absensi...
              </div>
            ) : (
              calendarCells.map((cell, idx) => {
                const record = getAttendanceForDay(cell);
                const cellBgClass = getStatusColor(record?.status);

                return (
                  <div
                    key={idx}
                    className={`
                      min-h-[60px] sm:min-h-[75px] border rounded-2xl p-2 flex flex-col justify-between transition-all duration-200 relative group
                      ${!cell.isCurrentMonth ? 'opacity-30 border-slate-50/50 bg-slate-50/20 text-slate-350' : 'border-slate-100'}
                      ${cellBgClass}
                    `}
                  >
                    <span className="text-xs font-bold leading-none">{cell.day}</span>
                    
                    {/* Status Badge Tag */}
                    {record && (
                      <span className="text-[8px] font-black uppercase tracking-wider block mt-auto truncate" title={record.status}>
                        {record.status}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Legend helper info */}
          <div className="flex flex-wrap gap-4 mt-5 text-[10px] text-slate-400 font-bold select-none border-t border-slate-100 pt-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md border border-emerald-200 bg-emerald-50" />
              <span>Hadir (Presensi)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md border border-amber-200 bg-amber-50" />
              <span>Izin / Sakit</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-md border border-rose-200 bg-rose-50" />
              <span>Alpa (Tanpa Keterangan)</span>
            </div>
          </div>
        </div>

        {/* Right Card: History table log list */}
        <div className="w-full xl:w-96 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm flex flex-col select-none max-h-[500px]">
          <h2 className="text-base font-black text-slate-800 tracking-tight mb-4">
            Log Riwayat Rinci
          </h2>

          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-10 bg-slate-100 rounded-xl" />
              <div className="h-10 bg-slate-100 rounded-xl" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex-1 py-16 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xs font-black text-slate-700">Log Kosong</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-1">
                {searchQuery ? 'Hasil pencarian absensi nihil.' : 'Belum ada pencatatan riwayat absensi.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {filteredHistory.map((item) => (
                <div key={item.id} className="border border-slate-100 rounded-2xl p-4 shadow-sm space-y-2 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#7047EB] font-black">{formatDate(item.date)}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider
                      ${item.status === 'Hadir' ? 'bg-emerald-50 text-emerald-700' : item.status === 'Alpa' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}
                    `}>
                      {item.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate">{item.subjectName}</span>
                  </div>
                  
                  {item.notes && (
                    <p className="text-[9px] text-slate-400 font-semibold leading-tight">
                      Keterangan: {item.notes}
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
      <div className="p-8 bg-red-50 border border-red-200 rounded-3xl text-red-750 font-sans max-w-2xl mx-auto my-12 shadow-sm">
        <h2 className="font-black text-base flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-500" />
          Terjadi Kesalahan Render
        </h2>
        <p className="text-xs font-bold text-slate-500 mt-1">Kami mendeteksi adanya error saat memproses tampilan Absensi:</p>
        <pre className="mt-4 text-[10px] font-mono bg-white p-4 rounded-2xl border border-red-100 overflow-auto max-h-60 leading-relaxed text-red-650">{err.stack || err.message || String(err)}</pre>
        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer">
          Segarkan Halaman
        </button>
      </div>
    );
  }
};

export default AttendancePage;
