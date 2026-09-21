import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useT } from '../../i18n/LanguageContext';
import { isNotBuiltYet } from '../../services/apiClient';
import { headmasterService } from '../../services/headmasterService';
import { buildSampleHeadmasterData } from './sampleHeadmasterData';
import { SampleDataBanner } from './components/SampleDataNotice';
import { getAccessToken } from '../../services/apiClient';
import {
  Users, 
  GraduationCap, 
  BookOpen, 
  Plus, 
  Trash2, 
  UserPlus, 
  School,
  X,
  PlusCircle,
  Megaphone
} from 'lucide-react';

export const HeadmasterDashboard = () => {
  const { showToast } = useOutletContext();
  const { t, lang } = useT();
  
  // Navigation active tab: 'dashboard', 'teachers', 'students', 'courses', 'announcements'
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Stats
  const [stats, setStats] = useState({ totalTeachers: 0, totalStudents: 0, totalCourses: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isSampleStats, setIsSampleStats] = useState(false);

  // Lists
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  
  // Loading states
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Modals Open/Close States
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);

  // Modal Form Inputs
  const [teacherForm, setTeacherForm] = useState({ name: '', email: '', password: '', nip: '' });
  const [studentForm, setStudentForm] = useState({ name: '', email: '', password: '', nis: '' });
  const [courseForm, setCourseForm] = useState({ code: '', name: '', description: '', grade_level: '', teacher_id: '' });
  const [announcementForm, setAnnouncementForm] = useState({ title: '', content: '' });

  /*
    1. Overview stats.

    This used to swallow its failure and leave the three cards showing the zeros
    they were initialised with — so a 404 read as **0 teachers, 0 students,
    0 subjects**, which is a confident statement about the school rather than an
    admission that nothing was asked. Worse than an error message.

    A 404 means the route is not written yet (the backend mounts four
    namespaces; this is not one of them), so the cards show labelled sample
    numbers. Any other failure keeps the old quiet behaviour, because the four
    management tabs below still handle their own errors the old way and one
    screen should not have two personalities.

    All three numbers are countable from tables that already exist, so this is
    among the cheapest endpoints for the backend to deliver.
  */
  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      setStats(await headmasterService.stats());
      setIsSampleStats(false);
    } catch (err) {
      if (isNotBuiltYet(err)) {
        setStats(buildSampleHeadmasterData().stats);
        setIsSampleStats(true);
      } else {
        console.error(err);
      }
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // 2. Fetch lists based on active tab selection
  const fetchTabData = async () => {
    const token = getAccessToken();
    setIsLoadingList(true);
    try {
      if (activeTab === 'teachers') {
        const res = await fetch('/api/headmaster/teachers', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setTeachers(await res.json());
      } else if (activeTab === 'students') {
        const res = await fetch('/api/headmaster/students', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setStudents(await res.json());
      } else if (activeTab === 'courses') {
        // Fetch courses list
        const resCourses = await fetch('/api/courses', { headers: { 'Authorization': `Bearer ${token}` } });
        if (resCourses.ok) setCourses(await resCourses.json());

        // Also fetch teachers list for the teacher selector in Create Course modal
        const resTeachers = await fetch('/api/headmaster/teachers', { headers: { 'Authorization': `Bearer ${token}` } });
        if (resTeachers.ok) setTeachers(await resTeachers.json());
      } else if (activeTab === 'announcements') {
        const res = await fetch('/api/announcements', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setAnnouncements(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'dashboard') {
      fetchTabData();
    }
  }, [activeTab]);

  // --- TEACHER CRUD HANDLERS ---
  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    try {
      const token = getAccessToken();
      const response = await fetch('/api/headmaster/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(teacherForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('principal.teachers.addFailed'));

      showToast(data.message, 'success');
      setTeacherForm({ name: '', email: '', password: '', nip: '' });
      setIsTeacherModalOpen(false);
      fetchStats();
      fetchTabData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteTeacher = async (id, name) => {
    if (!window.confirm(t('principal.teachers.confirmDelete', { name }))) return;
    try {
      const token = getAccessToken();
      const response = await fetch(`/api/headmaster/teachers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('principal.teachers.deleteFailed'));

      showToast(data.message, 'success');
      fetchStats();
      fetchTabData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // --- STUDENT CRUD HANDLERS ---
  const handleCreateStudent = async (e) => {
    e.preventDefault();
    try {
      const token = getAccessToken();
      const response = await fetch('/api/headmaster/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(studentForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('principal.students.addFailed'));

      showToast(data.message, 'success');
      setStudentForm({ name: '', email: '', password: '', nis: '' });
      setIsStudentModalOpen(false);
      fetchStats();
      fetchTabData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteStudent = async (id, name) => {
    if (!window.confirm(t('principal.students.confirmDelete', { name }))) return;
    try {
      const token = getAccessToken();
      const response = await fetch(`/api/headmaster/students/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('principal.students.deleteFailed'));

      showToast(data.message, 'success');
      fetchStats();
      fetchTabData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // --- COURSE CRUD HANDLERS ---
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    try {
      const token = getAccessToken();
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(courseForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('principal.courses.addFailed'));

      showToast(data.message, 'success');
      setCourseForm({ code: '', name: '', description: '', grade_level: '', teacher_id: '' });
      setIsCourseModalOpen(false);
      fetchStats();
      fetchTabData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteCourse = async (id, name) => {
    if (!window.confirm(t('principal.courses.confirmDelete', { name }))) return;
    try {
      const token = getAccessToken();
      const response = await fetch(`/api/courses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('principal.courses.deleteFailed'));

      showToast(data.message, 'success');
      fetchStats();
      fetchTabData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // --- ANNOUNCEMENT CRUD HANDLERS ---
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const token = getAccessToken();
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(announcementForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('principal.ann.addFailed'));

      showToast(data.message, 'success');
      setAnnouncementForm({ title: '', content: '' });
      setIsAnnouncementModalOpen(false);
      fetchTabData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteAnnouncement = async (id, title) => {
    if (!window.confirm(t('principal.ann.confirmDelete', { name: title }))) return;
    try {
      const token = getAccessToken();
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('principal.ann.deleteFailed'));

      showToast(data.message, 'success');
      fetchTabData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="space-y-6 w-full text-left">
      
      {/* 1. Header welcome */}
      <div className="space-y-1 select-none">
        <span className="px-2.5 py-1 bg-purple-100 text-brand text-xs font-extrabold rounded-lg uppercase">
          {t('dash.principal.badge')}
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight mt-2">
          {t('dash.principal.title')}
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          {t('dash.principal.subtitle')}
        </p>
      </div>

      {/* 2. Navigation tabs row */}
      {/*
        The five tabs need 778px. A 375px phone gives this row 343px, so two of
        them sat past the right edge, and reaching them meant dragging the whole
        page sideways: <main> is overflow-y-auto, and CSS resolves the other axis
        to auto with it, so the heading and every card slid along with the tabs.
        Now only the strip moves.

        Scrolling rather than wrapping: the bar stays one line, which is what the
        active underline reads against. On desktop the row is 960px for 778px of
        tabs, so nothing overflows and nothing scrolls — measured identical after
        the change, down to each tab's x position.
      */}
      <div className="border-b border-slate-100 flex gap-6 select-none overflow-x-auto">
        {[
          { id: 'dashboard', label: t('dash.principal.tab.dashboard'), icon: School },
          { id: 'teachers', label: t('dash.principal.tab.teachers'), icon: Users },
          { id: 'students', label: t('dash.principal.tab.students'), icon: GraduationCap },
          { id: 'courses', label: t('dash.principal.tab.courses'), icon: BookOpen },
          { id: 'announcements', label: t('dash.principal.tab.announcements'), icon: Megaphone }
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-extrabold transition-all flex items-center gap-2 border-b-2 focus:outline-none cursor-pointer shrink-0 whitespace-nowrap
                ${isActive 
                  ? 'border-brand text-brand' 
                  : 'border-transparent text-slate-400 hover:text-slate-600'
                }
              `}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. Render content based on active tab */}
      <div className="pt-2">

        {/* Tab 1: Dashboard overview */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {isSampleStats && <SampleDataBanner />}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 select-none">
              <div 
                onClick={() => setActiveTab('teachers')} 
                className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('dash.principal.stat.teachers')}</p>
                  <p className="text-3xl font-extrabold text-slate-800 mt-1">{stats.totalTeachers}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-brand flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('students')} 
                className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('dash.principal.stat.students')}</p>
                  <p className="text-3xl font-extrabold text-slate-800 mt-1">{stats.totalStudents}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6" />
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('courses')} 
                className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('dash.principal.stat.courses')}</p>
                  <p className="text-3xl font-extrabold text-slate-800 mt-1">{stats.totalCourses}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 select-none flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-brand text-2xl font-extrabold shrink-0 shadow-sm">
                🏢
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-800">{t('dash.principal.guide.title')}</h4>
                <p className="text-xs text-slate-400 font-semibold mt-1 leading-relaxed">
                  {t('dash.principal.guide.body')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Manage Teachers */}
        {activeTab === 'teachers' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center select-none">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.teachers.title')}</h3>
              <button 
                onClick={() => setIsTeacherModalOpen(true)}
                className="px-4 py-2 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                {t('principal.teachers.add')}
              </button>
            </div>

            {isLoadingList ? (
              <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse"></div>
            ) : (
              /*
                The wrapper has always had `overflow-x-auto`, but a `w-full` table
                can never overflow it — so on a phone these five columns squeezed
                instead of scrolling, and nothing ever scrolled at all.

                `min-w-max` rather than a fixed `min-w-[Nrem]` because there is
                nothing yet to measure: every one of these tables is empty, the
                endpoints behind them still 404, and the column widths that will
                matter belong to names, emails and NIPs nobody has seen. A number
                picked today would be a guess about that data. Content width is
                not a guess, and it will still be right when the rows arrive.

                Desktop is untouched: max-content is 242-345px against 911px of
                room, so `w-full` still wins and the table stays 911px wide.
              */
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-x-auto">
                <table className="w-full min-w-max text-xs font-medium text-slate-600">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-left">
                      <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.th.fullName')}</th>
                      <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.teachers.th.nip')}</th>
                      <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.th.email')}</th>
                      <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.teachers.th.username')}</th>
                      <th className="pb-3 text-right font-extrabold text-[10px] uppercase">{t('principal.th.action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {teachers.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                        <td className="py-3.5 font-extrabold text-slate-800">{row.name}</td>
                        <td className="py-3.5 text-slate-500 font-bold">{row.nip}</td>
                        <td className="py-3.5 text-slate-500 font-semibold">{row.email}</td>
                        <td className="py-3.5 text-slate-400 font-bold">{row.username}</td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteTeacher(row.id, row.name)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            title={t('principal.teachers.delete')}
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Manage Students */}
        {activeTab === 'students' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center select-none">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.students.title')}</h3>
              <button 
                onClick={() => setIsStudentModalOpen(true)}
                className="px-4 py-2 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                {t('principal.students.add')}
              </button>
            </div>

            {isLoadingList ? (
              <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse"></div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-x-auto">
                <table className="w-full min-w-max text-xs font-medium text-slate-600">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-left">
                      <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.th.fullName')}</th>
                      <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.students.th.nis')}</th>
                      <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.th.email')}</th>
                      <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.students.th.level')}</th>
                      <th className="pb-3 text-right font-extrabold text-[10px] uppercase">{t('principal.th.action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {students.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                        <td className="py-3.5 font-extrabold text-slate-800">{row.name}</td>
                        <td className="py-3.5 text-slate-500 font-bold">{row.nis}</td>
                        <td className="py-3.5 text-slate-500 font-semibold">{row.email}</td>
                        <td className="py-3.5 text-slate-400 font-bold">
                          Lvl {row.level} <span className="text-[10px] font-bold text-slate-400">({row.xp} XP)</span>
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteStudent(row.id, row.name)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            title={t('principal.students.delete')}
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Manage Classes & Courses */}
        {activeTab === 'courses' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center select-none">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.courses.title')}</h3>
              <button 
                onClick={() => setIsCourseModalOpen(true)}
                className="px-4 py-2 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                {t('principal.courses.add')}
              </button>
            </div>

            {isLoadingList ? (
              <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse"></div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-x-auto">
                <table className="w-full min-w-max text-xs font-medium text-slate-600">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-left">
                      <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.courses.th.code')}</th>
                      <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.courses.th.name')}</th>
                      <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.courses.th.grade')}</th>
                      <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.courses.th.teacher')}</th>
                      <th className="pb-3 text-right font-extrabold text-[10px] uppercase">{t('principal.th.action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {courses.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                        <td className="py-3.5 text-slate-500 font-bold">{row.code}</td>
                        <td className="py-3.5 font-extrabold text-slate-800">{row.name}</td>
                        <td className="py-3.5">
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-brand text-[10px] font-extrabold">
                            {row.grade_level || t('principal.courses.noGrade')}
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-500 font-semibold">
                          {teachers.find((guru) => guru.id === row.teacher_id)?.name || t('principal.courses.noTeacher')}
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteCourse(row.id, row.name)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            title={t('principal.courses.delete')}
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {/* Tab 5: Manage Announcements */}
        {activeTab === 'announcements' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center select-none">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.ann.title')}</h3>
              <button 
                onClick={() => setIsAnnouncementModalOpen(true)}
                className="px-4 py-2 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                {t('principal.ann.add')}
              </button>
            </div>

            {isLoadingList ? (
              <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse"></div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-x-auto">
                {announcements.length === 0 ? (
                  <p className="text-xs text-slate-400 font-bold italic py-4 text-center">{t('principal.ann.empty')}</p>
                ) : (
                  <table className="w-full min-w-max text-xs font-medium text-slate-600">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-left">
                        <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.ann.th.title')}</th>
                        <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.ann.th.content')}</th>
                        <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.ann.th.author')}</th>
                        <th className="pb-3 font-extrabold text-[10px] uppercase">{t('principal.ann.th.date')}</th>
                        <th className="pb-3 text-right font-extrabold text-[10px] uppercase">{t('principal.th.action')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {announcements.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                          <td className="py-3.5 font-extrabold text-slate-900 pr-4">{row.title}</td>
                          <td className="py-3.5 text-slate-500 font-semibold max-w-sm truncate pr-4">{row.content}</td>
                          <td className="py-3.5 text-slate-500 font-bold">{row.author_name || t('principal.ann.defaultAuthor')}</td>
                          <td className="py-3.5 text-slate-400 font-bold">
                            {new Date(row.created_at).toLocaleDateString(lang === 'en' ? 'en-GB' : 'id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              onClick={() => handleDeleteAnnouncement(row.id, row.title)}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              title={t('principal.ann.delete')}
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* --- TEACHER CREATION MODAL DIALOG --- */}
      {isTeacherModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateTeacher} className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center select-none">
              <h3 className="text-sm font-extrabold text-slate-800">{t('principal.modal.teacher.title')}</h3>
              <button type="button" onClick={() => setIsTeacherModalOpen(false)} className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.modal.teacher.name')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('principal.modal.teacher.name.hint')}
                  value={teacherForm.name}
                  onChange={(e) => setTeacherForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.modal.teacher.nip')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('principal.modal.teacher.nip.hint')}
                  value={teacherForm.nip}
                  onChange={(e) => setTeacherForm(prev => ({ ...prev, nip: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.modal.teacher.email')}</label>
                <input
                  type="email"
                  required
                  placeholder={t('principal.modal.teacher.email.hint')}
                  value={teacherForm.email}
                  onChange={(e) => setTeacherForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.modal.password')}</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder={t('principal.modal.password.hint')}
                  value={teacherForm.password}
                  onChange={(e) => setTeacherForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-2 select-none">
              <button type="button" onClick={() => setIsTeacherModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer">{t('principal.common.cancel')}</button>
              <button type="submit" className="px-5 py-2 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold rounded-xl cursor-pointer">{t('principal.modal.teacher.submit')}</button>
            </div>
          </form>
        </div>
      )}

      {/* --- STUDENT CREATION MODAL DIALOG --- */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateStudent} className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center select-none">
              <h3 className="text-sm font-extrabold text-slate-800">{t('principal.modal.student.title')}</h3>
              <button type="button" onClick={() => setIsStudentModalOpen(false)} className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.modal.student.name')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('principal.modal.student.name.hint')}
                  value={studentForm.name}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.modal.student.nis')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('principal.modal.student.nis.hint')}
                  value={studentForm.nis}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, nis: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.modal.student.email')}</label>
                <input
                  type="email"
                  required
                  placeholder={t('principal.modal.student.email.hint')}
                  value={studentForm.email}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.modal.password')}</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder={t('principal.modal.password.hint')}
                  value={studentForm.password}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-2 select-none">
              <button type="button" onClick={() => setIsStudentModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer">{t('principal.common.cancel')}</button>
              <button type="submit" className="px-5 py-2 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold rounded-xl cursor-pointer">{t('principal.modal.student.submit')}</button>
            </div>
          </form>
        </div>
      )}

      {/* --- COURSE CREATION MODAL DIALOG --- */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateCourse} className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center select-none">
              <h3 className="text-sm font-extrabold text-slate-800">{t('principal.modal.course.title')}</h3>
              <button type="button" onClick={() => setIsCourseModalOpen(false)} className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.modal.course.code')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('principal.modal.course.code.hint')}
                  value={courseForm.code}
                  onChange={(e) => setCourseForm(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.modal.course.name')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('principal.modal.course.name.hint')}
                  value={courseForm.name}
                  onChange={(e) => setCourseForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.modal.course.grade')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('principal.modal.course.grade.hint')}
                  value={courseForm.grade_level}
                  onChange={(e) => setCourseForm(prev => ({ ...prev, grade_level: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.modal.course.teacher')}</label>
                <select
                  required
                  value={courseForm.teacher_id}
                  onChange={(e) => setCourseForm(prev => ({ ...prev, teacher_id: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors bg-white cursor-pointer"
                >
                  <option value="">{t('principal.modal.course.teacher.none')}</option>
                  {teachers.map((guru) => (
                    <option key={guru.id} value={guru.id}>{guru.name} (NIP {guru.nip})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-2 select-none">
              <button type="button" onClick={() => setIsCourseModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer">{t('principal.common.cancel')}</button>
              <button type="submit" className="px-5 py-2 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold rounded-xl cursor-pointer">{t('principal.modal.course.submit')}</button>
            </div>
          </form>
        </div>
      )}

      {/* --- ANNOUNCEMENT CREATION MODAL DIALOG --- */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateAnnouncement} className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center select-none">
              <h3 className="text-sm font-extrabold text-slate-900">{t('principal.modal.ann.title')}</h3>
              <button type="button" onClick={() => setIsAnnouncementModalOpen(false)} className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.modal.ann.heading')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('principal.modal.ann.heading.hint')}
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('principal.modal.ann.body')}</label>
                <textarea
                  required
                  rows="5"
                  placeholder={t('principal.modal.ann.body.hint')}
                  value={announcementForm.content}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-brand transition-colors resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-2 select-none">
              <button type="button" onClick={() => setIsAnnouncementModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer">{t('principal.common.cancel')}</button>
              <button type="submit" className="px-5 py-2 bg-brand hover:bg-brand-deep text-white text-xs font-extrabold rounded-xl cursor-pointer">{t('principal.modal.ann.submit')}</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default HeadmasterDashboard;
