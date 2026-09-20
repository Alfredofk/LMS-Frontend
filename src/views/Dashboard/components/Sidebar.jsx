import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { ROLES, ROLE_HOME } from '../../../constants/roles';
import BrandMark from '../../../components/ui/BrandMark';
import LanguageSwitch from '../../../components/ui/LanguageSwitch';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { useT } from '../../../i18n/LanguageContext';
import {
  LayoutGrid,
  BookOpen,
  Award,
  MessageSquare,
  Calendar,
  ClipboardList,
  CalendarCheck,
  Megaphone,
  User,
  Users,
  GraduationCap,
  Repeat,
  LogOut
} from 'lucide-react';

/* Outside the component: a lookup table, not state. */
const ROLE_TITLE_KEY = {
  [ROLES.TEACHER]: 'roleTitle.TEACHER',
  [ROLES.PRINCIPAL]: 'roleTitle.PRINCIPAL',
  [ROLES.STUDENT]: 'roleTitle.STUDENT',
  [ROLES.GUARDIAN]: 'roleTitle.GUARDIAN',
};

export const Sidebar = ({ showToast, userRole }) => {
  const { user, membership, roles, activeRole, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useT();

  /*
    The role somebody is working as, not the only one they hold. Somebody may
    hold several — a teacher whose own child attends the same school holds
    TEACHER and GUARDIAN on one membership — and this sidebar shows one at a time.
  */
  const role = userRole || activeRole || ROLES.STUDENT;
  const dashboardPath = ROLE_HOME[role] ?? '/dashboard';
  const [isHomeroomTeacher, setIsHomeroomTeacher] = useState(false);
  const [isLogOutOpen, setIsLogOutOpen] = useState(false);

  useEffect(() => {
    if (role === ROLES.TEACHER) {
      const checkHomeroom = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch('/api/homeroom/class', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setIsHomeroomTeacher(data.isHomeroomTeacher);
          }
        } catch (err) {
          console.error('Error checking homeroom status:', err);
        }
      };
      checkHomeroom();
    }
  }, [role]);

  const handleLinkClick = (labelKey, routePath) => {
    if (routePath) {
      navigate(routePath);
    } else {
      if (showToast) {
        showToast(t('shell.underConstruction', { feature: t(labelKey) }), 'info');
      }
    }
  };

  const isActive = (routePath) => {
    if (routePath === '/classroom') {
      return location.pathname.startsWith('/classroom');
    }
    return location.pathname === routePath;
  };

  // Get Initials dynamically
  const getInitials = () => {
    // 'AR' were Andi Rahmat's initials — the last of the sample person.
    if (!user?.fullName) return '—';
    return user.fullName
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  /*
    Only what the backend actually sends. The NIP, NISN, NPSN and class name this
    card used to show came from fields no endpoint returns — they were sample
    text that read as fact. A person's own school comes from their membership;
    their name and address come from their account.
  */
  const schoolName = membership?.school?.name ?? membership?.schoolName ?? t('shell.noSchool');
  const roleTitle = ROLE_TITLE_KEY[role] ? t(ROLE_TITLE_KEY[role]) : t('roleTitle.fallback');

  const activeBtnClass = "w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl bg-brand text-white shadow-md shadow-brand/20 select-none cursor-pointer transition-all";
  const inactiveBtnClass = "w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl text-slate-700 hover:text-brand hover:bg-purple-50/50 select-none cursor-pointer group transition-all";

  /* The identity card is a link to /profile, except while you are on /profile —
     then there is nowhere to go, so it renders as a plain div. */
  const onProfile = isActive('/profile');
  const ProfileCardTag = onProfile ? 'div' : 'button';

  return (
    <aside className="w-64 bg-white border-r border-slate-100 flex flex-col h-full select-none shrink-0 text-slate-800">

      {/* Scrolls. The account group below does not — see the footer. */}
      <div className="flex flex-col flex-1 overflow-y-auto min-h-0">
        
        {/* Brand/School Logo Header */}
        <div className="p-5 border-b border-slate-50 flex items-center gap-3 select-none">
          <BrandMark size="md" tone="solid" />
          <div className="text-left min-w-0">
            <div className="text-sm font-extrabold tracking-tight leading-none text-slate-900">
              EduForID
            </div>
            <div className="text-[10px] font-semibold text-slate-400 truncate mt-0.5" title={schoolName}>
              {schoolName}
            </div>
          </div>
        </div>

        {/*
          Who is signed in, and a way to their profile.

          It already looked like a control — it carried `group` and a hover
          border while doing nothing — and an avatar card in a sidebar corner is
          somewhere people try to click whether or not it responds. So it is a
          real `<button>` now, with a cursor, a hover state and a focus ring,
          because a card that is secretly clickable is worse than one that is
          not: nobody finds it, and whoever does is surprised.

          `My Profile` stays in the menu below. It is the only entry with an
          active state, so it is what tells you which page you are on — this card
          cannot carry that without competing with its own job of showing
          identity.

          On /profile itself there is nowhere to go, so it renders as a plain
          div: same shape, no cursor, no focus stop. Same idiom as StatCard.
        */}
        <ProfileCardTag
          type={onProfile ? undefined : 'button'}
          onClick={onProfile ? undefined : () => handleLinkClick('shell.myProfile', '/profile')}
          /* The content alone would read as "Siti Rahma, siti@…, Siswa" and
             never say where it goes, so the label names the destination too. */
          aria-label={onProfile ? undefined : `${user?.fullName ?? ''} — ${t('shell.myProfile')}`}
          className={`w-full p-3.5 mx-3 mt-4 mb-2 flex items-center gap-3 bg-white border rounded-2xl min-w-0 shadow-sm text-left transition-all ${
            onProfile
              ? 'border-brand/40'
              : 'border-slate-100 hover:border-brand/40 hover:shadow-md cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand'
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-brand-tint text-brand flex items-center justify-center font-extrabold text-xs shrink-0 shadow-inner">
            {getInitials()}
          </div>
          <div className="text-left min-w-0 flex-1">
            <h4 className="text-xs font-extrabold text-slate-900 leading-tight truncate" title={user?.fullName}>
              {user?.fullName || t('shell.account.fallback')}
            </h4>
            <p className="text-[10px] font-medium text-slate-400 mt-0.5 truncate" title={user?.email}>
              {user?.email}
            </p>
            <div className="mt-1 px-2 py-0.5 bg-brand-tint text-brand text-[9px] font-bold rounded-full inline-block">
              {roleTitle}
            </div>
          </div>
        </ProfileCardTag>

        {/* Navigation Listings */}
        <div className="px-3 py-3 space-y-4 text-left flex-1">

          {/* Main Menu group */}
          <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold text-slate-400 tracking-wider block select-none">
              {t('shell.mainMenu')}
            </span>
            <nav className="space-y-0.5">
              <button
                onClick={() => handleLinkClick('shell.dashboard', dashboardPath)}
                className={isActive(dashboardPath) ? activeBtnClass : inactiveBtnClass}
              >
                <LayoutGrid className={`w-4 h-4 shrink-0 transition-colors ${isActive(dashboardPath) ? 'text-white' : 'text-brand'}`} />
                {t('shell.dashboard')}
              </button>

              {role !== ROLES.PRINCIPAL && (
                <button
                  onClick={() => handleLinkClick('shell.myCourses', role === ROLES.TEACHER ? '/teacher/courses' : '/classroom')}
                  className={isActive(role === ROLES.TEACHER ? '/teacher/courses' : '/classroom') ? activeBtnClass : inactiveBtnClass}
                >
                  <BookOpen className={`w-4 h-4 shrink-0 transition-colors ${isActive(role === ROLES.TEACHER ? '/teacher/courses' : '/classroom') ? 'text-white' : 'text-brand'}`} />
                  {t('shell.myCourses')}
                </button>
              )}

              {role === ROLES.TEACHER ? (
                <>
                  <button
                    onClick={() => handleLinkClick('shell.gradebook', '/teacher/gradebook')}
                    className={isActive('/teacher/gradebook') ? activeBtnClass : inactiveBtnClass}
                  >
                    <GraduationCap className={`w-4 h-4 shrink-0 transition-colors ${isActive('/teacher/gradebook') ? 'text-white' : 'text-brand'}`} />
                    {t('shell.gradebook')}
                  </button>

                  <button
                    onClick={() => handleLinkClick('shell.schedule', '/schedule')}
                    className={isActive('/schedule') ? activeBtnClass : inactiveBtnClass}
                  >
                    <Calendar className={`w-4 h-4 shrink-0 transition-colors ${isActive('/schedule') ? 'text-white' : 'text-brand'}`} />
                    {t('shell.schedule')}
                  </button>

                  {isHomeroomTeacher && (
                    <button
                      onClick={() => handleLinkClick('shell.homeroom', '/teacher/homeroom')}
                      className={isActive('/teacher/homeroom') ? activeBtnClass : inactiveBtnClass}
                    >
                      <Users className={`w-4 h-4 shrink-0 transition-colors ${isActive('/teacher/homeroom') ? 'text-white' : 'text-brand'}`} />
                      {t('shell.homeroom')}
                    </button>
                  )}
                </>
              ) : role === ROLES.STUDENT ? (
                <>
                  <button
                    onClick={() => handleLinkClick('shell.scores', '/scores')}
                    className={isActive('/scores') ? activeBtnClass : inactiveBtnClass}
                  >
                    <Award className={`w-4 h-4 shrink-0 transition-colors ${isActive('/scores') ? 'text-white' : 'text-brand'}`} />
                    {t('shell.scores')}
                  </button>

                  <button
                    onClick={() => handleLinkClick('shell.chatbot')}
                    className={inactiveBtnClass}
                  >
                    <MessageSquare className="w-4 h-4 shrink-0 text-brand transition-colors" />
                    {t('shell.chatbot')}
                  </button>
                </>
              ) : null}
            </nav>
          </div>

          {/* Activities group - Only for students */}
          {role === ROLES.STUDENT && (
            <div className="space-y-1">
              <span className="px-3 text-[10px] font-bold text-slate-400 tracking-wider block select-none">
                {t('shell.activities')}
              </span>
              <nav className="space-y-0.5">
                <button
                  onClick={() => handleLinkClick('shell.schedule', '/schedule')}
                  className={isActive('/schedule') ? activeBtnClass : inactiveBtnClass}
                >
                  <Calendar className={`w-4 h-4 shrink-0 transition-colors ${isActive('/schedule') ? 'text-white' : 'text-brand'}`} />
                  {t('shell.schedule')}
                </button>
                <button
                  onClick={() => handleLinkClick('shell.assessment', '/assessment')}
                  className={isActive('/assessment') ? activeBtnClass : inactiveBtnClass}
                >
                  <ClipboardList className={`w-4 h-4 shrink-0 transition-colors ${isActive('/assessment') ? 'text-white' : 'text-brand'}`} />
                  {t('shell.assessment')}
                </button>
                <button
                  onClick={() => handleLinkClick('shell.attendance', '/attendance')}
                  className={isActive('/attendance') ? activeBtnClass : inactiveBtnClass}
                >
                  <CalendarCheck className={`w-4 h-4 shrink-0 transition-colors ${isActive('/attendance') ? 'text-white' : 'text-brand'}`} />
                  {t('shell.attendance')}
                </button>
                <button
                  onClick={() => handleLinkClick('shell.announcement', '/announcements')}
                  className={isActive('/announcements') ? activeBtnClass : inactiveBtnClass}
                >
                  <Megaphone className={`w-4 h-4 shrink-0 transition-colors ${isActive('/announcements') ? 'text-white' : 'text-brand'}`} />
                  {t('shell.announcement')}
                </button>
              </nav>
            </div>
          )}

        </div>
      </div>

      {/*
        Pinned, not scrolled. Log Out used to live at the end of a scrolling
        column, so scrolling up took it off screen — and the decorative circle
        that used to sit here was painted *under* this text at 1.9:1 contrast,
        which is what made the group look covered. The circle is gone and this
        group no longer moves.
      */}
      <div className="shrink-0 border-t border-slate-100 px-3 py-3">
        <div className="space-y-1">
            <span className="px-3 text-[10px] font-bold text-slate-400 tracking-wider block select-none">
              {t('shell.account')}
            </span>
            <nav className="space-y-0.5">
              <button
                onClick={() => handleLinkClick('shell.myProfile', '/profile')}
                className={isActive('/profile') ? activeBtnClass : inactiveBtnClass}
              >
                <User className={`w-4 h-4 shrink-0 transition-colors ${isActive('/profile') ? 'text-white' : 'text-brand'}`} />
                {t('shell.myProfile')}
              </button>

              {/* Only somebody holding more than one role has anything to switch
                  between, and only then is the entry worth the space. */}
              {roles.length > 1 && (
                <button
                  onClick={() => handleLinkClick('shell.switchRole', '/select-role')}
                  className={inactiveBtnClass}
                >
                  <Repeat className="w-4 h-4 shrink-0 text-brand transition-colors" />
                  {t('shell.switchRole')}
                </button>
              )}
              <div className="px-3.5 py-2">
                <LanguageSwitch />
              </div>
              <button
                onClick={() => setIsLogOutOpen(true)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold rounded-xl text-slate-700 hover:text-rose-600 hover:bg-rose-50/50 select-none cursor-pointer group transition-all"
              >
                <LogOut className="w-4 h-4 shrink-0 text-brand group-hover:text-rose-500 transition-colors" />
                {t('shell.logOut')}
              </button>
          </nav>
        </div>
      </div>

      {/*
        No success toast after this resolves: clearing the session unmounts this
        layout — ProtectedRoute sends the now-signed-out person to /login — so
        anything shown at that point would vanish in the same frame.
      */}
      <ConfirmDialog
        open={isLogOutOpen}
        title={t('confirm.logOut.title')}
        body={t('confirm.logOut.body')}
        confirmLabel={t('shell.logOut')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setIsLogOutOpen(false)}
        onConfirm={logout}
      />

    </aside>
  );
};

export default Sidebar;
