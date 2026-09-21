import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAccessToken } from '../../../services/apiClient';
import { 
  Search, 
  Star, 
  Users, 
  ArrowRight, 
  BookOpen, 
  AlertCircle 
} from 'lucide-react';

export const MyCoursesCatalog = ({ courses = [], isLoading, error }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Tab Filter state: 'all' | 'ongoing' | 'completed' | 'favourite'
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('my_favorite_courses');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [courseProgressMap, setCourseProgressMap] = useState({});

  // Sync search input with searchParams if needed
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null && q !== searchQuery) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  // Fetch course progress metrics to calculate real percentage for each course
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const token = getAccessToken();
        if (!token) return;
        const res = await fetch('/api/announcements/student/dashboard-widgets', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const map = {};
          if (data.courseProgress) {
            data.courseProgress.forEach(cp => {
              const total = parseInt(cp.total_tasks || 0, 10);
              const submitted = parseInt(cp.submitted_tasks || 0, 10);
              const percent = total > 0 ? Math.round((submitted / total) * 100) : 100;
              map[cp.class_subject_id] = { percent, total, submitted };
            });
          }
          setCourseProgressMap(map);
        }
      } catch (err) {
        console.error('Fetch progress error:', err);
      }
    };
    fetchProgress();
  }, []);

  // Handle toggle favorite
  const toggleFavorite = (e, courseId) => {
    e.stopPropagation();
    setFavorites(prev => {
      const updated = prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId];
      try {
        localStorage.setItem('my_favorite_courses', JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
  };

  // Helper to get progress percent for a course
  const getProgress = (course) => {
    if (courseProgressMap[course.id]) {
      return courseProgressMap[course.id].percent;
    }
    return course.progress !== undefined ? course.progress : 65;
  };

  // Filter courses based on active tab and search query
  const filteredCourses = courses.filter(course => {
    // 1. Search filter
    const matchesSearch = 
      (course.name && course.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (course.code && course.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (course.teacher_name && course.teacher_name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // 2. Tab filter
    const progress = getProgress(course);
    if (activeFilter === 'ongoing') {
      return progress < 100;
    }
    if (activeFilter === 'completed') {
      return progress >= 100;
    }
    if (activeFilter === 'favourite') {
      return favorites.includes(course.id);
    }
    return true; // 'all'
  });

  if (isLoading) {
    return (
      <div className="space-y-6 text-left select-none animate-pulse w-full">
        <div className="flex gap-3">
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className="h-8 w-24 bg-slate-200 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(idx => (
            <div key={idx} className="h-56 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700 text-xs font-semibold select-none text-left w-full">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        <div>
          <p className="font-bold">Gagal memuat mata pelajaran</p>
          <p className="text-red-600 font-medium mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full text-left select-none">
      
      {/* Top Filter Tabs Row (Pills) & Search bar on smaller screens */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm
              ${activeFilter === 'all'
                ? 'bg-brand text-white shadow-brand/20'
                : 'border border-brand text-brand bg-white hover:bg-purple-50/50'
              }
            `}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('ongoing')}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm
              ${activeFilter === 'ongoing'
                ? 'bg-brand text-white shadow-brand/20'
                : 'border border-brand text-brand bg-white hover:bg-purple-50/50'
              }
            `}
          >
            Ongoing
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('completed')}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm
              ${activeFilter === 'completed'
                ? 'bg-brand text-white shadow-brand/20'
                : 'border border-brand text-brand bg-white hover:bg-purple-50/50'
              }
            `}
          >
            Completed
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('favourite')}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shadow-sm
              ${activeFilter === 'favourite'
                ? 'bg-brand text-white shadow-brand/20'
                : 'border border-brand text-brand bg-white hover:bg-purple-50/50'
              }
            `}
          >
            Favourite
          </button>
        </div>

        {/* Search input (Fallback for mobile or fast search) */}
        <div className="relative sm:hidden w-full">
          <Search className="w-4 h-4 text-brand absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchParams(e.target.value ? { q: e.target.value } : {});
            }}
            placeholder="Cari mata pelajaran..."
            className="w-full bg-brand-tint text-slate-800 text-xs font-medium pl-10 pr-4 py-2 rounded-full focus:outline-none focus:ring-1 focus:ring-brand placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Courses Grid List (3 Columns) */}
      {filteredCourses.length === 0 ? (
        <div className="py-20 flex flex-col items-center justify-center text-center bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
          <BookOpen className="w-10 h-10 text-slate-300 mb-3" />
          <h3 className="text-sm font-bold text-slate-800">
            Tidak ada mata pelajaran yang ditemukan.
          </h3>
          <p className="text-xs text-slate-400 font-medium mt-1 max-w-sm leading-relaxed">
            {searchQuery 
              ? `Tidak ada hasil untuk pencarian "${searchQuery}". Coba kata kunci lain.` 
              : activeFilter === 'favourite'
                ? 'Anda belum menambahkan mata pelajaran ke daftar favorit.'
                : 'Belum ada mata pelajaran terdaftar pada kategori ini.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourses.map((course) => {
            const progress = getProgress(course);
            const isCompleted = progress >= 100;
            const isFav = favorites.includes(course.id);
            const materialsCount = course.materials_count || course.total_materials || 24;
            const studentsCount = course.students_count || course.total_students || 32;

            return (
              <div
                key={course.id}
                onClick={() => navigate(`/classroom/${course.id}`)}
                className="bg-white border border-slate-100/90 hover:border-purple-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md flex flex-col justify-between transition-all duration-200 cursor-pointer group relative overflow-hidden"
              >
                {/* Top Section */}
                <div>
                  {/* Header Row: Subject Name, Status Badge, and Favorite Star */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 pr-2">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-brand transition-colors truncate">
                        {course.name}
                      </h3>
                      <span className="text-xs font-semibold text-brand block mt-0.5 truncate">
                        {course.code || course.className || 'Calculus 1'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full
                        ${isCompleted
                          ? 'bg-[#EBFBF2] text-[#059669]'
                          : 'bg-brand-tint text-brand'
                        }
                      `}>
                        {isCompleted ? 'Completed' : 'Ongoing'}
                      </span>

                      {/* Favorite Star Button */}
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(e, course.id)}
                        className="p-1 rounded-full hover:bg-slate-50 text-slate-300 hover:text-amber-400 transition-colors"
                        title={isFav ? 'Hapus dari Favorit' : 'Tambah ke Favorit'}
                      >
                        <Star className={`w-4 h-4 transition-all ${isFav ? 'fill-amber-400 text-amber-400 scale-110' : 'text-slate-300'}`} />
                      </button>
                    </div>
                  </div>

                  {/* Teacher, Materials, and Graphic Illustration Box */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-[11px] text-slate-400 font-medium space-y-0.5">
                      <p className="truncate max-w-[140px]" title={course.teacher_name || course.teacher || 'Guru Pengampu'}>
                        {course.teacher_name || course.teacher || 'Guru Pengampu'}
                      </p>
                      <p>
                        {materialsCount} Materials
                      </p>
                    </div>

                    {/* Subject Icon / Math Graphic Illustration */}
                    <div className="w-13 h-13 rounded-2xl bg-brand-tint flex items-center justify-center shrink-0 text-brand shadow-inner">
                      <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="4" y="6" width="20" height="22" rx="4" fill="var(--color-brand)" fillOpacity="0.85" />
                        <rect x="8" y="3" width="12" height="5" rx="2" fill="#5C36DB" />
                        <path d="M10 14C12 14 12 20 14 20M10 17H14M16 14L20 20M20 14L16 20" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Middle Section: Progress Bar */}
                <div className="mt-4">
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300
                        ${isCompleted ? 'bg-emerald-500' : 'bg-brand'}
                      `}
                      style={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
                    />
                  </div>
                </div>

                {/* Bottom Section: Footer with Student Count & View Course */}
                <div className="border-t border-slate-50 pt-3 mt-3.5 flex items-center justify-between text-slate-400 text-[11px] font-medium">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{studentsCount} Students</span>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-brand group-hover:underline">
                    <span>View Course</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default MyCoursesCatalog;
