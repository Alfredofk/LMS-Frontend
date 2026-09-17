import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import {
  LayoutGrid,
  BookOpen,
  Award,
  MessageSquare,
  Calendar,
  ClipboardList,
  CalendarCheck,
  Megaphone,
  User,
  Users,
  GraduationCap,
  LogOut
} from 'lucide-react';

export const Sidebar = ({ showToast, userRole }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const role = userRole || user?.role || 'student';
  const [isHomeroomTeacher, setIsHomeroomTeacher] = useState(false);

  useEffect(() => {
    if (role === 'teacher') {
      const checkHomeroom = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch('/api/homeroom/class', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setIsHomeroomTeacher(data.isHomeroomTeacher);
          }
        } catch (err) {
          console.error('Error checking homeroom status:', err);
        }
      };
      checkHomeroom();
    }
  }, [role]);

  const handleLinkClick = (menuName, routePath) => {
    if (routePath) {
      navigate(routePath);
    } else {
      if (showToast) {
        showToast(`Fitur "${menuName}" sedang dalam proses pengerjaan (On Progress).`, 'info');
      }
    }
  };

  const isActive = (routePath) => {
    if (routePath === '/classroom') {
      return location.pathname.startsWith('/classroom');
    }
    return location.pathname === routePath;
import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { 
  LayoutDashboard, 
  BookOpen, 
  GraduationCap, 
  MessageSquare, 
  Calendar, 
  FileText, 
  CheckSquare, 
  Megaphone, 
  User 
} from 'lucide-react';

export const Sidebar = ({ showToast }) => {
  const { user } = useAuth();

  const handleLinkClick = (menuName) => {
    if (showToast) {
      showToast(`Fitur "${menuName}" sedang dalam proses pengerjaan (On Progress).`, 'info');
    }
  };

  // Get Initials dynamically
  const getInitials = () => {
    if (!user || !user.name) return 'AR';
    if (!user || !user.name) return 'US';
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const activeBtnClass = "w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-[#7047EB] text-white shadow-md shadow-purple-500/20 select-none cursor-pointer transition-all";
  const inactiveBtnClass = "w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl text-slate-700 hover:text-[#7047EB] hover:bg-purple-50/50 select-none cursor-pointer group transition-all";

  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col justify-between h-full select-none shrink-0 relative overflow-hidden text-slate-800">

      {/* Main Content Area (With Scroll and generous bottom padding so items never overlap the decorative corner) */}
      <div className="flex flex-col flex-1 overflow-y-auto min-h-0 relative z-10 pb-28">
        
        {/* Brand/School Logo Header */}
        <div className="p-5 border-b border-slate-50 flex items-center gap-3 select-none">
          <div className="w-9 h-9 rounded-xl bg-[#7047EB] flex items-center justify-center text-white shadow-md shadow-purple-500/20 shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4L4 10L12 16L20 10L12 4Z" fill="white" fillOpacity="0.9" />
              <path d="M7 13.5L12 17.5L17 13.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-left min-w-0">
            <div className="text-sm font-black tracking-tight leading-none">
              <span className="text-slate-900">Mike</span>
              <span className="text-[#7047EB]">Kwok</span>
            </div>
            <div className="text-[10px] font-semibold text-slate-400 truncate mt-0.5" title={user?.schoolName || 'SMA Patroli Jaya'}>
              {user?.schoolName || 'SMA Patroli Jaya'}
            </div>
          </div>
        </div>

        {/* Student/Teacher Profile Info Card */}
        <div className="p-3.5 mx-3 mt-4 mb-2 flex items-center gap-3 bg-white border border-slate-100 rounded-2xl min-w-0 shadow-sm relative group hover:border-purple-100 transition-all">
          <div className="w-10 h-10 rounded-full bg-[#EDE9FE] text-[#7047EB] flex items-center justify-center font-black text-xs shrink-0 shadow-inner">
            {getInitials()}
          </div>
          <div className="text-left min-w-0 flex-1">
            <h4 className="text-xs font-black text-slate-900 leading-tight truncate" title={user?.name || (role === 'teacher' ? 'Guru' : role === 'headmaster' ? 'Kepala Sekolah' : 'Andi Rahmat')}>
              {user?.name || (role === 'teacher' ? 'Guru' : role === 'headmaster' ? 'Kepala Sekolah' : 'Andi Rahmat')}
            </h4>
            <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate">
              {role === 'teacher' 
                ? 'Guru Mata Pelajaran' 
                : role === 'headmaster' 
                  ? 'Kepala Sekolah' 
                  : (user?.className || 'Kelas XII IPA 2')}
            </p>
            <div className="mt-1 px-2 py-0.5 bg-[#EDE9FE] text-[#7047EB] text-[9px] font-bold rounded-full inline-block">
              {role === 'teacher'
                ? (user?.nip ? `NIP ${user.nip}` : (user?.username && !user.username.includes('@') ? `NIP ${user.username}` : 'NIP 197805122003122002'))
                : role === 'headmaster'
                  ? `NPSN ${user?.schoolCode || '20261005'}`
                  : (user?.nis ? `NIS ${user.nis}` : (user?.username && !user.username.includes('@') ? `NIS ${user.username}` : 'NIS 20245005'))
              }
  return (
    <aside className="w-64 bg-white border-r border-slate-150 flex flex-col justify-between h-full select-none shrink-0 relative overflow-hidden">
      
      <div className="flex flex-col">
        {/* Brand/School Logo Header */}
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 select-none">
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center text-white font-black text-base shadow-md shadow-violet-500/10">
            L
          </div>
          <div className="text-left">
            <div className="text-sm font-black text-slate-900 tracking-tight leading-tight">LMS</div>
            <div className="text-[10px] font-black text-slate-900">SMA Patroli Jaya</div>
          </div>
        </div>

        {/* Student Profile Info Card (Dynamic with truncation) */}
        <div className="p-6 flex items-center gap-3 border-b border-slate-100 min-w-0">
          <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-inner">
            {getInitials()}
          </div>
          <div className="text-left min-w-0 flex-1">
            <h4 className="text-xs font-black text-slate-900 leading-tight truncate" title={user?.name || 'Student User'}>
              {user?.name || 'Student User'}
            </h4>
            <p className="text-[10px] font-black text-slate-800 mt-0.5 truncate" title={user?.email || 'alfredofanko09@gmail.com'}>
              {user?.email || 'alfredofanko09@gmail.com'}
            </p>
            <p className="text-[10px] font-black text-slate-800 mt-0.5">
              Kelas XII IPA 2
            </p>
            <div className="mt-1.5 px-2 py-0.5 bg-[#F1EEFF] text-[#7047EB] text-[9px] font-black rounded-md inline-block">
              {user?.username ? `NIS ${user.username}` : 'NIS 20261005'}
            </div>
          </div>
        </div>

        {/* Navigation Listings */}
        <div className="px-3 py-3 space-y-4 text-left flex-1">

          {/* Main Menu group */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold text-[#8B7FE8] tracking-wider block select-none">
              Main Menu
            </span>
            <nav className="space-y-0.5">
              <button
                onClick={() => handleLinkClick('Dashboard', role === 'teacher' ? '/teacher/dashboard' : role === 'headmaster' ? '/headmaster/dashboard' : '/dashboard')}
                className={isActive(role === 'teacher' ? '/teacher/dashboard' : role === 'headmaster' ? '/headmaster/dashboard' : '/dashboard') ? activeBtnClass : inactiveBtnClass}
              >
                <LayoutGrid className={`w-4 h-4 shrink-0 transition-colors ${isActive(role === 'teacher' ? '/teacher/dashboard' : role === 'headmaster' ? '/headmaster/dashboard' : '/dashboard') ? 'text-white' : 'text-[#7047EB]'}`} />
                Dashboard
              </button>

              {role !== 'headmaster' && (
                <button
                  onClick={() => handleLinkClick('My Courses', role === 'teacher' ? '/teacher/courses' : '/classroom')}
                  className={isActive(role === 'teacher' ? '/teacher/courses' : '/classroom') ? activeBtnClass : inactiveBtnClass}
                >
                  <BookOpen className={`w-4 h-4 shrink-0 transition-colors ${isActive(role === 'teacher' ? '/teacher/courses' : '/classroom') ? 'text-white' : 'text-[#7047EB]'}`} />
                  My Courses
                </button>
              )}

              {role === 'teacher' ? (
                <>
                  <button
                    onClick={() => handleLinkClick('Gradebook', '/teacher/gradebook')}
                    className={isActive('/teacher/gradebook') ? activeBtnClass : inactiveBtnClass}
                  >
                    <GraduationCap className={`w-4 h-4 shrink-0 transition-colors ${isActive('/teacher/gradebook') ? 'text-white' : 'text-[#7047EB]'}`} />
                    Gradebook
                  </button>

                  <button
                    onClick={() => handleLinkClick('Schedule', '/schedule')}
                    className={isActive('/schedule') ? activeBtnClass : inactiveBtnClass}
                  >
                    <Calendar className={`w-4 h-4 shrink-0 transition-colors ${isActive('/schedule') ? 'text-white' : 'text-[#7047EB]'}`} />
                    Schedule
                  </button>

                  {isHomeroomTeacher && (
                    <button
                      onClick={() => handleLinkClick('Kelas Perwalian', '/teacher/homeroom')}
                      className={isActive('/teacher/homeroom') ? activeBtnClass : inactiveBtnClass}
                    >
                      <Users className={`w-4 h-4 shrink-0 transition-colors ${isActive('/teacher/homeroom') ? 'text-white' : 'text-[#7047EB]'}`} />
                      Kelas Perwalian
                    </button>
                  )}
                </>
              ) : role === 'student' ? (
                <>
                  <button
                    onClick={() => handleLinkClick('Scores', '/scores')}
                    className={isActive('/scores') ? activeBtnClass : inactiveBtnClass}
                  >
                    <Award className={`w-4 h-4 shrink-0 transition-colors ${isActive('/scores') ? 'text-white' : 'text-[#7047EB]'}`} />
                    Scores
                  </button>

                  <button
                    onClick={() => handleLinkClick('Chatbot')}
                    className={inactiveBtnClass}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-[#7047EB] transition-colors" />
                    Chatbot
                  </button>
                </>
              ) : null}
            </nav>
          </div>

          {/* Activities group - Only for students */}
          {role === 'student' && (
            <div className="space-y-1">
              <span className="px-3 text-[10px] font-bold text-[#8B7FE8] tracking-wider block select-none">
                Activities
              </span>
              <nav className="space-y-0.5">
                <button
                  onClick={() => handleLinkClick('Schedule', '/schedule')}
                  className={isActive('/schedule') ? activeBtnClass : inactiveBtnClass}
                >
                  <Calendar className={`w-4 h-4 shrink-0 transition-colors ${isActive('/schedule') ? 'text-white' : 'text-[#7047EB]'}`} />
                  Schedule
                </button>
                <button
                  onClick={() => handleLinkClick('Assessment', '/assessment')}
                  className={isActive('/assessment') ? activeBtnClass : inactiveBtnClass}
                >
                  <ClipboardList className={`w-4 h-4 shrink-0 transition-colors ${isActive('/assessment') ? 'text-white' : 'text-[#7047EB]'}`} />
                  Assessment
                </button>
                <button
                  onClick={() => handleLinkClick('Attendance', '/attendance')}
                  className={isActive('/attendance') ? activeBtnClass : inactiveBtnClass}
                >
                  <CalendarCheck className={`w-4 h-4 shrink-0 transition-colors ${isActive('/attendance') ? 'text-white' : 'text-[#7047EB]'}`} />
                  Attendance
                </button>
                <button
                  onClick={() => handleLinkClick('Announcement', '/announcements')}
                  className={isActive('/announcements') ? activeBtnClass : inactiveBtnClass}
                >
                  <Megaphone className={`w-4 h-4 shrink-0 transition-colors ${isActive('/announcements') ? 'text-white' : 'text-[#7047EB]'}`} />
                  Announcement
                </button>
              </nav>
            </div>
          )}

          {/* Account group */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold text-[#8B7FE8] tracking-wider block select-none">
              Account
            </span>
            <nav className="space-y-0.5">
              <button
                onClick={() => handleLinkClick('My Profile', '/profile')}
                className={isActive('/profile') ? activeBtnClass : inactiveBtnClass}
              >
                <User className={`w-4 h-4 shrink-0 transition-colors ${isActive('/profile') ? 'text-white' : 'text-[#7047EB]'}`} />
                My Profile
              </button>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl text-slate-700 hover:text-rose-600 hover:bg-rose-50/50 select-none cursor-pointer group transition-all"
              >
                <LogOut className="w-4 h-4 shrink-0 text-[#7047EB] group-hover:text-rose-500 transition-colors" />
                Log Out
              </button>
        {/* Navigation Listings (Black typography matching screenshot) */}
        <div className="px-4 py-4 space-y-6 text-left">
          
          {/* Main Menu group */}
          <div className="space-y-1.5">
            <span className="px-3 text-[10px] font-black text-slate-900 uppercase tracking-wider block select-none">
              Main Menu
            </span>
            <nav className="space-y-1">
              <button 
                onClick={() => handleLinkClick('Dashboard')}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl bg-violet-600 text-white shadow-md shadow-violet-500/10 hover:shadow-lg transition-all duration-200 select-none cursor-pointer"
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                Dashboard
              </button>
              <button 
                onClick={() => handleLinkClick('My Courses')}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl text-slate-900 hover:bg-slate-50 hover:shadow-sm transition-all duration-200 select-none cursor-pointer"
              >
                <BookOpen className="w-4 h-4 shrink-0 text-slate-900" />
                My Courses
              </button>
              <button 
                onClick={() => handleLinkClick('Scores')}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl text-slate-900 hover:bg-slate-50 hover:shadow-sm transition-all duration-200 select-none cursor-pointer"
              >
                <GraduationCap className="w-4 h-4 shrink-0 text-slate-900" />
                Scores
              </button>
              <button 
                onClick={() => handleLinkClick('Chatbot')}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl text-slate-900 hover:bg-slate-50 hover:shadow-sm transition-all duration-200 select-none cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 shrink-0 text-slate-900" />
                Chatbot
              </button>
            </nav>
          </div>

          {/* Activities group */}
          <div className="space-y-1.5">
            <span className="px-3 text-[10px] font-black text-slate-900 uppercase tracking-wider block select-none">
              Activities
            </span>
            <nav className="space-y-1">
              <button 
                onClick={() => handleLinkClick('Schedule')}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl text-slate-900 hover:bg-slate-50 hover:shadow-sm transition-all duration-200 select-none cursor-pointer"
              >
                <Calendar className="w-4 h-4 shrink-0 text-slate-900" />
                Schedule
              </button>
              <button 
                onClick={() => handleLinkClick('Assessment')}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl text-slate-900 hover:bg-slate-50 hover:shadow-sm transition-all duration-200 select-none cursor-pointer"
              >
                <FileText className="w-4 h-4 shrink-0 text-slate-900" />
                Assessment
              </button>
              <button 
                onClick={() => handleLinkClick('Attendance')}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl text-slate-900 hover:bg-slate-50 hover:shadow-sm transition-all duration-200 select-none cursor-pointer"
              >
                <CheckSquare className="w-4 h-4 shrink-0 text-slate-900" />
                Attendance
              </button>
              <button 
                onClick={() => handleLinkClick('Announcement')}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl text-slate-900 hover:bg-slate-50 hover:shadow-sm transition-all duration-200 select-none cursor-pointer"
              >
                <Megaphone className="w-4 h-4 shrink-0 text-slate-900" />
                Announcement
              </button>
            </nav>
          </div>

          {/* Account group */}
          <div className="space-y-1.5">
            <span className="px-3 text-[10px] font-black text-slate-900 uppercase tracking-wider block select-none">
              Account
            </span>
            <nav className="space-y-1">
              <button 
                onClick={() => handleLinkClick('My Profile')}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl text-slate-900 hover:bg-slate-50 hover:shadow-sm transition-all duration-200 select-none cursor-pointer"
              >
                <User className="w-4 h-4 shrink-0 text-slate-900" />
                My Profile
              </button>
            </nav>
          </div>

        </div>
      </div>

      {/* Decorative corner accent: Purple quarter circle positioned at the very bottom-left, cleanly below the scroll content */}
      <div className="absolute -bottom-14 -left-14 w-32 h-32 rounded-full bg-[#7047EB] pointer-events-none z-0" />
      {/* Decorative corner accent */}
      <div className="absolute bottom-[-60px] left-[-60px] w-32 h-32 rounded-full bg-[#6D43EC] pointer-events-none opacity-5" />

    </aside>
  );
};

export default Sidebar;
