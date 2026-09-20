import React, { useState, useEffect } from 'react';
import { Calendar, Save, CheckCircle, HelpCircle, FileText } from 'lucide-react';

export const AttendanceManagement = ({ courseId, showToast }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendances, setAttendances] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchAttendanceRekap = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/attendance/teacher/${courseId}?date=${selectedDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Gagal memuat rekap absensi.');
      }

      const data = await response.json();
      setAttendances(data.attendances);
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (courseId && selectedDate) {
      fetchAttendanceRekap();
    }
  }, [courseId, selectedDate]);

  const handleStatusChange = (studentId, newStatus) => {
    setAttendances(prev => 
      prev.map(item => 
        item.id === studentId ? { ...item, status: newStatus } : item
      )
    );
  };

  const handleNotesChange = (studentId, newNotes) => {
    setAttendances(prev => 
      prev.map(item => 
        item.id === studentId ? { ...item, notes: newNotes } : item
      )
    );
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('token');
      
      const payload = {
        date: selectedDate,
        attendances: attendances.map(a => ({
          studentId: a.id,
          status: a.status,
          notes: a.notes
        }))
      };

      const response = await fetch(`/api/attendance/teacher/${courseId}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyimpan absensi.');
      }

      showToast(data.message, 'success');
      await fetchAttendanceRekap();
      setIsSaving(false);
    } catch (err) {
      showToast(err.message, 'error');
      setIsSaving(false);
    }
  };

  // Helper counts for stats summary
  const counts = attendances.reduce((acc, curr) => {
    if (curr.status === 'Hadir') acc.hadir++;
    else if (curr.status === 'Izin') acc.izin++;
    else if (curr.status === 'Sakit') acc.sakit++;
    else if (curr.status === 'Alpa') acc.alpa++;
    return acc;
  }, { hadir: 0, izin: 0, sakit: 0, alpa: 0 });

  if (isLoading) {
    return (
      <div className="py-10 text-center animate-pulse select-none bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="h-6 bg-slate-200 rounded w-1/4 mx-auto mb-4"></div>
        <div className="h-20 bg-slate-200 rounded w-3/4 mx-auto"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left select-none">
      
      {/* 1. Date Picker & Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-slate-500" />
          <span className="text-xs font-extrabold text-slate-700">Tanggal Rekap:</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-xs font-extrabold border border-slate-200 focus:border-brand focus:outline-none px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center justify-center gap-2 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-indigo-100 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Menyimpan...' : 'Simpan Presensi Kelas'}
        </button>
      </div>

      {/* 2. Rekap Stats summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Hadir', value: counts.hadir, bg: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
          { label: 'Izin', value: counts.izin, bg: 'bg-amber-50 text-amber-600 border border-amber-100' },
          { label: 'Sakit', value: counts.sakit, bg: 'bg-blue-50 text-blue-600 border border-blue-100' },
          { label: 'Alpa', value: counts.alpa, bg: 'bg-rose-50 text-rose-600 border border-rose-100' }
        ].map((item, idx) => (
          <div key={idx} className={`rounded-xl p-4 flex items-center justify-between shadow-sm ${item.bg}`}>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">{item.label}</p>
              <p className="text-2xl font-extrabold mt-1">{item.value}</p>
            </div>
            <span className="text-lg font-extrabold">{item.label[0]}</span>
          </div>
        ))}
      </div>

      {/* 3. Student Attendances Table */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        {attendances.length === 0 ? (
          <div className="py-8 text-center bg-slate-50/30 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs font-semibold text-slate-400">Tidak ada siswa terdaftar di kelas ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-medium text-slate-600">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-left">
                  <th className="pb-3 font-extrabold uppercase tracking-wider text-[10px]">Nama Siswa</th>
                  <th className="pb-3 font-extrabold uppercase tracking-wider text-[10px]">NIS</th>
                  <th className="pb-3 font-extrabold uppercase tracking-wider text-[10px] text-center">Status Kehadiran</th>
                  <th className="pb-3 font-extrabold uppercase tracking-wider text-[10px]">Keterangan Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {attendances.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="py-4 font-extrabold text-slate-800">{row.name}</td>
                    <td className="py-4 text-slate-400 font-bold">{row.nis}</td>
                    
                    {/* Interactive Capsule Toggles */}
                    <td className="py-4 text-center">
                      <div className="inline-flex gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-100">
                        {[
                          { key: 'Hadir', active: 'bg-emerald-500 text-white shadow-sm font-extrabold' },
                          { key: 'Izin', active: 'bg-amber-500 text-white shadow-sm font-extrabold' },
                          { key: 'Sakit', active: 'bg-blue-500 text-white shadow-sm font-extrabold' },
                          { key: 'Alpa', active: 'bg-rose-500 text-white shadow-sm font-extrabold' }
                        ].map((btn) => {
                          const isSelected = row.status === btn.key;
                          return (
                            <button
                              key={btn.key}
                              type="button"
                              onClick={() => handleStatusChange(row.id, btn.key)}
                              className={`px-3 py-1 text-[10px] rounded-lg cursor-pointer transition-all focus:outline-none
                                ${isSelected 
                                  ? btn.active 
                                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                                }
                              `}
                            >
                              {btn.key}
                            </button>
                          );
                        })}
                      </div>
                    </td>

                    {/* Excuse Notes Input */}
                    <td className="py-4">
                      <input
                        type="text"
                        placeholder="Keterangan singkat..."
                        value={row.notes}
                        onChange={(e) => handleNotesChange(row.id, e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-100 focus:border-brand focus:outline-none px-3 py-1.5 rounded-xl transition-colors bg-slate-50/30"
                      />
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

export default AttendanceManagement;
