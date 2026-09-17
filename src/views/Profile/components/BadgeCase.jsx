import React from 'react';
import { 
  Trophy, 
  BookOpen, 
  Zap, 
  Flame, 
  Clock, 
  Sparkles, 
  Lock 
} from 'lucide-react';

export const BadgeCase = () => {
  const badges = [
    {
      name: 'Pelajar Teladan',
      desc: 'Selesaikan 5 modul kelas pertama.',
      unlocked: false,
      icon: Trophy,
    },
    {
      name: 'Penimbun Ilmu',
      desc: 'Baca 10 materi bacaan tambahan.',
      unlocked: false,
      icon: BookOpen,
    },
    {
      name: 'Kuis Master',
      desc: 'Raih nilai sempurna 100 di kuis.',
      unlocked: false,
      icon: Zap,
    },
    {
      name: 'Konsistensi Tinggi',
      desc: 'Login 7 hari berturut-turut.',
      unlocked: false,
      icon: Flame,
    },
    {
      name: 'Disiplin Waktu',
      desc: 'Kirim tugas 5 jam sebelum deadline.',
      unlocked: false,
      icon: Clock,
    },
    {
      name: 'Top Kontributor',
      desc: 'Buat 5 postingan diskusi yang dijawab.',
      unlocked: false,
      icon: Sparkles,
    }
  ];

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200">
      <div>
        <h3 className="text-base font-extrabold text-slate-850 tracking-tight pb-6">
          Pencapaian Saya
        </h3>

        {/* Badge Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {badges.map((badge, index) => {
            const BadgeIcon = badge.icon;
            return (
              <div 
                key={index}
                className={`border border-slate-100 rounded-2xl p-4 flex flex-col items-center text-center relative overflow-hidden transition-all duration-300 hover:shadow-sm
                  ${badge.unlocked 
                    ? 'bg-white' 
                    : 'bg-slate-50/50 opacity-60'
                  }
                `}
              >
                
                {/* Lock Badge Overlay */}
                {!badge.unlocked && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center border border-white shrink-0">
                    <Lock className="w-3 h-3" />
                  </div>
                )}

                {/* Circular Icon block */}
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 mb-3.5
                  ${badge.unlocked 
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
