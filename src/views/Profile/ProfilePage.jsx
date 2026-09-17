import React from 'react';
import ProfileHeader from './components/ProfileHeader';
import BadgeCase from './components/BadgeCase';
import LeaderboardWidget from './components/LeaderboardWidget';

export const ProfilePage = () => {
  return (
    <div className="space-y-6">
      
      {/* 1. Header (Profile info + XP progress) */}
      <ProfileHeader />

      {/* 2. Grid split content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Badge cabinet (Left - 8 columns on desktop) */}
        <div className="lg:col-span-8">
          <BadgeCase />
        </div>

        {/* Leaderboard ranking (Right - 4 columns on desktop) */}
        <div className="lg:col-span-4">
          <LeaderboardWidget />
        </div>

      </div>

    </div>
  );
};

export default ProfilePage;
