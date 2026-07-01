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
    if (!user || !user.name) return 'US';
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

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

      {/* Decorative corner accent */}
      <div className="absolute bottom-[-60px] left-[-60px] w-32 h-32 rounded-full bg-[#6D43EC] pointer-events-none opacity-5" />

    </aside>
  );
};

export default Sidebar;
