import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import StatCard from './components/StatCard';
import { 
  BookOpen, 
  ListTodo, 
  Star, 
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

      {/* Metrics cards row (Cleared mockup totals - setting to empty placeholders as requested) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div onClick={() => handleStatCardClick('Total Courses')} className="cursor-pointer">
          <StatCard
            title="Total Courses"
            value="0"
            subtext="This Semester"
            icon={BookOpen}
            iconBg="bg-[#F1EEFF] text-[#7047EB]"
          />
        </div>
        <div onClick={() => handleStatCardClick('To-Do')} className="cursor-pointer">
          <StatCard
            title="To-Do"
            value="0"
            subtext="Assignment"
            icon={ListTodo}
            iconBg="bg-amber-50 text-amber-500"
          />
        </div>
        <div onClick={() => handleStatCardClick('Avg Score')} className="cursor-pointer">
          <StatCard
            title="Avg Score"
            value="—"
            subtext="Overall"
            icon={Star}
            iconBg="bg-emerald-50 text-emerald-600"
          />
        </div>
        <div onClick={() => handleStatCardClick('New Materials')} className="cursor-pointer">
          <StatCard
            title="New Materials"
            value="0"
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
        <ActiveAssessment showToast={showToast} />

        {/* Row 2 Widgets */}
        <CourseProgress showToast={showToast} />
        <SchoolAnnouncement showToast={showToast} />
      </div>

    </div>
  );
};

export default StudentDashboard;
