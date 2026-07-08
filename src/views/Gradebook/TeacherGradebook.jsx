import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Save, Filter, AlertCircle, CheckCircle, GraduationCap } from 'lucide-react';
import Button from '../../components/ui/Button';

export const TeacherGradebook = () => {
  const { showToast } = useOutletContext();

  // 1. Setup API-Ready State Management
  const [studentsData, setStudentsData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('Semua');

  // 2. Simulated Asynchronous API Fetching
  useEffect(() => {
    let isMounted = true;
    
    const fetchGradebook = async () => {
      try {
        setIsLoading(true);
        // Simulate a 1.5-second network request delay
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        if (isMounted) {
          // Dynamic student grade list payload
          setStudentsData([
            { id: 1, name: 'Andi Rahmat', nis: '20261005', tugas1: 85, tugas2: 80, uts: 78 },
            { id: 2, name: 'Siti Rahma', nis: '20261006', tugas1: 90, tugas2: 92, uts: 88 },
            { id: 3, name: 'Budi Santoso', nis: '20261007', tugas1: 70, tugas2: 65, uts: 75 },
            { id: 4, name: 'Ratna Sari', nis: '20261008', tugas1: 82, tugas2: 80, uts: 85 },
            { id: 5, name: 'Fajar Utama', nis: '20261009', tugas1: 60, tugas2: 62, uts: 55 }
          ]);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError('Gagal memuat data buku nilai. Silakan coba kembali.');
          setIsLoading(false);
        }
      }
    };

    fetchGradebook();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update specific student score on input change
  const handleScoreChange = (studentId, field, val) => {
    // Parse value between 0 and 100 or default to empty
    let numVal = val === '' ? '' : Math.min(100, Math.max(0, parseInt(val) || 0));

    setStudentsData(prev => 
      prev.map(student => {
        if (student.id === studentId) {
          return {
            ...student,
            [field]: numVal
          };
        }
        return student;
      })
    );
  };

  // Trigger Save Updates
  const handleSaveData = () => {
    showToast('Menyimpan perubahan buku nilai ke database...', 'info');
    setTimeout(() => {
      showToast('Perubahan buku nilai berhasil disimpan!', 'success');
    }, 800);
  };

  // Helper to calculate total average
  const calculateFinalAverage = (student) => {
    const t1 = student.tugas1 === '' ? 0 : student.tugas1;
    const t2 = student.tugas2 === '' ? 0 : student.tugas2;
    const ut = student.uts === '' ? 0 : student.uts;
    return Math.round((t1 + t2 + ut) / 3);
  };

  // ==========================================
  // CONDITIONAL RENDERING: Table Rows Skeleton
  // ==========================================
  if (isLoading) {
    return (
      <div className="space-y-6 text-left animate-pulse w-full">
        {/* Header Block skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div className="space-y-2">
            <div className="h-7 bg-slate-200 rounded-lg w-72"></div>
            <div className="h-4 bg-slate-200 rounded-lg w-48"></div>
          </div>
          <div className="h-10 bg-slate-200 rounded-xl w-36 self-end sm:self-auto"></div>
        </div>

        {/* Filters skeleton */}
        <div className="h-10 bg-slate-200 rounded-xl w-48"></div>

        {/* Table skeleton */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <div className="space-y-3">
            <div className="h-8 bg-slate-100 rounded-lg w-full"></div>
            {[1, 2, 3, 4, 5].map((idx) => (
              <div key={idx} className="h-12 bg-slate-50 rounded-lg w-full flex items-center justify-between px-4">
                <div className="h-3.5 bg-slate-200 rounded w-8"></div>
                <div className="h-3.5 bg-slate-200 rounded w-32"></div>
                <div className="h-3.5 bg-slate-200 rounded w-16"></div>
                <div className="h-8 bg-slate-200 rounded w-14"></div>
                <div className="h-8 bg-slate-200 rounded w-14"></div>
                <div className="h-8 bg-slate-200 rounded w-14"></div>
                <div className="h-3.5 bg-slate-200 rounded w-10"></div>
                <div className="h-6 bg-slate-200 rounded w-16"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // CONDITIONAL RENDERING: Error State
  // ==========================================
  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-150 rounded-2xl flex items-center gap-3 text-red-700 text-sm font-semibold select-none text-left w-full">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        <div>
          <p className="font-bold">Terjadi Kesalahan</p>
          <p className="text-xs text-red-600 font-medium mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left w-full">
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-[#7047EB]" />
            Buku Nilai (Gradebook)
          </h1>
          <p className="text-xs font-semibold text-slate-500">
            Matematika Lanjut · Kelas XII IPA 2
          </p>
        </div>

        <Button
          onClick={handleSaveData}
          className="bg-[#7047EB] hover:bg-[#5E3BD2] text-white py-2.5 px-5 rounded-xl font-bold shadow-md shadow-violet-500/10 cursor-pointer text-xs flex items-center justify-center gap-1.5 self-end sm:self-auto"
        >
          <Save className="w-4 h-4" />
          Simpan Perubahan
        </Button>
      </div>

      {/* 2. Filter Dropdown Area */}
      <div className="flex flex-wrap items-center gap-3 select-none">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
          <Filter className="w-4 h-4 text-slate-400" />
          <span>Jenis Penilaian:</span>
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="text-xs font-black text-slate-800 border border-slate-200 rounded-xl px-3.5 py-2 bg-white focus:outline-none focus:border-[#7047EB] transition-colors cursor-pointer shadow-sm"
        >
          <option value="Semua">Semua Penilaian</option>
          <option value="Tugas Harian">Tugas Harian (Tugas 1 & 2)</option>
          <option value="UTS">Ujian Tengah Semester (UTS)</option>
          <option value="UAS">Ujian Akhir Semester (UAS)</option>
        </select>
      </div>

      {/* 3. Responsive Interactive Gradebook Table Card */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 p-6 select-none overflow-hidden">
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-xs text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 font-black text-slate-800">
                <th className="p-4 pl-5 w-12 text-center">No</th>
                <th className="p-4">Nama Siswa</th>
                <th className="p-4 w-28">NIS</th>
                <th className="p-4 w-24 text-center">Tugas 1</th>
                <th className="p-4 w-24 text-center">Tugas 2</th>
                <th className="p-4 w-24 text-center">UTS</th>
                <th className="p-4 w-28 text-center bg-slate-50/50">Total Akhir</th>
                <th className="p-4 pl-6 w-32 bg-slate-50/50">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
              {studentsData.map((student, idx) => {
                const finalAvg = calculateFinalAverage(student);
                const isPass = finalAvg >= 75;

                return (
                  <tr key={student.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="p-4 pl-5 text-center text-slate-450 font-bold">{idx + 1}</td>
                    <td className="p-4 font-bold text-slate-805">{student.name}</td>
                    <td className="p-4 text-slate-450 font-bold">{student.nis}</td>
                    
                    {/* Tugas 1 Cell */}
                    <td className="p-4 text-center">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        disabled={filterType === 'UTS' || filterType === 'UAS'}
                        value={student.tugas1}
                        onChange={(e) => handleScoreChange(student.id, 'tugas1', e.target.value)}
                        className={`w-16 border rounded-lg px-2 py-1.5 text-center font-black focus:outline-none focus:border-[#7047EB] bg-white transition-all
                          ${student.tugas1 < 75 ? 'text-red-600 border-red-200 bg-red-50/10' : 'text-slate-800 border-slate-200'}
                          ${(filterType === 'UTS' || filterType === 'UAS') ? 'opacity-40 bg-slate-100 border-slate-100' : ''}
                        `}
                      />
                    </td>

                    {/* Tugas 2 Cell */}
                    <td className="p-4 text-center">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        disabled={filterType === 'UTS' || filterType === 'UAS'}
                        value={student.tugas2}
                        onChange={(e) => handleScoreChange(student.id, 'tugas2', e.target.value)}
                        className={`w-16 border rounded-lg px-2 py-1.5 text-center font-black focus:outline-none focus:border-[#7047EB] bg-white transition-all
                          ${student.tugas2 < 75 ? 'text-red-600 border-red-200 bg-red-50/10' : 'text-slate-800 border-slate-200'}
                          ${(filterType === 'UTS' || filterType === 'UAS') ? 'opacity-40 bg-slate-100 border-slate-100' : ''}
                        `}
                      />
                    </td>

                    {/* UTS Cell */}
                    <td className="p-4 text-center">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        disabled={filterType === 'Tugas Harian' || filterType === 'UAS'}
                        value={student.uts}
                        onChange={(e) => handleScoreChange(student.id, 'uts', e.target.value)}
                        className={`w-16 border rounded-lg px-2 py-1.5 text-center font-black focus:outline-none focus:border-[#7047EB] bg-white transition-all
                          ${student.uts < 75 ? 'text-red-600 border-red-200 bg-red-50/10' : 'text-slate-800 border-slate-200'}
                          ${(filterType === 'Tugas Harian' || filterType === 'UAS') ? 'opacity-40 bg-slate-100 border-slate-100' : ''}
                        `}
                      />
                    </td>

                    {/* Total Akhir Average (calculated dynamically) */}
                    <td className="p-4 text-center bg-slate-50/30">
                      <span className={`text-sm font-black px-2 py-1 rounded-lg
                        ${isPass ? 'text-slate-800' : 'text-red-600 bg-red-50/30'}
                      `}>
                        {finalAvg}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="p-4 pl-6 bg-slate-50/30">
                      {isPass ? (
                        <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-black rounded-md inline-flex items-center gap-1 uppercase select-none">
                          <CheckCircle className="w-3 h-3" />
                          Lulus
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-red-50 border border-red-100 text-red-500 text-[10px] font-black rounded-md inline-flex items-center gap-1 uppercase select-none">
                          <AlertCircle className="w-3 h-3 text-red-400" />
                          Remedial
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default TeacherGradebook;
