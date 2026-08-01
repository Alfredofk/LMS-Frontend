import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  User,
  Users,
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
    <aside className="w-66 bg-white border-r border-slate-150 flex flex-col justify-between h-full select-none shrink-0 relative overflow-hidden text-slate-800">

      {/* Main Content Area (With Scroll) */}
      <div className="flex flex-col flex-1 overflow-y-auto min-h-0">
        
        {/* Brand/School Logo Header */}
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 select-none">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#7047EB] to-[#5C36DB] flex items-center justify-center text-white font-black text-base shadow-md shadow-violet-500/10">
            L
          </div>
          <div className="text-left min-w-0">
            <div className="text-sm font-black text-slate-900 tracking-tight leading-tight">LMS</div>
            <div className="text-[10px] font-bold text-slate-500 truncate" title={user?.schoolName || 'SMA Negeri 1 Harapan'}>
              {user?.schoolName || 'SMA Negeri 1 Harapan'}
            </div>
          </div>
        </div>

        {/* Student/Teacher Profile Info Card (Light Card Layout) */}
        <div className="p-4 mx-4 mt-6 mb-4 flex items-center gap-3 bg-slate-50/60 border border-slate-100 rounded-2xl min-w-0 shadow-sm relative group hover:bg-slate-50 transition-all">
          <div className="w-10 h-10 rounded-full bg-violet-100 border border-violet-200 text-violet-750 flex items-center justify-center font-black text-xs shrink-0 shadow-inner">
            {getInitials()}
          </div>
          <div className="text-left min-w-0 flex-1">
            <h4 className="text-xs font-black text-slate-900 leading-tight truncate" title={user?.name || (role === 'teacher' ? 'Teacher User' : role === 'headmaster' ? 'Kepala Sekolah' : 'Student User')}>
              {user?.name || (role === 'teacher' ? 'Teacher User' : role === 'headmaster' ? 'Kepala Sekolah' : 'Student User')}
            </h4>
            <p className="text-[9px] font-bold text-slate-500 mt-0.5 truncate" title={user?.email || 'admin@sekolah.sch.id'}>
              {user?.email || 'admin@sekolah.sch.id'}
            </p>
            <p className="text-[9px] font-bold text-slate-450 mt-0.5">
              {role === 'teacher' 
                ? 'Guru Mata Pelajaran' 
                : role === 'headmaster' 
                  ? 'Kepala Sekolah' 
                  : 'Kelas XII IPA 2'}
            </p>
            <div className="mt-1.5 px-2 py-0.5 bg-[#F1EEFF] text-[#7047EB] border border-violet-100 text-[8px] font-black rounded-md inline-block">
              {role === 'teacher'
                ? (user?.username && !user.username.includes('@') ? `NIP ${user.username}` : 'NIP 197805122003122002')
                : role === 'headmaster'
                  ? `NPSN ${user?.schoolCode || '20261005'}`
                  : (user?.username && !user.username.includes('@') ? `NIS ${user.username}` : 'NIS 20261005')
              }
            </div>
          </div>
        </div>

        {/* Navigation Listings */}
        <div className="px-4 py-4 space-y-6 text-left flex-1">

          {/* Main Menu group */}
          <div className="space-y-1.5">
            <span className="px-3 text-[9px] font-black text-slate-450 uppercase tracking-widest block select-none">
              Main Menu
            </span>
            <nav className="space-y-1">
              <button
                onClick={() => handleLinkClick('Dashboard', role === 'teacher' ? '/teacher/dashboard' : role === 'headmaster' ? '/headmaster/dashboard' : '/dashboard')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl transition-all duration-200 select-none cursor-pointer group hover:translate-x-1
                  ${isActive(role === 'teacher' ? '/teacher/dashboard' : role === 'headmaster' ? '/headmaster/dashboard' : '/dashboard')
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/10 hover:shadow-lg'
                    : 'text-slate-800 hover:text-[#7047EB] hover:bg-slate-50'
                  }
                `}
              >
                <LayoutDashboard className={`w-4 h-4 shrink-0 transition-colors ${isActive(role === 'teacher' ? '/teacher/dashboard' : role === 'headmaster' ? '/headmaster/dashboard' : '/dashboard') ? 'text-white' : 'text-slate-500 group-hover:text-[#7047EB]'}`} />
                Dashboard
              </button>

              {role !== 'headmaster' && (
                <button
                  onClick={() => handleLinkClick('My Courses', role === 'teacher' ? '/teacher/courses' : '/classroom')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl transition-all duration-200 select-none cursor-pointer group hover:translate-x-1
                    ${isActive(role === 'teacher' ? '/teacher/courses' : '/classroom')
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/10 hover:shadow-lg'
                      : 'text-slate-800 hover:text-[#7047EB] hover:bg-slate-50'
                    }
                  `}
                >
                  <BookOpen className={`w-4 h-4 shrink-0 transition-colors ${isActive(role === 'teacher' ? '/teacher/courses' : '/classroom') ? 'text-white' : 'text-slate-500 group-hover:text-[#7047EB]'}`} />
                  My Courses
                </button>
              )}

              {role === 'teacher' ? (
                <>
                  <button
                    onClick={() => handleLinkClick('Gradebook', '/teacher/gradebook')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl transition-all duration-200 select-none cursor-pointer group hover:translate-x-1
                      ${isActive('/teacher/gradebook')
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/10 hover:shadow-lg'
                        : 'text-slate-800 hover:text-[#7047EB] hover:bg-slate-50'
                      }
                    `}
                  >
                    <GraduationCap className={`w-4 h-4 shrink-0 transition-colors ${isActive('/teacher/gradebook') ? 'text-white' : 'text-slate-500 group-hover:text-[#7047EB]'}`} />
                    Gradebook
                  </button>

                  <button
                    onClick={() => handleLinkClick('Schedule', '/schedule')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl transition-all duration-200 select-none cursor-pointer group hover:translate-x-1
                      ${isActive('/schedule')
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/10 hover:shadow-lg'
                        : 'text-slate-800 hover:text-[#7047EB] hover:bg-slate-50'
                      }
                    `}
                  >
                    <Calendar className={`w-4 h-4 shrink-0 transition-colors ${isActive('/schedule') ? 'text-white' : 'text-slate-500 group-hover:text-[#7047EB]'}`} />
                    Schedule
                  </button>

                  {isHomeroomTeacher && (
                    <button
                      onClick={() => handleLinkClick('Kelas Perwalian', '/teacher/homeroom')}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl transition-all duration-200 select-none cursor-pointer group hover:translate-x-1
                        ${isActive('/teacher/homeroom')
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/10 hover:shadow-lg'
                          : 'text-slate-800 hover:text-[#7047EB] hover:bg-slate-50'
                        }
                      `}
                    >
                      <Users className={`w-4 h-4 shrink-0 transition-colors ${isActive('/teacher/homeroom') ? 'text-white' : 'text-slate-500 group-hover:text-[#7047EB]'}`} />
                      Kelas Perwalian
                    </button>
                  )}
                </>
              ) : role === 'student' ? (
                <>
                  <button
                    onClick={() => handleLinkClick('Scores', '/scores')}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl transition-all duration-200 select-none cursor-pointer group hover:translate-x-1
                      ${isActive('/scores')
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/10 hover:shadow-lg'
                        : 'text-slate-800 hover:text-[#7047EB] hover:bg-slate-50'
                      }
                    `}
                  >
                    <GraduationCap className={`w-4 h-4 shrink-0 transition-colors ${isActive('/scores') ? 'text-white' : 'text-slate-500 group-hover:text-[#7047EB]'}`} />
                    Scores
                  </button>

                  <button
                    onClick={() => handleLinkClick('Chatbot')}
                    className="w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl text-slate-800 hover:text-[#7047EB] hover:bg-slate-50 hover:translate-x-1 transition-all duration-200 select-none cursor-pointer group"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-[#7047EB] transition-colors" />
                    Chatbot
                  </button>
                </>
              ) : null}
            </nav>
          </div>

          {/* Activities group - Only for students */}
          {role === 'student' && (
            <div className="space-y-1.5">
              <span className="px-3 text-[9px] font-black text-slate-450 uppercase tracking-widest block select-none">
                Activities
              </span>
              <nav className="space-y-1">
                <button
                  onClick={() => handleLinkClick('Schedule', '/schedule')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl transition-all duration-200 select-none cursor-pointer group hover:translate-x-1
                    ${isActive('/schedule')
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/10 hover:shadow-lg'
                      : 'text-slate-800 hover:text-[#7047EB] hover:bg-slate-50'
                    }
                  `}
                >
                  <Calendar className={`w-4 h-4 shrink-0 transition-colors ${isActive('/schedule') ? 'text-white' : 'text-slate-500 group-hover:text-[#7047EB]'}`} />
                  Schedule
                </button>
                <button
                  onClick={() => handleLinkClick('Assessment', '/assessment')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl transition-all duration-200 select-none cursor-pointer group hover:translate-x-1
                    ${isActive('/assessment')
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/10 hover:shadow-lg'
                      : 'text-slate-800 hover:text-[#7047EB] hover:bg-slate-50'
                    }
                  `}
                >
                  <FileText className={`w-4 h-4 shrink-0 transition-colors ${isActive('/assessment') ? 'text-white' : 'text-slate-500 group-hover:text-[#7047EB]'}`} />
                  Assessment
                </button>
                <button
                  onClick={() => handleLinkClick('Attendance', '/attendance')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl transition-all duration-200 select-none cursor-pointer group hover:translate-x-1
                    ${isActive('/attendance')
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/10 hover:shadow-lg'
                      : 'text-slate-800 hover:text-[#7047EB] hover:bg-slate-50'
                    }
                  `}
                >
                  <CheckSquare className={`w-4 h-4 shrink-0 transition-colors ${isActive('/attendance') ? 'text-white' : 'text-slate-500 group-hover:text-[#7047EB]'}`} />
                  Attendance
                </button>
                <button
                  onClick={() => handleLinkClick('Announcement', '/announcements')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl transition-all duration-200 select-none cursor-pointer group hover:translate-x-1
                    ${isActive('/announcements')
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/10 hover:shadow-lg'
                      : 'text-slate-800 hover:text-[#7047EB] hover:bg-slate-50'
                    }
                  `}
                >
                  <Megaphone className={`w-4 h-4 shrink-0 transition-colors ${isActive('/announcements') ? 'text-white' : 'text-slate-500 group-hover:text-[#7047EB]'}`} />
                  Announcement
                </button>
              </nav>
            </div>
          )}

          {/* Account group */}
          <div className="space-y-1.5">
            <span className="px-3 text-[9px] font-black text-slate-450 uppercase tracking-widest block select-none">
              Account
            </span>
            <nav className="space-y-1">
              <button
                onClick={() => handleLinkClick('My Profile', '/profile')}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-black rounded-xl transition-all duration-200 select-none cursor-pointer group hover:translate-x-1
                  ${isActive('/profile')
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/10 hover:shadow-lg'
                    : 'text-slate-800 hover:text-[#7047EB] hover:bg-slate-50'
                  }
                `}
              >
                <User className={`w-4 h-4 shrink-0 transition-colors ${isActive('/profile') ? 'text-white' : 'text-slate-500 group-hover:text-[#7047EB]'}`} />
                My Profile
              </button>
            </nav>
          </div>

        </div>
      </div>

      {/* Decorative corner accent */}
      <div className="absolute bottom-[-60px] left-[-60px] w-32 h-32 rounded-full bg-[#6D43EC] pointer-events-none opacity-[0.02]" />

      {/* Log Out button */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-black rounded-xl text-slate-650 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200 select-none cursor-pointer group active:scale-95"
        >
          <LogOut className="w-4 h-4 shrink-0 text-slate-500 group-hover:text-rose-550 transition-colors" />
          Log Out
        </button>
      </div>

    </aside>
  );
};

export default Sidebar;
