import React from 'react';
import { Medal } from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';
import { useT } from '../../../i18n/LanguageContext';

/*
  Ranking, of which there is none.

  `rankings` is empty and stays empty: nothing in `schema.prisma` scores or
  orders students — no Xp, Point or Leaderboard model — so there is no query
  that could fill this. The rendering below is kept for when there is.

  `activeStudentName` decides which row is highlighted as "you". It read
  `user.name`, a field the account object does not have, so it could never match
  anybody and the highlight was dead alongside the data.
*/
export const LeaderboardWidget = () => {
  const { user } = useAuth();
  const { t } = useT();
  const activeStudentName = user?.fullName ?? null;

  const rankings = [];

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200">
      <div>
        <h3 className="text-base font-extrabold text-slate-900 tracking-tight pb-6">
          {t('profile.leaderboard')}
        </h3>

        {rankings.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
            <Medal className="w-7 h-7 text-slate-300 mb-2" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-600">
              {t('profile.leaderboard.empty')}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {rankings.map((student, index) => {
              const isCurrentUser = student.name === activeStudentName;
              
              // Render Rank Badges
              const renderRankBadge = () => {
                if (student.rank === 1) {
                  return (
                    <span className="w-6 h-6 rounded-full bg-yellow-50 text-yellow-600 border border-yellow-200 flex items-center justify-center font-extrabold text-xs shrink-0">
                      1
                    </span>
                  );
                }
                if (student.rank === 2) {
                  return (
                    <span className="w-6 h-6 rounded-full bg-slate-50 text-slate-500 border border-slate-200 flex items-center justify-center font-extrabold text-xs shrink-0">
                      2
                    </span>
                  );
                }
                if (student.rank === 3) {
                  return (
                    <span className="w-6 h-6 rounded-full bg-orange-50/70 text-orange-700 border border-orange-200/60 flex items-center justify-center font-extrabold text-xs shrink-0">
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
                      ? 'bg-purple-50/70 border-l-4 border-l-brand border-slate-200/80 shadow-sm' 
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
                        ? 'font-extrabold text-slate-900' 
                        : 'font-bold text-slate-700'
                      }
                    `}>
                      {student.name}
                    </span>
                  </div>

                  {/* Score */}
                  <span className="text-[10px] font-extrabold text-brand bg-purple-100/60 px-2 py-0.5 rounded-md shrink-0">
                    {student.xp.toLocaleString('id-ID')} XP
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
