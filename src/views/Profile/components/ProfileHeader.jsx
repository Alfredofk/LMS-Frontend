import React from 'react';
import { Award } from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';
import { useT } from '../../../i18n/LanguageContext';
import { ROLE_LABEL_KEY } from '../../../constants/roles';

/*
  Who is signed in, and what the backend can actually say about them.

  This card used to show "Andi Rahmat · Kelas XII IPA 2 · NIS 20261005" to
  everybody, for three separate reasons, all of which were reading fields that
  do not exist:

    user.name      the account object carries `fullName`; `name` was always
                   undefined, so the || fallback ran every single time
    user.username  no such field anywhere, so the NIS fallback ran too
    the class      never read from anything at all — a literal string

  Only the first of those is fixable from the client. The other two have no
  source: `GET /api/users/me` returns the account and the membership, and
  neither carries a class placement or a NISN. `StudentProfile.nisn` is a real
  column in the schema, but nothing serves it yet, and `ClassMembership` — which
  is what places a student in a class — is not in the response either.

  So those rows render **empty**, and say so. An invented value that reads as
  fact is worse than a blank: somebody would have quoted it.

  Same for the XP bar. There is no Xp, Badge, Level, Point or Streak model
  anywhere in `schema.prisma` — the whole idea is a design that no backend work
  currently planned would produce. The slot stays so the intent is visible; the
  numbers do not.
*/

/** What a field looks like when the database has nothing to put in it. */
const Empty = () => {
  const { t } = useT();
  return (
    <span className="text-slate-300 font-medium" title={t('profile.empty')}>
      —
    </span>
  );
};

const initialsOf = (fullName) => {
  if (!fullName) return '—';
  return fullName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

export const ProfileHeader = () => {
  const { user, membership, activeRole } = useAuth();
  const { t } = useT();

  const schoolName = membership?.school?.name ?? membership?.schoolName ?? null;
  const roleKey = activeRole ? ROLE_LABEL_KEY[activeRole] : null;

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 select-none hover:shadow-md transition-shadow duration-200 text-left">

      <div className="flex items-center gap-4 min-w-0">
        <div className="w-16 h-16 rounded-full bg-violet-100 text-brand flex items-center justify-center font-extrabold text-xl shadow-inner shrink-0 border-2 border-white ring-4 ring-violet-50">
          {initialsOf(user?.fullName)}
        </div>

        <div className="space-y-1 min-w-0">
          {/* Real, from /users/me. */}
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight truncate">
            {user?.fullName || <Empty />}
          </h1>
          <p className="text-xs font-semibold text-slate-500 truncate" title={user?.email}>
            {user?.email || <Empty />}
          </p>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {schoolName && (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-extrabold rounded-md">
                {schoolName}
              </span>
            )}
            {roleKey && (
              <span className="px-2 py-0.5 bg-brand-tint text-brand text-[10px] font-extrabold rounded-md">
                {t(roleKey)}
              </span>
            )}
          </div>

          {/* No endpoint reports either of these yet — see the note above. */}
          <div className="flex items-center gap-4 pt-1 text-[11px] font-semibold text-slate-400">
            <span>
              {t('profile.class')}: <Empty />
            </span>
            <span>
              {t('profile.nisn')}: <Empty />
            </span>
          </div>
        </div>
      </div>

      <div className="w-full md:w-80 lg:w-96 space-y-2.5 shrink-0">
        <div className="flex items-center justify-between text-xs font-extrabold text-slate-800">
          <div className="flex items-center gap-1.5">
            <Award className="w-4 h-4 text-slate-300 shrink-0" aria-hidden="true" />
            <span className="text-slate-400">
              {t('profile.xp')}: <Empty />
            </span>
          </div>
          <span className="text-slate-400">
            {t('profile.level')} <Empty />
          </span>
        </div>

        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40" />
      </div>
    </div>
  );
};

export default ProfileHeader;
