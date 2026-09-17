import React from 'react';
import { 
  Trophy, 
  Award,
  Zap, 
  Flame, 
  Clock, 
  Sparkles, 
  Lock 
} from 'lucide-react';

const iconMap = {
  Award: Award,
  Zap: Zap,
  Flame: Flame,
  Trophy: Trophy,
  Clock: Clock,
  Sparkles: Sparkles
};

export const BadgeCase = ({ badges }) => {
  // Master list of all possible badges in the system
  const defaultBadges = [
    {
      name: 'Murid Berbakat',
      desc: 'Berhasil naik ke level 2 setelah menyelesaikan tantangan akademik.',
      iconKey: 'Award',
    },
    {
      name: 'Pengumpul XP Ulung',
      desc: 'Berhasil mengumpulkan akumulasi total 1000 XP.',
      iconKey: 'Zap',
    },
    {
      name: 'Konsistensi Tinggi',
      desc: 'Memiliki streak kehadiran harian minimal 5 hari berturut-turut.',
      iconKey: 'Flame',
    }
  ];

  const isBadgeUnlocked = (badgeName) => {
    return badges.some(b => b.name.toLowerCase() === badgeName.toLowerCase());
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200 w-full">
      <div>
        <h3 className="text-base font-extrabold text-slate-800 tracking-tight pb-6">
          Lemari Lencana Pencapaian
        </h3>

        {/* Badge Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {defaultBadges.map((badge, index) => {
            const unlocked = isBadgeUnlocked(badge.name);
            const BadgeIcon = iconMap[badge.iconKey] || Trophy;

            return (
              <div 
                key={index}
                className={`border border-slate-100 rounded-2xl p-4 flex flex-col items-center text-center relative overflow-hidden transition-all duration-300 hover:shadow-sm
                  ${unlocked 
                    ? 'bg-white' 
                    : 'bg-slate-50/50 opacity-60'
                  }
                `}
              >
                {/* Lock Badge Overlay */}
                {!unlocked && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center border border-white shrink-0">
                    <Lock className="w-3 h-3" />
                  </div>
                )}

                {/* Circular Icon block */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 mb-3.5
                  ${unlocked 
                    ? 'bg-purple-100 text-[#7047EB]' 
                    : 'bg-slate-100 text-slate-400'
                  }
                `}>
                  <BadgeIcon className="w-5 h-5" />
                </div>

                {/* Typography info */}
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-slate-900 leading-tight">
                    {badge.name}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-bold leading-normal">
                    {badge.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BadgeCase;
