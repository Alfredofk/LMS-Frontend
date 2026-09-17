import React, { useState, useEffect } from 'react';
<<<<<<< HEAD
import { useOutletContext, useNavigate } from 'react-router-dom';
import React from 'react';
=======
>>>>>>> feat/frontend-course
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import StatCard from './components/StatCard';
import { 
  BookOpen, 
  ListTodo, 
  Star, 
  AlertCircle,
  Inbox
  AlertCircle 
} from 'lucide-react';
import { 
  TodayActivities, 
  ActiveAssessment, 
  CourseProgress, 
  SchoolAnnouncement 
} from './components/Widgets';

export const StudentDashboard = () => {
  const { user } = useAuth();
  const { showToast } = useOutletContext();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalCourses: 0,
    totalTodo: 0,
    avgScore: '—',
    totalMaterials: 0
  });
  const [todayActivities, setTodayActivities] = useState([]);
  const [protests, setProtests] = useState([]);
  const [activeAssessments, setActiveAssessments] = useState([]);
  const [courseProgress, setCourseProgress] = useState([]);
  const [schoolAnnouncements, setSchoolAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    const fetchStudentData = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Fetch stats, schedule, protests, announcements, and widgets in parallel
        const [statsRes, scheduleRes, protestsRes, announcementsRes, widgetsRes] = await Promise.all([
          fetch('/api/student/stats', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/schedule/student', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/protests/student', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/announcements', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/announcements/student/dashboard-widgets', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (isMounted) setStats(statsData);
        }

        if (scheduleRes.ok) {
          const scheduleData = await scheduleRes.json();
          if (isMounted) {
            const todayDayOfWeek = new Date().getDay();
            // Filter weekly schedules for today
            const todayClasses = scheduleData.weeklySchedules?.filter(s => s.dayOfWeek === todayDayOfWeek) || [];
            setTodayActivities(todayClasses);
          }
        }

        if (protestsRes.ok) {
          const protestsData = await protestsRes.json();
          if (isMounted) setProtests(protestsData);
        }

        if (announcementsRes.ok) {
          const announcementsData = await announcementsRes.json();
          if (isMounted) setSchoolAnnouncements(announcementsData);
        }

        if (widgetsRes.ok) {
          const widgetsData = await widgetsRes.json();
          if (isMounted) {
            setActiveAssessments(widgetsData.activeAssessments || []);
            setCourseProgress(widgetsData.courseProgress || []);
          }
        }

        if (isMounted) setIsLoading(false);
      } catch (err) {
        console.error('Fetch Student Stats/Protests/Announcements/Widgets Error:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    fetchStudentData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleStatCardClick = (statName) => {
    if (statName === 'To-Do') {
      navigate('/assessment');
    } else if (statName === 'Total Courses') {
      navigate('/classroom');
    } else if (statName === 'Avg Score') {
      navigate('/scores');
    } else if (statName === 'New Materials') {
      navigate('/classroom');

  // 1. State Management Setup
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // 2. Asynchronous API Data Fetching Simulation
  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Simulate a 1.5 second server communication delay
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        if (isMounted) {
          // Dynamic dashboard data payload
          setData({
            stats: {
              totalCourses: '0',
              todoCount: '0',
              avgScore: '—',
              newMaterials: '0'
            }
          });
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError('Gagal memuat data dashboard. Silakan coba beberapa saat lagi.');
          setIsLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleStatCardClick = (statName) => {
    if (showToast) {
      showToast(`Statistik detail "${statName}" sedang dalam proses pengerjaan (On Progress).`, 'info');
    }
  };

  // Get dynamic greeting based on Indonesian time standards
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'pagi';
    if (hour >= 12 && hour < 15) return 'siang';
    if (hour >= 15 && hour < 19) return 'sore';
    return 'malam';
  };

  // Get dynamic Indonesian formatted date
  const getFormattedDate = () => {
    return new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

<<<<<<< HEAD
  if (isLoading) {
    return (
      <div className="space-y-6 text-left animate-pulse select-none w-full">
        <div className="h-8 bg-slate-200 rounded w-1/3"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-5 h-28 shadow-sm"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-white border border-slate-100 rounded-2xl"></div>
          <div className="h-64 bg-white border border-slate-100 rounded-2xl"></div>
=======
  // ==========================================
  // CONDITIONAL RENDERING: Loading (Skeleton)
  // ==========================================
  if (isLoading) {
    return (
      <div className="space-y-6 text-left animate-pulse">
        {/* Banner Skeleton */}
        <div className="space-y-2 select-none">
          <div className="h-8 bg-slate-200 rounded-lg w-2/3 md:w-1/3"></div>
          <div className="h-4 bg-slate-200 rounded-lg w-1/2 md:w-1/4"></div>
        </div>

        {/* Stats Cards Skeleton row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-6 h-32 flex items-center justify-between shadow-sm">
              <div className="space-y-2.5 w-1/2">
                <div className="h-3 bg-slate-200 rounded w-3/4"></div>
                <div className="h-6 bg-slate-200 rounded w-1/2"></div>
                <div className="h-3 bg-slate-200 rounded w-2/3"></div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-slate-200 shrink-0"></div>
            </div>
          ))}
        </div>

        {/* Widgets Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((idx) => (
            <div key={idx} className="bg-white border border-slate-100 rounded-2xl p-6 h-60 shadow-sm space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                <div className="h-4 bg-slate-200 rounded w-1/6"></div>
              </div>
              <div className="space-y-3 pt-2">
                <div className="h-3.5 bg-slate-200 rounded w-full"></div>
                <div className="h-3.5 bg-slate-200 rounded w-5/6"></div>
                <div className="h-3.5 bg-slate-200 rounded w-4/5"></div>
              </div>
            </div>
          ))}
>>>>>>> feat/frontend-course
        </div>
      </div>
    );
  }

<<<<<<< HEAD
  return (
    <div className="space-y-6 w-full text-left">
      
      {/* Greeting Banner (Dynamic with real user name) */}
      <div className="select-none">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
          Selamat {getGreeting()}, {user?.name || 'Siswa'}
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
=======
  // ==========================================
  // CONDITIONAL RENDERING: Error State
  // ==========================================
  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-150 rounded-2xl flex items-center gap-3 text-red-700 text-sm font-semibold select-none text-left">
        <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
        <div>
          <p className="font-bold">Terjadi Kesalahan</p>
          <p className="text-xs text-red-600 font-medium mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // CONDITIONAL RENDERING: Success State
  // ==========================================
>>>>>>> feat/frontend-course
  return (
    <div className="space-y-6">
      
      {/* Greeting Banner (Dynamic) */}
      <div className="select-none text-left">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight capitalize">
          Selamat {getGreeting()}, {user?.name || 'Siswa'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-900 font-black mt-1">
          Semester Genap 2025/2026 · {getFormattedDate()}
        </p>
      </div>

      {/* Metrics cards row (Wired to dynamic API data state) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div onClick={() => handleStatCardClick('Total Courses')} className="cursor-pointer">
          <StatCard
            title="Total Courses"
            value={data?.stats?.totalCourses || '0'}
            subtext="This Semester"
            icon={BookOpen}
            iconBg="bg-[#F1EEFF] text-[#7047EB]"
          />
        </div>
        <div onClick={() => handleStatCardClick('To-Do')} className="cursor-pointer">
          <StatCard
            title="To-Do"
            value={data?.stats?.todoCount || '0'}
            subtext="Assignment"
            icon={ListTodo}
            iconBg="bg-amber-50 text-amber-500"
          />
        </div>
        <div onClick={() => handleStatCardClick('Avg Score')} className="cursor-pointer">
          <StatCard
            title="Avg Score"
            value={data?.stats?.avgScore || '—'}
            subtext="Overall"
            icon={Star}
            iconBg="bg-emerald-50 text-emerald-600"
          />
        </div>
        <div onClick={() => handleStatCardClick('New Materials')} className="cursor-pointer">
          <StatCard
            title="New Materials"
            value={data?.stats?.newMaterials || '0'}
            subtext="New Materials"
            icon={AlertCircle}
            iconBg="bg-red-50 text-red-500"
          />
        </div>
      </div>

      {/* Widgets Section Grid (2x2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Row 1 Widgets */}
        <TodayActivities activities={todayActivities} isLoading={isLoading} />
        <ActiveAssessment activeAssessments={activeAssessments} isLoading={isLoading} />

        {/* Row 2 Widgets */}
        <CourseProgress courseProgress={courseProgress} isLoading={isLoading} />
        <SchoolAnnouncement announcements={schoolAnnouncements} isLoading={isLoading} />

        {/* Row 3 Widget: Grade Protests Tracker (if any exist) */}
        {protests.length > 0 && (
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <Inbox className="w-4 h-4 text-[#7047EB]" />
              Pelacakan Banding & Sanggahan Nilai
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {protests.slice(0, 4).map(p => (
                <div key={p.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50/40 flex flex-col justify-between space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{p.assignment_title}</h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Diajukan: {new Date(p.created_at).toLocaleDateString('id-ID')}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold
                      ${p.status === 'Pending' ? 'bg-amber-100 text-amber-700' : p.status === 'Disetujui' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
                    `}>
                      {p.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium space-y-1">
                    <p>Nilai Asli: <strong className="text-slate-700">{p.original_grade}</strong> → Harapan: <strong className="text-[#7047EB]">{p.requested_grade}</strong></p>
                    <p className="italic text-slate-400">"{p.reason}"</p>
                    {p.teacher_feedback && (
                      <p className="text-slate-600 border-t border-slate-100 pt-1.5 mt-1.5">
                        <strong>Review Guru:</strong> "{p.teacher_feedback}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      {/* Widgets Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Row 1 Widgets */}
        <TodayActivities showToast={showToast} />
        <ActiveAssessment showToast={showToast} />

        {/* Row 2 Widgets */}
        <CourseProgress showToast={showToast} />
        <SchoolAnnouncement showToast={showToast} />
      </div>

    </div>
  );
};

export default StudentDashboard;
