import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, FileText, UserCheck, AlertTriangle } from 'lucide-react';

export const AttendanceContent = ({ courseId, showToast }) => {
  const [summary, setSummary] = useState({ total: 0, hadir: 0, izin: 0, sakit: 0, alpa: 0, percentage: 100 });
  const [history, setHistory] = useState([]);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);
  const [todayStatus, setTodayStatus] = useState(null);
  
  const [excuseStatus, setExcuseStatus] = useState('Izin');
  const [notes, setNotes] = useState('');
  const [showExcuseForm, setShowExcuseForm] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAttendance = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/attendance/student/${courseId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Gagal memuat riwayat presensi.');
      }

      const data = await response.json();
      setSummary(data.summary);
      setHistory(data.history);
      setHasCheckedInToday(data.hasCheckedInToday);
      setTodayStatus(data.todayStatus);
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) {
      fetchAttendance();
    }
  }, [courseId]);

  const handleCheckIn = async () => {
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/attendance/student/${courseId}/checkin`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal check-in presensi.');
      }

      showToast(data.message, 'success');
      await fetchAttendance();
      setIsSubmitting(false);
    } catch (err) {
      showToast(err.message, 'error');
      setIsSubmitting(false);
    }
  };

  const handleExcuseSubmit = async (e) => {
    e.preventDefault();
    if (!notes.trim()) {
      showToast('Keterangan alasan izin wajib diisi.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/attendance/student/${courseId}/excuse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: excuseStatus, notes })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengirimkan izin.');
      }

      showToast(data.message, 'success');
      setNotes('');
      setShowExcuseForm(false);
      await fetchAttendance();
      setIsSubmitting(false);
    } catch (err) {
      showToast(err.message, 'error');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-10 text-center animate-pulse select-none bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="h-6 bg-slate-200 rounded w-1/4 mx-auto mb-4"></div>
        <div className="h-20 bg-slate-200 rounded w-3/4 mx-auto"></div>
      </div>
    );
  }

  // Helper status color capsule mapping
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Hadir':
        return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
      case 'Izin':
        return 'bg-amber-50 text-amber-600 border border-amber-100';
      case 'Sakit':
        return 'bg-blue-50 text-blue-600 border border-blue-100';
      case 'Alpa':
        return 'bg-rose-50 text-rose-600 border border-rose-100';
      default:
        return 'bg-slate-50 text-slate-600 border border-slate-100';
    }
  };

  return (
    <div className="space-y-6 text-left select-none">
      
      {/* 1. Header Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Sleek Gradient Percentage Card */}
        <div className="bg-gradient-to-br from-brand to-brand/70 text-white rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-100">
              Persentase Kehadiran
            </h4>
            <div className="text-4xl font-extrabold mt-2">
              {summary.percentage}%
            </div>
          </div>
          <p className="text-[10px] text-purple-100 font-semibold mt-4">
            Terhitung dari {summary.total} hari pertemuan aktif kelas.
          </p>
        </div>

        {/* Dynamic Check-in Panel */}
        <div className="md:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          {hasCheckedInToday ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-3">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-800">
                Absensi Hari Ini Terpenuhi
              </h4>
              <p className="text-xs text-slate-400 font-bold mt-1">
                Anda terdaftar sebagai <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${getStatusBadge(todayStatus)}`}>{todayStatus}</span> hari ini.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800">
                    Presensi Hari Ini
                  </h4>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Silakan lakukan check-in kehadiran atau ajukan surat izin hari ini.
                  </p>
                </div>
                <div className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Hari Ini
                </div>
              </div>

              {!showExcuseForm ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleCheckIn}
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-2 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold py-3 rounded-xl transition-all shadow-sm shadow-indigo-100 hover:shadow-md cursor-pointer disabled:opacity-50"
                  >
                    <UserCheck className="w-4 h-4" />
                    Check-In Hadir (+10 XP)
                  </button>
                  <button
                    onClick={() => setShowExcuseForm(true)}
                    className="px-5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-extrabold py-3 rounded-xl border border-slate-200/60 transition-colors cursor-pointer"
                  >
                    Ajukan Izin / Sakit
                  </button>
                </div>
              ) : (
                <form onSubmit={handleExcuseSubmit} className="space-y-3 pt-2 border-t border-slate-50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-extrabold text-slate-600">Status:</span>
                    <div className="flex gap-2">
                      {['Izin', 'Sakit'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setExcuseStatus(s)}
                          className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-colors cursor-pointer
                            ${excuseStatus === s
                              ? 'bg-slate-800 text-white shadow-sm'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/50'
                            }
                          `}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <textarea
                      placeholder="Masukkan alasan atau keterangan tidak masuk kelas..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors"
                      rows={2}
                      maxLength={150}
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setShowExcuseForm(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-1.5 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold rounded-lg cursor-pointer disabled:opacity-50"
                    >
                      Kirim Keterangan
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

      </div>

      {/* 2. Numeric Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Hadir', value: summary.hadir, bg: 'bg-emerald-50/50 text-emerald-500' },
          { label: 'Izin', value: summary.izin, bg: 'bg-amber-50/50 text-amber-500' },
          { label: 'Sakit', value: summary.sakit, bg: 'bg-blue-50/50 text-blue-500' },
          { label: 'Alpa', value: summary.alpa, bg: 'bg-rose-50/50 text-rose-500' }
        ].map((item, idx) => (
          <div key={idx} className="bg-white border border-slate-100 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</p>
              <p className="text-xl font-extrabold text-slate-800 mt-1">{item.value}</p>
            </div>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${item.bg}`}>
              {item.label[0]}
            </div>
          </div>
        ))}
      </div>

      {/* 3. History Logs List */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          Riwayat Kehadiran Kelas
        </h3>

        {history.length === 0 ? (
          <div className="py-8 text-center bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs font-semibold text-slate-400">Belum ada riwayat absensi untuk mata pelajaran ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-medium text-slate-600">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-left">
                  <th className="pb-3 font-extrabold uppercase tracking-wider text-[10px]">Tanggal Pertemuan</th>
                  <th className="pb-3 font-extrabold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="pb-3 font-extrabold uppercase tracking-wider text-[10px]">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="py-3.5 font-bold text-slate-800">{row.date}</td>
                    <td className="py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${getStatusBadge(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-3.5 text-slate-500 font-medium max-w-xs truncate" title={row.notes}>
                      {row.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default AttendanceContent;
