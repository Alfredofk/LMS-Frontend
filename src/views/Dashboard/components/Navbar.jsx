import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { classroomData } from '../../Classroom/classroomData';

export const Navbar = ({ showToast }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleUtilityClick = (item) => {
    if (showToast) {
      showToast(`Fitur "${item}" sedang dalam proses pengerjaan (On Progress).`, 'info');
    }
  };

  // Get dynamic title based on active location pathname
  const getNavbarTitle = () => {
    if (location.pathname.startsWith('/classroom/')) {
      const courseId = location.pathname.split('/').pop();
      const course = classroomData.find(c => c.id === courseId) || classroomData[0];
      
      if (!course) {
        return (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 select-none">
            <span className="font-extrabold">My Courses</span>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 select-none">
          <span className="hover:text-slate-655 transition-colors">My Courses</span>
          <span className="text-slate-300 text-[10px] font-bold">/</span>
          <span className="hover:text-slate-655 transition-colors">{course.className}</span>
          <span className="text-slate-300 text-[10px] font-bold">/</span>
          <span className="text-slate-800 font-extrabold">{course.name}</span>
        </div>
      );
    }

    if (location.pathname.startsWith('/assignment/')) {
      const targetId = location.pathname.split('/').pop();
      let activeAssignment = null;
      let activeCourse = null;
      
      for (const course of classroomData) {
        for (const section of course.sections) {
          const found = section.assignments.find(a => a.id === targetId);
          if (found) {
            activeAssignment = found;
            activeCourse = course;
            break;
          }
        }
        if (activeAssignment) break;
      }

      if (!activeAssignment) {
        activeAssignment = { title: 'Laporan Praktikum Asam Basa' };
        activeCourse = { className: 'XII IPA 2', name: 'Kimia Dasar' };
      }

      return (
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 select-none">
          <span className="hover:text-slate-655 transition-colors">My Courses</span>
          <span className="text-slate-300 text-[10px] font-bold">/</span>
          <span className="hover:text-slate-655 transition-colors">{activeCourse.className}</span>
          <span className="text-slate-300 text-[10px] font-bold">/</span>
          <span className="hover:text-slate-655 transition-colors">{activeCourse.name}</span>
          <span className="text-slate-300 text-[10px] font-bold">/</span>
          <span className="text-slate-800 font-extrabold">{activeAssignment.title}</span>
        </div>
      );
    }

    switch (location.pathname) {
      case '/dashboard':
        return <span className="text-base font-semibold text-slate-700">Dashboard</span>;
      case '/teacher/dashboard':
        return <span className="text-base font-semibold text-slate-700">Teacher Dashboard</span>;
      case '/teacher/gradebook':
        return <span className="text-base font-semibold text-slate-700">Gradebook</span>;
      case '/teacher/create-assignment':
        return <span className="text-base font-semibold text-slate-700">Create Assignment</span>;
      case '/profile':
        return <span className="text-base font-semibold text-slate-700">My Profile</span>;
      default:
        return <span className="text-base font-semibold text-slate-700">Dashboard</span>;
    }
  };

  // Get Initials dynamically
  const getInitials = () => {
    if (!user || !user.name) return 'US';
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <header className="h-16 border-b border-slate-100 bg-white flex items-center justify-between px-8 select-none shrink-0">
      {/* Title */}
      <div className="tracking-tight">
        {getNavbarTitle()}
      </div>

      {/* Utilities */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button
          type="button"
          onClick={() => handleUtilityClick('Notifikasi')}
          className="p-2 rounded-xl hover:bg-slate-50 text-slate-900 hover:text-violet-600 transition-all relative cursor-pointer"
          aria-label="View notifications"
        >
          <Bell className="w-5 h-5" />
          {/* Red indicator dot */}
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border border-white" />
        </button>

        {/* Level Badge Indicator (Hidden for teachers) */}
        {user?.role !== 'teacher' && (
          <span className="px-2 py-0.5 bg-[#F1EEFF] text-[#7047EB] text-[10px] font-black rounded-md select-none tracking-wide">
            Lv. {user?.level || 1}
          </span>
        )}

        {/* Avatar block (navigates to Profile) */}
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="w-8 h-8 rounded-full bg-[#F1EEFF] text-[#7047EB] flex items-center justify-center font-extrabold text-xs shadow-inner select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        >
          {getInitials()}
        </button>
      </div>
    </header>
  );
};

export default Navbar;
