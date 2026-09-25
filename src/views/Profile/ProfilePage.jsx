import React, { useEffect, useRef } from 'react';

import { useAuth } from '../../context/AuthContext';
import { ROLES, heldRolesOf } from '../../constants/roles';
import ProfileHeader from './components/ProfileHeader';
import BadgeCase from './components/BadgeCase';
import LeaderboardWidget from './components/LeaderboardWidget';
import SchoolCodeCard from '../../components/SchoolCodeCard';
import AddRoleCard from './components/AddRoleCard';

/*
  My Profile, and it is not the same page for everybody.

  Achievements and a leaderboard are learner features. A teacher was being shown
  both as empty boxes, which reads as "you have none" rather than "this is not for
  you" — and there is no Badge, Xp or Point model anywhere in the schema, so they
  are empty for students too.

  Staff get the one thing that is theirs and real instead: the School Code they
  hand out. `SchoolCodeCard` decides for itself whether it has anything to say —
  its only source is keyed on who founded the school — so a teacher sees nothing
  and a principal sees their code, with no branching needed here. `AddRoleCard`
  works the same way: it appears only when there is a role left to add.

  ## Why this screen asks /users/me for itself

  **The membership arrives in two different shapes, and only one of them is any
  use here.** Sign-in answers `{ id, schoolId, schoolName, roles: [...] }` — flat,
  with the roles as bare strings. `GET /users/me` answers
  `{ id, status, approvedAt, school: { id, name, schoolType }, roles: [{...}] }`.

  Somebody holding exactly one role is routed from sign-in straight to their
  dashboard, never passing `/select-role`, which is the only other screen that
  calls `refreshMe()`. So a teacher arriving here carries the sign-in shape, and a
  card reading `membership.school.schoolType` or `membership.approvedAt` finds
  neither — which is exactly how this shipped: "Bintang Jaya Supreme" with no
  level, and "Member since: —".

  A profile is the one screen that must not describe somebody from a cached
  summary, so it asks. Once, through a ref rather than an empty dependency list:
  `refreshMe` is rebuilt whenever `activeRole` changes and can itself change
  `activeRole`, so an effect keyed on it could feed itself.
*/
export const ProfilePage = () => {
  const { membership, refreshMe } = useAuth();
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    /* A failure leaves the cached membership in place, which still names the
       person and their school — worse than the full answer, better than nothing. */
    refreshMe().catch(() => {});
  }, [refreshMe]);

  /* STUDENT cannot be combined with any other role (shared/approval.js:34), so
     holding it is the same as being a learner. */
  const isLearner = heldRolesOf(membership).includes(ROLES.STUDENT);

  return (
    <div className="space-y-6">
      <ProfileHeader />

      {isLearner ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <BadgeCase />
          </div>
          <div className="lg:col-span-4">
            <LeaderboardWidget />
          </div>
        </div>
      ) : (
        <>
          <SchoolCodeCard />
          <AddRoleCard />
        </>
      )}
    </div>
  );
};

export default ProfilePage;
