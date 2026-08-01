import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Award } from 'lucide-react';

export const ProfileHeader = ({ profile }) => {
  const { user } = useAuth();

  // Get Initials dynamically
  const getInitials = () => {
    if (!user || !user.name) return 'AR';
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const currentXp = profile?.xp || 0;
  const targetXp = ((Math.floor(currentXp / 1000) + 1) * 1000);
  const prevLevelXp = Math.floor(currentXp / 1000) * 1000;
  
  // Progress within current level:
  const levelProgress = currentXp - prevLevelXp;
  const nextLevelTarget = 1000;
  const progressPercentage = Math.min(100, Math.max(0, (levelProgress / nextLevelTarget) * 100));
  const currentLevel = profile?.level || 1;
  const nextLevel = currentLevel + 1;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 select-none hover:shadow-md transition-shadow duration-200 text-left w-full">
      {/* Left side: Avatar and credentials */}
      <div className="flex items-center gap-4">
        {/* Large Initials Avatar Circle */}
        <div className="w-16 h-16 rounded-full bg-violet-100 text-[#7047EB] flex items-center justify-center font-black text-xl shadow-inner shrink-0 border-2 border-white ring-4 ring-violet-50">
          {getInitials()}
        </div>
        
        {/* Credentials block */}
        <div className="space-y-1">
          <h1 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
            {user?.name || 'Andi Rahmat'}
          </h1>
          <p className="text-xs font-semibold text-slate-500">
            Kelas XII IPA 2
          </p>
          <div className="px-2 py-0.5 bg-[#F1EEFF] text-[#7047EB] text-[10px] font-black rounded-md inline-block">
            {user?.username && !user.username.includes('@') ? `NIS ${user.username}` : 'NIS 20261005'}
          </div>
        </div>
      </div>

      {/* Right side: XP Progress Section */}
      <div className="w-full md:w-80 lg:w-96 space-y-2.5">
        <div className="flex items-center justify-between text-xs font-black text-slate-800">
          <div className="flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[#7047EB] shrink-0" />
            <span>XP: {currentXp.toLocaleString('id-ID')} / {targetXp.toLocaleString('id-ID')}</span>
          </div>
          <span className="text-[#7047EB]">Menuju Level {nextLevel} (Lvl {currentLevel})</span>
        </div>

        {/* Thick progress bar */}
        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
          <div 
            className="bg-[#7047EB] h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
