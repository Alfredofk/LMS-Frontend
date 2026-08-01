import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Users, 
  GraduationCap, 
  CheckSquare, 
  AlertTriangle, 
  User, 
  ArrowRight,
  TrendingUp,
  X,
  Award
} from 'lucide-react';

export const HomeroomDashboard = () => {
  const { showToast } = useOutletContext();
  const [students, setStudents] = useState([]);
  const [classInfo, setClassInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected student for detail report modal
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentReport, setStudentReport] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  const fetchHomeroomData = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch class info first
      const classRes = await fetch('/api/homeroom/class', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!classRes.ok) throw new Error('Gagal memuat informasi kelas perwalian.');
      const classData = await classRes.json();
      
      if (!classData.isHomeroomTeacher) {
        throw new Error('Anda tidak terdaftar sebagai Wali Kelas untuk kelas mana pun.');
      }
      setClassInfo(classData.classInfo);

      // Fetch students list with metrics
      const studentsRes = await fetch('/api/homeroom/students', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!studentsRes.ok) throw new Error('Gagal memuat rekap murid kelas perwalian.');
      const studentsData = await studentsRes.json();
      
      setStudents(studentsData);
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeroomData();
  }, []);

  const handleViewReport = async (student) => {
    setSelectedStudent(student);
    try {
      setIsLoadingReport(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/homeroom/student/${student.id}/report`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Gagal memuat detail rapor siswa.');
      }

      const data = await response.json();
      setStudentReport(data);
      setIsLoadingReport(false);
    } catch (err) {
      console.error(err);
      showToast(err.message, 'error');
      setSelectedStudent(null);
      setIsLoadingReport(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 text-left animate-pulse select-none w-full">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="h-32 bg-white border border-slate-100 rounded-3xl"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-semibold select-none text-left w-full">
        <div>
          <p className="font-bold">Akses Ditolak</p>
          <p className="text-red-650 font-medium mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  // Calculate averages & warning counts
  const totalStudents = students.length;
  const rawGrades = students.map(s => s.averageGrade).filter(g => g !== null);
  const classAvgGrade = rawGrades.length > 0 ? Math.round(rawGrades.reduce((a, b) => a + b, 0) / rawGrades.length) : '—';
  
  const classAvgAttendance = totalStudents > 0 
    ? Math.round(students.reduce((acc, curr) => acc + curr.attendanceRate, 0) / totalStudents) 
    : 100;
    
  const studentsAtRisk = students.filter(s => s.warning).length;

  return (
    <div className="space-y-6 w-full text-left">
      
      {/* 1. Header Block */}
      <div className="space-y-1 select-none">
        <span className="px-2.5 py-1 bg-purple-100 text-[#7047EB] text-xs font-black rounded-lg uppercase">
          Dasbor Wali Kelas
        </span>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mt-2">
          Kelas Perwalian: {classInfo?.name}
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          Pantau perkembangan nilai akademik, statistik presensi kehadiran, serta deteksi dini anomali belajar murid.
        </p>
      </div>

      {/* 2. Overview cards grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 select-none">
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Murid</p>
            <p className="text-2xl font-black text-slate-805 mt-1">{totalStudents}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-650 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rata-Rata Kelas</p>
            <p className="text-2xl font-black text-slate-805 mt-1">{classAvgGrade}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-650 flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rerata Presensi</p>
            <p className="text-2xl font-black text-slate-805 mt-1">{classAvgAttendance}%</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-650 flex items-center justify-center">
            <CheckSquare className="w-5 h-5" />
          </div>
        </div>

        {/* Risk Alerts counts card */}
        <div className={`border rounded-2xl p-5 shadow-sm flex items-center justify-between transition-colors
          ${studentsAtRisk > 0 
            ? 'bg-rose-50/50 border-rose-100 text-rose-800' 
            : 'bg-white border-slate-100 text-slate-900'
          }
        `}>
          <div>
            <p className={`text-[10px] font-black uppercase tracking-wider ${studentsAtRisk > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
              Siswa Berisiko
            </p>
            <p className="text-2xl font-black mt-1">{studentsAtRisk}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center 
            ${studentsAtRisk > 0 ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Class Roster Monitoring Table */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-black text-slate-805 mb-4 select-none">
          Lembar Pemantauan Perkembangan Murid
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-medium text-slate-650">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-left">
                <th className="pb-3 font-black uppercase tracking-wider text-[10px]">Nama Siswa</th>
                <th className="pb-3 font-black uppercase tracking-wider text-[10px]">NIS</th>
                <th className="pb-3 font-black uppercase tracking-wider text-[10px]">Level / XP</th>
                <th className="pb-3 font-black uppercase tracking-wider text-[10px] text-center">Rerata Nilai</th>
                <th className="pb-3 font-black uppercase tracking-wider text-[10px] text-center">Tingkat Absensi</th>
                <th className="pb-3 font-black uppercase tracking-wider text-[10px]">Rekomendasi</th>
                <th className="pb-3 text-right font-black uppercase tracking-wider text-[10px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {students.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="py-3.5 font-extrabold text-slate-805">{row.name}</td>
                  <td className="py-3.5 text-slate-450 font-bold">{row.nis}</td>
                  <td className="py-3.5">
                    <span className="font-black text-slate-700">Lvl {row.level}</span>
                    <span className="text-[10px] font-bold text-slate-400 ml-1">({row.xp} XP)</span>
                  </td>
                  <td className="py-3.5 text-center font-black text-slate-850">
                    {row.averageGrade !== null ? (
                      <span className={`px-2 py-0.5 rounded-lg
                        ${row.averageGrade < 70 ? 'bg-red-50 text-red-650' : 'bg-slate-50 text-slate-700'}
                      `}>
                        {row.averageGrade}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-3.5 text-center font-black">
                    <span className={`px-2 py-0.5 rounded-lg
                      ${row.attendanceRate < 75 ? 'bg-amber-50 text-amber-650' : 'bg-slate-50 text-slate-700'}
                    `}>
                      {row.attendanceRate}%
                    </span>
                  </td>
                  
                  {/* Warning Anomalies Capsule */}
                  <td className="py-3.5">
                    {row.warning ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-50 text-red-600 border border-red-100">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {row.alertMessage}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-600 border border-emerald-100">
                        Normal
                      </span>
                    )}
                  </td>
                  
                  <td className="py-3.5 text-right">
                    <button
                      onClick={() => handleViewReport(row)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/50 text-[10px] font-black rounded-lg cursor-pointer transition-colors inline-flex items-center gap-1"
                    >
                      Lihat Rapor
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Student Detailed Report Modal View Dialog */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-start select-none">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-650 flex items-center justify-center font-black text-sm">
                  {selectedStudent.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                </div>
                <div className="text-left">
                  <h3 className="text-base font-black text-slate-805 leading-snug">
                    Rapor Perkembangan: {selectedStudent.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    NIS: {selectedStudent.nis} • Email: {selectedStudent.email}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedStudent(null); setStudentReport(null); }}
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
              {isLoadingReport ? (
                <div className="py-12 text-center animate-pulse">
                  <div className="h-6 bg-slate-200 rounded w-1/3 mx-auto mb-4"></div>
                  <div className="h-4 bg-slate-200 rounded w-2/3 mx-auto"></div>
                </div>
              ) : studentReport ? (
                <>
                  {/* Gamification stats row */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50/50 border border-slate-100 rounded-2xl p-4 select-none">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Level Belajar</span>
                      <span className="text-lg font-black text-slate-805 mt-1 block">Level {studentReport.student.level}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Pengalaman (XP)</span>
                      <span className="text-lg font-black text-slate-805 mt-1 block">{studentReport.student.xp} XP</span>
                    </div>
                  </div>

                  {/* Grades & Attendances list by Subject */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider select-none">
                      Nilai & Presensi per Mata Pelajaran
                    </h4>
                    
                    <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-xs font-medium text-slate-650">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-extrabold text-left">
                            <th className="py-2.5 px-4 font-black text-[10px]">Mata Pelajaran</th>
                            <th className="py-2.5 px-2 font-black text-[10px] text-center">Rata-Rata Nilai</th>
                            <th className="py-2.5 px-4 font-black text-[10px] text-center">Tingkat Absensi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {studentReport.subjects.map((sub, idx) => {
                            const isLowGrade = sub.averageGrade !== '—' && sub.averageGrade < 70;
                            const isLowAtt = sub.attendanceRate < 75;
                            return (
                              <tr key={idx} className="hover:bg-slate-50/20 transition-colors">
                                <td className="py-3 px-4 text-left">
                                  <div className="font-extrabold text-slate-805">{sub.name}</div>
                                  <div className="text-[10px] text-slate-400 font-bold">{sub.code}</div>
                                </td>
                                <td className="py-3 px-2 text-center font-black">
                                  <span className={`px-2 py-0.5 rounded-lg
                                    ${isLowGrade ? 'bg-red-50 text-red-650 font-black' : 'text-slate-800'}
                                  `}>
                                    {sub.averageGrade}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center font-black">
                                  <span className={`px-2 py-0.5 rounded-lg
                                    ${isLowAtt ? 'bg-amber-50 text-amber-650 font-black' : 'text-slate-800'}
                                  `}>
                                    {sub.attendanceRate}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Student Badges earned */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider select-none">
                      Lencana Penghargaan Unlocked ({studentReport.badges.length})
                    </h4>

                    {studentReport.badges.length === 0 ? (
                      <p className="text-xs text-slate-400 font-bold italic select-none">Belum memiliki lencana penghargaan.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {studentReport.badges.map((badge, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center gap-2 bg-slate-50 border border-slate-150 rounded-xl px-3 py-2 text-left"
                            title={badge.description}
                          >
                            <span className="text-base select-none">{badge.icon || '🏅'}</span>
                            <div>
                              <div className="text-xs font-black text-slate-805">{badge.name}</div>
                              <div className="text-[9px] text-slate-400 font-bold">Didapatkan: {new Date(badge.unlocked_at).toLocaleDateString('id-ID')}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs font-bold select-none">
                  Gagal memuat rekap laporan.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 flex justify-end select-none">
              <button
                onClick={() => { setSelectedStudent(null); setStudentReport(null); }}
                className="px-5 py-2.5 bg-slate-805 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-sm"
              >
                Tutup Rapor
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default HomeroomDashboard;
