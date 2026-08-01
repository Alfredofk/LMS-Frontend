import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Bell, 
  BookOpen, 
  Award, 
  MessageSquare, 
  Megaphone, 
  Check, 
  Trash2, 
  X 
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { classroomData } from '../../Classroom/classroomData';

export const Navbar = ({ showToast }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Notification States
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  
  const dropdownRef = useRef(null);
  const seenNotifIds = useRef(new Set());

  // Fetch Notifications
  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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

    fetchNotifications();

    // Poll every 10 seconds for real-time notifications
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [firstLoadDone]);

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
      const token = localStorage.getItem('token');
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
      const token = localStorage.getItem('token');
      const res = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
        if (showToast) showToast('Semua notifikasi ditandai sebagai terbaca.', 'success');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete notification
  const handleDeleteNotif = async (e, id) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('token');
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
        const token = localStorage.getItem('token');
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
      if (diffMins < 1) return 'Baru saja';
      if (diffMins < 60) return `${diffMins}m yang lalu`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}j yang lalu`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}h yang lalu`;
    } catch (e) {
      return '';
    }
  };

  // Get type icon
  const getNotifIcon = (type) => {
    switch (type) {
      case 'tugas_baru':
        return <BookOpen className="w-4 h-4 text-violet-500" />;
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
            <span className="font-extrabold">My Courses</span>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 select-none">
          <span className="hover:text-slate-655 transition-colors">My Courses</span>
          <span className="text-slate-300 text-[10px] font-bold">/</span>
          <span className="hover:text-slate-655 transition-colors">{course.className}</span>
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

      if (!activeAssignment) {
        activeAssignment = { title: 'Latihan Soal Limit Trigonometri' };
        activeCourse = { className: 'XII IPA 2', name: 'Matematika Lanjut' };
      }

      return (
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 select-none">
          <span className="hover:text-slate-655 transition-colors">My Courses</span>
          <span className="text-slate-300 text-[10px] font-bold">/</span>
          <span className="hover:text-slate-655 transition-colors">{activeCourse.className}</span>
          <span className="text-slate-300 text-[10px] font-bold">/</span>
          <span className="hover:text-slate-655 transition-colors">{activeCourse.name}</span>
          <span className="text-slate-300 text-[10px] font-bold">/</span>
          <span className="text-slate-800 font-extrabold">{activeAssignment.title}</span>
        </div>
      );
    }

    switch (location.pathname) {
      case '/dashboard':
        return <span className="text-base font-semibold text-slate-700">Dashboard</span>;
      case '/teacher/dashboard':
        return <span className="text-base font-semibold text-slate-700">Teacher Dashboard</span>;
      case '/teacher/gradebook':
        return <span className="text-base font-semibold text-slate-700">Gradebook</span>;
      case '/teacher/create-assignment':
        return <span className="text-base font-semibold text-slate-700">Create Assignment</span>;
      case '/profile':
        return <span className="text-base font-semibold text-slate-700">My Profile</span>;
      default:
        return <span className="text-base font-semibold text-slate-700">Dashboard</span>;
    }
  };

  // Get Initials dynamically
  const getInitials = () => {
    if (!user || !user.name) return 'US';
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <header className="h-16 border-b border-slate-100 bg-white flex items-center justify-between px-8 select-none shrink-0 relative">
      {/* Title */}
      <div className="tracking-tight">
        {getNavbarTitle()}
      </div>

      {/* Utilities */}
      <div className="flex items-center gap-4 relative">
        {/* Notification Bell Dropdown Container */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`p-2 rounded-xl transition-all relative cursor-pointer
              ${isDropdownOpen ? 'bg-violet-50 text-violet-650' : 'hover:bg-slate-50 text-slate-900 hover:text-violet-600'}
            `}
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            {/* Red indicator dot */}
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 px-1 min-w-4 h-4 rounded-full bg-red-500 border border-white text-white text-[8px] font-black flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown Panel Popover */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white border border-slate-100 rounded-2xl shadow-xl z-50 text-left py-2 flex flex-col focus:outline-none">
              
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-50">
                <h3 className="text-xs font-black text-slate-805 uppercase tracking-wider">Notifikasi</h3>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] font-extrabold text-[#7047EB] hover:text-[#5E3BD2] cursor-pointer"
                  >
                    Tandai semua terbaca
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-96 overflow-y-auto divide-y divide-slate-50">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-450 font-semibold text-xs">
                    Tidak ada notifikasi untuk Anda.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className={`flex items-start gap-3 p-4 hover:bg-slate-50/50 transition-colors cursor-pointer relative
                        ${!notif.isRead ? 'bg-[#F9F8FF]' : ''}
                      `}
                    >
                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${getNotifBg(notif.type)}`}>
                        {getNotifIcon(notif.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-6">
                        <p className={`text-[11px] leading-tight text-slate-805 truncate
                          ${!notif.isRead ? 'font-extrabold' : 'font-semibold'}
                        `}>
                          {notif.title}
                        </p>
                        <p className="text-[10px] text-slate-450 font-medium leading-relaxed mt-0.5 break-words">
                          {notif.message}
                        </p>
                        <span className="text-[9px] text-slate-400 font-bold block mt-1">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>

                      {/* Dot for unread */}
                      {!notif.isRead && (
                        <span className="absolute top-4 right-10 w-1.5 h-1.5 rounded-full bg-[#7047EB]" />
                      )}

                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteNotif(e, notif.id)}
                        className="absolute top-3 right-3 p-1 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-md transition-colors cursor-pointer"
                        title="Hapus"
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

        {/* Level Badge Indicator (Hidden for teachers) */}
        {user?.role !== 'teacher' && user?.role !== 'headmaster' && (
          <span className="px-2 py-0.5 bg-[#F1EEFF] text-[#7047EB] text-[10px] font-black rounded-md select-none tracking-wide">
            Lv. {user?.level || 1}
          </span>
        )}

        {/* Avatar block (navigates to Profile) */}
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="w-8 h-8 rounded-full bg-[#F1EEFF] text-[#7047EB] flex items-center justify-center font-extrabold text-xs shadow-inner select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        >
          {getInitials()}
        </button>
      </div>
    </header>
  );
};

export default Navbar;
