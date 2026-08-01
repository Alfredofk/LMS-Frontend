import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
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
  
  // Navigation active tab: 'dashboard', 'teachers', 'students', 'courses', 'announcements'
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Stats
  const [stats, setStats] = useState({ totalTeachers: 0, totalStudents: 0, totalCourses: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

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

  // 1. Fetch Overview Stats
  const fetchStats = async () => {
    try {
      setIsLoadingStats(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/headmaster/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
      setIsLoadingStats(false);
    } catch (err) {
      console.error(err);
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  // 2. Fetch lists based on active tab selection
  const fetchTabData = async () => {
    const token = localStorage.getItem('token');
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
      const token = localStorage.getItem('token');
      const response = await fetch('/api/headmaster/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(teacherForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menambahkan guru.');

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
    if (!window.confirm(`Apakah Anda yakin ingin menghapus akun guru "${name}"?`)) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/headmaster/teachers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menghapus guru.');

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
      const token = localStorage.getItem('token');
      const response = await fetch('/api/headmaster/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(studentForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menambahkan siswa.');

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
    if (!window.confirm(`Apakah Anda yakin ingin menghapus akun siswa "${name}"?`)) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/headmaster/students/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menghapus siswa.');

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
      const token = localStorage.getItem('token');
      const response = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(courseForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menambahkan mata pelajaran.');

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
    if (!window.confirm(`Apakah Anda yakin ingin menghapus mata pelajaran "${name}"?`)) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/courses/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menghapus mata pelajaran.');

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
      const token = localStorage.getItem('token');
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(announcementForm)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menerbitkan pengumuman.');

      showToast(data.message, 'success');
      setAnnouncementForm({ title: '', content: '' });
      setIsAnnouncementModalOpen(false);
      fetchTabData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteAnnouncement = async (id, title) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus pengumuman "${title}"?`)) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal menghapus pengumuman.');

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
        <span className="px-2.5 py-1 bg-purple-100 text-[#7047EB] text-xs font-black rounded-lg uppercase">
          Dasbor Administrator
        </span>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight mt-2">
          Sistem Tata Kelola Sekolah
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          Daftarkan akun staf pengajar, siswa, dan atur pemetaan kelas serta mata pelajaran akademik sekolah secara digital.
        </p>
      </div>

      {/* 2. Navigation tabs row */}
      <div className="border-b border-slate-100 flex gap-6 select-none">
        {[
          { id: 'dashboard', label: 'Dasbor Utama', icon: School },
          { id: 'teachers', label: 'Kelola Guru', icon: Users },
          { id: 'students', label: 'Kelola Siswa', icon: GraduationCap },
          { id: 'courses', label: 'Kelola Kelas & Pelajaran', icon: BookOpen },
          { id: 'announcements', label: 'Kelola Pengumuman', icon: Megaphone }
        ].map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-black transition-all flex items-center gap-2 border-b-2 focus:outline-none cursor-pointer
                ${isActive 
                  ? 'border-[#7047EB] text-[#7047EB]' 
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 select-none">
              <div 
                onClick={() => setActiveTab('teachers')} 
                className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Staf Guru</p>
                  <p className="text-3xl font-black text-slate-805 mt-1">{stats.totalTeachers}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-650 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('students')} 
                className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Siswa Terdaftar</p>
                  <p className="text-3xl font-black text-slate-805 mt-1">{stats.totalStudents}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-650 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6" />
                </div>
              </div>

              <div 
                onClick={() => setActiveTab('courses')} 
                className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all cursor-pointer flex items-center justify-between"
              >
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mata Pelajaran Aktif</p>
                  <p className="text-3xl font-black text-slate-805 mt-1">{stats.totalCourses}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-650 flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-6 select-none flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-[#7047EB] text-2xl font-black shrink-0 shadow-sm">
                🏢
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-805">Panduan Pengelolaan Multi-Tenant SaaS</h4>
                <p className="text-xs text-slate-450 font-semibold mt-1 leading-relaxed">
                  Sebagai Kepala Sekolah (Tenant Administrator), Anda bertanggung jawab untuk mendaftarkan akun guru dan murid sekolah Anda. Setelah didaftarkan, silakan tambahkan Kelas & Mata Pelajaran baru dan tunjuk guru yang bersangkutan untuk mengaktifkan kelas virtual.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Manage Teachers */}
        {activeTab === 'teachers' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center select-none">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Daftar Tenaga Pendidik</h3>
              <button 
                onClick={() => setIsTeacherModalOpen(true)}
                className="px-4 py-2 bg-[#7047EB] hover:bg-[#5b35d5] text-white text-xs font-black rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                Tambah Guru Baru
              </button>
            </div>

            {isLoadingList ? (
              <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse"></div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-x-auto">
                <table className="w-full text-xs font-medium text-slate-650">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-left">
                      <th className="pb-3 font-black text-[10px] uppercase">Nama Lengkap</th>
                      <th className="pb-3 font-black text-[10px] uppercase">NIP</th>
                      <th className="pb-3 font-black text-[10px] uppercase">Email</th>
                      <th className="pb-3 font-black text-[10px] uppercase">Username</th>
                      <th className="pb-3 text-right font-black text-[10px] uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {teachers.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                        <td className="py-3.5 font-extrabold text-slate-805">{row.name}</td>
                        <td className="py-3.5 text-slate-500 font-bold">{row.nip}</td>
                        <td className="py-3.5 text-slate-500 font-semibold">{row.email}</td>
                        <td className="py-3.5 text-slate-450 font-bold">{row.username}</td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteTeacher(row.id, row.name)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Akun"
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
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Daftar Siswa Terdaftar</h3>
              <button 
                onClick={() => setIsStudentModalOpen(true)}
                className="px-4 py-2 bg-[#7047EB] hover:bg-[#5b35d5] text-white text-xs font-black rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <UserPlus className="w-4 h-4" />
                Tambah Siswa Baru
              </button>
            </div>

            {isLoadingList ? (
              <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse"></div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-x-auto">
                <table className="w-full text-xs font-medium text-slate-650">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-left">
                      <th className="pb-3 font-black text-[10px] uppercase">Nama Lengkap</th>
                      <th className="pb-3 font-black text-[10px] uppercase">NIS</th>
                      <th className="pb-3 font-black text-[10px] uppercase">Email</th>
                      <th className="pb-3 font-black text-[10px] uppercase">Level / XP</th>
                      <th className="pb-3 text-right font-black text-[10px] uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {students.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                        <td className="py-3.5 font-extrabold text-slate-805">{row.name}</td>
                        <td className="py-3.5 text-slate-500 font-bold">{row.nis}</td>
                        <td className="py-3.5 text-slate-500 font-semibold">{row.email}</td>
                        <td className="py-3.5 text-slate-450 font-bold">
                          Lvl {row.level} <span className="text-[10px] font-bold text-slate-400">({row.xp} XP)</span>
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteStudent(row.id, row.name)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Akun"
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
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Pemetaan Mata Pelajaran</h3>
              <button 
                onClick={() => setIsCourseModalOpen(true)}
                className="px-4 py-2 bg-[#7047EB] hover:bg-[#5b35d5] text-white text-xs font-black rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                Tambah Kelas Pelajaran
              </button>
            </div>

            {isLoadingList ? (
              <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse"></div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-x-auto">
                <table className="w-full text-xs font-medium text-slate-650">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-left">
                      <th className="pb-3 font-black text-[10px] uppercase">Kode Mapel</th>
                      <th className="pb-3 font-black text-[10px] uppercase">Nama Pelajaran</th>
                      <th className="pb-3 font-black text-[10px] uppercase">Tingkat Kelas</th>
                      <th className="pb-3 font-black text-[10px] uppercase">Guru Pengampu</th>
                      <th className="pb-3 text-right font-black text-[10px] uppercase">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {courses.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                        <td className="py-3.5 text-slate-500 font-bold">{row.code}</td>
                        <td className="py-3.5 font-extrabold text-slate-805">{row.name}</td>
                        <td className="py-3.5">
                          <span className="px-2 py-0.5 rounded bg-purple-50 text-[#7047EB] text-[10px] font-black">
                            {row.grade_level || 'Umum'}
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-500 font-semibold">
                          {teachers.find(t => t.id === row.teacher_id)?.name || 'Belum Ditugaskan'}
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => handleDeleteCourse(row.id, row.name)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Mapel"
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
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">Daftar Pengumuman Sekolah</h3>
              <button 
                onClick={() => setIsAnnouncementModalOpen(true)}
                className="px-4 py-2 bg-[#7047EB] hover:bg-[#5b35d5] text-white text-xs font-black rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Tambah Pengumuman
              </button>
            </div>

            {isLoadingList ? (
              <div className="h-40 bg-white border border-slate-100 rounded-2xl animate-pulse"></div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm overflow-x-auto">
                {announcements.length === 0 ? (
                  <p className="text-xs text-slate-400 font-bold italic py-4 text-center">Belum ada pengumuman sekolah terbit.</p>
                ) : (
                  <table className="w-full text-xs font-medium text-slate-650">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-extrabold text-left">
                        <th className="pb-3 font-black text-[10px] uppercase">Judul Pengumuman</th>
                        <th className="pb-3 font-black text-[10px] uppercase">Isi Pengumuman</th>
                        <th className="pb-3 font-black text-[10px] uppercase">Penerbit</th>
                        <th className="pb-3 font-black text-[10px] uppercase">Tanggal Terbit</th>
                        <th className="pb-3 text-right font-black text-[10px] uppercase">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {announcements.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/20 transition-colors">
                          <td className="py-3.5 font-extrabold text-slate-850 pr-4">{row.title}</td>
                          <td className="py-3.5 text-slate-500 font-semibold max-w-sm truncate pr-4">{row.content}</td>
                          <td className="py-3.5 text-slate-500 font-bold">{row.author_name || 'Kepala Sekolah'}</td>
                          <td className="py-3.5 text-slate-450 font-bold">
                            {new Date(row.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              onClick={() => handleDeleteAnnouncement(row.id, row.title)}
                              className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              title="Hapus Pengumuman"
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
              <h3 className="text-sm font-black text-slate-805">Tambah Akun Guru Baru</h3>
              <button type="button" onClick={() => setIsTeacherModalOpen(false)} className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nama Lengkap Guru</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso, S.Pd."
                  value={teacherForm.name}
                  onChange={(e) => setTeacherForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#7047EB] transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nomor Induk Pegawai (NIP)</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 197805122003122002"
                  value={teacherForm.nip}
                  onChange={(e) => setTeacherForm(prev => ({ ...prev, nip: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#7047EB] transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Email Dinas</label>
                <input
                  type="email"
                  required
                  placeholder="Contoh: budi.guru@sekolah.sch.id"
                  value={teacherForm.email}
                  onChange={(e) => setTeacherForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#7047EB] transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Password Akun</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimal 6 karakter"
                  value={teacherForm.password}
                  onChange={(e) => setTeacherForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#7047EB] transition-colors"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-2 select-none">
              <button type="button" onClick={() => setIsTeacherModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer">Batal</button>
              <button type="submit" className="px-5 py-2 bg-[#7047EB] hover:bg-[#5b35d5] text-white text-xs font-black rounded-xl cursor-pointer">Daftarkan Guru</button>
            </div>
          </form>
        </div>
      )}

      {/* --- STUDENT CREATION MODAL DIALOG --- */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateStudent} className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center select-none">
              <h3 className="text-sm font-black text-slate-805">Tambah Akun Siswa Baru</h3>
              <button type="button" onClick={() => setIsStudentModalOpen(false)} className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Alfredo"
                  value={studentForm.name}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#7047EB] transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nomor Induk Siswa (NIS)</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: NIS-10029"
                  value={studentForm.nis}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, nis: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#7047EB] transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Email Siswa</label>
                <input
                  type="email"
                  required
                  placeholder="Contoh: alfredo.siswa@sekolah.sch.id"
                  value={studentForm.email}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#7047EB] transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Password Akun</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimal 6 karakter"
                  value={studentForm.password}
                  onChange={(e) => setStudentForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#7047EB] transition-colors"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-2 select-none">
              <button type="button" onClick={() => setIsStudentModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer">Batal</button>
              <button type="submit" className="px-5 py-2 bg-[#7047EB] hover:bg-[#5b35d5] text-white text-xs font-black rounded-xl cursor-pointer">Daftarkan Siswa</button>
            </div>
          </form>
        </div>
      )}

      {/* --- COURSE CREATION MODAL DIALOG --- */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateCourse} className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center select-none">
              <h3 className="text-sm font-black text-slate-805">Tambah Kelas & Pelajaran</h3>
              <button type="button" onClick={() => setIsCourseModalOpen(false)} className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Kode Mata Pelajaran</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: MAT-XII-L"
                  value={courseForm.code}
                  onChange={(e) => setCourseForm(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#7047EB] transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nama Mata Pelajaran</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Matematika Lanjut"
                  value={courseForm.name}
                  onChange={(e) => setCourseForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#7047EB] transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tingkat Kelas</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: XII IPA 2"
                  value={courseForm.grade_level}
                  onChange={(e) => setCourseForm(prev => ({ ...prev, grade_level: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#7047EB] transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Guru Pengampu</label>
                <select
                  required
                  value={courseForm.teacher_id}
                  onChange={(e) => setCourseForm(prev => ({ ...prev, teacher_id: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#7047EB] transition-colors bg-white cursor-pointer"
                >
                  <option value="">-- Pilih Guru --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name} (NIP {t.nip})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-2 select-none">
              <button type="button" onClick={() => setIsCourseModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer">Batal</button>
              <button type="submit" className="px-5 py-2 bg-[#7047EB] hover:bg-[#5b35d5] text-white text-xs font-black rounded-xl cursor-pointer">Buat Kelas Pelajaran</button>
            </div>
          </form>
        </div>
      )}

      {/* --- ANNOUNCEMENT CREATION MODAL DIALOG --- */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreateAnnouncement} className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center select-none">
              <h3 className="text-sm font-black text-slate-855">Terbitkan Pengumuman Sekolah</h3>
              <button type="button" onClick={() => setIsAnnouncementModalOpen(false)} className="p-1 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Judul Pengumuman</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Jadwal Ujian Akhir Semester"
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#7047EB] transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Isi Pengumuman / Maklumat</label>
                <textarea
                  required
                  rows="5"
                  placeholder="Tuliskan maklumat pengumuman di sini..."
                  value={announcementForm.content}
                  onChange={(e) => setAnnouncementForm(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-[#7047EB] transition-colors resize-none"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex justify-end gap-2 select-none">
              <button type="button" onClick={() => setIsAnnouncementModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-lg cursor-pointer">Batal</button>
              <button type="submit" className="px-5 py-2 bg-[#7047EB] hover:bg-[#5b35d5] text-white text-xs font-black rounded-xl cursor-pointer">Terbitkan Pengumuman</button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default HeadmasterDashboard;
