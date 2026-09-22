import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { 
  Bell, 
  BookOpen, 
  Award, 
  MessageSquare, 
  Megaphone, 
  Check, 
  Trash2, 
  X,
  Search,
  ChevronLeft,
  Menu
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { classroomData } from '../../Classroom/classroomData';
import { useT } from '../../../i18n/LanguageContext';
import { getAccessToken } from '../../../services/apiClient';

/*
  What the bar says on each route, and whether it carries a back arrow.

  A table rather than a switch: the two "with a back arrow" cases were the same
  twelve lines written twice, and every route added since was quietly forgotten.
  A route missing from here is a route that claims to be the dashboard, so add
  the entry when you add the route.

  `back` is for the screens somebody reaches from a dashboard card and wants a
  way out of. The role dashboards themselves have nowhere to go back to.
*/
const TITLES = {
  '/dashboard': { key: 'shell.dashboard' },
  '/classroom': { key: 'shell.myCourses', back: true },
  '/scores': { key: 'shell.scores', back: true },
  '/schedule': { key: 'shell.schedule', back: true },
  '/assessment': { key: 'shell.assessment', back: true },
  '/attendance': { key: 'shell.attendance', back: true },
  '/announcements': { key: 'shell.announcement', back: true },
  '/profile': { key: 'shell.myProfile' },
  /* No `back`: the button that flag renders goes to /dashboard, hardcoded, which
     is the wrong dashboard for a teacher and a principal. This page is reached
     from the sidebar, which is still on screen. */
  '/account': { key: 'account.title' },

  '/teacher/dashboard': { key: 'shell.title.teacherDashboard' },
  '/teacher/courses': { key: 'shell.myCourses' },
  '/teacher/gradebook': { key: 'shell.gradebook' },
  '/teacher/homeroom': { key: 'shell.homeroom' },
  '/teacher/create-assignment': { key: 'shell.title.createAssignment', back: true },

  '/headmaster/dashboard': { key: 'shell.title.principalDashboard' },
};

export const Navbar = ({ showToast, onOpenNav }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useT();

  // Notification States
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  /*
    /api/notifications does not exist yet, and a poll that asks a 404 six times
    a minute is not harmless here. The backend logs every request into a file
    under its own src/, and its dev script is `node --watch src/server.js` —
    so each of those requests restarts the server somebody else is working on.

    The first 404 stops the poll. The day the module lands the first call
    succeeds instead, this never turns true, and nothing here behaves
    differently.
  */
  const [notificationsNotBuilt, setNotificationsNotBuilt] = useState(false);
  
  const dropdownRef = useRef(null);
  const seenNotifIds = useRef(new Set());

  // Fetch Notifications
  const fetchNotifications = async () => {
    try {
      const token = getAccessToken();
      if (!token) return;

      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      /* Not a failed request — a module that is not there. Same distinction
         `isNotBuiltYet` draws in services/apiClient.js, read off the raw
         response because this call does not go through it yet. */
      if (res.status === 404) {
        setNotificationsNotBuilt(true);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        
        // Calculate unread count
        const unreads = data.filter(n => !n.isRead);
        setUnreadCount(unreads.length);

        if (!firstLoadDone) {
          // Initialize seen list so we don't trigger alerts for old unread tasks
          data.forEach(n => seenNotifIds.current.add(n.id));
          setFirstLoadDone(true);
        } else {
          // Trigger system popup for any brand new notification
          const newUnreads = unreads.filter(n => !seenNotifIds.current.has(n.id));
          if (newUnreads.length > 0) {
            newUnreads.forEach(n => {
              seenNotifIds.current.add(n.id);
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(n.title, {
                  body: n.message,
                  icon: '/favicon.svg'
                });
              }
            });
          }
        }
      }
    } catch (err) {
      console.error('Fetch Notifications Error:', err);
    }
  };

  // Setup Notification Permission & Polling
  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    /* Asking for permission still happens above: that is about this browser,
       not about whether the endpoint exists. */
    if (notificationsNotBuilt) return undefined;

    fetchNotifications();

    // Poll every 10 seconds for real-time notifications
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [firstLoadDone, notificationsNotBuilt]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Mark single notification as read
  const handleMarkAsRead = async (e, notif) => {
    e.stopPropagation();
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/notifications/${notif.id}/read`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        // Update local state
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      const token = getAccessToken();
      const res = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
        if (showToast) showToast(t('shell.allMarkedRead'), 'success');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete notification
  const handleDeleteNotif = async (e, id) => {
    e.stopPropagation();
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        // Recalculate unread count
        const wasUnread = notifications.find(n => n.id === id && !n.isRead);
        if (wasUnread) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle notification redirect
  const handleNotifClick = async (notif) => {
    setIsDropdownOpen(false);
    
    // Mark as read first if unread
    if (!notif.isRead) {
      try {
        const token = getAccessToken();
        await fetch(`/api/notifications/${notif.id}/read`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error(err);
      }
    }

    // Redirect to linkPath
    if (notif.type === 'pengumuman') {
      navigate('/announcements');
    } else if (notif.linkPath) {
      navigate(notif.linkPath);
    }
  };

  // Relative Time Formatter
  const formatTimeAgo = (dateStr) => {
    try {
      const diffMs = new Date() - new Date(dateStr);
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return t('shell.time.justNow');
      if (diffMins < 60) return t('shell.time.minutes', { n: diffMins });
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return t('shell.time.hours', { n: diffHours });
      const diffDays = Math.floor(diffHours / 24);
      return t('shell.time.days', { n: diffDays });
    } catch (e) {
      return '';
    }
  };

  // Get type icon
  const getNotifIcon = (type) => {
    switch (type) {
      case 'tugas_baru':
        return <BookOpen className="w-4 h-4 text-brand" />;
      case 'nilai_masuk':
        return <Award className="w-4 h-4 text-emerald-500" />;
      case 'sanggahan_selesai':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'pengumuman':
        return <Megaphone className="w-4 h-4 text-pink-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const getNotifBg = (type) => {
    switch (type) {
      case 'tugas_baru':
        return 'bg-violet-50';
      case 'nilai_masuk':
        return 'bg-emerald-50';
      case 'sanggahan_selesai':
        return 'bg-blue-50';
      case 'pengumuman':
        return 'bg-pink-50';
      default:
        return 'bg-slate-50';
    }
  };

  // Get dynamic title based on active location pathname
  const getNavbarTitle = () => {
    if (location.pathname.startsWith('/classroom/')) {
      const courseId = location.pathname.split('/').pop();
      const course = classroomData.find(c => c.id === courseId) || classroomData[0];
      
      if (!course) {
        return (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 select-none">
            <span className="font-extrabold">{t('shell.myCourses')}</span>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 select-none">
          <span className="hover:text-slate-600 transition-colors">{t('shell.myCourses')}</span>
          <span className="text-slate-300 text-[10px] font-bold">/</span>
          <span className="hover:text-slate-600 transition-colors">{course.className}</span>
          <span className="text-slate-300 text-[10px] font-bold">/</span>
          <span className="text-slate-800 font-extrabold">{course.name}</span>
        </div>
      );
    }

    if (location.pathname.startsWith('/assignment/')) {
      const targetId = location.pathname.split('/').pop();
      let activeAssignment = null;
      let activeCourse = null;
      
      for (const course of classroomData) {
        for (const section of course.sections) {
          const found = section.assignments.find(a => a.id === targetId);
          if (found) {
            activeAssignment = found;
            activeCourse = course;
            break;
          }
        }
        if (activeAssignment) break;
      }

      /*
        Nothing found used to mean inventing something: a title, a class and a
        subject, all written out in full and rendered as fact in the shell. And
        because `classroomData` is empty, that was the only branch that ever
        ran — so every visit to /assignment/:id put three lies in the chrome,
        unmarked, unlike the dashboard which at least says its data is sample.
        One of them, "XII IPA 2", also broke the IPA/IPS ban in the backend's
        own glossary.

        A breadcrumb that does not know where it is should say so by saying
        less.
      */
      if (!activeAssignment) {
        return (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 select-none">
            <span>{t('shell.myCourses')}</span>
            <span className="text-slate-300 text-[10px] font-bold">/</span>
            <span className="text-slate-800 font-extrabold">{t('shell.title.assignment')}</span>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 select-none">
          <span className="hover:text-slate-600 transition-colors">{t('shell.myCourses')}</span>
          <span className="text-slate-300 text-[10px] font-bold">/</span>
          <span className="hover:text-slate-600 transition-colors">{activeCourse.className}</span>
          <span className="text-slate-300 text-[10px] font-bold">/</span>
          <span className="hover:text-slate-600 transition-colors">{activeCourse.name}</span>
          <span className="text-slate-300 text-[10px] font-bold">/</span>
          <span className="text-slate-800 font-extrabold">{activeAssignment.title}</span>
        </div>
      );
    }

    const entry = TITLES[location.pathname];

    /*
      Falling back to the dashboard's title is only right for a route that has
      no title of its own. It used to be right for seven real routes as well,
      because they were simply missing from the list — so /attendance announced
      itself as "Dashboard" while the sidebar highlighted Attendance.
    */
    if (!entry) {
      return <span className="text-lg font-bold text-slate-900">{t('shell.dashboard')}</span>;
    }

    if (!entry.back) {
      return <span className="text-lg font-bold text-slate-900">{t(entry.key)}</span>;
    }

    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-all cursor-pointer shadow-sm"
          title={t('shell.backToDashboard')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xl font-bold text-slate-900 tracking-tight">{t(entry.key)}</span>
      </div>
    );
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
    The bell beside this one has always said what it does; this said nothing at
    all — no aria-label and no title — so a screen reader announced it as "SR,
    button", and somebody looking at it had no way to learn that a circle of
    initials leads anywhere. Same wording as the sidebar's profile card, minus
    the dangling dash that one produces when there is no name to put in front
    of it.
  */
  const profileLabel = user?.fullName
    ? `${user.fullName} — ${t('shell.myProfile')}`
    : t('shell.myProfile');

  return (
    /* px-8 spent 64px of a 375px phone on padding alone. */
    <header className="h-16 border-b border-slate-100 bg-white flex items-center justify-between gap-3 px-4 sm:px-6 md:px-8 select-none shrink-0 relative z-20">
      {/* Title, and below `md` the only way to reach the menu */}
      <div className="tracking-tight flex items-center gap-1.5 min-w-0">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label={t('shell.openMenu')}
          className="md:hidden -ml-1 p-2 rounded-xl text-slate-700 hover:bg-slate-50 hover:text-brand transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand shrink-0"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
        {/* min-w-0 + truncate: a long breadcrumb used to push the bell and the
            avatar off the right edge instead of shortening itself. */}
        <div className="min-w-0 truncate">{getNavbarTitle()}</div>
      </div>

      {/* Middle Search Bar for My Courses & Scores */}
      {(location.pathname === '/classroom' || location.pathname === '/scores') && (
        <div className="flex-1 max-w-sm mx-6 hidden md:block">
          <div className="relative">
            <Search className="w-4 h-4 text-brand absolute left-3.5 top-1/2 -translate-y-1/2" />
            {/* aria-label as well as the placeholder: a placeholder is not an
                accessible name, and it disappears on focus. Same pairing the two
                other search boxes in this app already use. */}
            <input
              type="text"
              value={searchParams.get('q') || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSearchParams(val ? { q: val } : {});
              }}
              placeholder={t('shell.search')}
              aria-label={t('shell.search')}
              className="w-full bg-brand-tint text-slate-800 text-xs font-medium pl-10 pr-4 py-2 rounded-full focus:outline-none focus:ring-1 focus:ring-brand placeholder:text-slate-400 transition-all"
            />
          </div>
        </div>
      )}

      {/* Utilities */}
      <div className="flex items-center gap-3 relative">
        {/* Notification Bell Dropdown Container */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`p-2 rounded-xl transition-all relative cursor-pointer
              ${isDropdownOpen ? 'bg-violet-50 text-brand' : 'hover:bg-slate-50 text-slate-700 hover:text-brand'}
            `}
            aria-label={t('shell.viewNotifications')}
          >
            <Bell className="w-5 h-5" />
            {/* Red indicator dot if unread notifications exist */}
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </button>

          {/* Dropdown Panel Popover */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 text-left py-2 flex flex-col focus:outline-none">
              
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-50">
                <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">{t('shell.notifications')}</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] font-extrabold text-brand hover:text-brand-deep cursor-pointer"
                  >
                    {t('shell.markAllRead')}
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 font-semibold text-xs">
                    {t('shell.noNotifications')}
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={`flex items-start gap-3 p-4 hover:bg-slate-50/50 transition-colors cursor-pointer relative
                        ${!notif.isRead ? 'bg-brand-tint/40' : ''}
                      `}
                    >
                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${getNotifBg(notif.type)}`}>
                        {getNotifIcon(notif.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-6">
                        <p className={`text-[11px] leading-tight text-slate-800 truncate
                          ${!notif.isRead ? 'font-extrabold' : 'font-semibold'}
                        `}>
                          {notif.title}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-0.5 break-words">
                          {notif.message}
                        </p>
                        <span className="text-[9px] text-slate-400 font-bold block mt-1">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>

                      {/* Dot for unread */}
                      {!notif.isRead && (
                        <span className="absolute top-4 right-10 w-1.5 h-1.5 rounded-full bg-brand" />
                      )}

                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteNotif(e, notif.id)}
                        className="absolute top-3 right-3 p-1 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-md transition-colors cursor-pointer"
                        title={t('shell.delete')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}
        </div>

        {/* Avatar block (navigates to Profile) */}
        <button
          type="button"
          onClick={() => navigate('/profile')}
          aria-label={profileLabel}
          /* Not only for screen readers: the tooltip is what answers "can I
             press this, and where does it go" without pressing it first. */
          title={profileLabel}
          className="w-8 h-8 rounded-full bg-brand-tint text-brand flex items-center justify-center font-bold text-xs shadow-inner select-none cursor-pointer focus:outline-none hover:ring-2 hover:ring-purple-200 transition-all"
        >
          {getInitials()}
        </button>
      </div>
    </header>
  );
};

export default Navbar;
