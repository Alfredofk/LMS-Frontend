import React, { useState, useEffect } from 'react';
import { AlertCircle, Users } from 'lucide-react';

import NotBuiltYet from '../../../components/ui/NotBuiltYet';
import { isNotBuiltYet } from '../../../services/apiClient';
import { coursesService } from '../../../services/coursesService';

export const StudentListTab = ({ courseId }) => {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notBuilt, setNotBuilt] = useState(false);

  useEffect(() => {
    let isMounted = true;

    /* The 401 branch that used to be here signed people out who were still
       signed in — see the note in TeacherCourses.jsx. apiClient refreshes and
       replays instead, and ProtectedRoute owns the redirect. */
    const fetchStudents = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await coursesService.students(courseId);
        if (isMounted) setStudents(data);
      } catch (err) {
        if (!isMounted) return;
        if (isNotBuiltYet(err)) setNotBuilt(true);
        else setError(err.message || 'Gagal memuat daftar siswa. Silakan coba lagi.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    if (courseId) {
      fetchStudents();
    }
    
    return () => {
      isMounted = false;
    };
  }, [courseId]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse select-none text-left">
        <div className="h-4 bg-slate-200 rounded w-1/4"></div>
        <div className="bg-white border border-slate-100 rounded-2xl p-6 h-48 shadow-sm">
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded w-full"></div>
            <div className="h-4 bg-slate-200 rounded w-5/6"></div>
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  /* Before the empty state: "no students enrolled" would be a claim about this
     class, and nobody has asked the database anything yet. */
  if (notBuilt) return <NotBuiltYet />;

  if (error) {
    return (
      <div className="p-5 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-semibold select-none text-left">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        <div>
          <p className="font-bold">Gagal Memuat Siswa</p>
          <p className="text-red-600 font-medium mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="py-16 text-center border border-dashed border-slate-200 rounded-3xl bg-slate-50/30 select-none">
        <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-extrabold text-slate-500">Belum ada siswa terdaftar</h3>
        <p className="text-xs text-slate-400 mt-1">Siswa harus mendaftar ke kelas ini terlebih dahulu.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-left">
      <div className="flex justify-between items-center select-none">
        <h2 className="text-sm font-extrabold text-slate-500 uppercase tracking-wider">
          Daftar Anggota Kelas
        </h2>
        <span className="text-xs text-slate-400 font-extrabold">
          {students.length} Siswa Terdaftar
        </span>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider border-b border-slate-100 select-none">
                <th className="py-3 px-6">Nama Siswa</th>
                <th className="py-3 px-6">NISN</th>
                <th className="py-3 px-6">Email</th>
                <th className="py-3 px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs text-slate-700 font-semibold">
              {students.map((stu) => (
                <tr key={stu.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3.5 px-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-brand flex items-center justify-center font-extrabold text-[10px]">
                      {stu.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <span>{stu.name}</span>
                  </td>
                  <td className="py-3.5 px-6 text-slate-400">
                    {stu.nis || '-'}
                  </td>
                  <td className="py-3.5 px-6 text-slate-400">
                    {stu.email}
                  </td>
                  <td className="py-3.5 px-6 text-center select-none">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-extrabold rounded-md uppercase">
                      Aktif
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StudentListTab;
