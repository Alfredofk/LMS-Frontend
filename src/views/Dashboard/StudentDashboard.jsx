import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import StatCard from './components/StatCard';
import { 
  BookOpen, 
  ListTodo, 
  Star, 
  AlertCircle,
  Inbox
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
        
        // Fetch stats, protests, announcements, and widgets in parallel
        const [statsRes, protestsRes, announcementsRes, widgetsRes] = await Promise.all([
          fetch('/api/student/stats', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/protests/student', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/announcements', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/announcements/student/dashboard-widgets', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (isMounted) setStats(statsData);
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
      navigate('/classroom', { state: { activeTab: 'tugas' } });
    } else if (statName === 'Total Courses') {
      navigate('/classroom');
    } else if (showToast) {
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
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full text-left">
      
      {/* Greeting Banner (Dynamic) */}
      <div className="select-none">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight capitalize">
          Selamat {getGreeting()}, {user?.name || 'Siswa'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-900 font-black mt-1">
          Semester Genap 2025/2026 · {getFormattedDate()}
        </p>
      </div>

      {/* Metrics cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div onClick={() => handleStatCardClick('Total Courses')} className="cursor-pointer">
          <StatCard
            title="Total Courses"
            value={stats.totalCourses.toString()}
            subtext="This Semester"
            icon={BookOpen}
            iconBg="bg-[#F1EEFF] text-[#7047EB]"
          />
        </div>
        <div onClick={() => handleStatCardClick('To-Do')} className="cursor-pointer">
          <StatCard
            title="To-Do"
            value={stats.totalTodo.toString()}
            subtext="Assignment"
            icon={ListTodo}
            iconBg="bg-amber-50 text-amber-500"
          />
        </div>
        <div onClick={() => handleStatCardClick('Avg Score')} className="cursor-pointer">
          <StatCard
            title="Avg Score"
            value={stats.avgScore}
            subtext="Overall"
            icon={Star}
            iconBg="bg-emerald-50 text-emerald-600"
          />
        </div>
        <div onClick={() => handleStatCardClick('New Materials')} className="cursor-pointer">
          <StatCard
            title="New Materials"
            value={stats.totalMaterials.toString()}
            subtext="New Materials"
            icon={AlertCircle}
            iconBg="bg-red-50 text-red-500"
          />
        </div>
      </div>

      {/* Widgets Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Row 1 Widgets */}
        <TodayActivities showToast={showToast} />
        <ActiveAssessment activeAssessments={activeAssessments} isLoading={isLoading} />

        {/* Row 2 Widgets */}
        <CourseProgress courseProgress={courseProgress} isLoading={isLoading} />
        <SchoolAnnouncement announcements={schoolAnnouncements} isLoading={isLoading} />

        {/* Row 3 Widget: Grade Protests Tracker */}
        {protests.length > 0 && (
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <Inbox className="w-4 h-4 text-[#7047EB]" />
              Pelacakan Banding & Sanggahan Nilai
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {protests.slice(0, 4).map(p => (
                <div key={p.id} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50 flex flex-col justify-between space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{p.assignment_title}</h4>
                      <span className="text-[10px] text-slate-400 font-semibold">Diajukan: {new Date(p.created_at).toLocaleDateString('id-ID')}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-black
                      ${p.status === 'Pending' ? 'bg-amber-100 text-amber-700' : p.status === 'Disetujui' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}
                    `}>
                      {p.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold space-y-1">
                    <p>Nilai Asli: <strong className="text-slate-700">{p.original_grade}</strong> → Harapan: <strong className="text-[#7047EB]">{p.requested_grade}</strong></p>
                    <p className="italic text-slate-400">"{p.reason}"</p>
                    {p.teacher_feedback && (
                      <p className="text-slate-650 border-t border-slate-200/60 pt-1.5 mt-1.5">
                        <strong>Review Guru:</strong> "{p.teacher_feedback}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default StudentDashboard;
