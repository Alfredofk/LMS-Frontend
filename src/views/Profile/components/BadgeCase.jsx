import React from 'react';
import { Trophy, Lock } from 'lucide-react';

import { useT } from '../../../i18n/LanguageContext';

/*
  Achievements, of which there are none.

  This file used to hold six hand-written badges — "Pelajar Teladan", "Login 7
  hari berturut-turut" and so on — all permanently locked. They looked like a
  feature awaiting data, but there is no data to await: `schema.prisma` has no
  Badge, Achievement, Xp, Level, Point or Streak model, and nothing in the
  backend counts logins, streaks or submissions.

  So the list is empty rather than fabricated, matching LeaderboardWidget beside
  it. The badge *rules* were the invented part — a locked badge still promises
  that finishing five modules earns something, and nothing does.

  When the models land, fill `badges` from the API; the card below already
  renders a list and an empty state.
*/

export const BadgeCase = () => {
  const { t } = useT();

  const badges = [];

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between text-left select-none hover:shadow-md transition-shadow duration-200">
      <div>
        <h3 className="text-base font-extrabold text-slate-900 tracking-tight pb-6">
          {t('profile.achievements')}
        </h3>

        {badges.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40">
            <Trophy className="w-7 h-7 text-slate-300 mb-2" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-600">
              {t('profile.achievements.empty')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {badges.map((badge) => {
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={badge.id}
                  className={`border border-slate-100 rounded-2xl p-4 flex flex-col items-center text-center relative overflow-hidden transition-all duration-300 hover:shadow-sm ${
                    badge.unlocked ? 'bg-white' : 'bg-slate-50/50 opacity-60'
                  }`}
                >
                  {!badge.unlocked && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center border border-white shrink-0">
                      <Lock className="w-3 h-3" aria-hidden="true" />
                    </div>
                  )}

                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 mb-3.5 ${
                      badge.unlocked ? 'bg-purple-100 text-brand' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {BadgeIcon && <BadgeIcon className="w-5 h-5" aria-hidden="true" />}
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-slate-900 leading-tight">
                      {badge.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-bold leading-normal">
                      {badge.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BadgeCase;
