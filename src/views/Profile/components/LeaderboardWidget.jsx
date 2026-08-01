import React from 'react';
import { useAuth } from '../../../context/AuthContext';

export const LeaderboardWidget = ({ leaderboard }) => {
  const { user } = useAuth();
  const activeStudentName = user?.name || '';

  const rankings = leaderboard || [];

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200 w-full">
      <div>
        <h3 className="text-base font-extrabold text-slate-800 tracking-tight pb-6">
          Papan Peringkat Sekolah
        </h3>

        {rankings.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
            <p className="text-xs font-black text-slate-400">
              Belum ada peringkat untuk saat ini.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {rankings.slice(0, 5).map((student, index) => {
              const isCurrentUser = student.name === activeStudentName;
              
              // Render Rank Badges
              const renderRankBadge = () => {
                if (student.rank === 1) {
                  return (
                    <span className="w-6 h-6 rounded-full bg-yellow-50 text-yellow-600 border border-yellow-200 flex items-center justify-center font-black text-xs shrink-0">
                      1
                    </span>
                  );
                }
                if (student.rank === 2) {
                  return (
                    <span className="w-6 h-6 rounded-full bg-slate-50 text-slate-500 border border-slate-200 flex items-center justify-center font-black text-xs shrink-0">
                      2
                    </span>
                  );
                }
                if (student.rank === 3) {
                  return (
                    <span className="w-6 h-6 rounded-full bg-orange-50/70 text-orange-700 border border-orange-200/60 flex items-center justify-center font-black text-xs shrink-0">
                      3
                    </span>
                  );
                }
                return (
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-extrabold text-xs shrink-0">
                    {student.rank}
                  </span>
                );
              };

              return (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-xl border border-slate-100/50 transition-all duration-300
                    ${isCurrentUser 
                      ? 'bg-purple-50/70 border-l-4 border-l-[#7047EB] border-slate-200/80 shadow-sm' 
                      : 'bg-white hover:bg-slate-50/50'
                    }
                  `}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank Circle */}
                    {renderRankBadge()}

                    {/* Student Name */}
                    <span className={`text-xs truncate tracking-wide
                      ${isCurrentUser 
                        ? 'font-black text-slate-900' 
                        : 'font-bold text-slate-700'
                      }
                    `}>
                      {student.name}
                    </span>
                  </div>

                  {/* Score */}
                  <span className="text-[10px] font-black text-[#7047EB] bg-purple-100/60 px-2 py-0.5 rounded-md shrink-0">
                    {(student.xp || 0).toLocaleString('id-ID')} XP
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardWidget;
