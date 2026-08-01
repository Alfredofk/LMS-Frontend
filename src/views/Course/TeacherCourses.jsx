import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Calendar, Users, ArrowRight, AlertCircle, Search, Filter } from 'lucide-react';
import Button from '../../components/ui/Button';

export const TeacherCourses = () => {
  const { user } = useAuth();
  const { showToast } = useOutletContext();
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchCourses = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
        const response = await fetch('/api/courses', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('lms_user');
            navigate('/login');
            return;
          }
          throw new Error('Gagal mengambil data kelas dari server.');
        }

        const data = await response.json();
        if (isMounted) {
          setCourses(data);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Gagal memuat daftar kelas. Silakan coba lagi.');
          setIsLoading(false);
        }
      }
    };

    fetchCourses();
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  // Filter courses based on search query
  const filteredCourses = courses.filter(cls => 
    cls.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (cls.grade_level && cls.grade_level.toLowerCase().includes(searchQuery.toLowerCase())) ||
    cls.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleManageClass = (classId) => {
    navigate(`/teacher/courses/${classId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 text-left animate-pulse">
        <div className="space-y-2 select-none">
          <div className="h-8 bg-slate-200 rounded-lg w-1/3"></div>
          <div className="h-4 bg-slate-200 rounded-lg w-1/4"></div>
        </div>
        <div className="h-12 bg-slate-200 rounded-xl w-full max-w-md"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-5 h-44 shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-150 rounded-2xl flex items-center gap-3 text-red-700 text-sm font-semibold select-none text-left">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        <div>
          <p className="font-bold">Terjadi Kesalahan</p>
          <p className="text-xs text-red-605 font-medium mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="select-none">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">
          Daftar Mata Pelajaran
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 font-bold mt-1">
          Kelola semua kelas dan penugasan yang Anda ampu di {user?.schoolName || 'SMA Negeri 1 Harapan'}
        </p>
      </div>

      {/* Action Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between select-none">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama kelas atau kode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-[#7047EB] focus:ring-1 focus:ring-[#7047EB] outline-none text-xs font-semibold placeholder-slate-400 bg-white shadow-sm transition-all"
          />
        </div>
        
        <button 
          onClick={() => showToast && showToast('Filter urutan kelas dalam pengembangan.', 'info')}
          className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 text-slate-600 text-xs font-black rounded-xl hover:bg-slate-50 transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
        >
          <Filter className="w-4 h-4 text-slate-405" />
          Urutkan Kelas
        </button>
      </div>

      {/* Grid List */}
      {filteredCourses.length === 0 ? (
        <div className="py-20 text-center border border-dashed border-slate-100 rounded-3xl bg-white shadow-sm select-none">
          <BookOpen className="w-12 h-12 text-slate-305 mx-auto mb-3" />
          <p className="text-sm font-black text-slate-550">Tidak ada kelas yang ditemukan</p>
          <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((cls) => (
            <div 
              key={cls.id} 
              className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4 select-none"
            >
              <div className="space-y-1.5 text-left">
                <div className="flex justify-between items-start gap-1">
                  <span className="px-2 py-0.5 bg-purple-100 text-[#7047EB] text-[9px] font-black rounded-md uppercase">
                    {cls.grade_level || 'Umum'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    35 Siswa
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-slate-800 leading-snug">
                  {cls.name}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Kode: {cls.code}
                </p>
              </div>

              <Button
                onClick={() => handleManageClass(cls.id)}
                className="w-full py-2.5 rounded-xl font-bold bg-[#7047EB] hover:bg-[#5E3BD2] text-white shadow-sm text-xs cursor-pointer flex items-center justify-center gap-1"
              >
                Kelola Kelas
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherCourses;
