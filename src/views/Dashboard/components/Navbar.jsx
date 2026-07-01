import React from 'react';
import { Bell } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

export const Navbar = ({ showToast }) => {
  const { user } = useAuth();

  const handleUtilityClick = (item) => {
    if (showToast) {
      showToast(`Fitur "${item}" sedang dalam proses pengerjaan (On Progress).`, 'info');
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
      <h2 className="text-base font-semibold text-slate-700 tracking-tight">
        Dashboard
      </h2>

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

        {/* Level Badge Indicator */}
        <span className="px-2 py-0.5 bg-[#F1EEFF] text-[#7047EB] text-[10px] font-black rounded-md select-none tracking-wide">
          Lv. {user?.level || 1}
        </span>

        {/* Avatar block */}
        <button
          type="button"
          onClick={() => handleUtilityClick('Profil Pengguna')}
          className="w-8 h-8 rounded-full bg-[#F1EEFF] text-[#7047EB] flex items-center justify-center font-extrabold text-xs shadow-inner select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        >
          {getInitials()}
        </button>
      </div>
    </header>
  );
};

export default Navbar;
